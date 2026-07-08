import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, Image, RotateCcw, Save, ChevronUp, ChevronDown, SlidersHorizontal, Undo2, Redo2, Moon, Sun, ZoomIn, ZoomOut, Columns } from 'lucide-react'
import type { Garment } from '../types'
import { removeBg, exportCanvas, type GarmentTransform, type ExportResolution } from '../src/utils/tryOnEngine'
import { detectBodyPose, smartAutoPlace, type BodyPose } from '../src/utils/poseDetection'
import { pickPhoto, type CameraSource } from '../src/utils/cameraPhoto'
import { successImpact, errorImpact } from '../src/utils/haptic'
import PoseGuide from '../components/PoseGuide'
import { api } from '../services/api'
import { saveBodyPhoto, loadBodyPhoto, clearBodyPhoto, loadBodyPhotos, removeBodyPhoto } from '../src/utils/syncStore'

interface Props { garments: Garment[]; onClose: () => void }

interface Layer {
  id: string; garment: Garment; url: string
  x: number; y: number; w: number; h: number
  rotation: number; opacity: number
  flipX: boolean; flipY: boolean
}

const CATS = [
  { k: 'all', l: 'Todo' }, { k: 'top', l: 'Top' }, { k: 'bottom', l: 'Bottom' },
  { k: 'dress', l: 'Vestido' }, { k: 'outer', l: 'Exterior' },
  { k: 'shoes', l: 'Zapatos' }, { k: 'acc', l: 'Accesorios' },
]

