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

type PoseDetectorType = any

let detectorPromise: Promise<PoseDetectorType> | null = null
let isLoading = false
let loadError: string | null = null

function getKeypointByName(keypoints: Array<{ x: number; y: number; score?: number; name?: string }>, name: string): { x: number; y: number; score: number } {
  const found = keypoints.find(k => k.name === name || k.name?.toLowerCase() === name.toLowerCase())
  if (found) return { x: found.x, y: found.y, score: found.score ?? 0 }
  return { x: 0, y: 0, score: 0 }
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function getLoadStatus() {
  return { isLoading, loadError, hasDetector: detectorPromise !== null }
}

export async function loadPoseDetector(): Promise<PoseDetectorType> {
  if (detectorPromise) return detectorPromise

  isLoading = true
  loadError = null

  detectorPromise = (async () => {
    try {
      const [tf, poseDetection] = await Promise.all([
        import('@tensorflow/tfjs-core'),
        import('@tensorflow/tfjs-backend-webgl'),
        import('@tensorflow-models/pose-detection'),
      ])
      await tf.ready()
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      )
      isLoading = false
      return detector
    } catch (err) {
      isLoading = false
      loadError = err instanceof Error ? err.message : 'Error al cargar el modelo de detección'
      detectorPromise = null
      throw new Error(loadError!)
    }
  })()

  return detectorPromise
}

export async function detectPose(imageUrl: string): Promise<DetectionResult> {
  const detector = await loadPoseDetector()
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = imageUrl
  })
  const poses = await detector.estimatePoses(img)
  if (!poses || poses.length === 0) {
    throw new Error('No se detectó ninguna persona en la imagen. Asegúrate de estar de frente y con buena iluminación.')
  }
  const pose = poses[0]
  const keypoints = pose.keypoints || []
  const leftShoulder = getKeypointByName(keypoints, 'left_shoulder')
  const rightShoulder = getKeypointByName(keypoints, 'right_shoulder')
  const leftHip = getKeypointByName(keypoints, 'left_hip')
  const rightHip = getKeypointByName(keypoints, 'right_hip')
  const leftKnee = getKeypointByName(keypoints, 'left_knee')
  const rightKnee = getKeypointByName(keypoints, 'right_knee')
  const leftAnkle = getKeypointByName(keypoints, 'left_ankle')
  const rightAnkle = getKeypointByName(keypoints, 'right_ankle')
  const leftEar = getKeypointByName(keypoints, 'left_ear')
  const rightEar = getKeypointByName(keypoints, 'right_ear')
  const leftEye = getKeypointByName(keypoints, 'left_eye')
  const rightEye = getKeypointByName(keypoints, 'right_eye')
  const nose = getKeypointByName(keypoints, 'nose')

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
  const shoulderCenterX = shoulderCenter.x
  const shoulderCenterY = shoulderCenter.y
  const hipCenterX = hipCenter.x
  const hipCenterY = hipCenter.y
  const torsoHeight = Math.abs(hipCenterY - shoulderCenterY)
  const bodyCenterX = (shoulderCenterX + hipCenterX) / 2
  const bodyCenterY = (shoulderCenterY + hipCenterY) / 2
  const waistY = landmarks.waist.y
  const torsoAngle = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * (180 / Math.PI)
  const legLength = (leftAnkle.score > 0.3 && rightAnkle.score > 0.3)
    ? Math.abs(ankleCenter.y - hipCenterY)
    : (leftKnee.score > 0.3 && rightKnee.score > 0.3 ? Math.abs(kneeCenter.y - hipCenterY) * 1.8 : torsoHeight * 1.35)
  const noseY = nose.score > 0.3
    ? nose.y
    : (leftEye.score > 0.3 && rightEye.score > 0.3
      ? (leftEye.y + rightEye.y) / 2 - shoulderWidth * 0.35
      : shoulderCenterY - shoulderWidth * 0.35)
  const headHeight = leftEar.score > 0.3 && rightEar.score > 0.3
    ? Math.abs((leftEar.y + rightEar.y) / 2 - noseY)
    : shoulderWidth * 0.4

  const dimensions: BodyDimensions = {
    shoulderWidth,
    hipWidth,
    waistWidth,
    torsoHeight,
    legLength,
    bodyCenterX,
    bodyCenterY,
    waistY,
    torsoAngle,
    headHeight,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
  }

  return { landmarks, dimensions, keypoints, imageUrl }
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
      ['left_shoulder', 'right_shoulder'],
      ['left_hip', 'right_hip'],
      ['left_knee', 'right_knee'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['right_hip', 'right_knee'],
      ['left_knee', 'left_ankle'],
      ['right_knee', 'right_ankle'],
      ['left_shoulder', 'left_ear'],
      ['right_shoulder', 'right_ear'],
      ['left_ear', 'left_eye'],
      ['right_ear', 'right_eye'],
    ]
    for (const [a, b] of connections) {
      const p1 = keypoints.find(k => k.name === a)
      const p2 = keypoints.find(k => k.name === b)
      if (p1 && p2 && p1.score > 0.3 && p2.score > 0.3) {
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }
    for (const kp of keypoints) {
      if (kp.score > 0.3) {
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
  }
  img.src = imageUrl
}
