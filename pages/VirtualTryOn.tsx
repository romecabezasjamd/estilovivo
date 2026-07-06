import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Garment } from '../types'
import {
  X, ArrowLeft, Camera, Image as ImageIcon, Shirt, RefreshCcw,
  Save, Share2, CheckCircle, AlertCircle, Loader, Sparkles, Upload,
  Layers, ChevronUp, ChevronDown, Plus
} from 'lucide-react'
import PoseGuide from '../components/PoseGuide'
import { removeBackground } from '../src/utils/garmentProcessor'
import { detectPose, loadPoseDetector, BodyDimensions } from '../src/utils/poseDetection'
import { segmentPerson, SegmentationResult } from '../src/utils/bodySegmentationNew'
import { renderMultiTryOn, GarmentAdjustments } from '../src/utils/garmentOverlay'
import { pickPhoto, CameraSource } from '../src/utils/cameraPhoto'
import { api } from '../services/api'
import { successImpact, errorImpact } from '../src/utils/haptic'

interface VirtualTryOnProps {
  user?: { id?: string; name: string; fullBodyAvatar?: string }
  garments: Garment[]
  initialGarment?: Garment | null
  initialMode?: 'manual' | 'ai'
  onSaveLook: (look: { name: string; garmentIds: string[]; imageBlob?: Blob }) => Promise<void>
  onClose: () => void
  onNavigate?: (tab: string, subTab?: string) => void
}

type Step = 'guide' | 'photo' | 'detecting' | 'select' | 'processing' | 'tryon' | 'saving' | 'saved'

const RENDER_TIMEOUT = 20000
const PROCESS_TIMEOUT = 20000
const DETECT_TIMEOUT = 12000
const SEG_TIMEOUT = 8000
const SAFETY_TIMEOUT = 30000

const FALLBACK: BodyDimensions = {
  shoulderWidth: 200, hipWidth: 200, waistWidth: 180,
  torsoHeight: 220, legLength: 260,
  bodyCenterX: 200, bodyCenterY: 300, waistY: 320,
  torsoAngle: 0, headHeight: 50, imageWidth: 400, imageHeight: 600,
}

const CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'outerwear', label: 'Abrigos' },
  { id: 'dress', label: 'Vestidos' },
  { id: 'shoes', label: 'Zapatos' },
  { id: 'accessories', label: 'Accesorios' },
]

interface GarmentLayer {
  id: string
  garment: Garment
  processedUrl: string
  adjustments: Partial<GarmentAdjustments>
}

function generateId() { return Math.random().toString(36).substring(2, 9) }

