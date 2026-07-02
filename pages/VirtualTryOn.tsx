import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Garment, Look } from '../types'
import {
  X, ArrowLeft, Camera, Image as ImageIcon, Check, Shirt, RefreshCcw,
  ZoomIn, ZoomOut, RotateCw, Sun, Moon, Maximize, Save, Share2,
  CheckCircle, AlertCircle, Loader, Sparkles, Move, Sliders,
  Plus, Upload
} from 'lucide-react'
import PoseGuide from '../components/PoseGuide'
import { removeBackground } from '../src/utils/garmentProcessor'
import { detectPose, loadPoseDetector, getLoadStatus, drawKeypointsOnCanvas, BodyDimensions, BodyLandmarks } from '../src/utils/bodyDetection'
import { renderTryOn, GarmentAdjustments, calculateGarmentTransform } from '../src/utils/tryOnRenderer'
import { pickPhoto, CameraSource, dataUrlToFile } from '../src/utils/cameraPhoto'
import { api } from '../services/api'
import { successImpact, errorImpact, lightImpact } from '../src/utils/haptic'

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

const AI_LOAD_TIMEOUT_MS = 20000
const AI_ERROR_MESSAGE = 'No se pudo generar el modelo IA. Inténtalo de nuevo.'

const getFallbackBodyDims = (): BodyDimensions => ({
  shoulderWidth: 200,
  hipWidth: 200,
  waistWidth: 180,
  torsoHeight: 220,
  legLength: 260,
  bodyCenterX: 200,
  bodyCenterY: 300,
  waistY: 320,
  torsoAngle: 0,
  headHeight: 50,
  imageWidth: 400,
  imageHeight: 600,
})