const RES_OPTIONS: { k: ExportResolution; l: string; desc: string }[] = [
  { k: 'hd', l: 'HD', desc: '1200px' },
  { k: '2k', l: '2K', desc: '2400px' },
  { k: 'full', l: 'Original', desc: 'Tamaño original' },
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

const MAX_HISTORY = 50

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
  const [mirror, setMirror] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [comparePos, setComparePos] = useState(50)
  const [exportRes, setExportRes] = useState<ExportResolution>('hd')
  const [darkBg, setDarkBg] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [savedLook, setSavedLook] = useState<{ layers: Layer[]; bodyUrl: string } | null>(null)
  const [compareView, setCompareView] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<Layer[]>([])
  const activeRef = useRef(-1)

  const [history, setHistory] = useState<Layer[][]>([[]])
  const [histIdx, setHistIdx] = useState(0)
  const historyRef = useRef<Layer[][]>([[]])
  const histIdxRef = useRef(0)

  const [photoList, setPhotoList] = useState<string[]>([])

  layersRef.current = layers
  activeRef.current = active
  historyRef.current = history
  histIdxRef.current = histIdx

  const filtered = garments.filter(g => !g.isWashing && matchG(g, filter))

  const pushHistory = useCallback((next: Layer[]) => {
    const h = historyRef.current.slice(0, histIdxRef.current + 1)
    h.push(next.map(l => ({ ...l })))
    if (h.length > MAX_HISTORY) h.shift()
    historyRef.current = h
    setHistory(h)
    setHistIdx(h.length - 1)
    histIdxRef.current = h.length - 1
  }, [])

  const undo = useCallback(() => {
    const idx = histIdxRef.current
    if (idx <= 0) return
    const prev = historyRef.current[idx - 1]
    setLayers(prev.map(l => ({ ...l })))
    layersRef.current = prev
    setHistIdx(idx - 1)
    histIdxRef.current = idx - 1
  }, [])

  const redo = useCallback(() => {
    const idx = histIdxRef.current
    if (idx >= historyRef.current.length - 1) return
    const next = historyRef.current[idx + 1]
    setLayers(next.map(l => ({ ...l })))
    layersRef.current = next
    setHistIdx(idx + 1)
    histIdxRef.current = idx + 1
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  useEffect(() => {
    loadBodyPhoto().then(saved => {
      if (saved) { setBodyUrl(saved); setStep('select') }
    })
    loadBodyPhotos().then(setPhotoList)
  }, [])

  useEffect(() => {
    if (!bodyUrl) { setBodyDim(null); return }
    const img = new window.Image()
    img.onload = () => setBodyDim({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = bodyUrl
  }, [bodyUrl])

  const gesture = useRef({
    mode: 'idle' as 'idle' | 'drag' | 'resize' | 'rotate',
    dragIdx: -1, lx: 0, ly: 0,
    handle: '' as string,
    centerNX: 0, centerNY: 0, startW: 0, startH: 0, startR: 0, startX: 0, startY: 0,
    pinch: false, pDist: 0, pAngle: 0, sW: 0, sH: 0, sR: 0,
    wasDragged: false,
  })

  const getScale = useCallback(() => {
    const c = containerRef.current
    if (!c || !bodyDim) return 1
    return c.clientWidth / bodyDim.w
  }, [bodyDim])

  const screenToNatural = useCallback((sx: number, sy: number) => {
    const c = containerRef.current
    if (!c || !bodyDim) return { nx: sx, ny: sy }
    const rect = c.getBoundingClientRect()
    const cW = rect.width, cH = rect.height
    const bAspect = bodyDim.w / bodyDim.h
    const cAspect = cW / cH
    let rW: number, rH: number
    if (cAspect > bAspect) { rH = cH; rW = cH * bAspect } else { rW = cW; rH = cW / bAspect }
    const oX = (cW - rW) / 2, oY = (cH - rH) / 2
    const lx = sx - rect.left - oX
    const ly = sy - rect.top - oY
    const nx = (lx / rW) * bodyDim.w
    const ny = (ly / rH) * bodyDim.h
    return { nx, ny }
  }, [bodyDim])

  const updateLayer = useCallback((idx: number, patch: Partial<Layer>) => {
    setLayers(p => p.map((l, i) => i === idx ? { ...l, ...patch } : l))
  }, [])

  useEffect(() => {
    if (step !== 'tryon') return
    const g = gesture.current

    const onMM = (e: MouseEvent) => {
      if (g.mode === 'idle' || g.dragIdx < 0) return
      const ls = layersRef.current
      const l = ls[g.dragIdx]
      if (!l) return
      g.wasDragged = true

      if (g.mode === 'drag') {
        const { nx, ny } = screenToNatural(e.clientX, e.clientY)
        const dx = nx - g.lx, dy = ny - g.ly
        g.lx = nx; g.ly = ny
        updateLayer(g.dragIdx, { x: l.x + dx, y: l.y + dy })
      } else if (g.mode === 'resize') {
        const { nx, ny } = screenToNatural(e.clientX, e.clientY)
        const rad = (-l.rotation * Math.PI) / 180
        const cos = Math.cos(rad), sin = Math.sin(rad)
        const dx = nx - g.centerNX, dy = ny - g.centerNY
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        const isEdge = g.handle.startsWith('e')
        let newW = g.startW, newH = g.startH
        if (isEdge) {
          const axis = g.handle[1]
          if (axis === 't' || axis === 'b') { newH = Math.max(40, Math.abs(localY) * 2) }
          else { newW = Math.max(40, Math.abs(localX) * 2) }
        } else {
          const isTop = g.handle.includes('t')
          const isLeft = g.handle.includes('l')
          if (isLeft) { newW = Math.max(40, g.startW - localX * 2) } else { newW = Math.max(40, g.startW + localX * 2) }
          if (isTop) { newH = Math.max(40, g.startH - localY * 2) } else { newH = Math.max(40, g.startH + localY * 2) }
          const ratio = g.startW / g.startH
          newH = newW / ratio
        }
        const cx = g.startX + g.startW / 2
        const cy = g.startY + g.startH / 2
        updateLayer(g.dragIdx, { w: newW, h: newH, x: cx - newW / 2, y: cy - newH / 2 })
      } else if (g.mode === 'rotate') {
        const { nx, ny } = screenToNatural(e.clientX, e.clientY)
        const cx = l.x + l.w / 2, cy = l.y + l.h / 2
        let angle = Math.atan2(ny - cy, nx - cx) * 180 / Math.PI + 90
        if (e.shiftKey) { angle = Math.round(angle / 15) * 15 }
        updateLayer(g.dragIdx, { rotation: angle })
      }
    }

    const onMU = () => {
      if (g.wasDragged && g.dragIdx >= 0) {
        pushHistory(layersRef.current)
      }
      g.mode = 'idle'; g.dragIdx = -1; g.wasDragged = false
    }

    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2 && g.dragIdx >= 0) {
        e.preventDefault()
        const t0 = e.touches[0], t1 = e.touches[1]
        const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const a = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * 180 / Math.PI
        const ratio = d / g.pDist
        const rot = g.sR + (a - g.pAngle)
        updateLayer(g.dragIdx, {
          w: Math.max(40, g.sW * ratio), h: Math.max(40, g.sH * ratio),
          rotation: rot,
        })
      } else if (e.touches.length === 1 && g.mode !== 'idle' && g.dragIdx >= 0) {
        e.preventDefault()
        const t = e.touches[0]
        const ls = layersRef.current
        const l = ls[g.dragIdx]
        if (!l) return
        g.wasDragged = true

        if (g.mode === 'drag') {
          const { nx, ny } = screenToNatural(t.clientX, t.clientY)
          const dx = nx - g.lx, dy = ny - g.ly
          g.lx = nx; g.ly = ny
          updateLayer(g.dragIdx, { x: l.x + dx, y: l.y + dy })
        } else if (g.mode === 'resize') {
          const { nx, ny } = screenToNatural(t.clientX, t.clientY)
          const rad = (-l.rotation * Math.PI) / 180
          const cos = Math.cos(rad), sin = Math.sin(rad)
          const dx = nx - g.centerNX, dy = ny - g.centerNY
          const localX = dx * cos - dy * sin
          const localY = dx * sin + dy * cos
          const isEdge = g.handle.startsWith('e')
          let newW = g.startW, newH = g.startH
          if (isEdge) {
            const axis = g.handle[1]
            if (axis === 't' || axis === 'b') { newH = Math.max(40, Math.abs(localY) * 2) }
            else { newW = Math.max(40, Math.abs(localX) * 2) }
          } else {
            const isTop = g.handle.includes('t')
            const isLeft = g.handle.includes('l')
            if (isLeft) { newW = Math.max(40, g.startW - localX * 2) } else { newW = Math.max(40, g.startW + localX * 2) }
            if (isTop) { newH = Math.max(40, g.startH - localY * 2) } else { newH = Math.max(40, g.startH + localY * 2) }
            const ratio = g.startW / g.startH
            newH = newW / ratio
          }
          const cx = g.startX + g.startW / 2
          const cy = g.startY + g.startH / 2
          updateLayer(g.dragIdx, { w: newW, h: newH, x: cx - newW / 2, y: cy - newH / 2 })
        } else if (g.mode === 'rotate') {
          const { nx, ny } = screenToNatural(t.clientX, t.clientY)
          const cx = l.x + l.w / 2, cy = l.y + l.h / 2
          let angle = Math.atan2(ny - cy, nx - cx) * 180 / Math.PI + 90
          updateLayer(g.dragIdx, { rotation: angle })
        }
      }
    }

    const onTE = () => {
      if (g.wasDragged && g.dragIdx >= 0) {
        pushHistory(layersRef.current)
      }
      g.mode = 'idle'; g.dragIdx = -1; g.pinch = false; g.wasDragged = false
    }

    const onW = (e: WheelEvent) => {
      if (activeRef.current < 0) return
      const ai = activeRef.current
      const ls = layersRef.current
      if (ai >= ls.length) return
      e.preventDefault()
      const f = e.deltaY > 0 ? 0.95 : 1.05
      const l = ls[ai]
      const newW = Math.max(40, l.w * f)
      const newH = Math.max(40, l.h * f)
      updateLayer(ai, { w: newW, h: newH, x: l.x + (l.w - newW) / 2, y: l.y + (l.h - newH) / 2 })
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
  }, [step, getScale, screenToNatural, updateLayer, bodyDim, bodyPose, pushHistory])

  // ─── Zoom/pan handlers (container-level) ──────────────────────
  const pinchRef = useRef({ dist: 0, zoom: 1 })
  const lastTapRef = useRef(0)
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 })

  useEffect(() => {
    if (step !== 'tryon' || !containerRef.current) return
    const el = containerRef.current

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const onGarment = target?.closest('[data-garment]') || target?.closest('[data-handle]')

      if (e.touches.length === 2 && !onGarment) {
        e.preventDefault()
        const t0 = e.touches[0], t1 = e.touches[1]
        pinchRef.current = { dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY), zoom }
      } else if (e.touches.length === 1 && !onGarment) {
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          e.preventDefault()
          lastTapRef.current = 0
          if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }) }
          else { setZoom(2); setPan({ x: 0, y: 0 }) }
          return
        }
        lastTapRef.current = now
        if (zoom > 1) {
          panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y }
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current.dist > 0) {
        e.preventDefault()
        const t0 = e.touches[0], t1 = e.touches[1]
        const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const newZoom = Math.min(3, Math.max(1, pinchRef.current.zoom * (d / pinchRef.current.dist)))
        setZoom(newZoom)
        if (newZoom <= 1) setPan({ x: 0, y: 0 })
      } else if (e.touches.length === 1 && zoom > 1 && gesture.current.mode === 'idle' && !(e.target as HTMLElement)?.closest?.('[data-garment]')) {
        const dx = e.touches[0].clientX - panStartRef.current.x
        const dy = e.touches[0].clientY - panStartRef.current.y
        setPan({ x: panStartRef.current.px + dx / zoom, y: panStartRef.current.py + dy / zoom })
      }
    }

    const onTouchEnd = () => { pinchRef.current.dist = 0 }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(z => {
          const nz = Math.min(3, Math.max(1, z * delta))
          if (nz <= 1) setPan({ x: 0, y: 0 })
          return nz
        })
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [step, zoom, pan])

  const pick = async (src: CameraSource) => {
    try {
      setError(null)
      const { dataUrl } = await pickPhoto(src)
      setBodyUrl(dataUrl)
      saveBodyPhoto(dataUrl)
      loadBodyPhotos().then(setPhotoList)
      setStep('select')
    } catch (e: any) { if (e?.message !== 'User cancelled') setError('No se pudo obtener la foto.') }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader(); r.onloadend = () => {
      const url = r.result as string
      setBodyUrl(url)
      saveBodyPhoto(url)
      loadBodyPhotos().then(setPhotoList)
      setStep('select')
    }; r.readAsDataURL(f)
  }

  const selectPhoto = (url: string) => {
    setBodyUrl(url)
    saveBodyPhoto(url)
    setStep('select')
  }

  const deletePhoto = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await removeBodyPhoto(url)
    const updated = await loadBodyPhotos()
    setPhotoList(updated)
    if (bodyUrl === url && updated.length > 0) {
      setBodyUrl(updated[0])
    } else if (updated.length === 0) {
      setBodyUrl(null)
      setBodyDim(null)
      setStep('photo')
    }
  }

  const toggle = (g: Garment) => setSelIds(p => { const n = new Set(p); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })

  const process = async () => {
    if (selIds.size === 0 || !bodyUrl || !bodyDim) return
    setBusy(true); setDetecting(true); setError(null)
    try {
      let pose = bodyPose
      if (!pose) { pose = await detectBodyPose(bodyUrl); if (pose) setBodyPose(pose) }
      setDetecting(false)

      const newLayers: Layer[] = []
      for (const g of garments.filter(g => selIds.has(g.id))) {
        const exists = layers.find(l => l.garment.id === g.id)
        if (exists) { newLayers.push(exists); continue }
        let url = g.imageUrl
        try { url = await removeBg(g.imageUrl) } catch {}
        const p = autoPos(pose, g.type, bodyDim.w, bodyDim.h)
        newLayers.push({
          id: `${g.id}_${Date.now()}`, garment: g, url,
          x: p.x, y: p.y, w: p.w, h: p.h,
          rotation: 0, opacity: 1, flipX: false, flipY: false,
        })
      }
      const merged = [...layers.filter(l => !selIds.has(l.garment.id) || newLayers.some(n => n.garment.id === l.garment.id)), ...newLayers.filter(n => !layers.some(l => l.garment.id === n.garment.id))]
      setLayers(merged)
      layersRef.current = merged
      pushHistory(merged)
      setStep('tryon')
    } catch { setDetecting(false); setError('Error procesando prendas.') }
    setBusy(false)
  }

  const save = async (transparent = false) => {
    if (!bodyUrl || !bodyDim) return
    setStep('saving')
    try {
      const dataUrl = await exportCanvas(bodyUrl, layers.map(l => ({
        url: l.url, t: { x: l.x, y: l.y, width: l.w, height: l.h, rotation: l.rotation, opacity: l.opacity, flipX: l.flipX, flipY: l.flipY }
      })), bodyDim.w, bodyDim.h, { transparent, mirror, resolution: exportRes })
      const res = await fetch(dataUrl); const blob = await res.blob()
      await api.saveLookWithImage(`Look ${new Date().toLocaleDateString('es')}`, layers.map(l => l.garment.id), blob)
      successImpact(); setStep('saved')
    } catch { errorImpact(); setError('No se pudo guardar.'); setStep('tryon') }
  }

  const updateOpacity = (v: number) => { if (active >= 0) { updateLayer(active, { opacity: v }); pushHistory(layersRef.current) } }
  const moveLayer = (d: -1 | 1) => {
    const t = active + d; if (t < 0 || t >= layers.length) return
    setLayers(p => { const a = [...p]; [a[active], a[t]] = [a[t], a[active]]; pushHistory(a); return a }); setActive(t)
  }
  const removeLayer = (i: number) => { setLayers(p => { const n = p.filter((_, j) => j !== i); if (!n.length) setStep('select'); pushHistory(n); return n }); setActive(-1) }
  const resetPos = () => {
    if (active < 0 || !bodyDim) return
    const p = autoPos(bodyPose, layers[active].garment.type, bodyDim.w, bodyDim.h)
    updateLayer(active, { x: p.x, y: p.y, w: p.w, h: p.h, rotation: 0 })
    pushHistory(layersRef.current)
  }

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
      {photoList.length > 0 && (
        <div className="w-full max-w-xs mt-2">
          <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Fotos anteriores</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photoList.map((p, i) => (
              <div key={i} className="relative shrink-0 w-16 h-20 rounded-lg overflow-hidden cursor-pointer" style={{ border: bodyUrl === p ? '2px solid var(--color-primary)' : '1px solid var(--border-light)' }} onClick={() => selectPhoto(p)}>
                <img src={p} className="w-full h-full object-cover" />
                <button onClick={e => deletePhoto(p, e)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center"><X size={8} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
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

    const onGarmentDown = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation()
      setActive(idx); activeRef.current = idx
      const l = layersRef.current[idx]
      const g = gesture.current
      g.mode = 'drag'; g.dragIdx = idx; g.wasDragged = false
      const { nx, ny } = screenToNatural(e.clientX, e.clientY)
      g.lx = nx; g.ly = ny
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
        g.mode = 'drag'; g.dragIdx = idx; g.wasDragged = false
        const { nx, ny } = screenToNatural(t.clientX, t.clientY)
        g.lx = nx; g.ly = ny
      }
    }

    const onHandleDown = (e: React.MouseEvent, idx: number, handle: string) => {
      e.stopPropagation(); e.preventDefault()
      setActive(idx); activeRef.current = idx
      const l = layersRef.current[idx]
      const g = gesture.current
      if (handle === 'rotate') {
        g.mode = 'rotate'; g.dragIdx = idx
      } else {
        g.mode = 'resize'; g.dragIdx = idx; g.handle = handle
        g.centerNX = l.x + l.w / 2; g.centerNY = l.y + l.h / 2
        g.startW = l.w; g.startH = l.h; g.startX = l.x; g.startY = l.y
      }
    }

    const onHandleTouch = (e: React.TouchEvent, idx: number, handle: string) => {
      e.stopPropagation(); e.preventDefault()
      setActive(idx); activeRef.current = idx
      const l = layersRef.current[idx]
      const g = gesture.current
      if (handle === 'rotate') {
        g.mode = 'rotate'; g.dragIdx = idx
      } else {
        g.mode = 'resize'; g.dragIdx = idx; g.handle = handle
        g.centerNX = l.x + l.w / 2; g.centerNY = l.y + l.h / 2
        g.startW = l.w; g.startH = l.h; g.startX = l.x; g.startY = l.y
      }
    }

    const onCanvasClick = (e: React.MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'IMG' || (e.target as HTMLElement).dataset.handle) return
      setActive(-1); activeRef.current = -1
    }

    const pct = (v: number, base: number) => `${(v / (base || 1)) * 100}%`

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={containerRef} onClick={onCanvasClick}
          className={`flex-1 mx-3 my-2 rounded-xl overflow-hidden relative ${darkBg ? 'bg-gray-900' : 'bg-gray-100'}`}
          style={{ border: '1px solid var(--border-light)' }}>
          {bodyUrl && bodyDim && (() => {
            const cW = containerRef.current?.clientWidth || 300
            const cH = containerRef.current?.clientHeight || 400
            const bAspect = bodyDim.w / bodyDim.h
            const cAspect = cW / cH
            let rW: number, rH: number
            if (cAspect > bAspect) { rH = cH; rW = cH * bAspect } else { rW = cW; rH = cW / bAspect }
            const oX = (cW - rW) / 2, oY = (cH - rH) / 2
            return (
              <div className="absolute" style={{ left: oX, top: oY, width: rW, height: rH, transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}>
                <img src={bodyUrl} className="w-full h-full pointer-events-none" draggable={false}
                  style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
                {layers.map((l, i) => (
                  <img key={l.id} src={l.url} draggable={false} data-garment="1"
                    onMouseDown={e => onGarmentDown(e, i)}
                    onTouchStart={e => onGarmentTouch(e, i)}
                    className="absolute pointer-events-auto"
                    style={{
                      left: pct(l.x, bodyDim.w), top: pct(l.y, bodyDim.h),
                      width: pct(l.w, bodyDim.w), height: pct(l.h, bodyDim.h),
                      transform: `rotate(${l.rotation}deg) scaleX(${l.flipX ? -1 : 1}) scaleY(${l.flipY ? -1 : 1})`,
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
                  const rot = l.rotation
                  const rs = rW / bodyDim.w
                  const halfW = l.w * rs / 2, halfH = l.h * rs / 2
                  const rotLen = Math.min(30, halfH * 0.5)
                  const corners = [
                    { h: 'tl', x: -halfW, y: -halfH },
                    { h: 'tr', x: halfW, y: -halfH },
                    { h: 'bl', x: -halfW, y: halfH },
                    { h: 'br', x: halfW, y: halfH },
                  ]
                  const edges = [
                    { h: 'et', x: 0, y: -halfH, cursor: 'ns-resize' },
                    { h: 'eb', x: 0, y: halfH, cursor: 'ns-resize' },
                    { h: 'el', x: -halfW, y: 0, cursor: 'ew-resize' },
                    { h: 'er', x: halfW, y: 0, cursor: 'ew-resize' },
                  ]
                  return (
                    <div className="absolute pointer-events-none" style={{
                      left: pct(l.x + l.w / 2, bodyDim.w), top: pct(l.y + l.h / 2, bodyDim.h),
                      width: 0, height: 0,
                      transform: `rotate(${rot}deg)`,
                      zIndex: 60,
                    }}>
                      <div className="absolute" style={{
                        left: -halfW, top: -halfH, width: l.w * rs, height: l.h * rs,
                        border: '2px solid rgba(255,255,255,0.9)',
                        boxShadow: '0 0 0 1px rgba(255,77,148,0.5)',
                        borderRadius: '2px',
                      }} />
                      {corners.map(c => (
                        <div key={c.h} data-handle={c.h}
                          onMouseDown={e => onHandleDown(e, active, c.h)}
                          onTouchStart={e => onHandleTouch(e, active, c.h)}
                          className="absolute pointer-events-auto"
                          style={{
                            left: c.x - 7, top: c.y - 7, width: 14, height: 14,
                            borderRadius: '2px', backgroundColor: 'white',
                            border: '2px solid var(--color-primary)',
                            cursor: c.h === 'tl' || c.h === 'br' ? 'nwse-resize' : 'nesw-resize',
                            zIndex: 70,
                          }}
                        />
                      ))}
                      {edges.map(e => (
                        <div key={e.h} data-handle={e.h}
                          onMouseDown={ev => onHandleDown(ev, active, e.h)}
                          onTouchStart={ev => onHandleTouch(ev, active, e.h)}
                          className="absolute pointer-events-auto"
                          style={{
                            left: e.x - 6, top: e.y - 6, width: 12, height: 12,
                            borderRadius: '50%', backgroundColor: 'white',
                            border: '2px solid var(--color-primary)',
                            cursor: e.cursor, zIndex: 70,
                          }}
                        />
                      ))}
                      <div className="absolute" style={{
                        left: -1, top: -halfH - rotLen, width: 2, height: rotLen,
                        backgroundColor: 'var(--color-primary)', opacity: 0.7,
                      }} />
                      <div data-handle="rotate"
                        onMouseDown={e => onHandleDown(e, active, 'rotate')}
                        onTouchStart={e => onHandleTouch(e, active, 'rotate')}
                        className="absolute pointer-events-auto"
                        style={{
                          left: -8, top: -halfH - rotLen - 8, width: 16, height: 16,
                          borderRadius: '50%', backgroundColor: 'white',
                          border: '2px solid var(--color-primary)',
                          cursor: 'grab', zIndex: 70,
                        }}
                      />
                    </div>
                  )
                })()}
              </div>
            )
          })()}
          {compareMode && bodyUrl && (
            <div className="absolute inset-0 z-[80]"
              onMouseMove={e => { if (e.buttons !== 1) return; const r = containerRef.current?.getBoundingClientRect(); if (r) setComparePos(((e.clientX - r.left) / r.width) * 100) }}
              onTouchMove={e => { const t = e.touches[0]; const r = containerRef.current?.getBoundingClientRect(); if (r) setComparePos(((t.clientX - r.left) / r.width) * 100) }}
            >
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
                <img src={bodyUrl} className="w-full h-full object-contain pointer-events-none" draggable={false}
                  style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
              </div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${comparePos}%`, zIndex: 81 }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ border: '2px solid var(--color-primary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M8 3l-5 9 5 9M16 3l5 9-5 9"/></svg>
                </div>
              </div>
            </div>
          )}
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
              <button onClick={() => updateLayer(active, { flipX: !cur.flipX })} className="p-1.5 rounded-lg" style={{ backgroundColor: cur.flipX ? 'var(--color-primary)' : 'var(--bg-card)', border: '1px solid var(--border-light)', color: cur.flipX ? 'white' : 'var(--text-secondary)' }} title="Voltear horizontal">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 20V4"/></svg>
              </button>
              <button onClick={() => updateLayer(active, { flipY: !cur.flipY })} className="p-1.5 rounded-lg" style={{ backgroundColor: cur.flipY ? 'var(--color-primary)' : 'var(--bg-card)', border: '1px solid var(--border-light)', color: cur.flipY ? 'white' : 'var(--text-secondary)' }} title="Voltear vertical">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8V5a2 2 0 012-2h14a2 2 0 012 2v3M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3M4 12h16"/></svg>
              </button>
            </div>
          </div>
        )}

        <div className="px-3 mb-1">
          <button onClick={() => setStep('select')} className="w-full py-2 rounded-xl text-[10px] font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>+ Mas prendas</button>
        </div>

        <div className="flex gap-1.5 px-3 mb-1">
          <button onClick={undo} disabled={histIdx <= 0} className="p-1.5 rounded-lg disabled:opacity-30" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }} title="Deshacer (Ctrl+Z)"><Undo2 size={12} style={{ color: 'var(--text-secondary)' }} /></button>
          <button onClick={redo} disabled={histIdx >= history.length - 1} className="p-1.5 rounded-lg disabled:opacity-30" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }} title="Rehacer (Ctrl+Shift+Z)"><Redo2 size={12} style={{ color: 'var(--text-secondary)' }} /></button>
          <button onClick={() => { setDarkBg(!darkBg); setZoom(1); setPan({ x: 0, y: 0 }) }} className="p-1.5 rounded-lg" style={{ backgroundColor: darkBg ? 'var(--color-primary)' : 'var(--bg-card)', border: '1px solid var(--border-light)', color: darkBg ? 'white' : 'var(--text-secondary)' }} title={darkBg ? 'Fondo claro' : 'Fondo oscuro'}>{darkBg ? <Sun size={12} /> : <Moon size={12} />}</button>
          {zoom > 1 && <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-primary)', border: '1px solid var(--color-primary)', color: 'white' }} title="Reset zoom"><ZoomOut size={12} /></button>}
          {zoom > 1 && <span className="px-1.5 py-0.5 rounded-lg text-[9px] font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{Math.round(zoom * 100)}%</span>}
          <button onClick={() => { if (savedLook) { setCompareView(true) } else { setSavedLook({ layers: layers.map(l => ({ ...l })), bodyUrl: bodyUrl! }); successImpact() } }} className="p-1.5 rounded-lg" style={{ backgroundColor: savedLook ? 'var(--color-primary)' : 'var(--bg-card)', border: '1px solid var(--border-light)', color: savedLook ? 'white' : 'var(--text-secondary)' }} title={savedLook ? 'Comparar looks' : 'Guardar Look A'}><Columns size={12} /></button>
          <div className="flex-1" />
          {RES_OPTIONS.map(r => (
            <button key={r.k} onClick={() => setExportRes(r.k)} className="px-2 py-1 rounded-lg text-[9px] font-medium" style={{ backgroundColor: exportRes === r.k ? 'var(--color-primary)' : 'var(--bg-card)', border: `1px solid ${exportRes === r.k ? 'var(--color-primary)' : 'var(--border-light)'}`, color: exportRes === r.k ? 'white' : 'var(--text-secondary)' }} title={r.desc}>{r.l}</button>
          ))}
        </div>

        <div className="flex gap-2 p-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={() => { setStep('select'); setActive(-1) }} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Volver</button>
          <button onClick={() => setMirror(!mirror)} className="py-2.5 px-3 rounded-xl text-xs font-medium" style={{ backgroundColor: mirror ? 'var(--color-primary)' : 'var(--bg-card)', border: '1px solid var(--border-light)', color: mirror ? 'white' : 'var(--text-secondary)' }} title="Espejo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M17 7l-5-4-5 4"/></svg>
          </button>
          <button onClick={() => { setCompareMode(!compareMode); setComparePos(50) }} className="py-2.5 px-3 rounded-xl text-xs font-medium" style={{ backgroundColor: compareMode ? 'var(--color-primary)' : 'var(--bg-card)', border: '1px solid var(--border-light)', color: compareMode ? 'white' : 'var(--text-secondary)' }} title="Comparar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          </button>
          <button onClick={() => { clearBodyPhoto(); setBodyUrl(null); setBodyDim(null); setLayers([]); setActive(-1); setStep('photo') }}
            className="py-2.5 px-3 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            <Camera size={14} />
          </button>
          <button onClick={() => save(false)} disabled={!bodyUrl || layers.length === 0} className="py-2.5 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--color-primary)' }}><Save size={12} /></button>
          <button onClick={() => save(true)} disabled={!bodyUrl || layers.length === 0} className="py-2.5 px-3 rounded-xl text-[10px] font-medium disabled:opacity-40" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }} title="Guardar sin fondo">PNG</button>
        </div>
      </div>
    )
  }

  const SCompare = () => {
    if (!savedLook || !bodyUrl || !bodyDim) return null
    const pct = (v: number, base: number) => `${(v / (base || 1)) * 100}%`
    const renderLook = (lookLayers: Layer[], mirrorLook: boolean) => (
      <div className="flex-1 relative overflow-hidden bg-gray-100">
        <img src={bodyUrl} className="w-full h-full object-contain pointer-events-none" draggable={false}
          style={{ transform: mirrorLook ? 'scaleX(-1)' : undefined }} />
        {lookLayers.map((l) => (
          <img key={l.id} src={l.url} draggable={false} className="absolute pointer-events-none"
            style={{
              left: pct(l.x, bodyDim.w), top: pct(l.y, bodyDim.h),
              width: pct(l.w, bodyDim.w), height: pct(l.h, bodyDim.h),
              transform: `rotate(${l.rotation}deg) scaleX(${l.flipX ? -1 : 1}) scaleY(${l.flipY ? -1 : 1})`,
              opacity: l.opacity,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            }}
          />
        ))}
      </div>
    )
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex gap-0.5 mx-3 my-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
          {renderLook(savedLook.layers, mirror)}
          <div className="w-0.5 bg-white z-10" />
          {renderLook(layers, mirror)}
        </div>
        <div className="px-3 mb-1 flex items-center gap-2">
          <div className="flex-1 text-center text-[10px] font-medium py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Look A (guardado)</div>
          <div className="flex-1 text-center text-[10px] font-medium py-1 rounded-lg" style={{ backgroundColor: 'var(--color-primary)', border: '1px solid var(--color-primary)', color: 'white' }}>Look B (actual)</div>
        </div>
        <div className="flex gap-2 p-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={() => setCompareView(false)} className="flex-1 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Volver</button>
          <button onClick={() => { setCompareView(false); setSavedLook(null) }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Confirmar</button>
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
      {step === 'tryon' && !compareView && <STryon />}
      {step === 'tryon' && compareView && <SCompare />}
      {step === 'saving' && <SSaving />}
      {step === 'saved' && <SSaved />}
    </div>
  )
}
