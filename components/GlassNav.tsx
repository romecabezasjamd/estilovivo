import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionTemplate, useMotionValue, useSpring, useTransform, useVelocity } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

/**
 * Barra inferior de cristal líquido: adaptación a la web de LiquidBar, la misma que usa la app (física, muelles y plegado).
 * La pestaña activa vive bajo una lente: en reposo es escarcha oscura; al pulsarla crece, se vuelve transparente, refracta con
 * arcoíris en el canto y amplía los iconos, que dentro de ella se tiñen de color. Se arrastra entre pestañas y se asienta en
 * la más cercana. Al hacer scroll hacia abajo la cápsula se recoge en un círculo.
 *
 * Capas hermanas: una capa con backdrop-filter, filter u opacity aislaría a sus hijas y dejarían de ver la página.
 * La refracción (filtro SVG en backdrop-filter) solo la pintan los navegadores Chromium; en los demás, escarcha sin doblar.
 */

export interface GlassNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

const BAR_H = 68;
const INSET = 4;
const LENS_H = BAR_H - INSET * 2;
const PRESSED = 78 / 56;
const PRESSED_H = Math.ceil(LENS_H * PRESSED);
const NAV_DELAY = 280; // la página cambia cuando la lente ya casi ha llegado: montarla antes frenaría el viaje
const FOLD_PX = 50;
const UNFOLD_PX = 8;

/** Amortiguación de framer para un muelle con la razón de amortiguamiento de la librería (masa 1). */
const damping = (ratio: number, stiffness: number) => 2 * ratio * Math.sqrt(stiffness);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Muelle subamortiguado comprimido en una duración fija (SpringEasing de la librería). */
function springEasing(z: number, w = 7.8) {
  const wd = w * Math.sqrt(1 - z * z);
  const k = (z * w) / wd;
  const step = (t: number) => 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + k * Math.sin(wd * t));
  const residual = 1 - step(1);
  return (t: number) => (t >= 1 ? 1 : step(t) + residual * t);
}
const FOLD_EASE = springEasing(0.55);
const UNFOLD_EASE = springEasing(0.74);

