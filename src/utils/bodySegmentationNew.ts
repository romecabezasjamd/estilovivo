export interface SegmentationResult {
  maskCanvas: HTMLCanvasElement
  width: number
  height: number
}

let segmenter: any = null
let segLoading = false
let segInitP: Promise<any> | null = null

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

async function loadSegmenter(): Promise<any> {
  if (segmenter) return segmenter
  if (segInitP) return segInitP
  segLoading = true
  segInitP = (async () => {
    try {
      const tfCore = await import('@tensorflow/tfjs-core')
      try {
        await import('@tensorflow/tfjs-backend-webgl')
        await tfCore.ready()
      } catch {
        await import('@tensorflow/tfjs-backend-cpu')
        await tfCore.ready()
      }

      const selfieSeg = await import('@mediapipe/selfie_segmentation')
      const seg = new selfieSeg.SelfieSegmentation({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        }
      })
      seg.setOptions({
        modelSelection: 1,
        selfieMode: false,
      })
      await new Promise<void>((resolve, reject) => {
        seg.onResults(() => resolve())
        seg.initialize().catch(reject)
      })
      segmenter = seg
      segLoading = false
      return seg
    } catch (e) {
      segLoading = false
      segInitP = null
      throw new Error(e instanceof Error ? e.message : 'Error al cargar MediaPipe Selfie Segmentation')
    }
  })()
  return segInitP
}

export function getSegmentationStatus() {
  return { isLoading: segLoading, isReady: segmenter !== null }
}

function segmentFallback(imageEl: HTMLImageElement): SegmentationResult {
  const w = imageEl.naturalWidth
  const h = imageEl.naturalHeight
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(imageEl, 0, 0, w, h)
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  const mask = document.createElement('canvas')
  mask.width = w; mask.height = h
  const mctx = mask.getContext('2d')!
  const maskData = mctx.createImageData(w, h)
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
  return { maskCanvas: mask, width: w, height: h }
}

export async function segmentPerson(imageSrc: string | HTMLImageElement | HTMLCanvasElement): Promise<SegmentationResult> {
  let el: HTMLImageElement | HTMLCanvasElement
  if (typeof imageSrc === 'string') {
    el = await loadImg(imageSrc)
  } else {
    el = imageSrc
  }

  try {
    const seg = await loadSegmenter()
    const w = el.naturalWidth
    const h = el.naturalHeight

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = w; tempCanvas.height = h
    const tctx = tempCanvas.getContext('2d')!
    tctx.drawImage(el, 0, 0, w, h)

    let maskCanvas: HTMLCanvasElement | null = null
    const result = await Promise.race([
      new Promise<void>((resolve) => {
        seg.onResults((results: any) => {
          const mask = results.segmentationMask
          const mc = document.createElement('canvas')
          mc.width = w; mc.height = h
          const mctx = mc.getContext('2d')!
          if (mask instanceof HTMLCanvasElement) {
            mctx.drawImage(mask, 0, 0, w, h)
          } else if (mask instanceof ImageData) {
            mctx.putImageData(mask, 0, 0)
          } else {
            mctx.drawImage(mask, 0, 0, w, h)
          }
          maskCanvas = mc
          resolve()
        })
        seg.send({ image: tempCanvas })
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MediaPipe timeout')), 25000)),
    ])

    if (result && maskCanvas) {
      return { maskCanvas, width: w, height: h }
    }
  } catch (e) {
    console.warn('MediaPipe Selfie Segmentation failed, using fallback:', e)
  }

  return segmentFallback(el as HTMLImageElement)
}
