export interface ProcessOptions {
  tolerance?: number
  featherRadius?: number
  autoCrop?: boolean
  maxSize?: number
}

export interface PreparedGarmentFile {
  file: File
  previewUrl: string
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = url
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('No se pudo convertir la imagen'))
    }
    reader.onerror = () => reject(new Error('No se pudo convertir la imagen'))
    reader.readAsDataURL(blob)
  })
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i)
  }
  return new File([array], filename, { type: mime })
}

function getContext(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { canvas, ctx }
}

function sampleEdgeColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sampleCount: number = 200
): number[][] {
  const samples: number[][] = []
  const edgePixels: [number, number][] = []
  for (let x = 0; x < width; x++) {
    edgePixels.push([x, 0], [x, height - 1])
  }
  for (let y = 1; y < height - 1; y++) {
    edgePixels.push([0, y], [width - 1, y])
  }
  const step = Math.max(1, Math.floor(edgePixels.length / sampleCount))
  for (let i = 0; i < edgePixels.length; i += step) {
    const [px, py] = edgePixels[i]
    const idx = (py * width + px) * 4
    samples.push([data[idx], data[idx + 1], data[idx + 2]])
  }
  return samples
}

function dominantColor(samples: number[][]): [number, number, number] {
  const buckets = new Map<string, { color: number[]; count: number }>()
  for (const s of samples) {
    const key = `${Math.round(s[0] / 16)},${Math.round(s[1] / 16)},${Math.round(s[2] / 16)}`
    const existing = buckets.get(key)
    if (existing) {
      existing.count++
    } else {
      buckets.set(key, { color: s, count: 1 })
    }
  }
  let best: { color: number[]; count: number } | null = null
  for (const entry of buckets.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  if (!best) return [255, 255, 255]
  return [best.color[0], best.color[1], best.color[2]]
}

function colorDistance(a: number[], b: number[]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function createMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: number[],
  tolerance: number
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    const dist = colorDistance([data[idx], data[idx + 1], data[idx + 2]], bg)
    const alpha = data[idx + 3]
    if (alpha === 0) {
      mask[i] = 0
    } else {
      const isBg = dist < tolerance
      const t = Math.max(0, Math.min(1, (dist - tolerance * 0.5) / (tolerance * 0.5)))
      mask[i] = isBg ? 0 : Math.round(t * 255)
    }
  }
  return mask
}

function featherMask(mask: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(mask)
  const passes = Math.max(1, Math.round(radius / 2))
  for (let p = 0; p < passes; p++) {
    const temp = new Uint8ClampedArray(result)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += temp[ny * width + nx]
              count++
            }
          }
        }
        result[y * width + x] = Math.round(sum / count)
      }
    }
  }
  return result
}

function findContentBounds(mask: Uint8ClampedArray, width: number, height: number, threshold = 30): { x: number; y: number; w: number; h: number } | null {
  let minX = width, minY = height, maxX = 0, maxY = 0
  let found = false
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > threshold) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
        found = true
      }
    }
  }
  if (!found) return null
  const padding = 4
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    w: Math.min(width - minX + padding, maxX - minX + padding * 2),
    h: Math.min(height - minY + padding, maxY - minY + padding * 2),
  }
}

async function runAiBackgroundRemoval(imageSource: string): Promise<string | null> {
  try {
    const { default: removeBackground } = await import('@imgly/background-removal')
    const resultBlob = await removeBackground(imageSource, {
      device: 'cpu',
      model: 'isnet_quint8',
      output: {
        format: 'image/png',
        type: 'foreground',
        quality: 0.95,
      },
      debug: false,
    })
    return await blobToDataUrl(resultBlob)
  } catch (error) {
    console.warn('AI background removal unavailable, using heuristic fallback', error)
    return null
  }
}

export async function removeBackground(imageUrl: string, options: ProcessOptions = {}): Promise<string> {
  const { tolerance = 45, featherRadius = 6, autoCrop = true, maxSize = 1200 } = options

  const aiCutout = await runAiBackgroundRemoval(imageUrl)
  if (aiCutout) {
    if (!autoCrop) return aiCutout
    return autoCropTransparent(aiCutout)
  }

  const img = await loadImage(imageUrl)
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (maxSize && (w > maxSize || h > maxSize)) {
    const scale = Math.min(maxSize / w, maxSize / h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const { canvas, ctx } = getContext(w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  const bgSamples = sampleEdgeColors(data, w, h)
  const bg = dominantColor(bgSamples)
  let mask = createMask(data, w, h, bg, tolerance)
  mask = featherMask(mask, w, h, featherRadius)
  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 3] = mask[i]
  }
  ctx.putImageData(imageData, 0, 0)
  if (autoCrop) {
    const bounds = findContentBounds(mask, w, h)
    if (bounds) {
      const cropCanvas = document.createElement('canvas')
      cropCanvas.width = bounds.w
      cropCanvas.height = bounds.h
      const cropCtx = cropCanvas.getContext('2d')!
      cropCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h)
      return cropCanvas.toDataURL('image/png')
    }
  }
  return canvas.toDataURL('image/png')
}

export async function prepareGarmentUpload(file: File, options: ProcessOptions = {}): Promise<PreparedGarmentFile> {
  const previewUrl = await blobToDataUrl(file)
  try {
    const cutoutUrl = await removeBackground(previewUrl, {
      ...options,
      maxSize: options.maxSize ?? 1600,
      autoCrop: true,
    })
    const processedFile = dataUrlToFile(cutoutUrl, file.name.replace(/\.[^.]+$/, '') + '-cutout.png')
    return { file: processedFile, previewUrl: cutoutUrl }
  } catch (error) {
    console.warn('Falling back to original garment file', error)
    return { file, previewUrl }
  }
}

export async function autoCropTransparent(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl)
  const { canvas, ctx } = getContext(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
  const alpha = new Uint8ClampedArray(img.naturalWidth * img.naturalHeight)
  for (let i = 0; i < img.naturalWidth * img.naturalHeight; i++) {
    alpha[i] = imageData.data[i * 4 + 3]
  }
  const bounds = findContentBounds(alpha, img.naturalWidth, img.naturalHeight)
  if (!bounds) return canvas.toDataURL('image/png')
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = bounds.w
  cropCanvas.height = bounds.h
  const cropCtx = cropCanvas.getContext('2d')!
  cropCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h)
  return cropCanvas.toDataURL('image/png')
}

export async function compositeImages(baseUrl: string, overlay: { url: string; x: number; y: number; w: number; h: number; rotation?: number }[]): Promise<string> {
  const base = await loadImage(baseUrl)
  const canvas = document.createElement('canvas')
  canvas.width = base.naturalWidth
  canvas.height = base.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(base, 0, 0)
  for (const item of overlay) {
    const img = await loadImage(item.url)
    ctx.save()
    const cx = item.x + item.w / 2
    const cy = item.y + item.h / 2
    ctx.translate(cx, cy)
    if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180)
    ctx.drawImage(img, -item.w / 2, -item.h / 2, item.w, item.h)
    ctx.restore()
  }
  return canvas.toDataURL('image/png')
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return loadImage(src)
}
