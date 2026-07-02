import { BodyDimensions } from './bodyDetection'

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
  adjustments?: Partial<GarmentAdjustments>
  canvasWidth?: number
  canvasHeight?: number
}

const DEFAULT_ADJUSTMENTS: GarmentAdjustments = {
  scaleX: 1, scaleY: 1, rotation: 0,
  offsetX: 0, offsetY: 0, opacity: 0.95,
  shadowBlur: 18, shadowOffsetY: 6,
  brightness: 1.0, contrast: 1.0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src.substring(0, 50)}`))
    img.src = src
  })
}

export function calculateGarmentTransform(
  bodyDims: BodyDimensions,
  garmentType: string
): { x: number; y: number; scaleX: number; scaleY: number; rotation: number } {
  const { shoulderWidth, hipWidth, waistWidth, torsoHeight, legLength, bodyCenterX, bodyCenterY, waistY, torsoAngle, headHeight } = bodyDims

  const type = garmentType.toLowerCase()
  let scaleX = 1, scaleY = 1, x = bodyCenterX, y = bodyCenterY, rotation = torsoAngle * 0.65
  const torsoTopY = bodyCenterY - torsoHeight * 0.5
  const autoWaistY = waistY || (torsoTopY + torsoHeight * 0.55)

  if (type === 'top' || type === 'blouse' || type === 'shirt' || type === 't-shirt' || type === 'camiseta') {
    const baseWidth = shoulderWidth * 1.18
    const baseHeight = torsoHeight * 1.18
    scaleX = baseWidth / 200
    scaleY = baseHeight / 200
    x = bodyCenterX
    y = torsoTopY + torsoHeight * 0.55
    rotation = torsoAngle * 0.7
  } else if (type === 'bottom' || type === 'pants' || type === 'jeans' || type === 'shorts' || type === 'pantalón' || type === 'falda' || type === 'skirt') {
    const baseWidth = Math.max(hipWidth, waistWidth) * 1.15
    const baseHeight = Math.max(legLength * 0.98, torsoHeight * 1.35) * 1.0
    scaleX = baseWidth / 200
    scaleY = baseHeight / 200
    x = bodyCenterX
    y = autoWaistY + legLength * 0.24
    rotation = torsoAngle * 0.3
  } else if (type === 'dress' || type === 'vestido') {
    const baseWidth = Math.max(shoulderWidth, hipWidth) * 1.2
    const baseHeight = torsoHeight + legLength * 0.85
    scaleX = baseWidth / 200
    scaleY = baseHeight / 200
    x = bodyCenterX
    y = torsoTopY + baseHeight * 0.48
    rotation = torsoAngle * 0.65
  } else if (type === 'outerwear' || type === 'jacket' || type === 'coat' || type === 'chaqueta' || type === 'abrigo') {
    const baseWidth = shoulderWidth * 1.25
    const baseHeight = torsoHeight * 1.3
    scaleX = baseWidth / 200
    scaleY = baseHeight / 200
    x = bodyCenterX
    y = torsoTopY + torsoHeight * 0.55
    rotation = torsoAngle * 0.7
  } else if (type === 'shoes' || type === 'zapatos' || type === 'sneakers') {
    scaleX = shoulderWidth * 0.32 / 200
    scaleY = shoulderWidth * 0.16 / 200
    y = bodyDims.imageHeight - 50
    x = bodyCenterX
    rotation = 0
  } else if (type === 'accessories' || type === 'accesorios' || type === 'bag' || type === 'bolso') {
    scaleX = shoulderWidth * 0.42 / 200
    scaleY = shoulderWidth * 0.42 / 200
    x = bodyCenterX + shoulderWidth * 0.8
    y = bodyCenterY + torsoHeight * 0.3
    rotation = torsoAngle * 0.2
  } else {
    const baseWidth = shoulderWidth * 1.2
    const baseHeight = torsoHeight * 1.0
    scaleX = baseWidth / 200
    scaleY = baseHeight / 200
    x = bodyCenterX
    y = bodyCenterY
  }

  return { x, y, scaleX, scaleY, rotation }
}

function estimateLightingProfile(ctx: CanvasRenderingContext2D, width: number, height: number): { brightness: number; contrast: number; shadow: number; ambientR: number; ambientG: number; ambientB: number } {
  const sampleX = Math.floor(width * 0.1)
  const sampleY = Math.floor(height * 0.15)
  const sampleW = Math.max(1, Math.floor(width * 0.8))
  const sampleH = Math.max(1, Math.floor(height * 0.7))
  const sample = ctx.getImageData(sampleX, sampleY, sampleW, sampleH)
  const data = sample.data
  let sum = 0
  let sumSq = 0
  let sumR = 0, sumG = 0, sumB = 0
  let count = 0
  const step = Math.max(12, Math.floor((sampleW * sampleH) / 3000))
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const luminance = r * 0.299 + g * 0.587 + b * 0.114
    sum += luminance
    sumSq += luminance * luminance
    sumR += r; sumG += g; sumB += b
    count++
  }
  const mean = count ? sum / count : 128
  const variance = count ? (sumSq / count) - (mean * mean) : 0
  const std = Math.sqrt(Math.max(variance, 0))
  const brightness = clamp(1 + (mean - 128) / 620, 0.88, 1.12)
  const contrast = clamp(1 + (80 - std) / 900, 0.94, 1.08)
  const shadow = clamp(0.20 + (255 - mean) / 1200, 0.16, 0.34)
  const ambientR = count ? clamp(sumR / count / 128, 0.85, 1.15) : 1
  const ambientG = count ? clamp(sumG / count / 128, 0.85, 1.15) : 1
  const ambientB = count ? clamp(sumB / count / 128, 0.85, 1.15) : 1
  return { brightness, contrast, shadow, ambientR, ambientG, ambientB }
}

export async function renderTryOn(options: RenderOptions): Promise<string> {
  const adj: GarmentAdjustments = { ...DEFAULT_ADJUSTMENTS, ...options.adjustments }
  const maxW = options.canvasWidth || 800
  const maxH = options.canvasHeight || 1000

  const [bodyImg, garmentImg] = await Promise.all([
    loadImage(options.bodyImageUrl),
    loadImage(options.garmentImageUrl),
  ])

  let scale = 1
  let canvasW = bodyImg.naturalWidth
  let canvasH = bodyImg.naturalHeight
  if (canvasW > maxW || canvasH > maxH) {
    scale = Math.min(maxW / canvasW, maxH / canvasH, 1)
    canvasW = Math.round(canvasW * scale)
    canvasH = Math.round(canvasH * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bodyImg, 0, 0, canvasW, canvasH)
  const lighting = estimateLightingProfile(ctx, canvasW, canvasH)

  const scaledDims: BodyDimensions = {
    ...options.bodyDimensions,
    shoulderWidth: options.bodyDimensions.shoulderWidth * scale,
    hipWidth: options.bodyDimensions.hipWidth * scale,
    waistWidth: options.bodyDimensions.waistWidth * scale,
    torsoHeight: options.bodyDimensions.torsoHeight * scale,
    legLength: options.bodyDimensions.legLength * scale,
    headHeight: options.bodyDimensions.headHeight * scale,
    bodyCenterX: options.bodyDimensions.bodyCenterX * scale,
    bodyCenterY: options.bodyDimensions.bodyCenterY * scale,
    waistY: options.bodyDimensions.waistY * scale,
    torsoAngle: options.bodyDimensions.torsoAngle,
    imageWidth: canvasW,
    imageHeight: canvasH,
  }

  const auto = calculateGarmentTransform(scaledDims, options.garmentType)
  const targetX = auto.x + adj.offsetX
  const targetY = auto.y + adj.offsetY
  const finalScaleX = auto.scaleX * adj.scaleX
  const finalScaleY = auto.scaleY * adj.scaleY

  const gw = garmentImg.naturalWidth
  const gh = garmentImg.naturalHeight
  const renderW = gw * finalScaleX
  const renderH = gh * finalScaleY

  ctx.save()

  const shadowAlpha = clamp(lighting.shadow * 0.8, 0.12, 0.30)
  ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`
  ctx.shadowBlur = adj.shadowBlur * scale * 0.9
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = adj.shadowOffsetY * scale * 0.8

  const cx = targetX
  const cy = targetY
  ctx.translate(cx, cy)
  ctx.rotate((auto.rotation + adj.rotation) * Math.PI / 180)
  ctx.globalAlpha = adj.opacity

  const finalBrightness = clamp(adj.brightness * lighting.brightness, 0.85, 1.2)
  const finalContrast = clamp(adj.contrast * lighting.contrast, 0.9, 1.12)
  ctx.filter = `brightness(${finalBrightness}) contrast(${finalContrast}) saturate(0.97)`
  ctx.drawImage(garmentImg, -renderW / 2, -renderH / 2, renderW, renderH)

  ctx.restore()

  return canvas.toDataURL('image/png')
}

export async function renderTryOnPreview(
  bodyImageUrl: string,
  garmentImageUrl: string,
  garmentType: string,
  bodyDims: BodyDimensions,
  adjustments?: Partial<GarmentAdjustments>
): Promise<string> {
  return renderTryOn({
    bodyImageUrl,
    garmentImageUrl,
    garmentType,
    bodyDimensions: bodyDims,
    adjustments,
    canvasWidth: 400,
    canvasHeight: 500,
  })
}
