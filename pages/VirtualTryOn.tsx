import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, Image, RotateCcw, Save, ChevronUp, ChevronDown, Trash2, SlidersHorizontal } from 'lucide-react'
import type { Garment } from '../types'
import { autoPlace, drawCanvas, exportCanvas, removeBg, getImageNaturalSize, type GarmentTransform } from '../src/utils/tryOnEngine'
import { pickPhoto, type CameraSource } from '../src/utils/cameraPhoto'
import { successImpact, errorImpact } from '../src/utils/haptic'
import PoseGuide from '../components/PoseGuide'
import { api } from '../services/api'

interface Props {
  garments: Garment[]
  onClose: () => void
}

interface Layer {
  id: string
  garment: Garment
  url: string
  t: GarmentTransform
}

const CATS = [
  { k: 'all', l: 'Todo' }, { k: 'top', l: 'Top' }, { k: 'bottom', l: 'Bottom' },
  { k: 'dress', l: 'Vestido' }, { k: 'outer', l: 'Exterior' },
  { k: 'shoes', l: 'Zapatos' }, { k: 'acc', l: 'Accesorios' },
]

function matchGarment(g: Garment, c: string) {
  if (c === 'all') return true
  const t = g.type.toLowerCase()
  const m: Record<string, RegExp> = {
    top: /top|camis|blusa|shirt|polo|sweater|jersey/,
    bottom: /bottom|pantal|falda|short|jean|trouser/,
    dress: /dress|vestido|enterizo/,
    outer: /outer|chaqueta|abrigo|saco|jacket|coat/,
    shoes: /shoe|zapat|bota|sandal|boot/,
    acc: /accesorio|sombrero|gorra|bolso|gafas|collar/,
  }
  return m[c] ? m[c].test(t) : true
}