/** Mapa de refracción de una cápsula: el canto muestrea hacia dentro con perfil circular (rojo = X, verde = Y, 128 = no mover). */
function capsuleMap(w: number, h: number, band: number, depth: boolean): string {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(W, H);
  const r = H / 2;
  const sd = (x: number, y: number) => {
    const qx = Math.abs(x) - W / 2 + r;
    const qy = Math.abs(y) - H / 2 + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - W / 2;
      const py = y + 0.5 - H / 2;
      const d = sd(px, py);
      let mx = 0;
      let my = 0;
      if (d <= 0 && -d < band) {
        const t = 1 + d / band;
        const bend = 1 - Math.sqrt(Math.max(1 - t * t, 0));
        let nx = sd(px + 0.75, py) - sd(px - 0.75, py);
        let ny = sd(px, py + 0.75) - sd(px, py - 0.75);
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        if (depth) {
          const rl = Math.hypot(px, py) || 1;
          nx += px / rl;
          ny += py / rl;
          const l = Math.hypot(nx, ny) || 1;
          nx /= l;
          ny /= l;
        }
        mx = -nx * bend;
        my = -ny * bend;
      }
      const i = (y * W + x) * 4;
      img.data[i] = Math.round(127.5 + mx * 127.5);
      img.data[i + 1] = Math.round(127.5 + my * 127.5);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const isChromium = () => /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);

/** Filtro SVG del canto. Con [spread] cada color se dobla un poco distinto: es el arcoíris del vidrio grueso. */
const EdgeFilter: React.FC<{ id: string; w: number; h: number; map: string; amount: number; spread?: number }> = ({ id, w, h, map, amount, spread = 0 }) => (
  <filter id={id} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
    <feImage href={map} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
    {spread === 0 ? (
      <feDisplacementMap in="SourceGraphic" in2="map" scale={amount * 2} xChannelSelector="R" yChannelSelector="G" />
    ) : (
      <>
        <feDisplacementMap in="SourceGraphic" in2="map" scale={amount * 2 * (1 - spread)} xChannelSelector="R" yChannelSelector="G" result="dr" />
        <feColorMatrix in="dr" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={amount * 2} xChannelSelector="R" yChannelSelector="G" result="dg" />
        <feColorMatrix in="dg" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={amount * 2 * (1 + spread)} xChannelSelector="R" yChannelSelector="G" result="db" />
        <feColorMatrix in="db" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feBlend in="r" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b" mode="screen" />
      </>
    )}
  </filter>
);

/** Icono sobre etiqueta. Al aterrizar en la pestaña el icono encoge un instante y vuelve con rebote. */
const TabContent: React.FC<{ item: GlassNavItem; active: boolean; bold: boolean; scale?: MotionValue<number> }> = ({ item, active, bold, scale }) => {
  const Icon = item.icon;
  const bounce = useMotionValue(1);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const first = animate(bounce, 0.8, { duration: 0.09, ease: 'easeInOut' });
    first.then(() => { if (!stopped) animate(bounce, 1, { type: 'spring', stiffness: 520, damping: damping(0.4, 520) }); });
    return () => { stopped = true; first.stop(); };
  }, [active, bounce]);
  return (
    <motion.span className="flex flex-col items-center gap-0.5" style={scale ? { scale } : undefined}>
      <motion.span className="block" style={{ scale: bounce }}><Icon size={25} strokeWidth={bold ? 2.4 : 2} /></motion.span>
      <span className={`text-[11px] leading-4 whitespace-nowrap ${bold ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
    </motion.span>
  );
};

const ACCENT = 'color-mix(in srgb, var(--color-accent) 62%, white)'; // aclarado para leerse sobre el cristal oscuro
const CONTENT = 'rgba(255, 255, 255, 0.82)';

const GlassNav: React.FC<{ items: GlassNavItem[]; activeIndex: number }> = ({ items, activeIndex }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const refract = useMemo(isChromium, []);
  const n = items.length;
  const last = Math.max(0, n - 1);
  const tabW = width > 0 ? (width - INSET * 2) / n : 0;
  const pressedW = tabW * PRESSED;
  const hasLens = activeIndex >= 0;

  const barMap = useMemo(() => (refract && width > 0 ? capsuleMap(width, BAR_H, 24, false) : ''), [refract, width]);
  const lensMap = useMemo(() => (refract && pressedW > 0 ? capsuleMap(pressedW, PRESSED_H, 10, true) : ''), [refract, pressedW]);

  // Los mismos muelles que LensDrag y LiquidBar en la app
  const target = useMotionValue(Math.max(0, activeIndex));
  const value = useSpring(target, { stiffness: 1000, damping: damping(1, 1000) });
  const speed = useVelocity(value);
  const velocity = useSpring(useTransform(speed, (v) => Math.abs(v) / Math.max(1, last) / 10), { stiffness: 300, damping: damping(0.5, 300) });
  const press = useSpring(0, { stiffness: 1000, damping: damping(1, 1000) });
  const scaleXBase = useSpring(1, { stiffness: 250, damping: damping(0.6, 250) });
  const scaleYBase = useSpring(1, { stiffness: 250, damping: damping(0.7, 250) });
  const pull = useSpring(0, { stiffness: 300, damping: damping(1, 300) });
  const glow = useSpring(0, { stiffness: 300, damping: damping(0.5, 300) });
  const fold = useMotionValue(0);

  const shift = useTransform(pull, (p) => {
    const f = clamp(p / Math.max(1, width), -1, 1);
    return 4 * Math.sign(f) * (1 - (1 - Math.abs(f)) ** 2);
  });
  const centerX = useTransform([value, shift], ([v, s]: number[]) => INSET + (v + 0.5) * tabW + s);
  // La lente se ensancha y se aplana al acelerar; ancho y alto rebotan desfasados
  const lensX = useTransform([scaleXBase, velocity], ([s, v]: number[]) => s / PRESSED / (1 - clamp(v * 0.75, 0, 0.2)));
  const lensY = useTransform([scaleYBase, velocity], ([s, v]: number[]) => (s / PRESSED) * (1 - clamp(v * 0.25, 0, 0.2)));
  const lensLeft = useTransform(centerX, (c) => c - pressedW / 2);
  const grabX = useTransform(centerX, (c) => c - tabW / 2);
  const halfW = useTransform(lensX, (s) => (pressedW / 2) * s);
  const halfH = useTransform(lensY, (s) => (PRESSED_H / 2) * s);
  const edgeL = useTransform([centerX, halfW], ([c, h]: number[]) => c - h);
  const edgeR = useTransform([centerX, halfW], ([c, h]: number[]) => c + h);
  const clipRight = useTransform(edgeR, (e) => width - e);
  const clipTop = useTransform(halfH, (h) => BAR_H / 2 - h);

  const lensAlpha = useTransform(fold, (p) => clamp(1 - clamp(p, 0, 1) * 3, 0, 1) * (hasLens ? 1 : 0));
  const frostAlpha = useTransform([press, lensAlpha], ([p, a]: number[]) => clamp(1 - p, 0, 1) * a);
  const clearAlpha = useTransform([press, lensAlpha], ([p, a]: number[]) => clamp(p, 0, 1) * a);
  const zoom = useTransform(press, (p) => lerp(1, 1.2, clamp(p, 0, 1)));

  const mask = useMotionTemplate`linear-gradient(90deg, #000 ${edgeL}px, transparent ${edgeL}px, transparent ${edgeR}px, #000 ${edgeR}px)`;
  const colorClip = useMotionTemplate`inset(${clipTop}px ${clipRight}px ${clipTop}px ${edgeL}px round ${halfH}px)`;
  const glowBg = useMotionTemplate`radial-gradient(circle at ${centerX}px 50%, rgba(255,255,255,.15), rgba(255,255,255,0) 70%), rgba(255,255,255,.08)`;

  // Plegado: la cápsula se recoge sobre la pestaña activa hasta quedar en un círculo a la izquierda
  const [folded, setFolded] = useState(false);
  const foldedRef = useRef(false);
  const setFold = (next: boolean) => {
    if (foldedRef.current === next) return;
    foldedRef.current = next;
    setFolded(next);
    animate(fold, next ? 1 : 0, next ? { duration: 0.56, ease: FOLD_EASE } : { duration: 0.47, ease: UNFOLD_EASE });
  };
  const barWidth = useTransform(fold, (p) => Math.max(BAR_H, lerp(width, BAR_H, p)));
  const rowOpacity = useTransform(fold, (p) => clamp(1 - clamp(p, 0, 1) * 3, 0, 1));
  const rowClipRight = useTransform(barWidth, (w) => Math.max(0, width - w));
  const rowClip = useMotionTemplate`inset(0px ${rowClipRight}px 0px 0px round ${BAR_H / 2}px)`;
  const singleAlpha = useTransform(fold, (p) => clamp(p, 0, 1));
  const singleX = useTransform(fold, (p) => lerp(INSET + (Math.max(0, activeIndex) + 0.5) * tabW - BAR_H / 2, 0, p));

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const seen = new WeakMap<Element, number>();
    let run = 0;
    const onScroll = (e: Event) => {
      const el = e.target instanceof Document ? document.scrollingElement : (e.target as Element | null);
      if (!el || !el.closest('main')) return;
      const top = el.scrollTop;
      const before = seen.get(el);
      seen.set(el, top);
      if (before === undefined) return;
      const dy = before - top;
      if (dy === 0) return;
      run = run === 0 || run > 0 === dy > 0 ? run + dy : dy;
      if (!foldedRef.current && run <= -FOLD_PX) { run = 0; setFold(true); }
      else if (foldedRef.current && run >= UNFOLD_PX) { run = 0; setFold(false); }
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drag = useRef<{ id: number; lastX: number; startX: number; moved: boolean } | null>(null);
  const navTimer = useRef<number | undefined>(undefined);
  const stopWatch = useRef<(() => void) | null>(null);

  const pressIn = () => {
    stopWatch.current?.();
    stopWatch.current = null;
    press.set(1);
    scaleXBase.set(PRESSED);
    scaleYBase.set(PRESSED);
  };
  const pressOut = () => {
    stopWatch.current?.();
    stopWatch.current = null;
    press.set(0);
    scaleXBase.set(1);
    scaleYBase.set(1);
  };
  /** Suelta el cristal cuando ya casi ha llegado, para que la lupa se vea viajar. */
  const releaseWhenNear = () => {
    const near = Math.max(1, last) * 0.025;
    const check = () => { if (Math.abs(value.get() - target.get()) < near) { pressOut(); return true; } return false; };
    requestAnimationFrame(() => {
      if (check()) return;
      stopWatch.current?.();
      stopWatch.current = value.on('change', check);
    });
  };

  // La pestaña cambia desde fuera (enlaces, tour…) o se abre otra: la lente viaja y la barra se despliega
  useEffect(() => {
    setFold(false);
    if (!hasLens || drag.current) return;
    if (target.get() !== activeIndex) {
      pressIn();
      target.set(activeIndex);
      releaseWhenNear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, hasLens]);

  useEffect(() => () => { window.clearTimeout(navTimer.current); stopWatch.current?.(); }, []);

  const travelTo = (i: number) => {
    if (i === activeIndex) { target.set(i); releaseWhenNear(); items[i].onClick(); return; }
    pressIn();
    target.set(i);
    releaseWhenNear();
    window.clearTimeout(navTimer.current);
    navTimer.current = window.setTimeout(() => items[i].onClick(), NAV_DELAY);
  };

  const onLensDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, lastX: e.clientX, startX: e.clientX, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    glow.set(1);
    pressIn();
  };
  const onLensMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !tabW) return;
    const dx = e.clientX - d.lastX;
    d.lastX = e.clientX;
    if (Math.abs(e.clientX - d.startX) > 6) d.moved = true;
    if (!dx) return;
    target.set(clamp(target.get() + dx / tabW, 0, last));
    pull.jump(pull.get() + dx);
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    glow.set(0);
    pull.set(0);
    const i = cancelled ? activeIndex : clamp(Math.round(target.get()), 0, last);
    if (i === activeIndex) {
      target.set(i);
      releaseWhenNear();
      if (!d.moved && !cancelled) items[i].onClick();
    } else {
      travelTo(i);
    }
  };

  const plain = 'blur(3px) saturate(1.5)';
  const barFilter = barMap && !folded ? `${plain} url(#ev-liquid-bar)` : plain;
  const lensFilter = lensMap ? 'url(#ev-liquid-lens)' : 'none';
  const active = items[activeIndex];

  return (
    <div ref={wrap} className="relative w-full max-w-md pointer-events-auto select-none" style={{ height: BAR_H }}>
      {width > 0 && (
        <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
          {barMap && <EdgeFilter id="ev-liquid-bar" w={width} h={BAR_H} map={barMap} amount={24} />}
          {lensMap && <EdgeFilter id="ev-liquid-lens" w={pressedW} h={PRESSED_H} map={lensMap} amount={14} spread={0.1} />}
        </svg>
      )}

      <motion.div
        className="ev-liquid-glass absolute left-0 top-0 rounded-full"
        aria-hidden="true"
        style={{ height: BAR_H, width: width ? barWidth : '100%', backdropFilter: barFilter, WebkitBackdropFilter: barFilter }}
      />
      <motion.div className="absolute inset-0 rounded-full pointer-events-none" aria-hidden="true" style={{ background: glowBg, opacity: glow }} />

      <motion.nav
        className="absolute inset-0"
        style={{ opacity: rowOpacity, clipPath: rowClip, pointerEvents: folded ? 'none' : 'auto' }}
      >
        <motion.div className="absolute inset-0" style={hasLens && width ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
          <motion.div className="absolute inset-0 flex items-center" style={{ x: shift, padding: INSET }}>
            {items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => travelTo(i)}
                aria-label={item.label}
                aria-current={i === activeIndex ? 'page' : undefined}
                className="relative h-full flex-1 min-w-0 flex items-center justify-center outline-none rounded-full touch-manipulation"
                style={{ color: i === activeIndex ? ACCENT : CONTENT }}
              >
                <TabContent item={item} active={i === activeIndex} bold={i === activeIndex} />
              </button>
            ))}
          </motion.div>
        </motion.div>
      </motion.nav>

      {hasLens && width > 0 && (
        <>
          {/* Cuerpo de la lente: escarcha en reposo, cristal transparente con arcoíris al pulsar */}
          <motion.div
            className="ev-liquid-frost absolute rounded-full pointer-events-none"
            aria-hidden="true"
            style={{ left: 0, top: (BAR_H - PRESSED_H) / 2, width: pressedW, height: PRESSED_H, x: lensLeft, scaleX: lensX, scaleY: lensY, opacity: frostAlpha }}
          />
          <motion.div
            className="ev-liquid-clear absolute rounded-full pointer-events-none"
            aria-hidden="true"
            style={{ left: 0, top: (BAR_H - PRESSED_H) / 2, width: pressedW, height: PRESSED_H, x: lensLeft, scaleX: lensX, scaleY: lensY, opacity: clearAlpha, backdropFilter: lensFilter, WebkitBackdropFilter: lensFilter }}
          />

          {/* Las pestañas en color, recortadas a la lente y ampliadas mientras se pulsa */}
          <motion.div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ clipPath: colorClip, opacity: lensAlpha }}>
            <motion.div className="absolute inset-0 flex items-center" style={{ x: shift, padding: INSET, color: ACCENT }}>
              {items.map((item, i) => (
                <span key={item.id} className="h-full flex-1 min-w-0 flex items-center justify-center">
                  <TabContent item={item} active={i === activeIndex} bold={i === activeIndex} scale={zoom} />
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Zona que agarra la lente; el teclado y los lectores de pantalla usan los botones de debajo */}
          {!folded && (
            <motion.div
              className="absolute top-0 cursor-grab active:cursor-grabbing"
              aria-hidden="true"
              style={{ left: 0, width: tabW, height: BAR_H, x: grabX, touchAction: 'none' }}
              onPointerDown={onLensDown}
              onPointerMove={onLensMove}
              onPointerUp={(e) => finish(e, false)}
              onPointerCancel={(e) => finish(e, true)}
            />
          )}
        </>
      )}

      {/* Plegada: solo la pestaña activa, en un círculo; al tocarlo se abre */}
      {active && (
        <motion.button
          type="button"
          aria-label="Mostrar pestañas"
          aria-hidden={!folded}
          tabIndex={folded ? 0 : -1}
          onClick={() => setFold(false)}
          className="absolute left-0 top-0 flex items-center justify-center rounded-full outline-none"
          style={{ width: BAR_H, height: BAR_H, x: singleX, opacity: singleAlpha, color: ACCENT, pointerEvents: folded ? 'auto' : 'none' }}
        >
          <active.icon size={25} strokeWidth={2.4} />
        </motion.button>
      )}
    </div>
  );
};

export default GlassNav;
