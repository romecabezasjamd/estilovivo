import type { Keypoint } from '@tensorflow-models/pose-detection'

export interface BodyPose {
  leftShoulder: Keypoint
  rightShoulder: Keypoint
  leftHip: Keypoint
  rightHip: Keypoint
  leftKnee: Keypoint
  rightKnee: Keypoint
  leftAnkle: Keypoint
  rightAnkle: Keypoint
  nose: Keypoint
  shoulderCenter: { x: number; y: number }
  hipCenter: { x: number; y: number }
  shoulderWidth: number
  hipWidth: number
  torsoHeight: number
  fullHeight: number
}

let detector: any = null
let loading = false
let loadPromise: Promise<void> | null = null

async function ensureDetector(): Promise<void> {
  if (detector) return
  if (loadPromise) return loadPromise

  loading = true
  loadPromise = (async () => {
    try {
      const tfjs = await import('@tensorflow/tfjs-core')
      await import('@tensorflow/tfjs-backend-webgl')
      const backend = 'webgl'
      if (!tfjs.getBackend || tfjs.getBackend() !== backend) {
        await tfjs.setBackend(backend)
      }
      await tfjs.ready()

      const poseDetection = await import('@tensorflow-models/pose-detection')
      detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
        enableSmoothing: false,
      })
    } catch (e) {
      detector = null
      throw e
    } finally {
      loading = false
    }
  })()

  return loadPromise
}

function findKeypoint(keypoints: Keypoint[], name: string): Keypoint | undefined {
  return keypoints.find(k => k.name === name)
}

function kp(k: Keypoint | undefined, fallback: { x: number; y: number }): Keypoint {
  if (k && k.score && k.score > 0.3) return k
  return { x: fallback.x, y: fallback.y, score: 0 }
}

export async function detectBodyPose(imageUrl: string): Promise<BodyPose | null> {
  try {
    await ensureDetector()
    if (!detector) return null

    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image()
      el.crossOrigin = 'anonymous'
      el.onload = () => res(el)
      el.onerror = () => rej(new Error('Failed to load image'))
      el.src = imageUrl
    })

    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout')), 5000))
    const poses = await Promise.race([detector.estimatePoses(img), timeout]) as Array<{ keypoints: Keypoint[] }>

    if (!poses || poses.length === 0) return null

    const kps = poses[0].keypoints
    const ls = kp(findKeypoint(kps, 'left_shoulder'), { x: img.naturalWidth * 0.35, y: img.naturalHeight * 0.22 })
    const rs = kp(findKeypoint(kps, 'right_shoulder'), { x: img.naturalWidth * 0.65, y: img.naturalHeight * 0.22 })
    const lh = kp(findKeypoint(kps, 'left_hip'), { x: img.naturalWidth * 0.38, y: img.naturalHeight * 0.52 })
    const rh = kp(findKeypoint(kps, 'right_hip'), { x: img.naturalWidth * 0.62, y: img.naturalHeight * 0.52 })
    const lk = kp(findKeypoint(kps, 'left_knee'), { x: img.naturalWidth * 0.4, y: img.naturalHeight * 0.72 })
    const rk = kp(findKeypoint(kps, 'right_knee'), { x: img.naturalWidth * 0.6, y: img.naturalHeight * 0.72 })
    const la = kp(findKeypoint(kps, 'left_ankle'), { x: img.naturalWidth * 0.4, y: img.naturalHeight * 0.92 })
    const ra = kp(findKeypoint(kps, 'right_ankle'), { x: img.naturalWidth * 0.6, y: img.naturalHeight * 0.92 })
    const nose = kp(findKeypoint(kps, 'nose'), { x: img.naturalWidth * 0.5, y: img.naturalHeight * 0.12 })

    const shoulderCenter = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
    const hipCenter = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
    const shoulderWidth = Math.abs(rs.x - ls.x)
    const hipWidth = Math.abs(rh.x - lh.x)
    const torsoHeight = Math.abs(hipCenter.y - shoulderCenter.y)
    const fullHeight = Math.abs(la.y - nose.y)

    return {
      leftShoulder: ls, rightShoulder: rs,
      leftHip: lh, rightHip: rh,
      leftKnee: lk, rightKnee: rk,
      leftAnkle: la, rightAnkle: ra,
      nose,
      shoulderCenter, hipCenter,
      shoulderWidth, hipWidth, torsoHeight, fullHeight,
    }
  } catch {
    return null
  }
}

export function smartAutoPlace(pose: BodyPose, type: string, bodyW: number, bodyH: number) {
  const t = type.toLowerCase()
  let w: number, h: number, x: number, y: number

  if (/dress|vestido|enterizo/.test(t)) {
    w = pose.shoulderWidth * 1.3
    h = pose.torsoHeight * 1.6
    x = pose.shoulderCenter.x - w / 2
    y = pose.shoulderCenter.y - pose.torsoHeight * 0.08
  } else if (/bottom|pantal|falda|short|jean|trouser/.test(t)) {
    w = pose.hipWidth * 1.15
    h = pose.torsoHeight * 0.85
    x = pose.hipCenter.x - w / 2
    y = pose.hipCenter.y - h * 0.1
  } else if (/outer|chaqueta|abrigo|saco|jacket|coat/.test(t)) {
    w = pose.shoulderWidth * 1.4
    h = pose.torsoHeight * 1.1
    x = pose.shoulderCenter.x - w / 2
    y = pose.shoulderCenter.y - pose.torsoHeight * 0.12
  } else if (/shoe|zapat|bota|sandal|boot/.test(t)) {
    const ankleY = (pose.leftAnkle.y + pose.rightAnkle.y) / 2
    const ankleCenterX = (pose.leftAnkle.x + pose.rightAnkle.x) / 2
    w = pose.shoulderWidth * 0.5
    h = pose.fullHeight * 0.06
    x = ankleCenterX - w / 2
    y = ankleY - h * 0.3
  } else if (/accesorio|sombrero|gorra|bolso|gafas|collar/.test(t)) {
    w = pose.shoulderWidth * 0.6
    h = pose.fullHeight * 0.08
    x = pose.nose.x - w / 2
    y = pose.nose.y - h * 0.8
  } else {
    w = pose.shoulderWidth * 1.1
    h = pose.torsoHeight * 0.9
    x = pose.shoulderCenter.x - w / 2
    y = pose.shoulderCenter.y - pose.torsoHeight * 0.05
  }

  x = Math.max(0, Math.min(x, bodyW - w))
  y = Math.max(0, Math.min(y, bodyH - h))

  return { x, y, width: w, height: h, rotation: 0, opacity: 1 }
}
