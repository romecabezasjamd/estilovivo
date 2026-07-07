import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, Image, RotateCcw, Save, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Garment } from '../types'
import { removeBg, exportCanvas, type GarmentTransform } from '../src/utils/tryOnEngine'
import { detectBodyPose, smartAutoPlace, type BodyPose } from '../src/utils/poseDetection'
import { pickPhoto, type CameraSource } from '../src/utils/cameraPhoto'
import { successImpact, errorImpact } from '../src/utils/haptic'
import PoseGuide from '../components/PoseGuide'
import { api } from '../services/api'

interface Props { garments: Garment[]; onClose: () => void }

interface Layer {
  id: string; garment: Garment; url: string
  x: number; y: number; w: number; h: number
  rotation: number; opacity: number
}

const CATS = [
  { k: 'all', l: 'Todo' }, { k: 'top', l: 'Top' }, { k: 'bottom', l: 'Bottom' },
  { k: 'dress', l: 'Vestido' }, { k: 'outer', l: 'Exterior' },
  { k: 'shoes', l: 'Zapatos' }, { k: 'acc', l: 'Accesorios' },
]

function matchG(g: Garment, c: string) {
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

function autoPos(pose: BodyPose | null, type: string, pw: number, ph: number): { x: number; y: number; w: number; h: number } {
  const t = type.toLowerCase()
  if (pose) {
    const s = smartAutoPlace(pose, type, pw, ph)
    return { x: s.x, y: s.y, w: s.width, h: s.height }
  }
  const r = { x: 0, y: 0, w: 0, h: 0 }
  if (/dress|vestido|enterizo/.test(t)) { r.w = pw * 0.55; r.h = ph * 0.48; r.x = (pw - r.w) / 2; r.y = ph * 0.14 }
  else if (/bottom|pantal|falda|short|jean|trouser/.test(t)) { r.w = pw * 0.42; r.h = ph * 0.28; r.x = (pw - r.w) / 2; r.y = ph * 0.44 }
  else if (/outer|chaqueta|abrigo|saco|jacket|coat/.test(t)) { r.w = pw * 0.6; r.h = ph * 0.36; r.x = (pw - r.w) / 2; r.y = ph * 0.12 }
  else if (/shoe|zapat|bota|sandal|boot/.test(t)) { r.w = pw * 0.2; r.h = ph * 0.08; r.x = (pw - r.w) / 2; r.y = ph * 0.9 }
  else if (/accesorio|sombrero|gorra|bolso|gafas|collar/.test(t)) { r.w = pw * 0.25; r.h = ph * 0.15; r.x = (pw - r.w) / 2; r.y = ph * 0.01 }
  else { r.w = pw * 0.48; r.h = ph * 0.3; r.x = (pw - r.w) / 2; r.y = ph * 0.14 }
  return r
}

export default function VirtualTryOn({ garments, onClose }: Props) {
  const [step, setStep] = useState<'guide' | 'photo' | 'select' | 'tryon' | 'saving' | 'saved'>('guide')
  const [bodyUrl, setBodyUrl] = useState<string | null>(null)
  const [bodyDim, setBodyDim] = useState<{ w: number; h: number } | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [active, setActive] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [selIds, setSelIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [bodyPose, setBodyPose] = useState<BodyPose | null>(null)
  const [detecting, setDetecting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<Layer[]>([])
  const activeRef = useRef(-1)

  layersRef.current = layers
  activeRef.current = active

  const filtered = garments.filter(g => !g.isWashing && matchG(g, filter))

  // ─── Load body photo dimensions ──────────────────────────────────
  useEffect(() => {
    if (!bodyUrl) { setBodyDim(null); return }
    const img = new window.Image()
    img.onload = () => setBodyDim({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = bodyUrl
  }, [bodyUrl])

  // ─── Global gesture state ────────────────────────────────────────
  const gesture = useRef({
    dragging: false, dragIdx: -1, lx: 0, ly: 0,
    pinch: false, pDist: 0, pAngle: 0, sW: 0, sH: 0, sR: 0, sX: 0, sY: 0,
  })

  const getScale = useCallback(() => {
    const c = containerRef.current
    if (!c || !bodyDim) return 1
    return c.clientWidth / bodyDim.w
  }, [bodyDim])

  const updateLayer = useCallback((idx: number, patch: Partial<Layer>) => {
    setLayers(p => p.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }, [])

  // ─── Touch/mouse handlers (window-level) ─────────────────────────
  useEffect(() => {
    if (step !== 'tryon') return
    const g = gesture.current

    const onMM = (e: MouseEvent) => {
      if (!g.dragging || g.dragIdx < 0) return
      const s = getScale()
      const dx = (e.clientX - g.lx) / s
      const dy = (e.clientY - g.ly) / s
      g.lx = e.clientX; g.ly = e.clientY
      updateLayer(g.dragIdx, {
        x: layersRef.current[g.dragIdx].x + dx,
        y: layersRef.current[g.dragIdx].y + dy,
      })
    }

    const onMU = () => { g.dragging = false; g.dragIdx = -1 }

    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2 && g.dragIdx >= 0) {
        e.preventDefault()
        const t0 = e.touches[0], t1 = e.touches[1]
        const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const a = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * 180 / Math.PI
        const ratio = d / g.pDist
        const rot = g.sR + (a - g.pAngle)
        updateLayer(g.dragIdx, {
          w: Math.max(30, g.sW * ratio), h: Math.max(30, g.sH * ratio),
          rotation: rot,
        })
      } else if (e.touches.length === 1 && g.dragging && g.dragIdx >= 0) {
        e.preventDefault()
        const t = e.touches[0]
        const s = getScale()
        const dx = (t.clientX - g.lx) / s
        const dy = (t.clientY - g.ly) / s
        g.lx = t.clientX; g.ly = t.clientY
        updateLayer(g.dragIdx, {
          x: layersRef.current[g.dragIdx].x + dx,
          y: layersRef.current[g.dragIdx].y + dy,
        })
      }
    }

    const onTE = () => { g.dragging = false; g.dragIdx = -1; g.pinch = false }

    const onW = (e: WheelEvent) => {
      if (activeRef.current < 0) return
      const ai = activeRef.current
      const ls = layersRef.current
      if (ai >= ls.length) return
      e.preventDefault()
      const f = e.deltaY > 0 ? 0.95 : 1.05
      updateLayer(ai, { w: Math.max(30, ls[ai].w * f), h: Math.max(30, ls[ai].h * f) })
    }

    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
    window.addEventListener('touchmove', onTM, { passive: false })
    window.addEventListener('touchend', onTE)
    window.addEventListener('wheel', onW, { passive: false })

    return () => {
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
      window.removeEventListener('touchmove', onTM)
      window.removeEventListener('touchend', onTE)
      window.removeEventListener('wheel', onW)
    }
  }, [step, getScale, updateLayer])

  // ─── Actions ─────────────────────────────────────────────────────
  const pick = async (src: CameraSource) => {
    try { setError(null); const { dataUrl } = await pickPhoto(src); setBodyUrl(dataUrl); setStep('select') }
    catch (e: any) { if (e?.message !== 'User cancelled') setError('No se pudo obtener la foto.') }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader(); r.onloadend = () => { setBodyUrl(r.result as string); setStep('select') }; r.readAsDataURL(f)
  }

  const toggle = (g: Garment) => setSelIds(p => { const n = new Set(p); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })

  const process = async () => {
    if (selIds.size === 0 || !bodyUrl) return
    setBusy(true); setDetecting(true); setError(null)
    try {
      let pose = bodyPose
      if (!pose) { pose = await detectBodyPose(bodyUrl); if (pose) setBodyPose(pose) }
      setDetecting(false)

      const cw = containerRef.current?.clientWidth || 300
      const ch = containerRef.current?.clientHeight || 400
      const sc = bodyDim ? cw / bodyDim.w : 1

      const newLayers: Layer[] = []
      for (const g of garments.filter(g => selIds.has(g.id))) {
        const exists = layers.find(l => l.garment.id === g.id)
        if (exists) { newLayers.push(exists); continue }
        let url = g.imageUrl
        try { url = await removeBg(g.imageUrl) } catch {}
        const p = autoPos(pose, g.type, cw / sc, ch / sc)
        newLayers.push({
          id: `${g.id}_${Date.now()}`, garment: g, url,
          x: p.x, y: p.y, w: p.w, h: p.h,
          rotation: 0, opacity: 1,
        })
      }
      setLayers(p => { const m = [...p, ...newLayers]; layersRef.current = m; return m })
      setStep('tryon')
    } catch { setDetecting(false); setError('Error procesando prendas.') }
    setBusy(false)
  }

  const save = async () => {
    if (!bodyUrl || !bodyDim) return
    setStep('saving')
    try {
      const dataUrl = await exportCanvas(bodyUrl, layers.map(l => ({
        url: l.url, t: { x: l.x, y: l.y, width: l.w, height: l.h, rotation: l.rotation, opacity: l.opacity }
      })), bodyDim.w, bodyDim.h)
      const res = await fetch(dataUrl); const blob = await res.blob()
      await api.saveLookWithImage(`Look ${new Date().toLocaleDateString('es')}`, layers.map(l => l.garment.id), blob)
      successImpact(); setStep('saved')
    } catch { errorImpact(); setError('No se pudo guardar.'); setStep('tryon') }
  }

  const updateOpacity = (v: number) => { if (active >= 0) updateLayer(active, { opacity: v }) }
  const moveLayer = (d: -1 | 1) => {
    const t = active + d; if (t < 0 || t >= layers.length) return
    setLayers(p => { const a = [...p]; [a[active], a[t]] = [a[t], a[active]]; return a }); setActive(t)
  }
  const removeLayer = (i: number) => { setLayers(p => { const n = p.filter((_, j) => j !== i); if (!n.length) setStep('select'); return n }); setActive(-1) }
  const resetPos = () => {
    if (active < 0 || !bodyDim) return
    const cw = containerRef.current?.clientWidth || 300
    const sc = cw / bodyDim.w
    const p = autoPos(bodyPose, layers[active].garment.type, cw / sc, bodyDim.h)
    updateLayer(active, { x: p.x, y: p.y, w: p.w, h: p.h, rotation: 0 })
  }

  // ─── Sub-screens ─────────────────────────────────────────────────
  const SGuide = () => (
    <div className="flex-1 overflow-y-auto p-4 pb-24"><PoseGuide onStart={() => setStep('photo')} /></div>
  )

  const SPhoto = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 pb-24">
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sube tu foto</h3>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Foto de cuerpo entero, de frente</p>
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
        <div className="w-full py-3 rounded-xl text-center text-xs font-medium cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-light)' }}>O selecciona un archivo</div>
      </label>
    </div>
  )

  const SSelect = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {bodyUrl && (
        <div className="relative mx-auto w-28 aspect-[3/4] rounded-xl overflow-hidden mb-2 shrink-0" style={{ border: '1px solid var(--border-light)' }}>
          <img src={bodyUrl} className="w-full h-full object-cover" />
          <button onClick={() => { setBodyUrl(null); setBodyDim(null); setStep('photo'); setLayers([]) }} className="absolute top-1 right-1 p-1 rounded-full bg-black/40 text-white"><X size={10} /></button>
        </div>
      )}
      <div className="flex gap-1.5 px-4 mb-2 overflow-x-auto">
        {CATS.map(c => (
          <button key={c.k} onClick={() => setFilter(c.k)} className="px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap"
            style={{ backgroundColor: filter === c.k ? 'var(--color-primary)' : 'var(--bg-card)', color: filter === c.k ? 'white' : 'var(--text-secondary)', border: `1px solid ${filter === c.k ? 'var(--color-primary)' : 'var(--border-light)'}` }}>{c.l}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(g => (
            <button key={g.id} onClick={() => toggle(g)} className="relative rounded-xl overflow-hidden"
              style={{ border: `2px solid ${selIds.has(g.id) ? 'var(--color-primary)' : 'var(--border-light)'}`, opacity: selIds.has(g.id) ? 1 : 0.7 }}>
              <img src={g.imageUrl} alt={g.name} className="w-full aspect-square object-cover" />
              {selIds.has(g.id) && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>✓</div>}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={process} disabled={selIds.size === 0 || busy}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          {(busy || detecting) && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {detecting ? 'Detectando pose...' : busy ? 'Procesando...' : `Probar (${selIds.size})`}
        </button>
      </div>
    </div>
  )

  const STryon = () => {
    const cur = active >= 0 ? layers[active] : null
    const aspect = bodyDim ? `${bodyDim.w} / ${bodyDim.h}` : '3 / 4'

    const onGarmentDown = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation()
      setActive(idx); activeRef.current = idx
      const g = gesture.current
      g.dragging = true; g.dragIdx = idx; g.lx = e.clientX; g.ly = e.clientY
    }

    const onGarmentTouch = (e: React.TouchEvent, idx: number) => {
      e.stopPropagation()
      setActive(idx); activeRef.current = idx
      const t = e.touches[0]
      const g = gesture.current
      if (e.touches.length === 2) {
        const t1 = e.touches[1]
        g.pinch = true; g.pDist = Math.hypot(t1.clientX - t.clientX, t1.clientY - t.clientY)
        g.pAngle = Math.atan2(t1.clientY - t.clientY, t1.clientX - t.clientX) * 180 / Math.PI
        g.sW = layersRef.current[idx].w; g.sH = layersRef.current[idx].h; g.sR = layersRef.current[idx].rotation
      } else {
        g.dragging = true; g.dragIdx = idx; g.lx = t.clientX; g.ly = t.clientY
      }
    }

    const onCanvasClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'IMG') return
      setActive(-1); activeRef.current = -1
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={containerRef} onClick={onCanvasClick}
          className="flex-1 mx-3 my-2 rounded-xl overflow-hidden relative bg-gray-100"
          style={{ border: '1px solid var(--border-light)' }}>
          {bodyUrl && (
            <img src={bodyUrl} className="w-full h-full object-contain pointer-events-none" draggable={false} />
          )}
          {layers.map((l, i) => (
            <img key={l.id} src={l.url} draggable={false}
              onMouseDown={e => onGarmentDown(e, i)}
              onTouchStart={e => onGarmentTouch(e, i)}
              className="absolute pointer-events-auto"
              style={{
                left: `${(l.x / (bodyDim?.w || 1)) * 100}%`,
                top: `${(l.y / (bodyDim?.h || 1)) * 100}%`,
                width: `${(l.w / (bodyDim?.w || 1)) * 100}%`,
                height: `${(l.h / (bodyDim?.h || 1)) * 100}%`,
                transform: `rotate(${l.rotation}deg)`,
                opacity: l.opacity,
                cursor: i === active ? 'grab' : 'pointer',
                filter: i === active ? 'drop-shadow(0 0 3px rgba(255,77,148,0.6))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                touchAction: 'none',
                zIndex: i === active ? 50 : 10,
              }}
            />
          ))}
          {active >= 0 && active < layers.length && (() => {
            const l = layers[active]
            return (
              <div className="absolute pointer-events-none" style={{
                left: `${(l.x / (bodyDim?.w || 1)) * 100}%`,
                top: `${(l.y / (bodyDim?.h || 1)) * 100}%`,
                width: `${(l.w / (bodyDim?.w || 1)) * 100}%`,
                height: `${(l.h / (bodyDim?.h || 1)) * 100}%`,
                transform: `rotate(${l.rotation}deg)`,
                border: '2px dashed rgba(255,255,255,0.8)',
                borderRadius: '4px',
                zIndex: 60,
              }} />
            )
          })()}
        </div>

        {error && <div className="flex items-center gap-2 px-3 py-2 mx-3 mb-1 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><X size={14} />{error}</div>}

        {layers.length > 0 && (
          <div className="px-3 mb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {layers.map((l, i) => (
                <button key={l.id} onClick={() => { setActive(i); activeRef.current = i }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0"
                  style={{ backgroundColor: active === i ? 'var(--color-primary)' : 'var(--bg-card)', color: active === i ? 'white' : 'var(--text-secondary)', border: `1px solid ${active === i ? 'var(--color-primary)' : 'var(--border-light)'}` }}>
                  {l.garment.name}
                  <span onClick={(e) => { e.stopPropagation(); removeLayer(i) }} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {cur && (
          <div className="px-3 mb-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{cur.garment.name}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{Math.round(cur.opacity * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={12} style={{ color: 'var(--text-muted)' }} />
              <input type="range" min="0.2" max="1" step="0.05" value={cur.opacity} onChange={e => updateOpacity(parseFloat(e.target.value))} className="flex-1 h-1 accent-[var(--color-primary)]" />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveLayer(-1)} disabled={active === 0} className="p-1.5 rounded-lg disabled:opacity-30" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}><ChevronUp size={12} style={{ color: 'var(--text-secondary)' }} /></button>
              <button onClick={() => moveLayer(1)} disabled={active === layers.length - 1} className="p-1.5 rounded-lg disabled:opacity-30" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}><ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} /></button>
              <button onClick={resetPos} className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}><RotateCcw size={12} style={{ color: 'var(--text-secondary)' }} /></button>
              <div className="flex-1" />
              <button onClick={() => setStep('select')} className="px-2 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>+ Mas prendas</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 p-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={() => { setStep('select'); setActive(-1) }} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Volver</button>
          <button onClick={save} disabled={!bodyUrl || layers.length === 0} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ backgroundColor: 'var(--color-primary)' }}><Save size={12} />Guardar</button>
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
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}><span className="text-2xl" style={{ color: '#22c55e' }}>✓</span></div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Look guardado</p>
      <div className="flex gap-2 w-full max-w-xs">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Cerrar</button>
        <button onClick={() => { setStep('select'); setLayers([]); setActive(-1) }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Nuevo look</button>
      </div>
    </div>
  )

  const titles: Record<string, string> = { guide: 'Probador virtual', photo: 'Subir foto', select: 'Elegir prendas', tryon: 'Ajustar', saving: 'Guardando...', saved: 'Listo' }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-white" style={{ borderColor: 'var(--border-light)' }}>
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
