export interface SegmentationResult {
  maskImage: ImageData
  canvas: HTMLCanvasElement
  width: number
  height: number
}

let segmenter: any = null
let segmenterLoading = false
let segmenterError: string | null = null
let initPromise: Promise<any> | null = null

export function getSegmenterStatus() {
  return { isLoading: segmenterLoading, error: segmenterError, isReady: segmenter !== null }
}

export async function loadSegmenter(): Promise<any> {
  if (segmenter) return segmenter
  if (initPromise) return initPromise

  segmenterLoading = true
  segmenterError = null

  initPromise = (async () => {
    try {
      const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation')
      const seg = new SelfieSegmentation({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      })
      seg.setOptions({ modelSelection: 1, selfieMode: true })
      await new Promise<void>((resolve, reject) => {
        seg.onResults(() => resolve())
        seg.initialize().catch(reject)
      })
      segmenter = seg
      segmenterLoading = false
      return seg
    } catch (err) {
      segmenterLoading = false
      segmenterError = err instanceof Error ? err.message : 'Error al cargar segmentación'
      initPromise = null
      throw new Error(segmenterError)
    }
  })()

  return initPromise
}

export async function segmentPerson(imageSource: string | HTMLImageElement | HTMLCanvasElement): Promise<SegmentationResult> {
  const seg = await loadSegmenter()

  let imgEl: HTMLImageElement | HTMLCanvasElement
  if (typeof imageSource === 'string') {
    imgEl = await loadImageElement(imageSource)
  } else {
    imgEl = imageSource
  }

  const width = imgEl instanceof HTMLImageElement ? imgEl.naturalWidth : imgEl.width
  const height = imgEl instanceof HTMLImageElement ? imgEl.naturalHeight : imgEl.height

  const offCanvas = document.createElement('canvas')
  offCanvas.width = width
  offCanvas.height = height
  const offCtx = offCanvas.getContext('2d')!
  offCtx.drawImage(imgEl, 0, 0, width, height)

  const results = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Segmentación timeout')), 15000)
    seg.onResults((r: any) => { clearTimeout(timeout); resolve(r) })
    seg.send({ image: offCanvas }).catch((e: any) => { clearTimeout(timeout); reject(e) })
  })

  if (!results.segmentationMask) {
    throw new Error('No se pudo generar la máscara de segmentación')
  }

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskCtx = maskCanvas.getContext('2d')!
  maskCtx.drawImage(results.segmentationMask, 0, 0, width, height)

  return {
    maskImage: maskCtx.getImageData(0, 0, width, height),
    canvas: maskCanvas,
    width,
    height,
  }
}

export async function applyPersonMask(
  imageUrl: string,
  segmentationResult: SegmentationResult,
  options: { featherRadius?: number; backgroundColor?: [number, number, number, number] } = {}
): Promise<string> {
  const { featherRadius = 3, backgroundColor = [0, 0, 0, 0] } = options
  const img = await loadImageElement(imageUrl)
  const { width, height } = segmentationResult

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const mask = segmentationResult.maskImage.data

  for (let i = 0; i < data.length; i += 4) {
    const mv = mask[i]
    if (mv < 128) {
      data[i] = backgroundColor[0]; data[i + 1] = backgroundColor[1]
      data[i + 2] = backgroundColor[2]; data[i + 3] = backgroundColor[3]
    } else if (featherRadius > 0 && mv < 200) {
      data[i + 3] = Math.round(data[i + 3] * ((mv - 128) / 72))
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function extractPersonFromBackground(imageUrl: string): Promise<string> {
  const segResult = await segmentPerson(imageUrl)
  return applyPersonMask(imageUrl, segResult)
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}
