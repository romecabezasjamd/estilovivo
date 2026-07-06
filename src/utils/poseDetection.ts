export interface BodyLandmarks {
  shoulders: { left: { x: number; y: number; score: number }; right: { x: number; y: number; score: number } }
  waist: { x: number; y: number; score: number }
  hips: { left: { x: number; y: number; score: number }; right: { x: number; y: number; score: number } }
  knees: { left: { x: number; y: number; score: number }; right: { x: number; y: number; score: number } }
  ankles: { left: { x: number; y: number; score: number }; right: { x: number; y: number; score: number } }
  ears: { left: { x: number; y: number; score: number }; right: { x: number; y: number; score: number } }
  eyes: { left: { x: number; y: number; score: number }; right: { x: number; y: number; score: number } }
  nose?: { x: number; y: number; score: number }
}

export interface BodyDimensions {
  shoulderWidth: number
  hipWidth: number
  waistWidth: number
  torsoHeight: number
  legLength: number
  bodyCenterX: number
  bodyCenterY: number
  waistY: number
  torsoAngle: number
  headHeight: number
  imageWidth: number
  imageHeight: number
}

export interface DetectionResult {
  landmarks: BodyLandmarks
  dimensions: BodyDimensions
  keypoints: Array<{ x: number; y: number; score: number; name: string }>
  imageUrl: string
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function getKeypoint(keypoints: Array<{ x: number; y: number; score?: number; name?: string; part?: string }>, name: string) {
  const found = keypoints.find(k =>
    k.name === name || k.part === name ||
    k.name?.toLowerCase() === name.toLowerCase() ||
    k.part?.toLowerCase() === name.toLowerCase()
  )
  if (found) return { x: found.x, y: found.y, score: found.score ?? 0 }
  return { x: 0, y: 0, score: 0 }
}

let humanInstance: any = null
let humanLoading = false
let humanInitP: Promise<any> | null = null

export function getLoadStatus() {
  return {
    isLoading: humanLoading,
    loadError: null as string | null,
    hasDetector: humanInstance !== null,
    engine: humanInstance ? 'human' as const : 'none' as const,
  }
}

async function loadHuman(): Promise<any> {
  if (humanInstance) return humanInstance
  if (humanInitP) return humanInitP
  humanLoading = true
  humanInitP = (async () => {
    try {
      const Human = (await import('@vladmandic/human')).default
      const h = new Human({
        backend: 'webgl',
        debug: false,
        async: true,
        warmup: 'none',
        cacheModels: true,
        cacheSensitivity: 0.7,
        deallocate: true,
        modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models',
        body: { enabled: true, maxDetected: 1, minConfidence: 0.3 },
        face: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
        filter: { enabled: false },
      })
      await h.init()
      await h.load()
      humanInstance = h
      humanLoading = false
      return h
    } catch (e) {
      humanLoading = false
      humanInitP = null
      throw new Error(e instanceof Error ? e.message : 'Error al cargar Human.js')
    }
  })()
  return humanInitP
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

function buildDetectionResult(
  leftShoulder: { x: number; y: number; score: number },
  rightShoulder: { x: number; y: number; score: number },
  leftHip: { x: number; y: number; score: number },
  rightHip: { x: number; y: number; score: number },
  leftKnee: { x: number; y: number; score: number },
  rightKnee: { x: number; y: number; score: number },
  leftAnkle: { x: number; y: number; score: number },
  rightAnkle: { x: number; y: number; score: number },
  leftEar: { x: number; y: number; score: number },
  rightEar: { x: number; y: number; score: number },
  leftEye: { x: number; y: number; score: number },
  rightEye: { x: number; y: number; score: number },
  nose: { x: number; y: number; score: number },
  rawKeypoints: Array<{ x: number; y: number; score: number; name: string }>,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
): DetectionResult {
  const shoulderCenter = midpoint(leftShoulder, rightShoulder)
  const hipCenter = midpoint(leftHip, rightHip)
  const kneeCenter = midpoint(leftKnee, rightKnee)
  const ankleCenter = midpoint(leftAnkle, rightAnkle)

  const landmarks: BodyLandmarks = {
    shoulders: { left: leftShoulder, right: rightShoulder },
    waist: {
      x: (shoulderCenter.x + hipCenter.x) / 2,
      y: shoulderCenter.y + (hipCenter.y - shoulderCenter.y) * 0.45,
      score: Math.max(Math.min(leftShoulder.score, rightShoulder.score), Math.min(leftHip.score, rightHip.score)),
    },
    hips: { left: leftHip, right: rightHip },
    knees: { left: leftKnee, right: rightKnee },
    ankles: { left: leftAnkle, right: rightAnkle },
    ears: { left: leftEar, right: rightEar },
    eyes: { left: leftEye, right: rightEye },
    nose: nose.score > 0.3 ? nose : undefined,
  }

  const shoulderWidth = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y)
  const hipWidth = Math.hypot(rightHip.x - leftHip.x, rightHip.y - leftHip.y)
  const waistWidth = Math.max(shoulderWidth * 0.92, hipWidth * 0.74)
  const torsoHeight = Math.abs(hipCenter.y - shoulderCenter.y)
  const bodyCenterX = (shoulderCenter.x + hipCenter.x) / 2
  const bodyCenterY = (shoulderCenter.y + hipCenter.y) / 2
  const waistY = landmarks.waist.y
  const torsoAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * (180 / Math.PI)
  const legLength = (leftAnkle.score > 0.3 && rightAnkle.score > 0.3)
    ? Math.abs(ankleCenter.y - hipCenter.y)
    : (leftKnee.score > 0.3 && rightKnee.score > 0.3 ? Math.abs(kneeCenter.y - hipCenter.y) * 1.8 : torsoHeight * 1.35)
  const noseY = nose.score > 0.3
    ? nose.y
    : (leftEye.score > 0.3 && rightEye.score > 0.3
      ? (leftEye.y + rightEye.y) / 2 - shoulderWidth * 0.35
      : shoulderCenter.y - shoulderWidth * 0.35)
  const headHeight = leftEar.score > 0.3 && rightEar.score > 0.3
    ? Math.abs((leftEar.y + rightEar.y) / 2 - noseY)
    : shoulderWidth * 0.4

  const dimensions: BodyDimensions = {
    shoulderWidth, hipWidth, waistWidth, torsoHeight, legLength,
    bodyCenterX, bodyCenterY, waistY, torsoAngle, headHeight,
    imageWidth, imageHeight,
  }

  return { landmarks, dimensions, keypoints: rawKeypoints, imageUrl }
}

export async function loadPoseDetector(): Promise<any> {
  return await loadHuman()
}

export async function detectPose(imageUrl: string): Promise<DetectionResult> {
  const h = await loadHuman()
  const img = await loadImg(imageUrl)
  const result = await Promise.race([
    h.detect(img),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Human.js timeout')), 20000)),
  ])
  if (!result || !result.body || result.body.length === 0) {
    throw new Error('No se detectó ninguna persona en la imagen. Asegúrate de estar de frente y con buena iluminación.')
  }
  const body = result.body[0]
  const kps = body.keypoints || []
  const kp = (name: string) => getKeypoint(kps, name)

  return buildDetectionResult(
    kp('leftShoulder'), kp('rightShoulder'),
    kp('leftHip'), kp('rightHip'),
    kp('leftKnee'), kp('rightKnee'),
    kp('leftAnkle'), kp('rightAnkle'),
    kp('leftEar'), kp('rightEar'),
    kp('leftEye'), kp('rightEye'),
    kp('nose'),
    kps.map((k: any) => ({ x: k.position?.x ?? k.x ?? 0, y: k.position?.y ?? k.y ?? 0, score: k.score ?? 0, name: k.part || k.name || '' })),
    imageUrl, img.naturalWidth, img.naturalHeight
  )
}
