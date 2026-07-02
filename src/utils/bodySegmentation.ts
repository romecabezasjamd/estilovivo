import { SelfieSegmentation, Results as SegmentationResults } from '@mediapipe/selfie_segmentation'

export interface SegmentationResult {
  maskImage: ImageData
  canvas: HTMLCanvasElement
  width: number
  height: number
}

let segmenter: SelfieSegmentation | null = null
let segmenterLoading = false
let segmenterError: string | null = null

export function getSegmenterStatus() {
  return { isLoading: segmenterLoading, error: segmenterError, isReady: segmenter !== null }
}

export async function loadSegmenter(): Promise<SelfieSegmentation> {
  if (segmenter) return segmenter
  if (segmenterLoading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (segmenter) { clearInterval(check); resolve(segmenter) }
        if (segmenterError) { clearInterval(check); reject(new Error(segmenterError)) }
      }, 100)
    })
  }

  segmenterLoading = true
  segmenterError = null

  try {
    segmenter = new SelfieSegmentation({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    })

    segmenter.setOptions({
      modelSelection: 1,
      selfieMode: true,
    })

    await new Promise<void>((resolve, reject) => {
      segmenter!.onResults(() => resolve())
      segmenter!.initialize().catch(reject)
    })

    segmenterLoading = false
    return segmenter!
  } catch (err) {
    segmenterLoading = false
    segmenterError = err instanceof Error ? err.message : 'Error al cargar segmentación'
    segmenter = null
    throw new Error(segmenterError)
  }
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

  const results: SegmentationResults = await new Promise((resolve, reject) => {
    seg.onResults((r: SegmentationResults) => resolve(r))
    seg.send({ image: offCanvas }).catch(reject)
  })

  if (!results.segmentationMask) {
    throw new Error('No se pudo generar la máscara de segmentación')
  }

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskCtx = maskCanvas.getContext('2d')!
  maskCtx.drawImage(results.segmentationMask, 0, 0, width, height)
  const maskImageData = maskCtx.getImageData(0, 0, width, height)

  return {
    maskImage: maskImageData,
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
    const maskVal = mask[i]
    if (maskVal < 128) {
      data[i] = backgroundColor[0]
      data[i + 1] = backgroundColor[1]
      data[i + 2] = backgroundColor[2]
      data[i + 3] = backgroundColor[3]
    } else if (featherRadius > 0 && maskVal < 200) {
      const alpha = (maskVal - 128) / 72
      data[i + 3] = Math.round(data[i + 3] * alpha)
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
