import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, Image, RotateCcw, Save, Sparkles, Hand, Layers, AlertTriangle } from 'lucide-react'
import type { Garment } from '../types'
import {
  detectBody,
  segmentBody,
  preprocessGarment,
  renderComposite,
  defaultLayer,
  defaultAdjustments,
  type GarmentLayer,
  type BodyDimensions,
  type SegmentationResult,
  type GarmentAdjustments,
} from '../src/utils/tryOnEngine'
import { pickPhoto, type CameraSource } from '../src/utils/cameraPhoto'
import { successImpact, errorImpact } from '../src/utils/haptic'
import PoseGuide from '../components/PoseGuide'
import { api } from '../services/api'

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

const CATEGORIES = [
  { key: 'all', label: 'Todo' },
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'dress', label: 'Vestido' },
  { key: 'outer', label: 'Exterior' },
  { key: 'shoes', label: 'Zapatos' },
  { key: 'acc', label: 'Accesorios' },
]

function matchCategory(g: Garment, cat: string): boolean {
  if (cat === 'all') return true
  const t = g.type.toLowerCase()
  switch (cat) {
    case 'top': return t.includes('top') || t.includes('camis') || t.includes('blusa') || t.includes('shirt') || t.includes('polo') || t.includes('sweater') || t.includes('jersey')
    case 'bottom': return t.includes('bottom') || t.includes('pantal') || t.includes('falda') || t.includes('short') || t.includes('jean') || t.includes('trouser')
    case 'dress': return t.includes('dress') || t.includes('vestido') || t.includes('enterizo')
    case 'outer': return t.includes('outer') || t.includes('chaqueta') || t.includes('abrigo') || t.includes('saco') || t.includes('jacket') || t.includes('coat') || t.includes('cardigan')
    case 'shoes': return t.includes('shoe') || t.includes('zapat') || t.includes('bota') || t.includes('sandal') || t.includes('boot')
    case 'acc': return t.includes('accesorio') || t.includes('sombrero') || t.includes('gorra') || t.includes('bolso') || t.includes('gafas') || t.includes('collar') || t.includes('pulsera')
    default: return true
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout> | null = null
  return new Promise<T>((resolve, reject) => {
    tid = setTimeout(() => reject(new Error(msg)), ms)
    p.then(resolve).catch(reject)
  }).finally(() => { if (tid) clearTimeout(tid) })
}

export default function VirtualTryOn({
  user,
  garments,
  initialGarment = null,
  initialMode = 'ai',
  onSaveLook,
  onClose,
  onNavigate,
}: VirtualTryOnProps) {
  const [step, setStep] = useState<Step>(initialGarment ? 'guide' : 'guide')
  const [mode, setMode] = useState<'ai' | 'manual'>(initialMode)

  const [bodyPhotoUrl, setBodyPhotoUrl] = useState<string | null>(null)
  const [bodyDims, setBodyDims] = useState<BodyDimensions | null>(null)
  const [segmentation, setSegmentation] = useState<SegmentationResult | null>(null)

  const [layers, setLayers] = useState<GarmentLayer[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [garmentFilter, setGarmentFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lookName, setLookName] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const renderLock = useRef(false)
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const DETECT_TIMEOUT = 12000
  const RENDER_TIMEOUT = 20000

  useEffect(() => {
    return () => {
      if (renderTimer.current) clearTimeout(renderTimer.current)
    }
  }, [])

  const filteredGarments = garments.filter(g => !g.isWashing && matchCategory(g, garmentFilter))

  const activeLayer = layers.find(l => l.id === activeLayerId) || null

  const updateLayer = useCallback((id: string, fn: (adj: GarmentAdjustments) => GarmentAdjustments) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, adjustments: fn(l.adjustments) } : l))
  }, [])

  const doRender = useCallback(async (layersToRender?: GarmentLayer[]) => {
    if (renderLock.current) return
    if (!bodyPhotoUrl) return
    const finalLayers = layersToRender ?? layers
    if (finalLayers.length === 0) { setResultUrl(bodyPhotoUrl); return }
    renderLock.current = true
    try {
      const url = await withTimeout(
        renderComposite(bodyPhotoUrl, finalLayers, segmentation, bodyDims),
        RENDER_TIMEOUT,
        'La renderizacion tardo demasiado.',
      )
      setResultUrl(url)
    } catch (e: any) {
      console.warn('Render error:', e)
      setError('Error al renderizar. Intenta de nuevo.')
    } finally {
      renderLock.current = false
    }
  }, [bodyPhotoUrl, segmentation, bodyDims, layers])

  useEffect(() => {
    if (step === 'tryon' && layers.length > 0) {
      if (renderTimer.current) clearTimeout(renderTimer.current)
      renderTimer.current = setTimeout(() => doRender(), 150)
    }
  }, [layers, step, doRender])

  const handlePickPhoto = async (source: CameraSource) => {
    try {
      setError(null)
      const { dataUrl } = await pickPhoto(source)
      setBodyPhotoUrl(dataUrl)
      setStep('detecting')
      detectFn(dataUrl)
    } catch (e: any) {
      if (e?.message !== 'User cancelled') {
        setError('No se pudo obtener la foto.')
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const url = reader.result as string
      setBodyPhotoUrl(url)
      setStep('detecting')
      detectFn(url)
    }
    reader.readAsDataURL(file)
  }

  const detectFn = async (url: string) => {
    setError(null)
    setModelLoading(true)
    setSegmentation(null)
    setBodyDims(null)

    try {
      const poseResult = await withTimeout(detectBody(url), DETECT_TIMEOUT, 'La deteccion de cuerpo tardo demasiado.')
      setModelLoading(false)
      setBodyDims(poseResult.dimensions)
      setStep('select')

      segmentBody(url).then(seg => setSegmentation(seg)).catch(() => {})
    } catch (err: any) {
      setModelLoading(false)
      setError('No se pudo detectar el cuerpo. Intenta con mejor iluminacion o usa modo manual.')
      setBodyDims(null)
      setStep('select')
    }
  }

  const handleToggleGarment = (g: Garment) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(g.id)) next.delete(g.id)
      else next.add(g.id)
      return next
    })
  }

  const handleProcessSelected = async () => {
    if (selectedIds.size === 0) return
    setStep('processing')
    setError(null)

    try {
      const toProcess = garments.filter(g => selectedIds.has(g.id))
      const newLayers: GarmentLayer[] = []

      for (const g of toProcess) {
        const existing = layers.find(l => l.garmentId === g.id)
        if (existing) {
          newLayers.push(existing)
          continue
        }
        try {
          const processedUrl = await withTimeout(
            preprocessGarment(g.imageUrl),
            RENDER_TIMEOUT,
            'El procesamiento de la prenda tardo demasiado.',
          )
          newLayers.push(defaultLayer({
            id: `layer_${g.id}_${Date.now()}`,
            garmentId: g.id,
            name: g.name,
            type: g.type,
            processedUrl,
            originalUrl: g.imageUrl,
            zIndex: layers.length + newLayers.length,
          }))
        } catch {
          newLayers.push(defaultLayer({
            id: `layer_${g.id}_${Date.now()}`,
            garmentId: g.id,
            name: g.name,
            type: g.type,
            processedUrl: g.imageUrl,
            originalUrl: g.imageUrl,
            zIndex: layers.length + newLayers.length,
          }))
        }
      }

      const allLayers = [...layers, ...newLayers]
      setLayers(allLayers)
      if (allLayers.length > 0 && !activeLayerId) {
        setActiveLayerId(allLayers[allLayers.length - 1].id)
      }
      setStep('tryon')
      await doRender(allLayers)
    } catch (err: any) {
      setError(err?.message || 'No se pudo procesar la prenda. Intentalo de nuevo o usa modo manual.')
      setStep('select')
    }
  }

  const handleRemoveLayer = (id: string) => {
    const next = layers.filter(l => l.id !== id)
    setLayers(next)
    if (activeLayerId === id) {
      setActiveLayerId(next.length > 0 ? next[next.length - 1].id : null)
    }
    if (next.length === 0) {
      setResultUrl(null)
      setStep('select')
    }
  }

  const handleMoveLayer = (id: string, dir: 'up' | 'down') => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx < 0) return prev
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= prev.length) return prev
      const next = [...prev]
      const tmpZ = next[idx].zIndex
      next[idx] = { ...next[idx], zIndex: next[swap].zIndex }
      next[swap] = { ...next[swap], zIndex: tmpZ }
      return next.sort((a, b) => a.zIndex - b.zIndex)
    })
  }

  const handleResetAdj = () => {
    if (!activeLayerId) return
    updateLayer(activeLayerId, () => defaultAdjustments())
  }

  const handleSave = async () => {
    if (!resultUrl) return
    setStep('saving')
    setError(null)
    try {
      const res = await fetch(resultUrl)
      const blob = await res.blob()
      const name = lookName.trim() || `Look ${new Date().toLocaleDateString('es')}`
      await api.saveLookWithImage(name, layers.map(l => l.garmentId), blob)
      successImpact()
      setStep('saved')
    } catch (err: any) {
      errorImpact()
      setError('No se pudo guardar. Intenta de nuevo.')
      setStep('tryon')
    }
  }

  const handleManualAdj = useCallback((type: string, delta: number) => {
    if (!activeLayerId) return
    updateLayer(activeLayerId, adj => {
      switch (type) {
        case 'moveX': return { ...adj, offsetX: adj.offsetX + delta }
        case 'moveY': return { ...adj, offsetY: adj.offsetY + delta }
        case 'scale': {
          const s = Math.max(0.3, Math.min(3, adj.scaleX + delta))
          return { ...adj, scaleX: s, scaleY: s }
        }
        case 'rotate': return { ...adj, rotation: adj.rotation + delta }
        case 'opacity': return { ...adj, opacity: Math.max(0.1, Math.min(1, adj.opacity + delta)) }
        default: return adj
      }
    })
  }, [activeLayerId, updateLayer])

  useEffect(() => {
    if (step !== 'tryon' || !containerRef.current || mode !== 'manual') return
    const el = containerRef.current

    let isDragging = false
    let lastX = 0
    let lastY = 0
    let pinchDist = 0
    let pinchAngle = 0
    let startScale = 1
    let startRotation = 0

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

    const getTouchAngle = (t1: Touch, t2: Touch) =>
      Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI)

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        pinchDist = getTouchDist(e.touches[0], e.touches[1])
        pinchAngle = getTouchAngle(e.touches[0], e.touches[1])
        if (activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId)
          if (layer) {
            startScale = layer.adjustments.scaleX
            startRotation = layer.adjustments.rotation
          }
        }
      } else if (e.touches.length === 1) {
        isDragging = true
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeLayerId) return
      if (e.touches.length === 2) {
        e.preventDefault()
        const dist = getTouchDist(e.touches[0], e.touches[1])
        const angle = getTouchAngle(e.touches[0], e.touches[1])
        const scaleDelta = (dist - pinchDist) * 0.005
        const newScale = Math.max(0.3, Math.min(3, startScale + scaleDelta))
        const rotDelta = angle - pinchAngle
        updateLayer(activeLayerId, adj => ({
          ...adj,
          scaleX: newScale,
          scaleY: newScale,
          rotation: startRotation + rotDelta,
        }))
      } else if (e.touches.length === 1 && isDragging) {
        e.preventDefault()
        const dx = e.touches[0].clientX - lastX
        const dy = e.touches[0].clientY - lastY
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
        updateLayer(activeLayerId, adj => ({
          ...adj,
          offsetX: adj.offsetX + dx,
          offsetY: adj.offsetY + dy,
        }))
      }
    }

    const onTouchEnd = () => { isDragging = false }

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      lastX = e.clientX
      lastY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !activeLayerId) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      updateLayer(activeLayerId, adj => ({
        ...adj,
        offsetX: adj.offsetX + dx,
        offsetY: adj.offsetY + dy,
      }))
    }

    const onMouseUp = () => { isDragging = false }

    const onWheel = (e: WheelEvent) => {
      if (!activeLayerId) return
      e.preventDefault()
      if (e.ctrlKey) {
        const delta = -e.deltaY * 0.002
        updateLayer(activeLayerId, adj => {
          const s = Math.max(0.3, Math.min(3, adj.scaleX + delta))
          return { ...adj, scaleX: s, scaleY: s }
        })
      } else {
        const delta = e.deltaY * 0.1
        updateLayer(activeLayerId, adj => ({
          ...adj,
          rotation: adj.rotation + delta,
        }))
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [step, mode, activeLayerId, layers, updateLayer])

  const renderStepGuide = () => (
    <div className="flex-1 overflow-y-auto p-4">
      <PoseGuide onStart={() => setStep('photo')} />
    </div>
  )

  const renderStepPhoto = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="text-center mb-4">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Sube tu foto
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Elige una foto de cuerpo entero
        </p>
      </div>

      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={() => handlePickPhoto('camera')}
          className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl transition-opacity active:opacity-80"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
        >
          <Camera size={28} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Camara</span>
        </button>
        <button
          onClick={() => handlePickPhoto('gallery')}
          className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl transition-opacity active:opacity-80"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
        >
          <Image size={28} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Galeria</span>
        </button>
      </div>

      <label className="w-full max-w-xs">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div
          className="w-full py-3 rounded-xl text-center text-xs font-medium cursor-pointer transition-opacity active:opacity-80"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-light)' }}
        >
          O selecciona un archivo
        </div>
      </label>
    </div>
  )

  const renderStepDetecting = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Analizando tu foto...
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Detectando postura y silueta
        </p>
      </div>
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  )

  const renderStepSelect = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {bodyPhotoUrl && (
        <div className="relative mx-auto w-full max-w-sm aspect-[3/4] rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-light)' }}>
          <img src={bodyPhotoUrl} alt="Tu foto" className="w-full h-full object-cover" loading="eager" />
          <button
            onClick={() => { setBodyPhotoUrl(null); setStep('photo'); setLayers([]); setResultUrl(null); setSegmentation(null); setBodyDims(null) }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mx-4 mb-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Modo:</span>
        <button
          onClick={() => setMode('ai')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-opacity"
          style={{
            backgroundColor: mode === 'ai' ? 'var(--color-primary)' : 'var(--bg-card)',
            color: mode === 'ai' ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${mode === 'ai' ? 'var(--color-primary)' : 'var(--border-light)'}`,
          }}
        >
          <Sparkles size={10} className="inline mr-1" />IA
        </button>
        <button
          onClick={() => setMode('manual')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-opacity"
          style={{
            backgroundColor: mode === 'manual' ? 'var(--color-primary)' : 'var(--bg-card)',
            color: mode === 'manual' ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${mode === 'manual' ? 'var(--color-primary)' : 'var(--border-light)'}`,
          }}
        >
          <Hand size={10} className="inline mr-1" />Manual
        </button>
      </div>

      <div className="flex gap-1.5 px-4 mb-2 overflow-x-auto">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setGarmentFilter(c.key)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-opacity"
            style={{
              backgroundColor: garmentFilter === c.key ? 'var(--color-primary)' : 'var(--bg-card)',
              color: garmentFilter === c.key ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${garmentFilter === c.key ? 'var(--color-primary)' : 'var(--border-light)'}`,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {filteredGarments.map(g => {
            const selected = selectedIds.has(g.id)
            return (
              <button
                key={g.id}
                onClick={() => handleToggleGarment(g)}
                className="relative rounded-xl overflow-hidden transition-all"
                style={{
                  border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-light)'}`,
                  opacity: selected ? 1 : 0.7,
                }}
              >
                <img
                  src={g.imageUrl}
                  alt={g.name}
                  className="w-full aspect-square object-cover"
                  loading="eager"
                />
                {selected && (
                  <div
                    className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    ✓
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
        <button
          onClick={handleProcessSelected}
          disabled={selectedIds.size === 0}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Probar combinacion ({selectedIds.size})
        </button>
      </div>
    </div>
  )

  const renderStepProcessing = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Procesando prenda...
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Recortando y ajustando
        </p>
      </div>
    </div>
  )

  const renderStepTryon = () => {
    const displayUrl = resultUrl || bodyPhotoUrl
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={containerRef}
          className="relative flex-1 mx-4 my-2 rounded-xl overflow-hidden touch-none select-none"
          style={{ border: '1px solid var(--border-light)', backgroundColor: '#ffffff' }}
        >
          {displayUrl && (
            <img
              src={displayUrl}
              alt="Resultado"
              className="w-full h-full object-contain"
              draggable={false}
              loading="eager"
            />
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mx-4 mb-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {layers.length > 1 && (
          <div className="px-4 mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Capas</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {layers.map((l, i) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLayerId(l.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-opacity"
                  style={{
                    backgroundColor: activeLayerId === l.id ? 'var(--color-primary)' : 'var(--bg-card)',
                    color: activeLayerId === l.id ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${activeLayerId === l.id ? 'var(--color-primary)' : 'var(--border-light)'}`,
                  }}
                >
                  {l.name}
                  <X size={10} className="cursor-pointer opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleRemoveLayer(l.id) }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeLayer && (
          <div className="px-4 mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Ajustar: {activeLayer.name}
              </span>
              <button onClick={handleResetAdj} className="text-[10px]" style={{ color: 'var(--color-primary)' }}>
                <RotateCcw size={10} className="inline mr-0.5" />Reset
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { label: '←→', type: 'moveX', delta: 5 },
                { label: '↑↓', type: 'moveY', delta: 5 },
                { label: '⊕⊖', type: 'scale', delta: 0.05 },
                { label: '↻↺', type: 'rotate', delta: 5 },
                { label: '◐◑', type: 'opacity', delta: -0.1 },
              ].map(b => (
                <button
                  key={b.type}
                  onClick={() => handleManualAdj(b.type, b.delta)}
                  className="py-1.5 rounded-lg text-[10px] font-medium transition-opacity active:opacity-70"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <button
            onClick={() => { setStep('select'); setResultUrl(null) }}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-opacity active:opacity-80"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
          >
            Volver
          </button>
          <button
            onClick={handleSave}
            disabled={!resultUrl}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Save size={12} />Guardar
          </button>
        </div>
      </div>
    )
  }

  const renderStepSaving = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Guardando look...</p>
    </div>
  )

  const renderStepSaved = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
        ✓
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Look guardado</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Se agrego a tu armario</p>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-opacity active:opacity-80"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
        >
          Cerrar
        </button>
        <button
          onClick={() => {
            setStep('select')
            setResultUrl(null)
            setSelectedIds(new Set())
            setLayers([])
            setActiveLayerId(null)
          }}
          className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity active:opacity-80"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Nuevo look
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onClose} className="p-1 rounded-lg transition-opacity active:opacity-70">
          <X size={20} style={{ color: 'var(--text-primary)' }} />
        </button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {step === 'guide' && 'Probador virtual'}
          {step === 'photo' && 'Subir foto'}
          {step === 'detecting' && 'Analizando...'}
          {step === 'select' && 'Elegir prendas'}
          {step === 'processing' && 'Procesando...'}
          {step === 'tryon' && 'Probador virtual'}
          {step === 'saving' && 'Guardando...'}
          {step === 'saved' && 'Guardado'}
        </h2>
        <div className="w-8" />
      </div>

      {step === 'guide' && renderStepGuide()}
      {step === 'photo' && renderStepPhoto()}
      {step === 'detecting' && renderStepDetecting()}
      {step === 'select' && renderStepSelect()}
      {step === 'processing' && renderStepProcessing()}
      {step === 'tryon' && renderStepTryon()}
      {step === 'saving' && renderStepSaving()}
      {step === 'saved' && renderStepSaved()}
    </div>
  )
}
