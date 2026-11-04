import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Garment } from '../types';

/**
 * Lavadora flotante del armario. En el ordenador se arrastra la prenda con el ratón (arrastre nativo);
 * en el móvil, pulsación larga sobre la prenda y arrastrar hasta la lavadora. Al soltar, el tambor centrifuga.
 * Tocar la lavadora abre la lista de lo que hay dentro (la gestiona Layout con el evento 'ev:open-washing').
 */

type DragState = { garment: Garment; x: number; y: number } | null;

export function useWashDrag(onWash: (g: Garment) => void) {
  const [drag, setDrag] = useState<DragState>(null);
  const [spins, setSpins] = useState(0);
  const washerRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState>(null);
  const justDragged = useRef(false); // evita que al soltar se abra el detalle de la prenda
  dragRef.current = drag;

  const overWasher = useCallback((x: number, y: number) => {
    const r = washerRef.current?.getBoundingClientRect();
    return !!r && x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24;
  }, []);

  // Mientras se arrastra con el dedo, la página no hace scroll
  useEffect(() => {
    const block = (e: TouchEvent) => { if (dragRef.current || gesture.current?.active) e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  const drop = useCallback((g: Garment) => {
    setSpins((n) => n + 1);
    try { navigator.vibrate?.(30); } catch {}
    onWash(g);
  }, [onWash]);

  /** Props para la tarjeta de cada prenda (solo táctil: con ratón se usa el arrastre nativo que ya tienen). */
  // Un solo gesto a la vez: se guarda en una ref para que sobreviva a los renders que provoca mover el dedo
  const gesture = useRef<{ id: string; timer?: number; x: number; y: number; active: boolean } | null>(null);

  const cardProps = useCallback((g: Garment) => {
    const mine = () => (gesture.current?.id === g.id ? gesture.current : null);
    const end = (e: React.PointerEvent) => {
      const s = mine();
      if (!s) return;
      window.clearTimeout(s.timer);
      gesture.current = null;
      if (!s.active) return;
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 350);
      setDrag(null);
      if (overWasher(e.clientX, e.clientY)) drop(g);
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch' || g.forSale) return;
        const target = e.currentTarget as HTMLElement;
        const id = e.pointerId;
        const s = { id: g.id, x: e.clientX, y: e.clientY, active: false } as NonNullable<typeof gesture.current>;
        s.timer = window.setTimeout(() => {
          s.active = true;
          try { target.setPointerCapture(id); } catch {}
          try { navigator.vibrate?.(15); } catch {}
          // Ya mismo (sin esperar al render) para que el primer movimiento no se convierta en scroll
          dragRef.current = { garment: g, x: s.x, y: s.y };
          setDrag(dragRef.current);
        }, 380);
        gesture.current = s;
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = mine();
        if (!s) return;
        if (!s.active) {
          // Si el dedo se mueve antes de tiempo es un scroll: se cancela la pulsación larga
          if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) { window.clearTimeout(s.timer); gesture.current = null; }
          return;
        }
        setDrag({ garment: g, x: e.clientX, y: e.clientY });
      },
      onPointerUp: end,
      onPointerCancel: end,
      onClickCapture: (e: React.MouseEvent) => { if (justDragged.current) { e.stopPropagation(); e.preventDefault(); } },
      onContextMenu: (e: React.MouseEvent) => { if (gesture.current || dragRef.current) e.preventDefault(); },
    };
  }, [drop, overWasher]);

  const hovering = !!drag && overWasher(drag.x, drag.y);
  return { drag, hovering, spins, washerRef, cardProps, drop };
}