export default function VirtualTryOn({ garments, onClose }: Props) {
  const [step, setStep] = useState<'guide' | 'photo' | 'select' | 'tryon' | 'saving' | 'saved'>('guide')
  const [bodyUrl, setBodyUrl] = useState<string | null>(null)
  const [bodySize, setBodySize] = useState<{ w: number; h: number } | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [selIds, setSelIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layersRef = useRef<Layer[]>([])
  const activeRef = useRef(0)
  const rafRef = useRef(0)
  const bodyUrlRef = useRef<string | null>(null)

  layersRef.current = layers
  activeRef.current = active
  bodyUrlRef.current = bodyUrl

  const filtered = garments.filter(g => !g.isWashing && matchGarment(g, filter))

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const c = canvasRef.current
      if (!c || !bodyUrlRef.current) return
      drawCanvas(c, bodyUrlRef.current, layersRef.current.map(l => ({ url: l.url, t: l.t })), activeRef.current).catch(() => {})
    })
  }, [])

  useEffect(() => { scheduleRedraw() }, [scheduleRedraw, layers, active, step])

  const pick = async (src: CameraSource) => {
    try {
      setError(null)
      const { dataUrl } = await pickPhoto(src)
      setBodyUrl(dataUrl)
      setStep('select')
    } catch (e: any) {
      if (e?.message !== 'User cancelled') setError('No se pudo obtener la foto.')
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onloadend = () => { setBodyUrl(r.result as string); setStep('select') }
    r.readAsDataURL(f)
  }

  const toggle = (g: Garment) => {
    setSelIds(p => { const n = new Set(p); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })
  }

  const process = async () => {
    if (selIds.size === 0 || !bodyUrl) return
    setBusy(true)
    setError(null)
    try {
      let sz = bodySize
      if (!sz) {
        sz = await getImageNaturalSize(bodyUrl)
        setBodySize(sz)
      }
      const cw = sz.w, ch = sz.h
      const newLayers: Layer[] = []
      for (const g of garments.filter(g => selIds.has(g.id))) {
        const exists = layers.find(l => l.garment.id === g.id)
        if (exists) { newLayers.push(exists); continue }
        let url = g.imageUrl
        try { url = await removeBg(g.imageUrl) } catch {}
        newLayers.push({ id: `${g.id}_${Date.now()}`, garment: g, url, t: autoPlace(g.type, cw, ch) })
      }
      setLayers(p => { const merged = [...p, ...newLayers]; layersRef.current = merged; return merged })
      setStep('tryon')
    } catch {
      setError('Error procesando prendas.')
    }
    setBusy(false)
  }

  // ─── Gesture handler: attaches once per tryon step ─────────────────
  useEffect(() => {
    if (step !== 'tryon') return
    const c = canvasRef.current
    if (!c) return

    const S = {
      dragging: false, lx: 0, ly: 0,
      pinchDist: 0, pinchAngle: 0, pinchSavedW: 0, pinchSavedH: 0, pinchSavedRot: 0,
    }

    const scale = () => {
      if (!c.clientWidth || !c.clientHeight) return 1
      return c.width / c.clientWidth
    }

    const hitTest = (clientX: number, clientY: number): number => {
      const r = c.getBoundingClientRect()
      const s = scale()
      const cx = (clientX - r.left) * s
      const cy = (clientY - r.top) * s
      const ls = layersRef.current
      for (let i = ls.length - 1; i >= 0; i--) {
        const t = ls[i].t
        if (cx >= t.x && cx <= t.x + t.width && cy >= t.y && cy <= t.y + t.height) return i
      }
      return -1
    }

    const td = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
    const ta = (a: Touch, b: Touch) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180 / Math.PI

    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        S.pinchDist = td(e.touches[0], e.touches[1])
        S.pinchAngle = ta(e.touches[0], e.touches[1])
        const l = layersRef.current[activeRef.current]
        if (l) { S.pinchSavedW = l.t.width; S.pinchSavedH = l.t.height; S.pinchSavedRot = l.t.rotation }
      } else if (e.touches.length === 1) {
        const idx = hitTest(e.touches[0].clientX, e.touches[0].clientY)
        if (idx >= 0) {
          setActive(idx)
          activeRef.current = idx
        }
        S.dragging = true
        S.lx = e.touches[0].clientX
        S.ly = e.touches[0].clientY
      }
    }

    const onTM = (e: TouchEvent) => {
      const ai = activeRef.current
      const ls = layersRef.current
      if (e.touches.length === 2 && ai >= 0 && ai < ls.length) {
        e.preventDefault()
        const d = td(e.touches[0], e.touches[1])
        const a = ta(e.touches[0], e.touches[1])
        const ratio = d / S.pinchDist
        setLayers(p => p.map((l, i) => i === ai ? {
          ...l, t: { ...l.t, width: Math.max(20, S.pinchSavedW * ratio), height: Math.max(20, S.pinchSavedH * ratio), rotation: S.pinchSavedRot + (a - S.pinchAngle) }
        } : l))
      } else if (e.touches.length === 1 && S.dragging && ai >= 0 && ai < ls.length) {
        e.preventDefault()
        const s = scale()
        const dx = (e.touches[0].clientX - S.lx) * s
        const dy = (e.touches[0].clientY - S.ly) * s
        S.lx = e.touches[0].clientX
        S.ly = e.touches[0].clientY
        setLayers(p => p.map((l, i) => i === ai ? { ...l, t: { ...l.t, x: l.t.x + dx, y: l.t.y + dy } } : l))
      }
    }

    const onTE = () => { S.dragging = false }

    const onMD = (e: MouseEvent) => {
      const idx = hitTest(e.clientX, e.clientY)
      if (idx >= 0) {
        setActive(idx)
        activeRef.current = idx
      }
      S.dragging = true; S.lx = e.clientX; S.ly = e.clientY
    }

    const onMM = (e: MouseEvent) => {
      if (!S.dragging) return
      const ai = activeRef.current
      const ls = layersRef.current
      if (ai < 0 || ai >= ls.length) return
      const s = scale()
      const dx = (e.clientX - S.lx) * s
      const dy = (e.clientY - S.ly) * s
      S.lx = e.clientX; S.ly = e.clientY
      setLayers(p => p.map((l, i) => i === ai ? { ...l, t: { ...l.t, x: l.t.x + dx, y: l.t.y + dy } } : l))
    }

    const onMU = () => { S.dragging = false }

    const onW = (e: WheelEvent) => {
      const ai = activeRef.current
      const ls = layersRef.current
      if (ai < 0 || ai >= ls.length) return
      e.preventDefault()
      const s = e.deltaY > 0 ? 0.95 : 1.05
      setLayers(p => p.map((l, i) => i === ai ? {
        ...l, t: { ...l.t, width: Math.max(20, l.t.width * s), height: Math.max(20, l.t.height * s) }
      } : l))
    }

    c.addEventListener('touchstart', onTS, { passive: false })
    c.addEventListener('touchmove', onTM, { passive: false })
    c.addEventListener('touchend', onTE)
    c.addEventListener('mousedown', onMD)
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
    c.addEventListener('wheel', onW, { passive: false })

    return () => {
      c.removeEventListener('touchstart', onTS)
      c.removeEventListener('touchmove', onTM)
      c.removeEventListener('touchend', onTE)
      c.removeEventListener('mousedown', onMD)
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
      c.removeEventListener('wheel', onW)
    }
  }, [step])

  const updateActiveOpacity = (opacity: number) => {
    setLayers(p => p.map((l, i) => i === active ? { ...l, t: { ...l.t, opacity } } : l))
  }

  const moveLayer = (dir: -1 | 1) => {
    setLayers(p => {
      const target = active + dir
      if (target < 0 || target >= p.length) return p
      const arr = [...p]
      ;[arr[active], arr[target]] = [arr[target], arr[active]]
      setActive(target)
      return arr
    })
  }

  const removeLayer = (idx: number) => {
    setLayers(p => { const n = p.filter((_, i) => i !== idx); if (n.length === 0) setStep('select'); return n })
    setActive(0)
  }

  const resetPosition = () => {
    if (!bodySize) return
    setLayers(p => p.map((l, i) => i === active ? { ...l, t: autoPlace(l.garment.type, bodySize.w, bodySize.h) } : l))
  }

  const save = async () => {
    if (!bodyUrl) return
    setStep('saving')
    try {
      const dataUrl = await exportCanvas(bodyUrl, layers.map(l => ({ url: l.url, t: l.t })))
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

  const addMoreGarments = () => {
    setStep('select')
  }

  // ─── Sub-screens ───────────────────────────────────────────────────

  const SGuide = () => (
    <div className="flex-1 overflow-y-auto p-4">
      <PoseGuide onStart={() => setStep('photo')} />
    </div>
  )

  const SPhoto = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sube tu foto</h3>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Foto de cuerpo entero</p>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={() => pick('camera')} className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <Camera size={28} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Camara</span>
        </button>
        <button onClick={() => pick('gallery')} className="flex-1 flex flex-col items-center gap-2 py-5 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <Image size={28} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Galeria</span>
        </button>
      </div>
      <label className="w-full max-w-xs">
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        <div className="w-full py-3 rounded-xl text-center text-xs font-medium cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-light)' }}>
          O selecciona un archivo
        </div>
      </label>
    </div>
  )

  const SSelect = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {bodyUrl && (
        <div className="relative mx-auto w-full max-w-sm aspect-[3/4] rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-light)' }}>
          <img src={bodyUrl} className="w-full h-full object-cover" loading="eager" />
          <button onClick={() => { setBodyUrl(null); setBodySize(null); setStep('photo'); setLayers([]) }} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white"><X size={14} /></button>
        </div>
      )}
      <div className="flex gap-1.5 px-4 mb-2 overflow-x-auto">
        {CATS.map(c => (
          <button key={c.k} onClick={() => setFilter(c.k)} className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap"
            style={{ backgroundColor: filter === c.k ? 'var(--color-primary)' : 'var(--bg-card)', color: filter === c.k ? 'white' : 'var(--text-secondary)', border: `1px solid ${filter === c.k ? 'var(--color-primary)' : 'var(--border-light)'}` }}>
            {c.l}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(g => (
            <button key={g.id} onClick={() => toggle(g)} className="relative rounded-xl overflow-hidden"
              style={{ border: `2px solid ${selIds.has(g.id) ? 'var(--color-primary)' : 'var(--border-light)'}`, opacity: selIds.has(g.id) ? 1 : 0.7 }}>
              <img src={g.imageUrl} alt={g.name} className="w-full aspect-square object-cover" loading="eager" />
              {selIds.has(g.id) && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>✓</div>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={process} disabled={selIds.size === 0 || busy}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {busy ? 'Procesando...' : `Probar (${selIds.size})`}
        </button>
      </div>
    </div>
  )

  const STryon = () => {
    const cur = layers[active]
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 mx-3 my-2 rounded-xl overflow-hidden relative" style={{ backgroundColor: '#f0f0f0', border: '1px solid var(--border-light)' }}>
          <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mx-3 mb-1 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <X size={14} />{error}
          </div>
        )}

        {layers.length > 0 && (
          <div className="px-3 mb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {layers.map((l, i) => (
                <button key={l.id} onClick={() => { setActive(i); activeRef.current = i }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: active === i ? 'var(--color-primary)' : 'var(--bg-card)',
                    color: active === i ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${active === i ? 'var(--color-primary)' : 'var(--border-light)'}`,
                  }}>
                  {l.garment.name}
                  <span onClick={(e) => { e.stopPropagation(); removeLayer(i) }} className="ml-0.5 opacity-60 hover:opacity-100">
                    <X size={10} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {cur && (
          <div className="px-3 mb-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{cur.garment.name}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{Math.round(cur.t.opacity * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={12} style={{ color: 'var(--text-muted)' }} />
              <input type="range" min="0.2" max="1" step="0.05" value={cur.t.opacity}
                onChange={e => updateActiveOpacity(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-[var(--color-primary)]" />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveLayer(-1)} disabled={active === 0}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <ChevronUp size={12} style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button onClick={() => moveLayer(1)} disabled={active === layers.length - 1}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button onClick={resetPosition}
                className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <RotateCcw size={12} style={{ color: 'var(--text-secondary)' }} />
              </button>
              <div className="flex-1" />
              <button onClick={addMoreGarments}
                className="px-2 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                + Mas prendas
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 p-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={() => { setStep('select'); setActive(0) }}
            className="flex-1 py-2.5 rounded-xl text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            Volver
          </button>
          <button onClick={save} disabled={!bodyUrl || layers.length === 0}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <Save size={12} />Guardar
          </button>
        </div>
      </div>
    )
  }

  const SSaving = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Guardando...</p>
    </div>
  )

  const SSaved = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
        <span className="text-2xl" style={{ color: '#22c55e' }}>✓</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Look guardado</p>
      <div className="flex gap-2 w-full max-w-xs">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Cerrar</button>
        <button onClick={() => { setStep('select'); setLayers([]); setActive(0) }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Nuevo look</button>
      </div>
    </div>
  )

  const titles: Record<string, string> = { guide: 'Probador virtual', photo: 'Subir foto', select: 'Elegir prendas', tryon: 'Ajustar', saving: 'Guardando...', saved: 'Listo' }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onClose} className="p-1 rounded-lg"><X size={20} style={{ color: 'var(--text-primary)' }} /></button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{titles[step]}</h2>
        <div className="w-8" />
      </div>
      {step === 'guide' && <SGuide />}
      {step === 'photo' && <SPhoto />}
      {step === 'select' && <SSelect />}
      {step === 'tryon' && <STryon />}
      {step === 'saving' && <SSaving />}
      {step === 'saved' && <SSaved />}
    </div>
  )
}
