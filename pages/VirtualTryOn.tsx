import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, Image, RotateCcw, Save, Sparkles, Hand, Layers, AlertTriangle, Plus } from 'lucide-react'
import type { Garment } from '../types'
import { autoPlaceGarment, renderToCanvas, removeGarmentBackground, type GarmentTransform } from '../src/utils/tryOnEngine'
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

interface Layer {
  id: string
  garment: Garment
  processedUrl: string
  transform: GarmentTransform
  opacity: number
  zIndex: number
}

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
    case 'top': return /top|camis|blusa|shirt|polo|sweater|jersey/.test(t)
    case 'bottom': return /bottom|pantal|falda|short|jean|trouser/.test(t)
    case 'dress': return /dress|vestido|enterizo/.test(t)
    case 'outer': return /outer|chaqueta|abrigo|saco|jacket|coat|cardigan/.test(t)
    case 'shoes': return /shoe|zapat|bota|sandal|boot/.test(t)
    case 'acc': return /accesorio|sombrero|gorra|bolso|gafas|collar|pulsera/.test(t)
    default: return true
  }
}

export default function VirtualTryOn({ garments, onClose }: VirtualTryOnProps) {
  const [step, setStep] = useState<'guide' | 'photo' | 'select' | 'tryon' | 'saving' | 'saved'>('guide')
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState<string | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const renderLock = useRef(false)

  const filtered = garments.filter(g => !g.isWashing && matchCategory(g, filter))
  const activeLayer = layers.find(l => l.id === activeId) || null

  useEffect(() => {
    if (layers.length > 0 && !activeId) {
      setActiveId(layers[layers.length - 1].id)
    }
  }, [layers, activeId])

  const updateTransform = useCallback((id: string, fn: (t: GarmentTransform) => GarmentTransform) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, transform: fn(l.transform) } : l))
  }, [])

  const handlePickPhoto = async (source: CameraSource) => {
    try {
      setError(null)
      const { dataUrl } = await pickPhoto(source)
      setBodyPhotoUrl(dataUrl)
      setStep('select')
    } catch (e: any) {
      if (e?.message !== 'User cancelled') setError('No se pudo obtener la foto.')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => { setBodyPhotoUrl(reader.result as string); setStep('select') }
    reader.readAsDataURL(file)
  }

  const handleToggleGarment = (g: Garment) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(g.id)) next.delete(g.id); else next.add(g.id)
      return next
    })
  }

  const handleProcessSelected = async () => {
    if (selectedIds.size === 0 || !containerRef.current) return
    setProcessing(true)
    setError(null)

    const rect = containerRef.current.getBoundingClientRect()
    const cw = rect.width
    const ch = rect.height

    try {
      const newLayers: Layer[] = []
      for (const g of garments.filter(g => selectedIds.has(g.id))) {
        const existing = layers.find(l => l.garment.id === g.id)
        if (existing) { newLayers.push(existing); continue }

        let processedUrl = g.imageUrl
        try {
          processedUrl = await removeGarmentBackground(g.imageUrl)
        } catch {}

        const transform = autoPlaceGarment(g.type, cw, ch)
        newLayers.push({
          id: `L${g.id}_${Date.now()}`,
          garment: g,
          processedUrl,
          transform,
          opacity: 1,
          zIndex: layers.length + newLayers.length,
        })
      }

      setLayers(prev => [...prev, ...newLayers])
      setStep('tryon')
    } catch {
      setError('No se pudo procesar. Intenta de nuevo.')
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveLayer = (id: string) => {
    const next = layers.filter(l => l.id !== id)
    setLayers(next)
    if (activeId === id) setActiveId(next.length ? next[next.length - 1].id : null)
    if (next.length === 0) setStep('select')
  }

  const handleReset = () => {
    if (!activeId || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    updateTransform(activeId, () => autoPlaceGarment(activeLayer?.garment.type || '', rect.width, rect.height))
  }

  const handleSave = async () => {
    if (!bodyPhotoUrl || !containerRef.current) return
    setStep('saving')
    try {
      const rect = containerRef.current.getBoundingClientRect()
      const dataUrl = await renderToCanvas(
        bodyPhotoUrl,
        layers.map(l => ({ url: l.processedUrl, transform: l.transform, opacity: l.opacity })),
        rect.width, rect.height,
      )
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await api.saveLookWithImage(`Look ${new Date().toLocaleDateString('es')}`, layers.map(l => l.garment.id), blob)
      successImpact()
      setStep('saved')
    } catch {
      errorImpact()
      setError('No se pudo guardar.')
      setStep('tryon')
    }
  }

  // ─── Touch gesture handler ────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'tryon' || !containerRef.current) return
    const el = containerRef.current

    let dragging = false
    let lastX = 0, lastY = 0
    let pinchDist = 0, pinchAngle = 0
    let startScale = 1, startRotation = 0

    const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
    const angle = (a: Touch, b: Touch) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI)

    const onTouchStart = (e: TouchEvent) => {
      if (!activeId) return
      if (e.touches.length === 2) {
        e.preventDefault()
        pinchDist = dist(e.touches[0], e.touches[1])
        pinchAngle = angle(e.touches[0], e.touches[1])
        const layer = layers.find(l => l.id === activeId)
        if (layer) { startScale = layer.transform.width; startRotation = layer.transform.rotation }
      } else if (e.touches.length === 1) {
        dragging = true
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeId) return
      if (e.touches.length === 2) {
        e.preventDefault()
        const d = dist(e.touches[0], e.touches[1])
        const a = angle(e.touches[0], e.touches[1])
        const scaleRatio = d / pinchDist
        updateTransform(activeId, t => ({
          ...t,
          width: Math.max(40, startScale * scaleRatio),
          height: Math.max(40, (startScale * (t.height / Math.max(1, t.width))) * scaleRatio),
          rotation: startRotation + (a - pinchAngle),
        }))
      } else if (e.touches.length === 1 && dragging) {
        e.preventDefault()
        const dx = e.touches[0].clientX - lastX
        const dy = e.touches[0].clientY - lastY
        lastX = e.touches[0].clientX
        lastY = e.touches[0].clientY
        updateTransform(activeId, t => ({ ...t, x: t.x + dx, y: t.y + dy }))
      }
    }

    const onTouchEnd = () => { dragging = false }

    const onMouseDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !activeId) return
      updateTransform(activeId, t => ({ ...t, x: t.x + (e.clientX - lastX), y: t.y + (e.clientY - lastY) }))
      lastX = e.clientX; lastY = e.clientY
    }
    const onMouseUp = () => { dragging = false }

    const onWheel = (e: WheelEvent) => {
      if (!activeId) return
      e.preventDefault()
      const delta = e.deltaY * 0.002
      updateTransform(activeId, t => ({
        ...t,
        width: Math.max(40, t.width * (1 - delta)),
        height: Math.max(40, t.height * (1 - delta)),
      }))
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
  }, [step, activeId, layers, updateTransform])

  // ─── Render helpers ───────────────────────────────────────────────────
  const Guide = () => (
    <div className="flex-1 overflow-y-auto p-4">
      <PoseGuide onStart={() => setStep('photo')} />
    </div>
  )

  const Photo = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sube tu foto</h3>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Foto de cuerpo entero</p>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={() => handlePickPhoto('camera')} className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <Camera size={28} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Camara</span>
        </button>
        <button onClick={() => handlePickPhoto('gallery')} className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <Image size={28} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Galeria</span>
        </button>
      </div>
      <label className="w-full max-w-xs">
        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        <div className="w-full py-3 rounded-xl text-center text-xs font-medium cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-light)' }}>
          O selecciona un archivo
        </div>
      </label>
    </div>
  )

  const Select = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {bodyPhotoUrl && (
        <div ref={containerRef} className="relative mx-auto w-full max-w-sm aspect-[3/4] rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-light)' }}>
          <img src={bodyPhotoUrl} alt="Tu foto" className="w-full h-full object-cover" loading="eager" />
          <button onClick={() => { setBodyPhotoUrl(null); setStep('photo'); setLayers([]) }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white"><X size={14} /></button>
        </div>
      )}
      <div className="flex gap-1.5 px-4 mb-2 overflow-x-auto">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setFilter(c.key)} className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap"
            style={{ backgroundColor: filter === c.key ? 'var(--color-primary)' : 'var(--bg-card)', color: filter === c.key ? 'white' : 'var(--text-secondary)', border: `1px solid ${filter === c.key ? 'var(--color-primary)' : 'var(--border-light)'}` }}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(g => (
            <button key={g.id} onClick={() => handleToggleGarment(g)} className="relative rounded-xl overflow-hidden"
              style={{ border: `2px solid ${selectedIds.has(g.id) ? 'var(--color-primary)' : 'var(--border-light)'}`, opacity: selectedIds.has(g.id) ? 1 : 0.7 }}>
              <img src={g.imageUrl} alt={g.name} className="w-full aspect-square object-cover" loading="eager" />
              {selectedIds.has(g.id) && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>✓</div>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={handleProcessSelected} disabled={selectedIds.size === 0 || processing}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          {processing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {processing ? 'Procesando...' : `Probar (${selectedIds.size})`}
        </button>
      </div>
    </div>
  )

  const Tryon = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={containerRef} className="relative flex-1 mx-4 my-2 rounded-xl overflow-hidden touch-none select-none" style={{ backgroundColor: '#fff', border: '1px solid var(--border-light)' }}>
        {bodyPhotoUrl && <img src={bodyPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-contain" draggable={false} loading="eager" />}
        {layers.map(layer => (
          <img key={layer.id} src={layer.processedUrl} alt={layer.garment.name} draggable={false} loading="eager"
            onClick={(e) => { e.stopPropagation(); setActiveId(layer.id) }}
            className="absolute select-none"
            style={{
              left: layer.transform.x,
              top: layer.transform.y,
              width: layer.transform.width,
              height: layer.transform.height,
              transform: `rotate(${layer.transform.rotation}deg)`,
              opacity: layer.opacity,
              zIndex: layer.id === activeId ? 20 : layer.zIndex + 1,
              outline: layer.id === activeId ? '2px solid var(--color-primary)' : 'none',
              outlineOffset: '2px',
              cursor: 'grab',
            }} />
        ))}
      </div>

      {error && <div className="flex items-center gap-2 px-3 py-2 mx-4 mb-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><AlertTriangle size={14} />{error}</div>}

      {layers.length > 1 && (
        <div className="px-4 mb-2 flex gap-1.5 overflow-x-auto">
          {layers.map(l => (
            <button key={l.id} onClick={() => setActiveId(l.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap"
              style={{ backgroundColor: activeId === l.id ? 'var(--color-primary)' : 'var(--bg-card)', color: activeId === l.id ? 'white' : 'var(--text-secondary)', border: `1px solid ${activeId === l.id ? 'var(--color-primary)' : 'var(--border-light)'}` }}>
              {l.garment.name}
              <X size={10} className="cursor-pointer opacity-60" onClick={(e) => { e.stopPropagation(); handleRemoveLayer(l.id) }} />
            </button>
          ))}
        </div>
      )}

      {activeLayer && (
        <div className="px-4 mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Arrastra, pellizca o rota: {activeLayer.garment.name}
          </span>
          <button onClick={handleReset} className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
            <RotateCcw size={10} />Reset
          </button>
        </div>
      )}

      <div className="flex gap-2 p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={() => setStep('select')} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
          Volver
        </button>
        <button onClick={handleSave} disabled={!bodyPhotoUrl} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Save size={12} />Guardar
        </button>
      </div>
    </div>
  )

  const Saving = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Guardando...</p>
    </div>
  )

  const Saved = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>✓</div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Look guardado</p>
      <div className="flex gap-2 w-full max-w-xs">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Cerrar</button>
        <button onClick={() => { setStep('select'); setLayers([]); setActiveId(null) }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Nuevo look</button>
      </div>
    </div>
  )

  const titles: Record<string, string> = { guide: 'Probador virtual', photo: 'Subir foto', select: 'Elegir prendas', tryon: 'Ajustar prenda', saving: 'Guardando...', saved: 'Guardado' }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onClose} className="p-1 rounded-lg"><X size={20} style={{ color: 'var(--text-primary)' }} /></button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{titles[step]}</h2>
        <div className="w-8" />
      </div>
      {step === 'guide' && <Guide />}
      {step === 'photo' && <Photo />}
      {step === 'select' && <Select />}
      {step === 'tryon' && <Tryon />}
      {step === 'saving' && <Saving />}
      {step === 'saved' && <Saved />}
    </div>
  )
}
