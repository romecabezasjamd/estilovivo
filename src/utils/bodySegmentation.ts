export interface SegmentationResult {
  personMask: ImageData
  personCanvas: HTMLCanvasElement
  width: number
  height: number
}

let bodyPixSegmenter: any = null
let bodyPixLoading = false
let bodyPixInitP: Promise<any> | null = null

export function getStatus() {
  return {
    isLoading: bodyPixLoading,
    error: null,
    isReady: bodyPixSegmenter !== null,
  }
}

async function loadBodyPix(): Promise<any> {
  if (bodyPixSegmenter) return bodyPixSegmenter
  if (bodyPixInitP) return bodyPixInitP
  bodyPixLoading = true
  bodyPixInitP = (async () => {
    try {
      const tfCore = await import('@tensorflow/tfjs-core')
      let backendReady = false
      try {
        await import('@tensorflow/tfjs-backend-webgl')
        await tfCore.ready()
        backendReady = true
      } catch {
        try {
          await import('@tensorflow/tfjs-backend-cpu')
          await tfCore.ready()
          backendReady = true
        } catch {}
      }
      if (!backendReady) throw new Error('No se pudo inicializar backend')
      const bodySeg = await import('@tensorflow-models/body-segmentation')
      const seg = await bodySeg.createSegmenter(
        bodySeg.SupportedModels.BodyPix,
        { runtime: 'tfjs', modelType: 'general' }
      )
      bodyPixSegmenter = seg
      bodyPixLoading = false
      return seg
    } catch (e) {
      bodyPixLoading = false
      bodyPixInitP = null
      throw new Error(e instanceof Error ? e.message : 'Error al cargar BodyPix')
    }
  })()
  return bodyPixInitP
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

function getC(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  return { c, ctx }
}

async function segmentWithBodyPix(imageEl: HTMLImageElement): Promise<SegmentationResult> {
  const seg = await loadBodyPix()
  const w = imageEl.naturalWidth
  const h = imageEl.naturalHeight
  const result = await Promise.race([
    seg.segmentPeople(imageEl, { flipHorizontal: false, multiSegmentation: false, segmentThreshold: 0.7 }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('BodyPix timeout')), 20000)),
  ])
  if (!result || result.length === 0) throw new Error('BodyPix no detectó persona')
  const mask = result[0].mask
  const mc = document.createElement('canvas')
  mc.width = w; mc.height = h
  const mctx = mc.getContext('2d')!
  if (mask instanceof ImageData) {
    mctx.putImageData(mask, 0, 0)
  } else {
    const tmpC = document.createElement('canvas')
    tmpC.width = mask.width; tmpC.height = mask.height
    tmpC.getContext('2d')!.putImageData(mask, 0, 0)
    mctx.drawImage(tmpC, 0, 0, w, h)
  }
  return { personMask: mctx.getImageData(0, 0, w, h), personCanvas: mc, width: w, height: h }
}

function segmentFallback(imageEl: HTMLImageElement): SegmentationResult {
  const w = imageEl.naturalWidth
  const h = imageEl.naturalHeight
  const { c, ctx } = getC(w, h)
  ctx.drawImage(imageEl, 0, 0, w, h)
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  const mc = document.createElement('canvas')
  mc.width = w; mc.height = h
  const mctx = mc.getContext('2d')!
  const maskData = new ImageData(w, h)
  const md = maskData.data
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    const r = d[p], g = d[p + 1], b = d[p + 2], a = d[p + 3]
    if (a < 128) { md[p] = 0; md[p + 1] = 0; md[p + 2] = 0; md[p + 3] = 0; continue }
    const gray = r * 0.299 + g * 0.587 + b * 0.114
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    const isSkin = gray > 60 && gray < 240 && sat < 120 && r > 60 && g > 40
    const val = isSkin ? 255 : (gray > 30 && gray < 250 ? 200 : 0)
    md[p] = 255; md[p + 1] = 255; md[p + 2] = 255; md[p + 3] = val
  }
  mctx.putImageData(maskData, 0, 0)
  return { personMask: maskData, personCanvas: mc, width: w, height: h }
}

export async function segmentPerson(imageSrc: string | HTMLImageElement | HTMLCanvasElement): Promise<SegmentationResult> {
  let el: HTMLImageElement | HTMLCanvasElement
  if (typeof imageSrc === 'string') {
    el = await loadImg(imageSrc)
  } else {
    el = imageSrc
  }

  try {
    return await segmentWithBodyPix(el as HTMLImageElement)
  } catch (e) {
    console.warn('BodyPix segmentation failed, using fallback:', e)
  }

  return segmentFallback(el as HTMLImageElement)
}

export function applyMask(imageUrl: string, seg: SegmentationResult, featherPx = 4): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const { c, ctx } = getC(img.naturalWidth, img.naturalHeight)
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
      const d = id.data
      const m = seg.personMask.data
      const fw = seg.width / img.naturalWidth
      const fh = seg.height / img.naturalHeight
      for (let y = 0; y < img.naturalHeight; y++) {
        for (let x = 0; x < img.naturalWidth; x++) {
          const mx = Math.round(x * fw)
          const my = Math.round(y * fh)
          const mv = m[(my * seg.width + mx) * 4]
          const i = (y * img.naturalWidth + x) * 4
          if (mv < 128) {
            d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0
          } else if (featherPx > 0 && mv < 200) {
            d[i + 3] = Math.round(d[i + 3] * ((mv - 128) / 72))
          }
        }
      }
      ctx.putImageData(id, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para aplicar máscara'))
    img.src = imageUrl
  })
}

export async function extractPerson(imageUrl: string): Promise<string> {
  const seg = await segmentPerson(imageUrl)
  return applyMask(imageUrl, seg)
}