export default function VirtualTryOn({ user, garments, initialGarment = null, initialMode = 'ai', onSaveLook, onClose, onNavigate }: VirtualTryOnProps) {
  const [step, setStep] = useState<Step>('guide')
  const [mode, setMode] = useState<'manual' | 'ai'>(initialMode)
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState<string | null>(user?.fullBodyAvatar || null)
  const [bodyPhotoFile, setBodyPhotoFile] = useState<File | null>(null)
  const [bodyDims, setBodyDims] = useState<BodyDimensions | null>(null)
  const [bodyLandmarks, setBodyLandmarks] = useState<BodyLandmarks | null>(null)
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(initialGarment)
  const [processedGarmentUrl, setProcessedGarmentUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adjustments, setAdjustments] = useState<Partial<GarmentAdjustments>>({})
  const [lookName, setLookName] = useState('')
  const [modelLoading, setModelLoading] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [detectionKeypoints, setDetectionKeypoints] = useState<Array<{ x: number; y: number; score: number; name: string }> | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingMsg, setSavingMsg] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const initialPinchDist = useRef<number | null>(null)
  const startScale = useRef(1)
  const initialPinchAngle = useRef<number | null>(null)
  const startRotation = useRef(0)

  useEffect(() => {
    if (initialGarment && !selectedGarment) {
      setSelectedGarment(initialGarment)
    }
  }, [initialGarment, selectedGarment])

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      return await new Promise<T>((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        promise.then(resolve).catch(reject)
      })
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  useEffect(() => {
    const status = getLoadStatus()
    if (status.isLoading) setModelLoading(true)
    if (status.hasDetector) {
      setModelLoaded(true)
      setModelLoading(false)
    }
    if (status.loadError) {
      setModelLoading(false)
    }
  }, [])

  const handlePoseGuideDone = () => setStep('photo')

  const clearDetectionState = () => {
    setBodyDims(null)
    setBodyLandmarks(null)
    setDetectionKeypoints(null)
    setModelLoading(false)
  }

  const handlePickPhoto = async (source: CameraSource) => {
    setError(null)
    setResultUrl(null)
    setProcessedGarmentUrl(null)
    clearDetectionState()
    try {
      const { dataUrl, file } = await pickPhoto(source)
      setBodyPhotoUrl(dataUrl)
      setBodyPhotoFile(file)
      if (mode === 'manual') {
        setStep('select')
      } else {
        setStep('detecting')
        await runDetection(dataUrl)
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '')
      if (!msg.toLowerCase().includes('cancel')) {
        setError(msg || 'No se pudo obtener la foto')
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setResultUrl(null)
    setProcessedGarmentUrl(null)
    clearDetectionState()
    const reader = new FileReader()
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        setBodyPhotoUrl(reader.result)
        if (mode === 'manual') {
          setStep('select')
        } else {
          setStep('detecting')
          await runDetection(reader.result)
        }
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const runDetection = async (imageUrl: string) => {
    setError(null)
    setModelLoading(true)
    try {
      if (!modelLoaded) {
        await withTimeout(loadPoseDetector(), AI_LOAD_TIMEOUT_MS, AI_ERROR_MESSAGE)
        setModelLoaded(true)
      }
      setModelLoading(false)
      const result = await withTimeout(detectPose(imageUrl), AI_LOAD_TIMEOUT_MS, AI_ERROR_MESSAGE)
      setBodyDims(result.dimensions)
      setBodyLandmarks(result.landmarks)
      setDetectionKeypoints(result.keypoints)
      setStep('select')
    } catch (err: any) {
      setModelLoading(false)
      const msg = err?.message || AI_ERROR_MESSAGE
      setError(msg.includes('timeout') || msg.includes('Timeout')
        ? 'La carga del modelo está tardando demasiado. Verifica tu conexión a internet.'
        : msg)
      setStep('detecting')
    }
  }

  const handleModeChange = async (nextMode: 'manual' | 'ai') => {
    if (nextMode === mode) return
    setMode(nextMode)
    setError(null)
    setResultUrl(null)
    setProcessedGarmentUrl(null)

    if (!bodyPhotoUrl) {
      setStep('photo')
      return
    }

    if (nextMode === 'manual') {
      clearDetectionState()
      setStep(selectedGarment ? 'tryon' : 'select')
      return
    }

    setStep('detecting')
    await runDetection(bodyPhotoUrl)
  }

  const handleSelectGarment = async (garment: Garment) => {
    setSelectedGarment(garment)
    setStep('processing')
    setError(null)
    setResultUrl(null)
    const nextGarment = garment
    try {
      const processed = await removeBackground(garment.imageUrl, { maxSize: 800 })
      setProcessedGarmentUrl(processed)
      setStep('tryon')
      await renderComposite(processed, nextGarment)
    } catch (err: any) {
      setProcessedGarmentUrl(garment.imageUrl)
      setStep('tryon')
      await renderComposite(garment.imageUrl, nextGarment)
    }
  }

  const renderComposite = async (garmentUrl: string, garment: Garment | null = selectedGarment) => {
    if (!bodyPhotoUrl || !garment) return
    try {
      const dims = bodyDims || getFallbackBodyDims()
      const result = await renderTryOn({
        bodyImageUrl: bodyPhotoUrl,
        garmentImageUrl: garmentUrl,
        garmentType: garment.type,
        bodyDimensions: dims,
        adjustments,
        canvasWidth: 600,
        canvasHeight: 800,
      })
      setResultUrl(result)
    } catch (err: any) {
      setError('Error al generar la previsualización: ' + (err.message || ''))
    }
  }

  useEffect(() => {
    if (step === 'tryon' && processedGarmentUrl && bodyPhotoUrl && selectedGarment) {
      renderComposite(processedGarmentUrl, selectedGarment)
    }
  }, [adjustments, step, processedGarmentUrl, bodyPhotoUrl, selectedGarment, bodyDims])

  const handleAdjust = (key: keyof GarmentAdjustments, value: number) => {
    lightImpact()
    setAdjustments(prev => ({ ...prev, [key]: (prev[key] || 0) + value }))
  }

  const resetAdjustments = () => {
    lightImpact()
    setAdjustments({})
  }

  const handleSave = async () => {
    if (!resultUrl || !lookName.trim() || !selectedGarment) return
    setStep('saving')
    setSavingMsg('Generando imagen final...')
    try {
      const res = await fetch(resultUrl)
      const blob = await res.blob()
      setSavingMsg('Guardando en tu armario...')
      const productIds = [selectedGarment.id]
      await api.saveLookWithImage(lookName, productIds, blob)
      successImpact()
      setStep('saved')
      setSavingMsg('¡Look guardado con éxito!')
    } catch (err: any) {
      errorImpact()
      setError(err.message || 'Error al guardar')
      setStep('tryon')
    }
  }

  const canvasHandlers = {
    onMouseDown: (e: React.MouseEvent) => { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } },
    onMouseMove: (e: React.MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      setAdjustments(prev => ({ ...prev, offsetX: (prev.offsetX || 0) + dx * 0.5, offsetY: (prev.offsetY || 0) + dy * 0.5 }))
      lastPos.current = { x: e.clientX, y: e.clientY }
    },
    onMouseUp: () => { isDragging.current = false },
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        isDragging.current = false
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        initialPinchDist.current = Math.hypot(dx, dy)
        initialPinchAngle.current = Math.atan2(dy, dx)
        startScale.current = adjustments.scaleX || 1
        startRotation.current = adjustments.rotation || 0
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0].clientX - lastPos.current.x
        const dy = e.touches[0].clientY - lastPos.current.y
        setAdjustments(prev => ({ ...prev, offsetX: (prev.offsetX || 0) + dx * 0.5, offsetY: (prev.offsetY || 0) + dy * 0.5 }))
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2 && initialPinchDist.current !== null && initialPinchAngle.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const scale = startScale.current * (dist / initialPinchDist.current)
        const currentAngle = Math.atan2(dy, dx)
        const angleDelta = (currentAngle - initialPinchAngle.current) * (180 / Math.PI)
        setAdjustments(prev => ({ ...prev, scaleX: scale, scaleY: scale, rotation: startRotation.current + angleDelta }))
      }
    },
    onTouchEnd: () => { isDragging.current = false; initialPinchDist.current = null; initialPinchAngle.current = null },
  }

  const saveToSocial = () => {
    if (onNavigate) onNavigate('social', 'create')
    onClose()
  }

  const saveToChallenge = () => {
    if (onNavigate) onNavigate('social', 'challenge')
    onClose()
  }

  const stepTitles: Record<Step, string> = {
    guide: 'Guía de pose',
    photo: 'Tu foto',
    detecting: 'Detectando...',
    select: 'Elige prenda',
    processing: 'Procesando...',
    tryon: 'Probador',
    saving: 'Guardando...',
    saved: '¡Listo!',
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--bg-base)] flex flex-col font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-[var(--bg-base)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          {(['guide', 'photo', 'select', 'tryon'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full transition-colors ${step === s ? 'bg-primary' : i < ['guide', 'photo', 'select', 'tryon'].indexOf(step) ? 'bg-primary/50' : 'bg-[var(--border-light)]'}`} />
              {i < 3 && <div className="w-4 h-[1px] bg-[var(--border-light)]" />}
            </div>
          ))}
        </div>
        <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider">{stepTitles[step]}</span>
      </div>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--bg-card)] p-1 border border-[var(--border-light)]">
          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            className={`py-2 rounded-xl text-[11px] font-bold transition-colors ${mode === 'manual' ? 'bg-primary text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
          >
            Modo Manual
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('ai')}
            className={`py-2 rounded-xl text-[11px] font-bold transition-colors ${mode === 'ai' ? 'bg-primary text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
          >
            Modo IA
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {step === 'guide' && (
            <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
              <PoseGuide onStart={handlePoseGuideDone} />
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
                  <img src={bodyPhotoUrl} alt="Tu foto" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 ring-2 ring-primary/30 ring-inset rounded-3xl pointer-events-none" />
                </div>
              )}

              <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
                <button onClick={() => handlePickPhoto(CameraSource.Camera)} className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-primary-dark active:scale-[0.98] transition-all shadow-lg shadow-primary/30">
                  <Camera size={20} />
                  <span>Tomar foto con cámara</span>
                </button>
                <button onClick={() => handlePickPhoto(CameraSource.Photos)} className="w-full py-4 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl font-bold flex items-center justify-center gap-3 border border-[var(--border-light)] active:scale-[0.98] transition-all">
                  <ImageIcon size={20} />
                  <span>Elegir de la galería</span>
                </button>
                <label className="w-full py-4 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl font-bold flex items-center justify-center gap-3 border border-dashed border-[var(--border-light)] cursor-pointer active:scale-[0.98] transition-all">
                  <Upload size={20} />
                  <span>Subir foto</span>
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
              {modelLoading ? (
                <Loader size={40} className="text-primary animate-spin" />
              ) : (
                <Sparkles size={40} className="text-primary animate-pulse" />
              )}
              <div className="text-center">
                <h3 className="text-lg font-bold">{modelLoading ? 'Cargando modelo de IA...' : 'Analizando tu foto...'}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {modelLoading ? 'Primera carga puede tardar unos segundos' : 'Detectando hombros, cintura, cadera y piernas'}
                </p>
              </div>
              {error && (
                <div className="flex flex-col items-center gap-3 max-w-xs">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => { setError(null); setStep('photo'); }}
                      className="flex-1 py-3 rounded-xl border border-[var(--border-light)] text-[var(--text-secondary)] text-xs font-bold"
                    >
                      Volver
                    </button>
                    <button
                      onClick={() => { setError(null); runDetection(bodyPhotoUrl || ''); }}
                      className="flex-1 py-3 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/30"
                    >
                      Reintentar
                    </button>
                  </div>
                  <button
                    onClick={() => { setError(null); setMode('manual'); setStep('select'); }}
                    className="text-xs text-[var(--text-muted)] font-bold underline underline-offset-2"
                  >
                    Usar modo manual
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {step === 'select' && bodyPhotoUrl && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col gap-4">
              {mode === 'ai' && detectionKeypoints ? (
                <DrawKeypointsCanvas canvasRef={canvasRef} imageUrl={bodyPhotoUrl} keypoints={detectionKeypoints} />
              ) : (
                <div className="relative w-full max-w-xs mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)]">
                  <img src={bodyPhotoUrl} alt="Tu foto" className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] font-bold">
                    Modo Manual
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Shirt size={18} />
                  Elige una prenda
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {mode === 'ai' && bodyDims
                    ? `Cuerpo detectado: hombros, cintura, cadera y piernas${bodyDims.shoulderWidth ? ` — hombros: ${Math.round(bodyDims.shoulderWidth)}px` : ''}`
                    : 'Puedes ajustar la prenda manualmente con mover, rotar y escalar'}
                </p>
              </div>

              {error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-3 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">{error}</p>
                </div>
              )}

              {garments.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)]">
                  <Shirt size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No tienes prendas en tu armario</p>
                  <p className="text-xs mt-1">Añade prendas desde la sección Armario</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 pb-6">
                  {garments.map(g => (
                    <button
                      key={g.id}
                      onClick={() => handleSelectGarment(g)}
                      className={`aspect-square rounded-2xl border-2 p-2 flex items-center justify-center transition-all active:scale-95 ${
                        selectedGarment?.id === g.id
                          ? 'border-primary bg-primary/5'
                          : 'border-[var(--border-light)] bg-[var(--bg-card)] hover:border-primary/50'
                      }`}
                    >
                      <img src={g.imageUrl} alt={g.name} className="max-w-full max-h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setStep('photo')}
                className="w-full py-3 rounded-xl border border-[var(--border-light)] text-[var(--text-secondary)] text-xs font-bold"
              >
                Tomar otra foto
              </button>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center p-10 gap-4 min-h-[60vh]">
              <Loader size={40} className="text-primary animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-bold">Procesando prenda</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Eliminando fondo y preparando para superposición</p>
              </div>
              {selectedGarment && (
                <img src={selectedGarment.imageUrl} alt="" className="w-20 h-20 object-contain opacity-50" />
              )}
            </motion.div>
          )}

          {step === 'tryon' && (
            <motion.div key="tryon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
              <div className="flex-1 relative flex items-center justify-center bg-black/5 dark:bg-white/5 p-4" ref={containerRef}>
                {resultUrl ? (
                  <img
                    src={resultUrl}
                    alt="Probador virtual"
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-xl"
                    draggable={false}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                    <Loader size={32} className="animate-spin" />
                    <p className="text-sm">Generando...</p>
                  </div>
                )}
              </div>

              <div className="bg-[var(--bg-card)] border-t border-[var(--border-light)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">Ajustes</span>
                  <button onClick={resetAdjustments} className="text-[10px] text-primary font-bold flex items-center gap-1">
                    <RefreshCcw size={12} />
                    Restablecer
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <AdjustBtn icon={<Move size={14} />} label="Arriba" onPress={() => handleAdjust('offsetY', -5)} />
                  <AdjustBtn icon={<Move size={14} />} label="Abajo" onPress={() => handleAdjust('offsetY', 5)} />
                  <AdjustBtn icon={<Move size={14} />} label="Izquierda" onPress={() => handleAdjust('offsetX', -5)} />
                  <AdjustBtn icon={<Move size={14} />} label="Derecha" onPress={() => handleAdjust('offsetX', 5)} />
                  <AdjustBtn icon={<ZoomIn size={14} />} label="Agrandar" onPress={() => handleAdjust('scaleX', 0.05)} />
                  <AdjustBtn icon={<ZoomOut size={14} />} label="Reducir" onPress={() => handleAdjust('scaleX', -0.05)} />
                  <AdjustBtn icon={<RotateCw size={14} />} label="Girar" onPress={() => handleAdjust('rotation', 3)} />
                  <AdjustBtn icon={<Sun size={14} />} label="Luz" onPress={() => handleAdjust('brightness', 0.05)} />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSavingName(true)} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-[0.98] transition-all shadow-lg shadow-primary/30">
                    <Save size={16} />
                    Guardar look
                  </button>
                  <button onClick={saveToSocial} className="flex-1 py-3 bg-[var(--bg-base)] text-[var(--text-primary)] rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-[var(--border-light)] active:scale-[0.98] transition-all">
                    <Share2 size={16} />
                    Publicar
                  </button>
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
              {resultUrl && (
                <img src={resultUrl} alt="Resultado" className="w-40 h-52 object-contain rounded-2xl shadow-lg border border-[var(--border-light)]" />
              )}
              <div className="flex gap-3 w-full max-w-xs">
                <button onClick={saveToSocial} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-[0.98] transition-all">
                  <Share2 size={16} />
                  Publicar
                </button>
                <button onClick={saveToChallenge} className="flex-1 py-3 bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl font-bold text-xs uppercase tracking-wider border border-[var(--border-light)] active:scale-[0.98] transition-all">
                  Reto
                </button>
              </div>
              <button onClick={onClose} className="text-sm text-[var(--text-muted)] font-bold underline underline-offset-2">
                Volver al inicio
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save name modal */}
      <AnimatePresence>
        {savingName && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--bg-card)] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-[var(--border-light)]">
              <h3 className="text-lg font-bold mb-1">Nombre del look</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">¿Cómo quieres llamar a este look?</p>
              <input
                autoFocus
                value={lookName}
                onChange={e => setLookName(e.target.value)}
                placeholder="Ej: Outfit primavera 🌸"
                className="w-full bg-[var(--bg-base)] border border-[var(--border-light)] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                onKeyDown={e => { if (e.key === 'Enter' && lookName.trim()) handleSave() }}
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setSavingName(false)} className="flex-1 py-3 bg-[var(--bg-base)] text-[var(--text-secondary)] rounded-xl font-bold text-xs">Cancelar</button>
                <button onClick={handleSave} disabled={!lookName.trim()} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs disabled:opacity-50 shadow-lg shadow-primary/30">Guardar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && step !== 'photo' && step !== 'select' && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-20 left-4 right-4 bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-xl z-40">
            <AlertCircle size={18} className="flex-shrink-0" />
            <p className="text-xs font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-white/80"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DrawKeypointsCanvas({ canvasRef, imageUrl, keypoints }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; imageUrl: string; keypoints: Array<{ x: number; y: number; score: number; name: string }> }) {
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.style.maxHeight = '400px'
      ctx.drawImage(img, 0, 0)
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 3
      ctx.fillStyle = '#00ff88'
      const connections = [
        ['left_shoulder', 'right_shoulder'],
        ['left_hip', 'right_hip'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_shoulder', 'left_ear'],
        ['right_shoulder', 'right_ear'],
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
  }, [imageUrl, keypoints])
  return (
    <div className="relative w-full max-w-xs mx-auto aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-light)]">
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  )
}

function AdjustBtn({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-[var(--bg-base)] border border-[var(--border-light)] active:scale-95 transition-all text-[var(--text-secondary)] hover:border-primary/50"
    >
      {icon}
      <span className="text-[9px] font-bold">{label}</span>
    </button>
  )
}
