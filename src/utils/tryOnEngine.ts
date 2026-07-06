import { loadPoseDetector, detectPose, type BodyDimensions, type DetectionResult } from './poseDetection'
import { segmentPerson, type SegmentationResult } from './bodySegmentationNew'

export type { BodyDimensions, DetectionResult, SegmentationResult }

export interface GarmentLayer {
  id: string
  garmentId: string
  name: string
  type: string
  processedUrl: string
  originalUrl: string
  zIndex: number
  visible: boolean
  adjustments: GarmentAdjustments
}

export interface GarmentAdjustments {
  scaleX: number
  scaleY: number
  rotation: number
  offsetX: number
  offsetY: number
  opacity: number
}

const DEFAULT_ADJ: GarmentAdjustments = {
  scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0, opacity: 1,
}

export function defaultAdjustments(): GarmentAdjustments {
  return { ...DEFAULT_ADJ }
}

export function defaultLayer(overrides: Partial<GarmentLayer> & Pick<GarmentLayer, 'id' | 'garmentId' | 'name' | 'type' | 'processedUrl' | 'originalUrl'>): GarmentLayer {
  return {
    zIndex: 0,
    visible: true,
    adjustments: defaultAdjustments(),
    ...overrides,
  }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

export async function detectBody(imageUrl: string): Promise<DetectionResult> {
  return detectPose(imageUrl)
}

export async function segmentBody(imageUrl: string): Promise<SegmentationResult> {
  return segmentPerson(imageUrl)
}

export async function preprocessGarment(imageUrl: string): Promise<string> {
  const { removeBackground } = await import('./garmentProcessor')
  return removeBackground(imageUrl)
}

function estimateGarmentPlacement(
  garmentType: string,
  bodyDims: BodyDimensions,
  garmentW: number,
  garmentH: number,
): { x: number; y: number; w: number; h: number; rotation: number } {
  const { shoulderWidth, hipWidth, torsoHeight, bodyCenterX, bodyCenterY, waistY, torsoAngle, imageWidth, imageHeight } = bodyDims

  const normX = bodyCenterX / imageWidth
  const normY = waistY / imageHeight

  let targetW: number
  let targetH: number
  let targetY: number

  const t = garmentType.toLowerCase()
  if (t.includes('dress') || t.includes('vestido')) {
    targetW = Math.max(shoulderWidth, hipWidth) * 1.3
    targetH = torsoHeight * 1.8
    targetY = bodyCenterY - torsoHeight * 0.25
  } else if (t.includes('bottom') || t.includes('pantal') || t.includes('falda') || t.includes('short')) {
    targetW = hipWidth * 1.4
    targetH = torsoHeight * 0.9
    targetY = waistY + torsoHeight * 0.05
  } else if (t.includes('outer') || t.includes('chaqueta') || t.includes('abrigo') || t.includes('saco')) {
    targetW = shoulderWidth * 1.5
    targetH = torsoHeight * 1.1
    targetY = bodyCenterY - torsoHeight * 0.3
  } else if (t.includes('shoe') || t.includes('zapat') || t.includes('bota')) {
    targetW = hipWidth * 0.4
    targetH = hipWidth * 0.35
    targetY = imageHeight * 0.92
  } else if (t.includes('accesorio') || t.includes('sombrero') || t.includes('gorra') || t.includes('bolso')) {
    targetW = shoulderWidth * 0.5
    targetH = shoulderWidth * 0.5
    targetY = bodyCenterY - torsoHeight * 0.55
  } else {
    targetW = shoulderWidth * 1.2
    targetH = torsoHeight * 0.65
    targetY = bodyCenterY - torsoHeight * 0.15
  }

  const ratio = targetW / garmentW
  const scaledW = garmentW * ratio
  const scaledH = garmentH * ratio

  return {
    x: normX * imageWidth - scaledW / 2,
    y: targetY - scaledH * 0.3,
    w: scaledW,
    h: scaledH,
    rotation: torsoAngle * 0.6,
  }
}

export async function renderComposite(
  bodyPhotoUrl: string,
  layers: GarmentLayer[],
  segmentation: SegmentationResult | null,
  bodyDims: BodyDimensions | null,
): Promise<string> {
  const bodyImg = await loadImg(bodyPhotoUrl)
  const cw = bodyImg.naturalWidth
  const ch = bodyImg.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(bodyImg, 0, 0, cw, ch)

  const visible = layers.filter(l => l.visible && l.processedUrl).sort((a, b) => a.zIndex - b.zIndex)

  if (visible.length === 0) return canvas.toDataURL('image/png')

  const garmentImgs = await Promise.allSettled(visible.map(l => loadImg(l.processedUrl)))

  if (segmentation && segmentation.maskCanvas) {
    const maskCanvas = segmentation.maskCanvas
    const invertedMask = document.createElement('canvas')
    invertedMask.width = cw
    invertedMask.height = ch
    const mctx = invertedMask.getContext('2d')!
    mctx.drawImage(maskCanvas, 0, 0, cw, ch)
    const maskData = mctx.getImageData(0, 0, cw, ch)
    const md = maskData.data
    for (let i = 3; i < md.length; i += 4) {
      md[i] = 255 - md[i]
    }
    mctx.putImageData(maskData, 0, 0)

    for (let i = 0; i < visible.length; i++) {
      const r = garmentImgs[i]
      if (r.status !== 'fulfilled') continue
      const gImg = r.value
      const layer = visible[i]
      const adj = layer.adjustments

      const placement = bodyDims
        ? estimateGarmentPlacement(layer.type, bodyDims, gImg.naturalWidth, gImg.naturalHeight)
        : { x: cw * 0.15, y: ch * 0.2, w: cw * 0.7, h: ch * 0.5, rotation: 0 }

      const gw = placement.w * adj.scaleX
      const gh = placement.h * adj.scaleY
      const gx = placement.x + adj.offsetX
      const gy = placement.y + adj.offsetY
      const cx = gx + gw / 2
      const cy = gy + gh / 2

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((adj.rotation + placement.rotation) * Math.PI / 180)
      ctx.globalAlpha = adj.opacity
      ctx.drawImage(gImg, -gw / 2, -gh / 2, gw, gh)
      ctx.restore()
    }

    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(maskCanvas, 0, 0, cw, ch)
    ctx.restore()

    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    ctx.drawImage(bodyImg, 0, 0, cw, ch)
    ctx.restore()
  } else {
    for (let i = 0; i < visible.length; i++) {
      const r = garmentImgs[i]
      if (r.status !== 'fulfilled') continue
      const gImg = r.value
      const layer = visible[i]
      const adj = layer.adjustments

      const placement = bodyDims
        ? estimateGarmentPlacement(layer.type, bodyDims, gImg.naturalWidth, gImg.naturalHeight)
        : { x: cw * 0.15, y: ch * 0.2, w: cw * 0.7, h: ch * 0.5, rotation: 0 }

      const gw = placement.w * adj.scaleX
      const gh = placement.h * adj.scaleY
      const gx = placement.x + adj.offsetX
      const gy = placement.y + adj.offsetY
      const cx = gx + gw / 2
      const cy = gy + gh / 2

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((adj.rotation + placement.rotation) * Math.PI / 180)
      ctx.globalAlpha = adj.opacity
      ctx.drawImage(gImg, -gw / 2, -gh / 2, gw, gh)
      ctx.restore()
    }
  }

  return canvas.toDataURL('image/png')
}

export function computeGarmentTransform(
  garmentType: string,
  bodyDims: BodyDimensions | null,
  garmentW: number,
  garmentH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number; w: number; h: number; rotation: number } {
  if (!bodyDims) {
    return { x: canvasW * 0.15, y: canvasH * 0.2, w: canvasW * 0.7, h: canvasH * 0.5, rotation: 0 }
  }
  return estimateGarmentPlacement(garmentType, bodyDims, garmentW, garmentH)
}
