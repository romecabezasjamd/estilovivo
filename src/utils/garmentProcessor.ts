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

function sampleCorners(data: Uint8ClampedArray, w: number, h: number): number[][] {
  const s: number[][] = []
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4
    s.push([data[i], data[i + 1], data[i + 2]])
  }
  for (let y = 0; y < h; y++) {
    px(0, y); px(1, y); px(w - 1, y); px(w - 2, y)
  }
  for (let x = 0; x < w; x++) {
    px(x, 0); px(x, 1); px(x, h - 1); px(x, h - 2)
  }
  return s
}

function dominant(samples: number[][]): [number, number, number] {
  const buckets = new Map<string, { c: number[]; n: number }>()
  for (const s of samples) {
    const k = `${s[0] >> 4},${s[1] >> 4},${s[2] >> 4}`
    const b = buckets.get(k)
    if (b) b.n++; else buckets.set(k, { c: s, n: 1 })
  }
  let best: { c: number[]; n: number } | null = null
  for (const b of buckets.values()) { if (!best || b.n > best.n) best = b }
  return best ? [best.c[0], best.c[1], best.c[2]] : [255, 255, 255]
}

function colorDist(a: number[], b: number[]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

function buildMask(data: Uint8ClampedArray, w: number, h: number, bg: number[], tol: number): Uint8ClampedArray {
  const m = new Uint8ClampedArray(w * h)
  const lo = tol * 0.3, hi = tol * 0.9
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    if (data[p + 3] === 0) { m[i] = 0; continue }
    const d = colorDist([data[p], data[p + 1], data[p + 2]], bg)
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

function feather(mask: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask)
  const passes = Math.max(1, r >> 1)
  for (let p = 0; p < passes; p++) {
    const tmp = new Uint8ClampedArray(out)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) { s += tmp[ny * w + nx]; n++ }
          }
        }
        out[y * w + x] = s / n
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
  const bg = dominant(sampleCorners(id.data, w, h))
  let mask = buildMask(id.data, w, h, bg, tolerance)
  floodBG(mask, w, h)
  mask = feather(mask, w, h, featherRadius)
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