const WasherSvg: React.FC<{ spinning: boolean; glow: boolean }> = ({ spinning, glow }) => (
  <svg viewBox="0 0 118 138" width="78" height="92" aria-hidden="true" style={{ overflow: 'visible' }}>
    <defs>
      <linearGradient id="wm-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e3e3ea" /></linearGradient>
      <linearGradient id="wm-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#93c5fd" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
      <radialGradient id="wm-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffffff" stopOpacity=".7" /><stop offset=".5" stopColor="#ffffff" stopOpacity=".05" /></radialGradient>
      <clipPath id="wm-hole"><circle cx="59" cy="82" r="34" /></clipPath>
      <radialGradient id="wm-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#000" stopOpacity=".45" /><stop offset=".6" stopColor="#000" stopOpacity=".18" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      <linearGradient id="wm-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".07" /><stop offset=".18" stopColor="#000" stopOpacity="0" /><stop offset=".8" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></linearGradient>
      <radialGradient id="wm-inset" cx=".5" cy=".5" r=".5"><stop offset=".82" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></radialGradient>
    </defs>
    {/* Sombra en el suelo: elipse difuminada bajo la lavadora, más oscura en el centro */}
    <ellipse cx="59" cy="139" rx="62" ry="9" fill="url(#wm-floor)" />
    {/* Patas */}
    <rect x="12" y="131" width="12" height="7" rx="2" fill="#9ca3af" /><rect x="94" y="131" width="12" height="7" rx="2" fill="#9ca3af" />
    <rect x="2" y="2" width="114" height="134" rx="16" fill="url(#wm-body)" stroke="#cfcfd8" strokeWidth="2" />
    {/* Volumen: laterales algo más oscuros, como si la luz viniera de arriba a la izquierda */}
    <rect x="2" y="2" width="114" height="134" rx="16" fill="url(#wm-side)" />
    <rect x="2" y="2" width="114" height="30" rx="16" fill="#f4f4f8" />
    <line x1="4" y1="32" x2="114" y2="32" stroke="#d6d6de" strokeWidth="2" />
    <rect x="12" y="12" width="34" height="11" rx="4" fill="#1f2937" /><rect x="15" y="15" width="16" height="5" rx="2" fill="#60a5fa" />
    <circle cx="96" cy="17" r="8" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" /><line x1="96" y1="17" x2="96" y2="11" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="76" cy="17" r="3" fill="#22c55e" /><circle cx="66" cy="17" r="3" fill="#d1d5db" />
    <circle cx="59" cy="82" r="44" fill="#d9d9e1" />
    <circle cx="59" cy="82" r="40" fill={glow ? '#3b82f6' : '#9ca3af'} style={{ transition: 'fill .2s' }} />
    <circle cx="59" cy="82" r="34" fill="#1e293b" />
    <circle cx="59" cy="82" r="34" fill="url(#wm-inset)" />
    <g clipPath="url(#wm-hole)">
      <motion.g
        style={{ originX: '59px', originY: '82px' }}
        animate={spinning ? { rotate: [0, 1080] } : { rotate: [0, 8, -8, 0] }}
        transition={spinning ? { duration: 1.8, ease: [0.4, 0, 0.2, 1] } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M20 92 Q 40 84 59 92 T 98 92 V 130 H 20 Z" fill="url(#wm-water)" opacity=".9" />
        <rect x="34" y="62" width="22" height="18" rx="5" fill="#f472b6" transform="rotate(-20 45 71)" />
        <rect x="60" y="88" width="24" height="16" rx="5" fill="#fbbf24" transform="rotate(25 72 96)" />
        <rect x="44" y="96" width="18" height="14" rx="4" fill="#ffffff" opacity=".9" />
        <circle cx="76" cy="66" r="3" fill="#ffffff" opacity=".8" /><circle cx="40" cy="98" r="2.5" fill="#ffffff" opacity=".8" />
      </motion.g>
    </g>
    <circle cx="59" cy="82" r="34" fill="url(#wm-glass)" />
    <circle cx="59" cy="82" r="34" fill="none" stroke="#e5e7eb" strokeWidth="3" />
  </svg>
);

interface Props {
  wash: ReturnType<typeof useWashDrag>;
  count: number;
  garments: Garment[];
}

const WashingMachineDrop: React.FC<Props> = ({ wash, count, garments }) => {
  const { drag, hovering, spins, washerRef, drop } = wash;
  const [nativeOver, setNativeOver] = useState(false);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!spins) return;
    setSpinning(true);
    const t = window.setTimeout(() => setSpinning(false), 1850);
    return () => window.clearTimeout(t);
  }, [spins]);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onMenu = (e: Event) => setMenuOpen(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener('ev:wardrobe-menu', onMenu);
    return () => window.removeEventListener('ev:wardrobe-menu', onMenu);
  }, []);
  const over = hovering || nativeOver;

  return (
    <>
      <motion.button
        ref={washerRef}
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('ev:open-washing'))}
        onDragOver={(e) => { e.preventDefault(); setNativeOver(true); }}
        onDragLeave={() => setNativeOver(false)}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setNativeOver(false);
          const g = garments.find((x) => x.id === e.dataTransfer.getData('garmentId'));
          if (g && !g.isWashing && !g.forSale) drop(g);
        }}
        tabIndex={menuOpen ? -1 : 0}
        aria-hidden={menuOpen || undefined}
        animate={{ scale: menuOpen ? 0.6 : over ? 1.12 : drag ? 1.05 : 1, opacity: menuOpen ? 0 : 1, x: spinning ? [0, 1.5, -1.5, 1, -1, 0] : 0 }}
        transition={spinning ? { x: { duration: 0.18, repeat: 9 } } : { type: 'spring', stiffness: 400, damping: 18 }}
        // Justo a la izquierda del botón redondo de añadir (right-6 + 56 px + hueco), con la base alineada
        className="fixed z-[56] bottom-28 right-[92px]"
        style={{ pointerEvents: menuOpen ? 'none' : undefined, filter:'drop-shadow(0 10px 12px rgba(0,0,0,.18)) drop-shadow(0 2px 3px rgba(0,0,0,.12))' }}
        aria-label={count > 0 ? `Lavadora: ${count} ${count === 1 ? 'prenda' : 'prendas'} dentro. Abrir` : 'Lavadora. Arrastra aquí una prenda para lavarla'}
      >
        <WasherSvg spinning={spinning} glow={over} />
        {count > 0 && (
          <span className="absolute -top-2 -right-2 w-[26px] h-[26px] rounded-full bg-blue-500 text-white text-xs font-bold grid place-items-center border-2 border-white">{count}</span>
        )}
        {(drag || nativeOver) && (
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-100 text-blue-600 text-[11px] font-bold px-2.5 py-1">
            {over ? '¡Suelta!' : 'Arrastra aquí'}
          </span>
        )}
      </motion.button>
      {drag && (
        <div className="fixed z-[57] pointer-events-none" style={{ left: drag.x - 44, top: drag.y - 70 }}>
          <motion.div animate={{ scale: hovering ? 0.7 : 1 }} className="w-[88px] h-[88px] rounded-2xl bg-white border-[3px] border-white shadow-2xl overflow-hidden -rotate-[8deg]">
            <img src={drag.garment.imageUrl} alt="" className="w-full h-full object-contain" />
          </motion.div>
        </div>
      )}
    </>
  );
};

export default WashingMachineDrop;
