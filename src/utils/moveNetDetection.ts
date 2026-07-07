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

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

let detector: any = null
let detectorLoading = false
let detectorInitP: Promise<any> | null = null

async function loadMoveNet(): Promise<any> {
  if (detector) return detector
  if (detectorInitP) return detectorInitP
  detectorLoading = true
  detectorInitP = (async () => {
    try {
      const tf = await import('@tensorflow/tfjs-core')
      try {
        await import('@tensorflow/tfjs-backend-webgl')
      } catch {
        await import('@tensorflow/tfjs-backend-cpu')
      }
      await tf.ready()

      const poseDetection = await import('@tensorflow-models/pose-detection')
      const det = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
          enableSmoothing: true,
          multiPoseMaxDimension: 256,
          enableTracking: false,
        }
      )
      detector = det
      detectorLoading = false
      return det
    } catch (e) {
      detectorLoading = false
      detectorInitP = null
      throw new Error(e instanceof Error ? e.message : 'Error al cargar MoveNet')
    }
  })()
  return detectorInitP
}

function kp(keypoints: any[], name: string) {
  const k = keypoints.find((p: any) =>
    p.name === name || p.part === name ||
    p.name?.toLowerCase() === name.toLowerCase() ||
    p.part?.toLowerCase() === name.toLowerCase()
  )
  return k ? { x: k.x ?? k.position?.x ?? 0, y: k.y ?? k.y ?? 0, score: k.score ?? 0 } : { x: 0, y: 0, score: 0 }
}

export async function loadPoseDetector(): Promise<any> {
  return await loadMoveNet()
}

export async function detectPose(imageUrl: string): Promise<DetectionResult> {
  const det = await loadMoveNet()
  const img = await loadImg(imageUrl)

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = img.naturalWidth
  tempCanvas.height = img.naturalHeight
  const tctx = tempCanvas.getContext('2d')!
  tctx.drawImage(img, 0, 0)

  const poses = await Promise.race([
    det.estimatePoses(tempCanvas),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MoveNet timeout')), 15000)),
  ])

  if (!poses || poses.length === 0 || !poses[0].keypoints) {
    throw new Error('No se detecto ninguna persona. Asegurate de estar de frente y con buena iluminacion.')
  }

  const kps = poses[0].keypoints
  const leftShoulder = kp(kps, 'left_shoulder')
  const rightShoulder = kp(kps, 'right_shoulder')
  const leftHip = kp(kps, 'left_hip')
  const rightHip = kp(kps, 'right_hip')
  const leftKnee = kp(kps, 'left_knee')
  const rightKnee = kp(kps, 'right_knee')
  const leftAnkle = kp(kps, 'left_ankle')
  const rightAnkle = kp(kps, 'right_ankle')
  const leftEar = kp(kps, 'left_ear')
  const rightEar = kp(kps, 'right_ear')
  const leftEye = kp(kps, 'left_eye')
  const rightEye = kp(kps, 'right_eye')
  const nose = kp(kps, 'nose')

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
    imageWidth: img.naturalWidth, imageHeight: img.naturalHeight,
  }

  const rawKps = kps.map((k: any) => ({
    x: k.x ?? k.position?.x ?? 0,
    y: k.y ?? k.position?.y ?? 0,
    score: k.score ?? 0,
    name: k.name || k.part || '',
  }))

  return { landmarks, dimensions, keypoints: rawKps, imageUrl }
}
