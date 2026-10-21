import React, { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

interface Props { label: string; onComplete: () => void; className?: string; style?: React.CSSProperties }

/**
 * Botón "desliza para empezar", como EvSlideToStart de la app: se arrastra el círculo hasta el final.
 * Un toque también vale (accesible y cómodo con ratón).
 */
export default function SlideToStart({ label, onComplete, className = '', style }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; max: number; moved: boolean } | null>(null)
  const [x, setX] = useState(0)
  const [done, setDone] = useState(false)

  const finish = () => { if (done) return; setDone(true); onComplete() }

  const onDown = (e: React.PointerEvent) => {
    if (done) return
    const t = track.current!
    ;(e.target as Element).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX - x, max: t.clientWidth - 64, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const nx = Math.min(s.max, Math.max(0, e.clientX - s.x))
    if (Math.abs(nx - x) > 2) s.moved = true
    setX(nx)
  }
  const onUp = () => {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.moved || x > s.max * 0.6) { setX(s.max); finish() } else setX(0)
  }

  const progress = track.current ? x / Math.max(1, track.current.clientWidth - 64) : 0
  return (
    <div
      ref={track}
      role="button"
      tabIndex={0}
      aria-label={`${label}: desliza o toca para continuar`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish() } }}
      className={`relative w-full h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/25 overflow-hidden select-none touch-none ${className}`}
      style={style}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-white/20" style={{ width: x + 64, transition: start.current ? 'none' : 'width .3s ease' }} />
      <span className="absolute inset-0 flex items-center justify-center pl-12 text-white font-semibold text-lg pointer-events-none" style={{ opacity: 1 - progress * 0.9 }}>
        {label}
        <span className="ml-2 inline-flex ev-slide-hint" aria-hidden="true">›››</span>
      </span>
      <span
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className="absolute top-2 left-2 w-12 h-12 rounded-full bg-white text-[#0B0B0F] flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
        style={{ transform: `translateX(${x}px)`, transition: start.current ? 'none' : 'transform .3s ease' }}
      >
        <ArrowRight size={22} />
      </span>
      {/* El resto de la barra también responde a un toque */}
      <span className="absolute inset-0" style={{ left: 64 }} onClick={finish} />
    </div>
  )
}