export default function VirtualTryOn({ user, garments, initialGarment = null, initialMode = 'ai', onSaveLook, onClose, onNavigate }: VirtualTryOnProps) {
  const [step, setStep] = useState<Step>('guide')
  const [mode, setMode] = useState<'manual' | 'ai'>(initialMode)
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState<string | null>(user?.fullBodyAvatar || null)
  const [bodyDims, setBodyDims] = useState<BodyDimensions | null>(null)
  const [segmentation, setSegmentation] = useState<SegmentationResult | null>(null)
  const [garmentLayers, setGarmentLayers] = useState<GarmentLayer[]>([])
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lookName, setLookName] = useState('')
  const [modelLoading, setModelLoading] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [detectionKeypoints, setDetectionKeypoints] = useState<Array<{ x: number; y: number; score: number; name: string }> | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingMsg, setSavingMsg] = useState('')
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<Set<string>>(new Set())
  const [garmentFilter, setGarmentFilter] = useState('all')

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const initialPinchDist = useRef<number | null>(null)
  const startScale = useRef(1)
  const initialPinchAngle = useRef<number | null>(null)
  const startRotation = useRef(0)
  const renderLock = useRef(false)
  const adjDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const adjVersion = useRef(0)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentStepRef = useRef<Step>('guide')

  useEffect(() => { currentStepRef.current = step }, [step])

  useEffect(() => {
    return () => {
      if (safetyTimer.current) clearTimeout(safetyTimer.current)
      if (adjDebounce.current) clearTimeout(adjDebounce.current)
    }
  }, [])

  useEffect(() => {
    if (initialGarment && garmentLayers.length === 0 && !selectedGarmentIds.has(initialGarment.id)) {
      setSelectedGarmentIds(prev => new Set(prev).add(initialGarment.id))
    }
  }, [initialGarment])

  const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> => {
    let tid: ReturnType<typeof setTimeout> | null = null
    return new Promise<T>((resolve, reject) => {
      tid = setTimeout(() => reject(new Error(msg)), ms)
      p.then(resolve).catch(reject)
    }).finally(() => { if (tid) clearTimeout(tid) })
  }

  const startSafetyTimer = () => {
    if (safetyTimer.current) clearTimeout(safetyTimer.current)
    safetyTimer.current = setTimeout(() => {
      const s = currentStepRef.current
      if (s === 'processing' || s === 'detecting') {
        setError('La operación está tardando demasiado. Inténtalo de nuevo.')
        setStep('select')
      }
    }, SAFETY_TIMEOUT)
  }

  const clearSafetyTimer = () => {
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null }
  }

  const goPhoto = () => { setError(null); setResultUrl(null); setStep('photo') }

  const handlePickPhoto = async (source: CameraSource) => {
    setError(null); setResultUrl(null)
    setBodyDims(null); setDetectionKeypoints(null); setSegmentation(null); setModelLoading(false)
    try {
      const { dataUrl } = await pickPhoto(source)
      setBodyPhotoUrl(dataUrl)
      if (mode === 'manual') { setStep('select'); return }
      setStep('detecting')
      startSafetyTimer()
      await detectFn(dataUrl)
    } catch (err: any) {
      clearSafetyTimer()
      if (!String(err?.message || '').toLowerCase().includes('cancel')) {
        setError(err?.message || 'No se pudo obtener la foto')
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setError(null); setResultUrl(null)
    setBodyDims(null); setDetectionKeypoints(null); setSegmentation(null); setModelLoading(false)
    const reader = new FileReader()
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        setBodyPhotoUrl(reader.result)
        if (mode === 'manual') { setStep('select'); return }
        setStep('detecting')
        startSafetyTimer()
        await detectFn(reader.result)
      }
    }
    reader.readAsDataURL(file); e.target.value = ''
  }

  const detectFn = async (url: string) => {
    setError(null); setModelLoading(true); setSegmentation(null); setBodyDims(null)
    try {
      if (!modelLoaded) {
        await withTimeout(loadPoseDetector(), DETECT_TIMEOUT, 'El modelo de IA tardó demasiado en cargar.')
        setModelLoaded(true)
      }
      setModelLoading(false)

      const poseR = await withTimeout(detectPose(url), DETECT_TIMEOUT, 'La detección de cuerpo tardó demasiado.').catch(e => { console.warn(e); return null })

      clearSafetyTimer()

      const dims = poseR ? poseR.dimensions : FALLBACK
      const kps = poseR ? poseR.keypoints : null
      setBodyDims(dims)
      setDetectionKeypoints(kps)

      if (!poseR) {
        setError('No se pudo detectar el cuerpo. Intenta con mejor iluminación o usa modo manual.')
      }

      setStep('select')

      segmentPerson(url).then(seg => setSegmentation(seg)).catch(() => {})
    } catch (err: any) {
      setModelLoading(false)
      clearSafetyTimer()
      setError(err?.message || 'Error inesperado durante la detección')
      setBodyDims(FALLBACK)
      setStep('select')
    }
  }

  const handleModeChange = async (next: 'manual' | 'ai') => {
    if (next === mode) return
    setMode(next); setError(null); setResultUrl(null)
    setSegmentation(null); setBodyDims(null)
    if (!bodyPhotoUrl) { setStep('photo'); return }
    if (next === 'manual') {
      setStep(garmentLayers.length > 0 ? 'tryon' : 'select'); return
    }
    setStep('detecting')
    startSafetyTimer()
    await detectFn(bodyPhotoUrl)
  }

  const handleToggleGarment = (garment: Garment) => {
    setSelectedGarmentIds(prev => {
      const next = new Set(prev)
      if (next.has(garment.id)) {
        next.delete(garment.id)
      } else {
        next.add(garment.id)
      }
      return next
    })
  }

  const handleProcessSelected = async () => {
    if (selectedGarmentIds.size === 0) return
    setStep('processing')
    startSafetyTimer()

    const existingIds = new Set(garmentLayers.map(l => l.garment.id))
    const newGarments = garments.filter(g => selectedGarmentIds.has(g.id) && !existingIds.has(g.id))
    const keptLayers = garmentLayers.filter(l => selectedGarmentIds.has(l.garment.id))

    const newLayers: GarmentLayer[] = []

    for (const g of newGarments) {
      try {
        const processed = await withTimeout(
          removeBackground(g.imageUrl, { maxSize: 800 }),
          PROCESS_TIMEOUT, `El procesamiento de ${g.name} tardó demasiado`
        )
        newLayers.push({
          id: generateId(),
          garment: g,
          processedUrl: processed,
          adjustments: {},
        })
      } catch {
        newLayers.push({
          id: generateId(),
          garment: g,
          processedUrl: g.imageUrl,
          adjustments: {},
        })
      }
    }

    clearSafetyTimer()
    const allLayers = [...keptLayers, ...newLayers]
    setGarmentLayers(allLayers)
    if (allLayers.length > 0) {
      setActiveLayerId(allLayers[allLayers.length - 1].id)
    }
    setStep('tryon')
    setSelectedGarmentIds(new Set())
    await doRenderAll(allLayers)
  }

  const handleAddMoreGarments = () => {
    setSelectedGarmentIds(new Set(garmentLayers.map(l => l.garment.id)))
    setStep('select')
  }

  const doRenderAll = async (layers?: GarmentLayer[]) => {
    if (renderLock.current) return
    const activeLayers = layers || garmentLayers
    if (activeLayers.length === 0 || !bodyPhotoUrl) return

    renderLock.current = true
    try {
      const dims = bodyDims || FALLBACK
      const out = await withTimeout(
        renderMultiTryOn({
          bodyImageUrl: bodyPhotoUrl,
          garmentLayers: activeLayers.map(l => ({
            garmentImageUrl: l.processedUrl,
            garmentType: l.garment.type,
            adjustments: l.adjustments,
          })),
          bodyDimensions: dims,
          segmentation: mode === 'ai' ? segmentation : null,
          canvasWidth: 600,
          canvasHeight: 800,
        }),
        RENDER_TIMEOUT, 'La generación está tardando demasiado'
      )
      setResultUrl(out)
    } catch (err: any) {
      if (bodyPhotoUrl) setResultUrl(bodyPhotoUrl)
      setError('No se pudo procesar la combinación. Inténtalo de nuevo.')
    } finally {
      renderLock.current = false
    }
  }

  useEffect(() => {
    if (step !== 'tryon' || garmentLayers.length === 0) return
    if (adjDebounce.current) clearTimeout(adjDebounce.current)
    adjVersion.current++
    const v = adjVersion.current
    adjDebounce.current = setTimeout(() => {
      if (v === adjVersion.current && !renderLock.current) {
        setResultUrl(null)
        doRenderAll(garmentLayers)
      }
    }, 350)
    return () => { if (adjDebounce.current) clearTimeout(adjDebounce.current) }
  }, [garmentLayers])

  const resetAdj = () => {
    setGarmentLayers(prev => prev.map(l => ({ ...l, adjustments: {} })))
    if (bodyPhotoUrl) {
      setResultUrl(null)
      doRenderAll(garmentLayers.map(l => ({ ...l, adjustments: {} })))
    }
  }

  const handleRemoveLayer = (id: string) => {
    setGarmentLayers(prev => {
      const next = prev.filter(l => l.id !== id)
      if (next.length === 0) {
        setActiveLayerId(null)
        setResultUrl(null)
        setStep('select')
      } else if (activeLayerId === id) {
        setActiveLayerId(next[next.length - 1].id)
      }
      return next
    })
  }

  const handleMoveLayerUp = (index: number) => {
    if (index >= garmentLayers.length - 1) return
    setGarmentLayers(prev => {
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const handleMoveLayerDown = (index: number) => {
    if (index <= 0) return
    setGarmentLayers(prev => {
      const next = [...prev]
      ;[next[index], next[index - 1]] = [next[index - 1], next[index]]
      return next
    })
  }

  const updateActiveLayerAdj = (fn: (prev: Partial<GarmentAdjustments>) => Partial<GarmentAdjustments>) => {
    setGarmentLayers(prev => prev.map(l =>
      l.id === activeLayerId
        ? { ...l, adjustments: { ...l.adjustments, ...fn(l.adjustments) } }
        : l
    ))
  }

  const handleSave = async () => {
    if (!resultUrl || !lookName.trim() || garmentLayers.length === 0) return
    setStep('saving'); setSavingMsg('Generando imagen final...')
    try {
      const res = await fetch(resultUrl)
      const blob = await res.blob()
      setSavingMsg('Guardando en tu armario...')
      const garmentIds = garmentLayers.map(l => l.garment.id)
      await api.saveLookWithImage(lookName, garmentIds, blob)
      successImpact(); setStep('saved'); setSavingMsg('¡Look guardado con éxito!')
    } catch (err: any) {
      errorImpact(); setError(err.message || 'Error al guardar'); setStep('tryon')
    }
  }

  const touchHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      if (!activeLayerId) return
      if (e.touches.length === 1) {
        isDragging.current = true
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        isDragging.current = false
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        initialPinchDist.current = Math.hypot(dx, dy)
        initialPinchAngle.current = Math.atan2(dy, dx)
        setGarmentLayers(prev => {
          const layer = prev.find(l => l.id === activeLayerId)
          startScale.current = layer?.adjustments?.scaleX || 1
          startRotation.current = layer?.adjustments?.rotation || 0
          return prev
        })
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!activeLayerId) return
      if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0].clientX - lastPos.current.x
        const dy = e.touches[0].clientY - lastPos.current.y
        updateActiveLayerAdj(prev => ({
          offsetX: (prev.offsetX || 0) + dx * 0.5,
          offsetY: (prev.offsetY || 0) + dy * 0.5,
        }))
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2 && initialPinchDist.current !== null && initialPinchAngle.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const scale = startScale.current * (dist / initialPinchDist.current)
        const angle = Math.atan2(dy, dx)
        const delta = (angle - initialPinchAngle.current) * (180 / Math.PI)
        updateActiveLayerAdj(() => ({
          scaleX: scale, scaleY: scale,
          rotation: startRotation.current + delta,
        }))
      }
    },
    onTouchEnd: () => {
      isDragging.current = false
      initialPinchDist.current = null
      initialPinchAngle.current = null
    },
  }

  const mouseHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (!activeLayerId) return
      isDragging.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!isDragging.current || !activeLayerId) return
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      updateActiveLayerAdj(prev => ({
        offsetX: (prev.offsetX || 0) + dx * 0.5,
        offsetY: (prev.offsetY || 0) + dy * 0.5,
      }))
      lastPos.current = { x: e.clientX, y: e.clientY }
    },
    onMouseUp: () => { isDragging.current = false },
  }

  const goSocial = () => { if (onNavigate) onNavigate('social', 'create'); onClose() }
  const goChallenge = () => { if (onNavigate) onNavigate('social', 'challenge'); onClose() }

  const stepTitle: Record<Step, string> = {
    guide: 'Guía', photo: 'Foto', detecting: 'Detectando...', select: 'Prendas',
    processing: 'Procesando...', tryon: 'Probador', saving: 'Guardando...', saved: '¡Listo!',
  }

  const filteredGarments = garmentFilter === 'all'
    ? garments
    : garments.filter(g => g.type === garmentFilter)

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--bg-base)] flex flex-col font-sans">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-secondary)]">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          {(['guide', 'photo', 'select', 'tryon'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${step === s ? 'bg-primary' : i < ['guide', 'photo', 'select', 'tryon'].indexOf(step) ? 'bg-primary/50' : 'bg-[var(--border-light)]'}`} />
              {i < 3 && <div className="w-4 h-[1px] bg-[var(--border-light)]" />}
            </div>
          ))}
        </div>
        <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider">{stepTitle[step]}</span>
      </div>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--bg-card)] p-1 border border-[var(--border-light)]">
          <button onClick={() => handleModeChange('manual')}
            className={`py-2 rounded-xl text-[11px] font-bold transition-colors ${mode === 'manual' ? 'bg-primary text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}>
            Modo Manual
          </button>
          <button onClick={() => handleModeChange('ai')}
            className={`py-2 rounded-xl text-[11px] font-bold transition-colors ${mode === 'ai' ? 'bg-primary text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}>
            Modo IA
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {step === 'guide' && (
            <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
              <PoseGuide onStart={() => setStep('photo')} />
            </motion.div>
          )}

          {step === 'photo' && (
            <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-xl font-bold">Tu foto de cuerpo completo</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Necesitamos una foto tuya para colocar las prendas</p>
              </div>
              {bodyPhotoUrl && (
                <div className="relative w-full max-w-xs mx-auto aspect-[3/4] rounded-3xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)]">
                  <img src={bodyPhotoUrl} alt="" className="w-full h-full object-cover" loading="eager" />
                  <div className="absolute inset-0 ring-2 ring-primary/30 ring-inset rounded-3xl pointer-events-none" />
                </div>
              )}
              <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
                <button onClick={() => handlePickPhoto(CameraSource.Camera)} className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg shadow-primary/30">
                  <Camera size={20} /><span>Tomar foto con cámara</span>
                </button>
                <button onClick={() => handlePickPhoto(CameraSource.Photos)} className="w-full py-4 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl font-bold flex items-center justify-center gap-3 border border-[var(--border-light)] active:scale-[0.98] transition-all">
                  <ImageIcon size={20} /><span>Elegir de la galería</span>
                </button>
                <label className="w-full py-4 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl font-bold flex items-center justify-center gap-3 border border-dashed border-[var(--border-light)] cursor-pointer active:scale-[0.98] transition-all">
                  <Upload size={20} /><span>Subir foto</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {step === 'detecting' && (
            <motion.div key="detecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center p-10 gap-6 min-h-[60vh]">
              {modelLoading ? <Loader size={40} className="text-primary animate-spin" /> : <Sparkles size={40} className="text-primary animate-pulse" />}
              <div className="text-center">
                <h3 className="text-lg font-bold">{modelLoading ? 'Cargando motor de IA...' : 'Analizando tu foto...'}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{modelLoading ? 'Primera carga puede tardar unos segundos' : 'Detectando cuerpo, postura y segmentación'}</p>
              </div>
              {error && (
                <div className="flex flex-col items-center gap-3 max-w-xs">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => { setError(null); setStep('photo') }} className="flex-1 py-3 rounded-xl border border-[var(--border-light)] text-[var(--text-secondary)] text-xs font-bold">Volver</button>
                    <button onClick={() => { setError(null); if (bodyPhotoUrl) { startSafetyTimer(); detectFn(bodyPhotoUrl) } }} className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/30">Reintentar</button>
                  </div>
                  <button onClick={() => { setError(null); setMode('manual'); setStep('select') }} className="text-xs text-[var(--text-muted)] font-bold underline underline-offset-2">Usar modo manual</button>
                </div>
              )}
            </motion.div>
          )}

          {step === 'select' && bodyPhotoUrl && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col gap-4">
              <div className="relative w-full max-w-xs mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)]">
                <img src={bodyPhotoUrl} alt="" className="w-full h-full object-cover" loading="eager" />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] font-bold">{mode === 'ai' ? 'Modo IA' : 'Modo Manual'}</div>
              </div>
              {mode === 'ai' && detectionKeypoints && detectionKeypoints.some(k => k.score > 0.3) && (
                <div className="text-center">
                  <p className="text-xs text-green-600 dark:text-green-400 font-bold">✓ Cuerpo detectado</p>
                  {bodyDims && <p className="text-[10px] text-[var(--text-muted)]">Hombros: {Math.round(bodyDims.shoulderWidth)}px</p>}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2"><Shirt size={18} /> Elige prendas</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Selecciona varias prendas para probar. Se superpondrán por capas.
                </p>
              </div>
              {error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-3 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">{error}</p>
                </div>
              )}

              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setGarmentFilter(cat.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
                      garmentFilter === cat.id
                        ? 'bg-primary text-white'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)]'
                    }`}>
                    {cat.label}
                  </button>
                ))}
              </div>

              {filteredGarments.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)]">
                  <Shirt size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No tienes prendas en esta categoría</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 pb-6">
                  {filteredGarments.map(g => {
                    const isSelected = selectedGarmentIds.has(g.id)
                    return (
                      <button key={g.id} onClick={() => handleToggleGarment(g)}
                        className={`relative aspect-square rounded-2xl border-2 p-2 flex items-center justify-center transition-all active:scale-95 ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                            : 'border-[var(--border-light)] bg-[var(--bg-card)] hover:border-primary/50'
                        }`}>
                        <img src={g.imageUrl} alt={g.name} className="max-w-full max-h-full object-contain" loading="eager" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="sticky bottom-0 bg-[var(--bg-base)] pt-2 pb-4 flex flex-col gap-2">
                {selectedGarmentIds.size > 0 && (
                  <div className="text-center text-xs text-[var(--text-secondary)]">
                    {selectedGarmentIds.size} prenda{selectedGarmentIds.size !== 1 ? 's' : ''} seleccionada{selectedGarmentIds.size !== 1 ? 's' : ''}
                  </div>
                )}
                <button onClick={handleProcessSelected} disabled={selectedGarmentIds.size === 0}
                  className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    selectedGarmentIds.size > 0
                      ? 'bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-light)]'
                  }`}>
                  <Layers size={16} /> Probar combinación
                </button>
                <button onClick={goPhoto} className="w-full py-3 rounded-xl border border-[var(--border-light)] text-[var(--text-secondary)] text-xs font-bold">Tomar otra foto</button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center p-10 gap-4 min-h-[60vh]">
              <Loader size={40} className="text-primary animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-bold">Procesando prendas</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Eliminando fondos y preparando para superposición</p>
              </div>
              <div className="flex gap-3 mt-2">
                {garments.filter(g => selectedGarmentIds.has(g.id)).map(g => (
                  <div key={g.id} className="flex flex-col items-center gap-1">
                    <img src={g.imageUrl} alt="" className="w-14 h-14 object-contain opacity-50 rounded-lg bg-[var(--bg-card)]" loading="eager" />
                    <span className="text-[10px] text-[var(--text-muted)]">{g.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'tryon' && (
            <motion.div key="tryon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              <div
                className="flex-1 relative flex items-center justify-center bg-black/5 dark:bg-white/5 p-4 select-none overflow-hidden"
                ref={containerRef}
                {...touchHandlers}
                {...mouseHandlers}
              >
                {resultUrl ? (
                  <img src={resultUrl} alt="Probador virtual" className="max-w-full max-h-full object-contain rounded-2xl shadow-xl" draggable={false} loading="eager" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                    <Loader size={32} className="animate-spin" />
                    <p className="text-sm">Generando...</p>
                    {error && (
                      <div className="flex flex-col items-center gap-2 mt-2">
                        <p className="text-xs text-red-500 text-center max-w-[260px]">{error}</p>
                        <button onClick={() => { setError(null); if (bodyPhotoUrl) doRenderAll() }}
                          className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">Reintentar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[var(--bg-card)] border-t border-[var(--border-light)]">
                {garmentLayers.length > 1 && (
                  <div className="px-4 pt-3 pb-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Layers size={14} className="text-[var(--text-secondary)]" />
                      <span className="text-[11px] font-bold text-[var(--text-secondary)]">Capas</span>
                      <span className="text-[10px] text-[var(--text-muted)]">(toca para activar)</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {garmentLayers.map((layer, i) => (
                        <div key={layer.id}
                          onClick={() => setActiveLayerId(layer.id)}
                          className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            activeLayerId === layer.id
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-[var(--border-light)] bg-[var(--bg-base)] hover:border-primary/50'
                          }`}>
                          <img src={layer.garment.imageUrl} alt="" className="w-8 h-8 object-contain rounded-lg" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold truncate max-w-[80px]">{layer.garment.name}</p>
                            <p className="text-[9px] text-[var(--text-muted)]">Capa {i + 1}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 ml-1">
                            <button onClick={(e) => { e.stopPropagation(); handleMoveLayerUp(i) }}
                              disabled={i >= garmentLayers.length - 1}
                              className={`p-0.5 rounded ${i >= garmentLayers.length - 1 ? 'opacity-20' : 'hover:bg-[var(--bg-card)]'}`}>
                              <ChevronUp size={10} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleMoveLayerDown(i) }}
                              disabled={i <= 0}
                              className={`p-0.5 rounded ${i <= 0 ? 'opacity-20' : 'hover:bg-[var(--bg-card)]'}`}>
                              <ChevronDown size={10} />
                            </button>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleRemoveLayer(layer.id) }}
                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--text-muted)] hover:text-red-500 ml-0.5">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">
                      {activeLayerId
                        ? `Ajustando: ${garmentLayers.find(l => l.id === activeLayerId)?.garment.name || ''}`
                        : 'Toca una capa para ajustarla'}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={handleAddMoreGarments} className="text-[10px] text-primary font-bold flex items-center gap-1">
                        <Plus size={12} /> Añadir
                      </button>
                      <button onClick={resetAdj} className="text-[10px] text-primary font-bold flex items-center gap-1">
                        <RefreshCcw size={12} /> Restablecer
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSavingName(true)} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-[0.98] transition-all shadow-lg shadow-primary/30">
                      <Save size={16} /> Guardar look
                    </button>
                    <button onClick={goSocial} className="flex-1 py-3 bg-[var(--bg-base)] text-[var(--text-primary)] rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[var(--border-light)] active:scale-[0.98] transition-all">
                      <Share2 size={16} /> Publicar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'saving' && (
            <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center p-10 gap-4 min-h-[60vh]">
              <Loader size={40} className="text-primary animate-spin" />
              <p className="text-sm font-bold">{savingMsg}</p>
            </motion.div>
          )}

          {step === 'saved' && (
            <motion.div key="saved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center p-10 gap-6 min-h-[60vh]">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle size={40} className="text-green-500" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">Look guardado</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Tu probador virtual se ha guardado como look</p>
              </div>
              {resultUrl && <img src={resultUrl} alt="Resultado" className="w-40 h-52 object-contain rounded-2xl shadow-lg border border-[var(--border-light)]" loading="eager" />}
              <div className="flex gap-3 w-full max-w-xs">
                <button onClick={goSocial} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/30">
                  <Share2 size={16} /> Publicar
                </button>
                <button onClick={goChallenge} className="flex-1 py-3 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl font-bold text-xs uppercase tracking-wider border border-[var(--border-light)]">
                  Reto
                </button>
              </div>
              <button onClick={onClose} className="text-sm text-[var(--text-muted)] font-bold underline underline-offset-2">Volver al inicio</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {savingName && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--bg-card)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border-light)]">
              <h3 className="text-lg font-bold mb-1">Nombre del look</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">¿Cómo quieres llamar a este look?</p>
              <input autoFocus value={lookName} onChange={e => setLookName(e.target.value)} placeholder="Ej: Outfit primavera"
                className="w-full bg-[var(--bg-base)] border border-[var(--border-light)] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                onKeyDown={e => { if (e.key === 'Enter' && lookName.trim()) handleSave() }} />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setSavingName(false)} className="flex-1 py-3 bg-[var(--bg-base)] text-[var(--text-secondary)] rounded-xl font-bold text-xs">Cancelar</button>
                <button onClick={handleSave} disabled={!lookName.trim()} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs disabled:opacity-50 shadow-lg shadow-primary/30">Guardar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && step !== 'photo' && step !== 'select' && step !== 'detecting' && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-20 left-4 right-4 bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-xl z-40">
            <AlertCircle size={18} className="flex-shrink-0" />
            <p className="text-xs font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-white/80"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
