import { BodyDimensions } from './bodyDetection'
import { SegmentationResult } from './bodySegmentation'

export interface GarmentAdjustments {
  scaleX: number
  scaleY: number
  rotation: number
  offsetX: number
  offsetY: number
  opacity: number
  shadowBlur: number
  shadowOffsetY: number
  brightness: number
  contrast: number
}

export interface RenderOptions {
  bodyImageUrl: string
  garmentImageUrl: string
  garmentType: string
  bodyDimensions: BodyDimensions
  segmentation?: SegmentationResult | null
  adjustments?: Partial<GarmentAdjustments>
  canvasWidth?: number
  canvasHeight?: number
}

const DEFAULTS: GarmentAdjustments = {
  scaleX: 1, scaleY: 1, rotation: 0,
  offsetX: 0, offsetY: 0, opacity: 0.95,
  shadowBlur: 18, shadowOffsetY: 6,
  brightness: 1.0, contrast: 1.0,
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src || src === 'undefined' || src === 'null') {
      reject(new Error('URL de imagen inválida')); return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src.slice(0, 60)}`))
    img.src = src
  })
}

export function calcGarmentTransform(
  bodyDims: BodyDimensions,
  garmentType: string
): { x: number; y: number; scaleX: number; scaleY: number; rotation: number } {
  const { shoulderWidth, hipWidth, waistWidth, torsoHeight, legLength, bodyCenterX, bodyCenterY, waistY, torsoAngle } = bodyDims
  const t = garmentType.toLowerCase()
  const torsoTop = bodyCenterY - torsoHeight * 0.5
  const aWaist = waistY || (torsoTop + torsoHeight * 0.55)
  let sx = 1, sy = 1, x = bodyCenterX, y = bodyCenterY, rot = torsoAngle * 0.65
  if (t === 'top' || t === 'blouse' || t === 'shirt' || t === 't-shirt' || t === 'camiseta' || t === 'blusa') {
    sx = (shoulderWidth * 1.22) / 200
    sy = (torsoHeight * 1.22) / 200
    y = torsoTop + torsoHeight * 0.53
    rot = torsoAngle * 0.7
  } else if (t === 'bottom' || t === 'pants' || t === 'jeans' || t === 'shorts' || t === 'pantalón' || t === 'falda' || t === 'skirt') {
    sx = Math.max(hipWidth, waistWidth) * 1.18 / 200
    sy = Math.max(legLength * 0.98, torsoHeight * 1.4) / 200
    y = aWaist + legLength * 0.22
    rot = torsoAngle * 0.3
  } else if (t === 'dress' || t === 'vestido') {
    sx = Math.max(shoulderWidth, hipWidth) * 1.22 / 200
    sy = (torsoHeight + legLength * 0.88) / 200
    y = torsoTop + (torsoHeight + legLength * 0.88) * 0.47
    rot = torsoAngle * 0.65
  } else if (t === 'outerwear' || t === 'jacket' || t === 'coat' || t === 'chaqueta' || t === 'abrigo') {
    sx = (shoulderWidth * 1.28) / 200
    sy = (torsoHeight * 1.35) / 200
    y = torsoTop + torsoHeight * 0.53
    rot = torsoAngle * 0.7
  } else if (t === 'shoes' || t === 'zapatos' || t === 'sneakers' || t === 'zapato') {
    sx = (shoulderWidth * 0.34) / 200
    sy = (shoulderWidth * 0.17) / 200
    y = bodyDims.imageHeight - 55
    rot = 0
  } else if (t === 'accessories' || t === 'accesorios' || t === 'bag' || t === 'bolso') {
    sx = (shoulderWidth * 0.44) / 200
    sy = (shoulderWidth * 0.44) / 200
    x = bodyCenterX + shoulderWidth * 0.82
    y = bodyCenterY + torsoHeight * 0.28
    rot = torsoAngle * 0.2
  } else {
    sx = (shoulderWidth * 1.2) / 200
    sy = (torsoHeight * 1.0) / 200
  }
  return { x, y, scaleX: sx, scaleY: sy, rotation: rot }
}

function estimateLighting(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sx = Math.floor(w * 0.1), sy = Math.floor(h * 0.15)
  const sw = Math.max(1, Math.floor(w * 0.8)), sh = Math.max(1, Math.floor(h * 0.7))
  const d = ctx.getImageData(sx, sy, sw, sh).data
  let sum = 0, sumSq = 0, n = 0
  const step = Math.max(12, Math.floor((sw * sh) / 3000))
  for (let i = 0; i < d.length; i += 4 * step) {
    const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    sum += l; sumSq += l * l; n++
  }
  const mean = n ? sum / n : 128
  const std = n ? Math.sqrt(Math.max((sumSq / n) - mean * mean, 0)) : 0
  return {
    brightness: clamp(1 + (mean - 128) / 600, 0.85, 1.15),
    contrast: clamp(1 + (80 - std) / 850, 0.92, 1.10),
    shadow: clamp(0.18 + (255 - mean) / 1100, 0.14, 0.36),
  }
}

export async function renderTryOn(options: RenderOptions): Promise<string> {
  const adj: GarmentAdjustments = { ...DEFAULTS, ...options.adjustments }
  const maxW = options.canvasWidth || 800
  const maxH = options.canvasHeight || 1000
  const [bodyImg, garmentImg] = await Promise.all([loadImg(options.bodyImageUrl), loadImg(options.garmentImageUrl)])
  let sc = 1
  let cw = bodyImg.naturalWidth, ch = bodyImg.naturalHeight
  if (cw > maxW || ch > maxH) {
    sc = Math.min(maxW / cw, maxH / ch, 1)
    cw = Math.round(cw * sc); ch = Math.round(ch * sc)
  }
  const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bodyImg, 0, 0, cw, ch)
  const light = estimateLighting(ctx, cw, ch)
  const sd: BodyDimensions = {
    ...options.bodyDimensions,
    shoulderWidth: options.bodyDimensions.shoulderWidth * sc,
    hipWidth: options.bodyDimensions.hipWidth * sc,
    waistWidth: options.bodyDimensions.waistWidth * sc,
    torsoHeight: options.bodyDimensions.torsoHeight * sc,
    legLength: options.bodyDimensions.legLength * sc,
    headHeight: options.bodyDimensions.headHeight * sc,
    bodyCenterX: options.bodyDimensions.bodyCenterX * sc,
    bodyCenterY: options.bodyDimensions.bodyCenterY * sc,
    waistY: options.bodyDimensions.waistY * sc,
    torsoAngle: options.bodyDimensions.torsoAngle,
    imageWidth: cw, imageHeight: ch,
  }
  const auto = calcGarmentTransform(sd, options.garmentType)
  const tx = auto.x + adj.offsetX
  const ty = auto.y + adj.offsetY
  const fsx = auto.scaleX * adj.scaleX
  const fsy = auto.scaleY * adj.scaleY
  const rw = garmentImg.naturalWidth * fsx
  const rh = garmentImg.naturalHeight * fsy
  ctx.save()
  ctx.shadowColor = `rgba(0,0,0,${clamp(light.shadow * 0.75, 0.10, 0.32)})`
  ctx.shadowBlur = adj.shadowBlur * sc * 0.9
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = adj.shadowOffsetY * sc * 0.8
  ctx.translate(tx, ty)
  ctx.rotate((auto.rotation + adj.rotation) * Math.PI / 180)
  ctx.globalAlpha = adj.opacity
  ctx.filter = `brightness(${clamp(adj.brightness * light.brightness, 0.82, 1.25)}) contrast(${clamp(adj.contrast * light.contrast, 0.88, 1.15)}) saturate(0.96)`
  ctx.drawImage(garmentImg, -rw / 2, -rh / 2, rw, rh)
  ctx.restore()
  return canvas.toDataURL('image/png')
}

export async function renderTryOnPreview(bodyImageUrl: string, garmentImageUrl: string, garmentType: string, bodyDims: BodyDimensions, adjustments?: Partial<GarmentAdjustments>): Promise<string> {
  return renderTryOn({ bodyImageUrl, garmentImageUrl, garmentType, bodyDimensions: bodyDims, adjustments, canvasWidth: 400, canvasHeight: 500 })
}

export async function renderWithSegmentation(bodyImageUrl: string, garmentUrl: string, garmentType: string, bodyDims: BodyDimensions, segmentation: SegmentationResult, adjustments?: Partial<GarmentAdjustments>): Promise<string> {
  const r = await renderTryOn({ bodyImageUrl, garmentImageUrl: garmentUrl, garmentType, bodyDimensions: bodyDims, segmentation, adjustments })
  return r
}

export { calcGarmentTransform as calculateGarmentTransform }
