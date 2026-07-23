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

function getCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  return { c, ctx }
}

function sampleEdges(data: Uint8ClampedArray, w: number, h: number): number[][] {
  const s: number[][] = []
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4
    if (data[i + 3] > 128) s.push([data[i], data[i + 1], data[i + 2]])
  }
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40))
  for (let y = 0; y < h; y += step) {
    px(0, y); px(1, y); px(w - 1, y); px(w - 2, y)
  }
  for (let x = 0; x < w; x += step) {
    px(x, 0); px(x, 1); px(x, h - 1); px(x, h - 2)
  }
  return s
}

function dominantColor(samples: number[][]): [number, number, number] {
  if (samples.length === 0) return [255, 255, 255]
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
  for (const s of samples) {
    const k = `${s[0] >> 4},${s[1] >> 4},${s[2] >> 4}`
    const b = buckets.get(k)
    if (b) { b.r += s[0]; b.g += s[1]; b.b += s[2]; b.n++ }
    else buckets.set(k, { r: s[0], g: s[1], b: s[2], n: 1 })
  }
  let best: { r: number; g: number; b: number; n: number } | null = null
  for (const b of buckets.values()) {
    if (!best || b.n > best.n) best = b
  }
  if (!best) return [255, 255, 255]
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)]
}

function colorDistLab(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const ravg = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  const dR = dr * dr
  const dG = dg * dg * (1 + 0.05 * ravg / 255)
  const dB = db * db * (2 + ravg / 256)
  return Math.sqrt(dR + dG + dB)
}

function buildMask(data: Uint8ClampedArray, w: number, h: number, bg: [number, number, number], tol: number): Uint8ClampedArray {
  const m = new Uint8ClampedArray(w * h)
  const lo = tol * 0.25
  const hi = tol * 0.75
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    if (data[p + 3] < 128) { m[i] = 0; continue }
    const d = colorDistLab(data[p], data[p + 1], data[p + 2], bg[0], bg[1], bg[2])
    if (d < lo) { m[i] = 0; continue }
    if (d > hi) { m[i] = 255; continue }
    m[i] = Math.round(((d - lo) / (hi - lo)) * 255)
  }
  return m
}

function floodBG(mask: Uint8ClampedArray, w: number, h: number) {
  const q: [number, number][] = []
  const v = new Uint8Array(w * h)
  const push = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return
    const k = y * w + x
    if (v[k]) return
    v[k] = 1
    if (mask[k] < 128) { mask[k] = 0; q.push([x, y]) }
  }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (q.length) {
    const [x, y] = q.pop()!
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
}

function erode(mask: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            min = Math.min(min, mask[ny * w + nx])
          }
        }
      }
      out[y * w + x] = min
    }
  }
  return out
}

function dilate(mask: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let max = 0
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            max = Math.max(max, mask[ny * w + nx])
          }
        }
      }
      out[y * w + x] = max
    }
  }
  return out
}

function gaussianFeather(mask: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return mask
  const passes = Math.max(1, Math.ceil(radius / 2))
  let out = new Uint8ClampedArray(mask)
  for (let p = 0; p < passes; p++) {
    const tmp = new Uint8ClampedArray(out)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, weight = 0
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const d = Math.sqrt(dx * dx + dy * dy)
              const w2 = Math.exp(-d * d / 2)
              sum += tmp[ny * w + nx] * w2
              weight += w2
            }
          }
        }
        out[y * w + x] = Math.round(sum / weight)
      }
    }
  }
  return out
}

function contentBounds(mask: Uint8ClampedArray, w: number, h: number, threshold = 30): { x: number; y: number; w: number; h: number } | null {
  let mnX = w, mnY = h, mxX = 0, mxY = 0, found = false
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] > threshold) {
        mnX = Math.min(mnX, x); mnY = Math.min(mnY, y)
        mxX = Math.max(mxX, x); mxY = Math.max(mxY, y)
        found = true
      }
    }
  }
  if (!found) return null
  const p = 6
  return {
    x: Math.max(0, mnX - p), y: Math.max(0, mnY - p),
    w: Math.min(w - mnX + p * 2, mxX - mnX + p * 2),
    h: Math.min(h - mnY + p * 2, mxY - mnY + p * 2),
  }
}

function detectAlphaTransparency(data: Uint8ClampedArray, w: number, h: number): boolean {
  let transparent = 0
  const total = w * h
  const step = Math.max(1, Math.floor(total / 5000))
  for (let i = 3; i < total * 4; i += 4 * step) {
    if (data[i] < 128) transparent++
  }
  return transparent / (total / step) > 0.15
}

function sobelEdgeMask(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  const gx = new Float32Array(w * h)
  const gy = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      gx[i] = -gray[(y - 1) * w + x - 1] + gray[(y - 1) * w + x + 1]
        - 2 * gray[y * w + x - 1] + 2 * gray[y * w + x + 1]
        - gray[(y + 1) * w + x - 1] + gray[(y + 1) * w + x + 1]
      gy[i] = -gray[(y - 1) * w + x - 1] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + x + 1]
        + gray[(y + 1) * w + x - 1] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + x + 1]
    }
  }
  const m = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) {
    const mag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i])
    m[i] = Math.min(255, Math.round(mag))
  }
  return m
}

