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

function getKeypointByName(keypoints: Array<{ x: number; y: number; score?: number; name?: string; part?: string }>, name: string): { x: number; y: number; score: number } {
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
let humanError: string | null = null
let humanInitP: Promise<any> | null = null

let moveNetDetector: any = null
let moveNetLoading = false
let moveNetInitP: Promise<any> | null = null

export function getLoadStatus() {
  return {
    isLoading: humanLoading || moveNetLoading,
    loadError: humanError,
    hasDetector: humanInstance !== null || moveNetDetector !== null,
    engine: humanInstance ? 'human' : moveNetDetector ? 'movenet' : 'none',
  }
}

async function loadHuman(): Promise<any> {
  if (humanInstance) return humanInstance
  if (humanInitP) return humanInitP
  humanLoading = true
  humanError = null
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
      humanError = e instanceof Error ? e.message : 'Error al cargar Human.js'
      humanInitP = null
      throw new Error(humanError)
    }
  })()
  return humanInitP
}

async function loadMoveNet(): Promise<any> {
  if (moveNetDetector) return moveNetDetector
  if (moveNetInitP) return moveNetInitP
  moveNetLoading = true
  moveNetInitP = (async () => {
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
      const poseDetection = await import('@tensorflow-models/pose-detection')
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      )
      moveNetDetector = detector
      moveNetLoading = false
      return detector
    } catch (e) {
      moveNetLoading = false
      moveNetInitP = null
      throw new Error(e instanceof Error ? e.message : 'Error al cargar MoveNet')
    }
  })()
  return moveNetInitP
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

async function detectWithHuman(imageUrl: string): Promise<DetectionResult> {
  const h = await loadHuman()
  const img = await loadImg(imageUrl)
  const result = await h.detect(img)
  if (!result || !result.body || result.body.length === 0) {
    throw new Error('No se detectó ninguna persona en la imagen. Asegúrate de estar de frente y con buena iluminación.')
  }
  const body = result.body[0]
  const kps = body.keypoints || []
  const leftShoulder = getKeypointByName(kps, 'leftShoulder')
  const rightShoulder = getKeypointByName(kps, 'rightShoulder')
  const leftHip = getKeypointByName(kps, 'leftHip')
  const rightHip = getKeypointByName(kps, 'rightHip')
  const leftKnee = getKeypointByName(kps, 'leftKnee')
  const rightKnee = getKeypointByName(kps, 'rightKnee')
  const leftAnkle = getKeypointByName(kps, 'leftAnkle')
  const rightAnkle = getKeypointByName(kps, 'rightAnkle')
  const leftEar = getKeypointByName(kps, 'leftEar')
  const rightEar = getKeypointByName(kps, 'rightEar')
  const leftEye = getKeypointByName(kps, 'leftEye')
  const rightEye = getKeypointByName(kps, 'rightEye')
  const nose = getKeypointByName(kps, 'nose')

  return buildDetectionResult(
    leftShoulder, rightShoulder, leftHip, rightHip,
    leftKnee, rightKnee, leftAnkle, rightAnkle,
    leftEar, rightEar, leftEye, rightEye, nose,
    kps.map((kp: any) => ({ x: kp.position?.x ?? kp.x ?? 0, y: kp.position?.y ?? kp.y ?? 0, score: kp.score ?? 0, name: kp.part || kp.name || '' })),
    imageUrl, img.naturalWidth, img.naturalHeight
  )
}

async function detectWithMoveNet(imageUrl: string): Promise<DetectionResult> {
  const detector = await loadMoveNet()
  const img = await loadImg(imageUrl)
  const poses = await detector.estimatePoses(img)
  if (!poses || poses.length === 0) {
    throw new Error('No se detectó ninguna persona en la imagen. Asegúrate de estar de frente y con buena iluminación.')
  }
  const pose = poses[0]
  const kps = pose.keypoints || []
  const leftShoulder = getKeypointByName(kps, 'left_shoulder')
  const rightShoulder = getKeypointByName(kps, 'right_shoulder')
  const leftHip = getKeypointByName(kps, 'left_hip')
  const rightHip = getKeypointByName(kps, 'right_hip')
  const leftKnee = getKeypointByName(kps, 'left_knee')
  const rightKnee = getKeypointByName(kps, 'right_knee')
  const leftAnkle = getKeypointByName(kps, 'left_ankle')
  const rightAnkle = getKeypointByName(kps, 'right_ankle')
  const leftEar = getKeypointByName(kps, 'left_ear')
  const rightEar = getKeypointByName(kps, 'right_ear')
  const leftEye = getKeypointByName(kps, 'left_eye')
  const rightEye = getKeypointByName(kps, 'right_eye')
  const nose = getKeypointByName(kps, 'nose')

  return buildDetectionResult(
    leftShoulder, rightShoulder, leftHip, rightHip,
    leftKnee, rightKnee, leftAnkle, rightAnkle,
    leftEar, rightEar, leftEye, rightEye, nose,
    kps.map((kp: any) => ({ x: kp.x, y: kp.y, score: kp.score ?? 0, name: kp.name || '' })),
    imageUrl, img.naturalWidth, img.naturalHeight
  )
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
  try {
    return await loadHuman()
  } catch {
    return await loadMoveNet()
  }
}

export async function detectPose(imageUrl: string): Promise<DetectionResult> {
  try {
    return await detectWithHuman(imageUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('No se detectó')) throw e
    console.warn('Human.js failed, falling back to MoveNet:', e)
    return await detectWithMoveNet(imageUrl)
  }
}

export function drawKeypointsOnCanvas(
  canvas: HTMLCanvasElement,
  imageUrl: string,
  keypoints: Array<{ x: number; y: number; score: number; name: string }>
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)
    ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 3
    ctx.fillStyle = '#00ff88'
    const connections = [
      ['left_shoulder', 'right_shoulder'], ['left_hip', 'right_hip'],
      ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
      ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
      ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle'],
    ]
    for (const [a, b] of connections) {
      const p1 = keypoints.find(k => k.name === a)
      const p2 = keypoints.find(k => k.name === b)
      if (p1 && p2 && p1.score > 0.3 && p2.score > 0.3) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
      }
    }
    for (const kp of keypoints) {
      if (kp.score > 0.3) {
        ctx.beginPath(); ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke()
      }
    }
  }
  img.src = imageUrl
}
