export interface SegmentationResult {
  personMask: ImageData
  personCanvas: HTMLCanvasElement
  width: number
  height: number
}

let segmenter: any = null
let loading = false
let initErr: string | null = null
let initP: Promise<any> | null = null

export function getStatus() {
  return { isLoading: loading, error: initErr, isReady: segmenter !== null }
}

export async function loadSelfieSegmentation(): Promise<any> {
  if (segmenter) return segmenter
  if (initP) return initP
  loading = true
  initErr = null
  initP = (async () => {
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
      if (!backendReady) throw new Error('No se pudo inicializar el backend de TensorFlow')

      const bodySeg = await import('@tensorflow-models/body-segmentation')
      const seg = await bodySeg.createSegmenter(
        bodySeg.SupportedModels.BodyPix,
        { runtime: 'tfjs', modelType: bodySeg.modelTypes.general }
      )
      segmenter = seg
      loading = false
      return seg
    } catch (e) {
      loading = false
      initErr = e instanceof Error ? e.message : 'Error al cargar segmentación'
      initP = null
      throw new Error(initErr)
    }
  })()
  return initP
}

export async function segmentPerson(imageSrc: string | HTMLImageElement | HTMLCanvasElement): Promise<SegmentationResult> {
  const seg = await loadSelfieSegmentation()
  let el: HTMLImageElement | HTMLCanvasElement
  if (typeof imageSrc === 'string') {
    el = await loadImg(imageSrc)
  } else {
    el = imageSrc
  }
  const w = el instanceof HTMLImageElement ? el.naturalWidth : el.width
  const h = el instanceof HTMLImageElement ? el.naturalHeight : el.height

  const result = await Promise.race([
    seg.segmentPerson(el, { flipHorizontal: false, multiSegmentation: false, segmentThreshold: 0.7 }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('La segmentación tardó demasiado')), 20000)),
  ])

  if (!result || result.length === 0) throw new Error('No se detectó ninguna persona')
  const mask = result[0].mask

  const mc = document.createElement('canvas')
  mc.width = w
  mc.height = h
  const mctx = mc.getContext('2d')!

  if (mask instanceof ImageData) {
    mctx.putImageData(mask, 0, 0)
  } else {
    const tmpC = document.createElement('canvas')
    tmpC.width = mask.width
    tmpC.height = mask.height
    const tmpCtx = tmpC.getContext('2d')!
    tmpCtx.putImageData(mask, 0, 0)
    mctx.drawImage(tmpC, 0, 0, w, h)
  }

  return { personMask: mctx.getImageData(0, 0, w, h), personCanvas: mc, width: w, height: h }
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
