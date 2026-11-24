import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Visor de fotos a pantalla completa con zoom (como en la app):
 * - pellizcar con dos dedos o la rueda del ratón: ampliar (hasta 5x)
 * - doble toque / doble clic: acercar o volver
 * - arrastrar: moverse por la foto ampliada
 * - deslizar hacia abajo, tocar fuera, Esc o la ✕: cerrar
 *
 * Uso: openImageZoom(url, 'descripción') desde cualquier sitio. <ImageZoomHost /> se monta una vez en App.
 */

type ZoomRequest = { src: string; alt?: string };
const EVENT = 'ev:image-zoom';
const MAX = 5;
const DOUBLE = 2.5;

export function openImageZoom(src: string | null | undefined, alt?: string) {
  if (!src) return;
  window.dispatchEvent(new CustomEvent<ZoomRequest>(EVENT, { detail: { src, alt } }));
}

/** Props para una <img> que se abre ampliada al tocarla (detiene el clic para no activar la tarjeta). */
export function zoomableProps(src: string | null | undefined, alt?: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': alt ? `Ampliar foto: ${alt}` : 'Ampliar foto',
    style: { cursor: 'zoom-in' } as React.CSSProperties,
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); openImageZoom(src, alt); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openImageZoom(src, alt); }
    },
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const ImageZoomHost: React.FC = () => {
  const [req, setReq] = useState<ZoomRequest | null>(null);
  useEffect(() => {
    const on = (e: Event) => setReq((e as CustomEvent<ZoomRequest>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!req) return null;
  return createPortal(<Viewer key={req.src} src={req.src} alt={req.alt} onClose={() => setReq(null)} />, document.body);
};

const Viewer: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; mid: { x: number; y: number }; pos: { x: number; y: number }; moved: boolean; startY: number } | null>(null);
  const lastTap = useRef(0);
  const downOnBackground = useRef(false);
  const state = useRef({ scale: 1, pos: { x: 0, y: 0 } });
  state.current = { scale, pos };

  // Bloquea el scroll de fondo, devuelve el foco al cerrar y cierra con Esc
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [onClose]);

  const limit = useCallback((p: { x: number; y: number }, s: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    const img = imgRef.current;
    if (!r || !img) return p;
    // Se puede mover solo lo que la foto ampliada sobresale de la pantalla (nunca más allá de su borde)
    const mx = Math.max(0, (img.offsetWidth * s - r.width) / 2);
    const my = Math.max(0, (img.offsetHeight * s - r.height) / 2);
    return { x: clamp(p.x, -mx, mx), y: clamp(p.y, -my, my) };
  }, []);

  /** Cambia el zoom manteniendo fijo el punto (cx, cy) de la pantalla. */
  const zoomAt = useCallback((next: number, cx: number, cy: number, base = state.current) => {
    const r = boxRef.current?.getBoundingClientRect();
    const s = clamp(next, 1, MAX);
    if (!r) return;
    const ox = cx - (r.left + r.width / 2);
    const oy = cy - (r.top + r.height / 2);
    const k = s / base.scale;
    const p = { x: ox - (ox - base.pos.x) * k, y: oy - (oy - base.pos.y) * k };
    setScale(s);
    setPos(s === 1 ? { x: 0, y: 0 } : limit(p, s));
  }, [limit]);

  const toggleAt = (cx: number, cy: number) => {
    setAnimate(true);
    if (state.current.scale > 1.01) { setScale(1); setPos({ x: 0, y: 0 }); }
    else zoomAt(DOUBLE, cx, cy);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Con la captura del puntero el "click" siempre llega al fondo: se anota aquí si se pulsó fuera de la foto
    if (pointers.current.size === 0) downOnBackground.current = e.target === e.currentTarget;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimate(false);
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y), scale: state.current.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pos: state.current.pos, moved: true, startY: e.clientY,
      };
    } else if (pts.length === 1) {
      gesture.current = { dist: 0, scale: state.current.scale, mid: { x: e.clientX, y: e.clientY }, pos: state.current.pos, moved: false, startY: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = clamp(g.scale * (dist / (g.dist || dist)), 1, MAX);
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return;
      const ox = g.mid.x - (r.left + r.width / 2);
      const oy = g.mid.y - (r.top + r.height / 2);
      const k = s / g.scale;
      const p = { x: ox - (ox - g.pos.x) * k + (mid.x - g.mid.x), y: oy - (oy - g.pos.y) * k + (mid.y - g.mid.y) };
      setScale(s);
      setPos(limit(p, s));
      return;
    }
    const dx = e.clientX - g.mid.x;
    const dy = e.clientY - g.mid.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (state.current.scale > 1.01) setPos(limit({ x: g.pos.x + dx, y: g.pos.y + dy }, state.current.scale));
    else if (g.moved) setDragY(e.clientY - g.startY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    setAnimate(true);
    if (pointers.current.size === 1) {
      // Queda un dedo: sigue moviendo desde donde está
      const [p] = [...pointers.current.values()];
      gesture.current = { dist: 0, scale: state.current.scale, mid: p, pos: state.current.pos, moved: true, startY: p.y };
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (state.current.scale < 1.05) { setScale(1); setPos({ x: 0, y: 0 }); }
    if (Math.abs(dragY) > 120) { onClose(); return; }
    setDragY(0);
    if (g && !g.moved) {
      // Tocar fuera de la foto (sin zoom) cierra
      if (downOnBackground.current && state.current.scale <= 1.01) { onClose(); return; }
      const now = Date.now();
      if (now - lastTap.current < 300) { lastTap.current = 0; toggleAt(e.clientX, e.clientY); }
      else lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    setAnimate(false);
    zoomAt(state.current.scale * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  };

  const fade = 1 - Math.min(Math.abs(dragY) / 400, 0.7);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `Foto ampliada: ${alt}` : 'Foto ampliada'}
      className="fixed inset-0 z-[2000] flex items-center justify-center select-none animate-fade-in"
      style={{ backgroundColor: `rgba(0,0,0,${0.92 * fade})` }}
    >
      <div
        ref={boxRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || 'Foto ampliada'}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="max-w-full max-h-full object-contain will-change-transform"
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y + dragY}px, 0) scale(${scale * (1 - Math.min(Math.abs(dragY) / 2000, 0.15))})`,
            transition: animate ? 'transform 260ms cubic-bezier(.2,.8,.2,1)' : 'none',
            opacity: loaded ? 1 : 0,
          }}
        />
        {!loaded && !failed && (
          <div className="absolute w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
        )}
        {failed && <p className="absolute text-white/80 text-sm">No se pudo cargar la foto</p>}
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar foto"
        className="absolute right-3 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <X size={22} />
      </button>
      {loaded && scale <= 1.01 && (
        <p className="absolute left-0 right-0 text-center text-[11px] text-white/60 pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
          Pellizca o haz doble toque para ampliar
        </p>
      )}
    </div>
  );
};

export default ImageZoomHost;