function regionGrowForeground(data: Uint8ClampedArray, w: number, h: number, bg: [number, number, number], tol: number): Uint8ClampedArray {
  const m = new Uint8ClampedArray(w * h)
  const seed = Math.floor(w * h * 0.5)
  const sp = seed * 4
  const fg = [data[sp], data[sp + 1], data[sp + 2]]
  const q: [number, number][] = []
  const v = new Uint8Array(w * h)
  const push = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return
    const k = y * w + x
    if (v[k]) return
    v[k] = 1
    const p = k * 4
    if (data[p + 3] < 128) return
    const d = colorDistLab(data[p], data[p + 1], data[p + 2], fg[0], fg[1], fg[2])
    if (d < tol * 1.2) {
      m[k] = 255
      q.push([x, y])
    }
  }
  push(Math.floor(w / 2), Math.floor(h / 2))
  while (q.length) {
    const [x, y] = q.pop()!
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  return m
}

export async function removeBackground(imageUrl: string, options: ProcessOptions = {}): Promise<string> {
  const { tolerance = 55, featherRadius = 8, autoCrop = true, maxSize = 1200 } = options
  const img = await loadImage(imageUrl)
  let w = img.naturalWidth, h = img.naturalHeight
  if (maxSize && (w > maxSize || h > maxSize)) {
    const s = Math.min(maxSize / w, maxSize / h)
    w = Math.round(w * s); h = Math.round(h * s)
  }
  const { c, ctx } = getCanvas(w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const id = ctx.getImageData(0, 0, w, h)

  if (detectAlphaTransparency(id.data, w, h)) {
    const b = contentBounds(id.data.map((v, i) => i % 4 === 3 ? v : 0), w, h)
    if (b) {
      const cr = document.createElement('canvas')
      cr.width = b.w; cr.height = b.h
      cr.getContext('2d')!.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
      return cr.toDataURL('image/png')
    }
  }

  const bg = dominantColor(sampleEdges(id.data, w, h))
  let mask = buildMask(id.data, w, h, bg, tolerance)
  floodBG(mask, w, h)

  const fgPixels = mask.reduce((s, v) => s + (v > 128 ? 1 : 0), 0)
  const totalPixels = w * h

  if (fgPixels < totalPixels * 0.05) {
    mask = regionGrowForeground(id.data, w, h, bg, tolerance)
    floodBG(mask, w, h)
  }

  if (fgPixels > totalPixels * 0.92) {
    const edges = sobelEdgeMask(id.data, w, h)
    let edgeMask = new Uint8ClampedArray(w * h)
    for (let i = 0; i < w * h; i++) {
      edgeMask[i] = edges[i] > 40 ? 255 : 0
    }
    floodBG(edgeMask, w, h)
    const edgeFg = edgeMask.reduce((s, v) => s + (v > 128 ? 1 : 0), 0)
    if (edgeFg > totalPixels * 0.05 && edgeFg < totalPixels * 0.85) {
      for (let i = 0; i < w * h; i++) {
        mask[i] = Math.max(mask[i], edgeMask[i])
      }
    }
  }

  mask = erode(mask, w, h, 1)
  mask = dilate(mask, w, h, 2)
  mask = gaussianFeather(mask, w, h, featherRadius)

  for (let i = 0; i < w * h; i++) id.data[i * 4 + 3] = mask[i]
  ctx.putImageData(id, 0, 0)

  if (autoCrop) {
    const b = contentBounds(mask, w, h)
    if (b) {
      const cr = document.createElement('canvas')
      cr.width = b.w; cr.height = b.h
      cr.getContext('2d')!.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
      return cr.toDataURL('image/png')
    }
  }
  return c.toDataURL('image/png')
}

export async function prepareGarmentUpload(file: File, options: ProcessOptions = {}): Promise<PreparedGarmentFile> {
  const previewUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => { if (typeof r.result === 'string') resolve(r.result); else reject() }
    r.onerror = () => reject()
    r.readAsDataURL(file)
  })
  try {
    const cutoutUrl = await removeBackground(previewUrl, { ...options, maxSize: options.maxSize ?? 1600, autoCrop: true })
    const processedFile = dataUrlToFile(cutoutUrl, file.name.replace(/\.[^.]+$/, '') + '-cutout.png')
    return { file: processedFile, previewUrl: cutoutUrl }
  } catch {
    return { file, previewUrl }
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [h, b64] = dataUrl.split(',')
  const m = h.match(/:(.*?);/)
  const mime = m ? m[1] : 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

export async function autoCropTransparent(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl)
  const { c, ctx } = getCanvas(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
  const alpha = new Uint8ClampedArray(img.naturalWidth * img.naturalHeight)
  for (let i = 0; i < alpha.length; i++) alpha[i] = id.data[i * 4 + 3]
  const b = contentBounds(alpha, img.naturalWidth, img.naturalHeight)
  if (!b) return c.toDataURL('image/png')
  const cr = document.createElement('canvas')
  cr.width = b.w; cr.height = b.h
  cr.getContext('2d')!.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  return cr.toDataURL('image/png')
}

export async function compositeImages(baseUrl: string, overlay: { url: string; x: number; y: number; w: number; h: number; rotation?: number }[]): Promise<string> {
  const base = await loadImage(baseUrl)
  const { c, ctx } = getCanvas(base.naturalWidth, base.naturalHeight)
  ctx.drawImage(base, 0, 0)
  for (const item of overlay) {
    const img = await loadImage(item.url)
    ctx.save()
    ctx.translate(item.x + item.w / 2, item.y + item.h / 2)
    if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180)
    ctx.drawImage(img, -item.w / 2, -item.h / 2, item.w, item.h)
    ctx.restore()
  }
  return c.toDataURL('image/png')
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return loadImage(src)
}
