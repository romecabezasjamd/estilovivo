import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCw, Smile, Sparkles, Trash2, Type, X } from 'lucide-react';

/*
 * Editor de historias (igual que en la app): encuadre (arrastrar, rueda o pellizco para zoom, girar), filtros de
 * color, textos con estilos y pegatinas/emojis. La vista y la imagen final usan la misma función de dibujo, así lo
 * que ves es lo que se publica (1080×1920).
 */

const OUT_W = 1080;
const OUT_H = 1920;

const FILTERS = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Cálido', css: 'sepia(0.25) saturate(1.15) hue-rotate(-8deg)' },
  { id: 'cool', label: 'Frío', css: 'saturate(1.05) hue-rotate(12deg) brightness(1.02)' },
  { id: 'mono', label: 'B/N', css: 'grayscale(1)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.6) contrast(0.92) brightness(1.05)' },
  { id: 'vivid', label: 'Intenso', css: 'saturate(1.45) contrast(1.08)' },
  { id: 'soft', label: 'Suave', css: 'saturate(0.8) brightness(1.06)' },
] as const;

const FONTS = [
  { id: 'bold', label: 'Moderna', css: '700 1em Poppins, sans-serif' },
  { id: 'serif', label: 'Elegante', css: 'italic 400 1.15em "Instrument Serif", Georgia, serif' },
  { id: 'classic', label: 'Clásica', css: '500 1em Poppins, sans-serif' },
] as const;

const COLORS = ['#FFFFFF', '#0B0B0F', '#FF5A5F', '#FFD54F', '#14A89A', '#7C5CFF', '#FF8FB1'];
const EMOJIS = ['😍', '🔥', '✨', '💖', '👗', '👠', '👜', '🕶️', '🧥', '👟', '🌸', '☀️', '🌧️', '❄️', '💫', '🛍️', '💅', '🌿'];
const STICKERS = ['OOTD', 'Look del día', 'Nuevo en mi armario', '#EstiloVivo', 'Segunda mano', '¿Qué os parece?'];

type Kind = 'text' | 'emoji' | 'sticker';
interface Overlay { id: number; kind: Kind; text: string; font: number; color: string; bg: boolean; cx: number; cy: number; scale: number; rotation: number }
interface Frame { ox: number; oy: number; zoom: number; rotation: number }

function fontPx(o: Overlay, w: number) { return o.kind === 'emoji' ? w * 0.16 : o.kind === 'sticker' ? w * 0.055 : w * 0.075; }
function setFont(ctx: CanvasRenderingContext2D, o: Overlay, w: number) {
  const px = fontPx(o, w);
  const f = o.kind === 'text' ? FONTS[o.font] : FONTS[0];
  ctx.font = f.css.replace(/([\d.]+)em/, (_, n) => `${Number(n) * px}px`);
}
function box(ctx: CanvasRenderingContext2D, o: Overlay, w: number) {
  setFont(ctx, o, w);
  const lines = o.text.split('\n');
  const px = fontPx(o, w);
  const lineH = px * 1.25;
  const pad = o.bg || o.kind === 'sticker' ? px * 0.45 : 0;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
  return { w: width + pad * 2, h: lineH * lines.length + pad * 2, lineH, lines, px };
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement | null, frame: Frame, filter: string, overlays: Overlay[], selected: number | null) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (img) {
    const cover = Math.max(w / img.naturalWidth, h / img.naturalHeight) * frame.zoom;
    ctx.save();
    ctx.filter = filter;
    ctx.translate(w / 2 + frame.ox * w, h / 2 + frame.oy * w);
    ctx.rotate((frame.rotation * Math.PI) / 180);
    ctx.scale(cover, cover);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }
  for (const o of overlays) {
    const b = box(ctx, o, w);
    ctx.save();
    ctx.translate(o.cx * w, o.cy * h);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.scale(o.scale, o.scale);
    if (o.bg || o.kind === 'sticker') {
      ctx.fillStyle = o.kind === 'sticker' ? '#FFFFFF' : o.color.toUpperCase() === '#FFFFFF' ? 'rgba(11,11,15,0.8)' : '#FFFFFF';
      const r = b.px * 0.6;
      ctx.beginPath();
      ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, r);
      ctx.fill();
    } else if (o.kind === 'text') {
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = b.px * 0.12;
      ctx.shadowOffsetY = b.px * 0.04;
    }
    setFont(ctx, o, w);
    ctx.fillStyle = o.kind === 'sticker' ? '#0B0B0F' : o.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    b.lines.forEach((line, i) => ctx.fillText(line, 0, -((b.lines.length - 1) * b.lineH) / 2 + i * b.lineH));
    if (o.id === selected) {
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = (w * 0.004) / o.scale;
      ctx.setLineDash([w * 0.015, w * 0.01]);
      ctx.strokeRect(-b.w / 2 - 8, -b.h / 2 - 8, b.w + 16, b.h + 16);
    }
    ctx.restore();
  }
  ctx.restore();
}

function hit(ctx: CanvasRenderingContext2D, o: Overlay, x: number, y: number, w: number, h: number) {
  const b = box(ctx, o, w);
  const dx = x - o.cx * w, dy = y - o.cy * h;
  const rad = (-o.rotation * Math.PI) / 180;
  const lx = (dx * Math.cos(rad) - dy * Math.sin(rad)) / o.scale;
  const ly = (dx * Math.sin(rad) + dy * Math.cos(rad)) / o.scale;
  const slack = w * 0.04;
  return Math.abs(lx) <= b.w / 2 + slack && Math.abs(ly) <= b.h / 2 + slack;
}

interface Props { src: string; onDone: (file: File, previewUrl: string) => void; onCancel: () => void }

const StoryEditor: React.FC<Props> = ({ src, onDone, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState<Frame>({ ox: 0, oy: 0, zoom: 1, rotation: 0 });
  const [filter, setFilter] = useState(0);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [panel, setPanel] = useState<'filters' | 'stickers' | null>(null);
  const [editing, setEditing] = useState<Overlay | null>(null);
  const [exporting, setExporting] = useState(false);
  const nextId = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ target: number | null; moved: boolean; startDist: number; startAngle: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => setImg(i);
    i.onerror = () => setFailed(true);
    i.src = src;
  }, [src]);

  // Redibujar la vista
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d')!;
    draw(ctx, c.width, c.height, img, frame, FILTERS[filter].css, overlays, selected);
  });

  const local = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      const c = canvasRef.current!;
      const ctx = c.getContext('2d')!;
      const target = [...overlays].reverse().find((o) => hit(ctx, o, p.x, p.y, c.width, c.height));
      setSelected(target?.id ?? null);
      gesture.current = { target: target?.id ?? null, moved: false, startDist: 0, startAngle: 0 };
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.startDist = Math.hypot(b.x - a.x, b.y - a.y);
      gesture.current.startAngle = Math.atan2(b.y - a.y, b.x - a.x);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!prev || !g) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const c = canvasRef.current!;
    const w = c.width, h = c.height;
    let pan = { x: 0, y: 0 }, zoom = 1, rot = 0;
    if (pointers.current.size === 1) pan = { x: p.x - prev.x, y: p.y - prev.y };
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (g.startDist > 0) { zoom = dist / g.startDist; rot = ((ang - g.startAngle) * 180) / Math.PI; }
      g.startDist = dist; g.startAngle = ang;
      pan = { x: (p.x - prev.x) / 2, y: (p.y - prev.y) / 2 };
    }
    if (Math.abs(pan.x) + Math.abs(pan.y) > 1 || zoom !== 1 || rot !== 0) g.moved = true;
    if (g.target != null) {
      setOverlays((list) => list.map((o) => o.id === g.target ? {
        ...o, cx: Math.min(1, Math.max(0, o.cx + pan.x / w)), cy: Math.min(1, Math.max(0, o.cy + pan.y / h)),
        scale: Math.min(5, Math.max(0.3, o.scale * zoom)), rotation: o.rotation + rot,
      } : o));
    } else {
      setFrame((f) => ({ ...f, ox: f.ox + pan.x / w, oy: f.oy + pan.y / w, zoom: Math.min(6, Math.max(0.5, f.zoom * zoom)), rotation: f.rotation + rot }));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0 && g) {
      if (!g.moved && g.target != null) {
        const o = overlays.find((x) => x.id === g.target);
        if (o?.kind === 'text') setEditing(o);
      }
      gesture.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    if (selected != null) setOverlays((l) => l.map((o) => (o.id === selected ? { ...o, scale: Math.min(5, Math.max(0.3, o.scale * factor)) } : o)));
    else setFrame((f) => ({ ...f, zoom: Math.min(6, Math.max(0.5, f.zoom * factor)) }));
  };

  const addOverlay = (o: Omit<Overlay, 'id'>) => {
    const id = nextId.current++;
    setOverlays((l) => [...l, { ...o, id }]);
    setSelected(id);
  };

  const finish = async () => {
    if (!img || exporting) return;
    setExporting(true);
    try {
      await (document as any).fonts?.ready;
      const c = document.createElement('canvas');
      c.width = OUT_W; c.height = OUT_H;
      draw(c.getContext('2d')!, OUT_W, OUT_H, img, frame, FILTERS[filter].css, overlays, null);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('export'))), 'image/jpeg', 0.88));
      onDone(new File([blob], `historia-${Date.now()}.jpg`, { type: 'image/jpeg' }), URL.createObjectURL(blob));
    } catch {
      setFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const iconBtn = 'w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center';
  return createPortal(
    <div className="fixed inset-0 z-[400] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Editar historia">
      <div className="flex items-center gap-2 p-3">
        <button className={iconBtn} onClick={onCancel} aria-label="Cancelar"><X size={22} /></button>
        <div className="flex-1" />
        {selected != null && <button className={iconBtn} aria-label="Quitar elemento" onClick={() => { setOverlays((l) => l.filter((o) => o.id !== selected)); setSelected(null); }}><Trash2 size={20} /></button>}
        <button className={iconBtn} aria-label="Girar foto" onClick={() => setFrame((f) => ({ ...f, rotation: (f.rotation + 90) % 360 }))}><RotateCw size={20} /></button>
        <button onClick={finish} disabled={!img || exporting} className="h-11 px-5 rounded-full bg-white text-black font-semibold flex items-center gap-1.5 disabled:opacity-60">
          <Check size={18} /> {exporting ? '…' : 'Listo'}
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-3">
        <div className="relative h-full max-h-full aspect-[9/16] max-w-full rounded-2xl overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none select-none"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
          />
          {!img && <div className="absolute inset-0 flex items-center justify-center text-white text-sm">{failed ? 'No se pudo abrir la foto' : 'Cargando…'}</div>}
        </div>
      </div>
      <p className="text-center text-xs text-white/70 pt-2">Arrastra, pellizca o usa la rueda para encuadrar. Toca un texto para editarlo.</p>
      <div className="flex justify-evenly p-3">
        {[
          { icon: <Type size={22} />, label: 'Texto', on: () => setEditing({ id: -1, kind: 'text', text: '', font: 0, color: '#FFFFFF', bg: false, cx: 0.5, cy: 0.45, scale: 1, rotation: 0 }) },
          { icon: <Sparkles size={22} />, label: 'Filtros', on: () => setPanel(panel === 'filters' ? null : 'filters') },
          { icon: <Smile size={22} />, label: 'Pegatinas', on: () => setPanel('stickers') },
        ].map((t) => (
          <button key={t.label} onClick={t.on} className="w-20 flex flex-col items-center gap-1 text-white">
            <span className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">{t.icon}</span>
            <span className="text-xs">{t.label}</span>
          </button>
        ))}
      </div>
      {panel === 'filters' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pb-4">
          {FILTERS.map((f, i) => (
            <button key={f.id} onClick={() => setFilter(i)} className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap ${filter === i ? 'bg-white text-black' : 'bg-white/15 text-white'}`}>{f.label}</button>
          ))}
        </div>
      )}

      {panel === 'stickers' && (
        <div className="fixed inset-0 z-[410] bg-black/50 flex items-end" onClick={() => setPanel(null)}>
          <div className="w-full bg-[var(--bg-base)] rounded-t-[28px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-lg text-[var(--text-primary)]">Pegatinas</p>
            <div className="flex flex-wrap gap-2">
              {STICKERS.map((s) => (
                <button key={s} onClick={() => { addOverlay({ kind: 'sticker', text: s, font: 0, color: '#0B0B0F', bg: true, cx: 0.5, cy: 0.35, scale: 1, rotation: 0 }); setPanel(null); }}
                  className="px-4 py-2.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-light)] text-sm font-semibold text-[var(--text-primary)]">{s}</button>
              ))}
            </div>
            <p className="font-semibold text-lg text-[var(--text-primary)]">Emojis</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => { addOverlay({ kind: 'emoji', text: e, font: 0, color: '#FFFFFF', bg: false, cx: 0.5, cy: 0.35, scale: 1, rotation: 0 }); setPanel(null); }}
                  className="w-12 h-12 rounded-2xl bg-[var(--bg-card)] text-2xl">{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[410] bg-black/50 flex items-end" onClick={() => setEditing(null)}>
          <div className="w-full bg-[var(--bg-base)] rounded-t-[28px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-lg text-[var(--text-primary)]">Texto</p>
            <textarea autoFocus maxLength={120} rows={2} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              placeholder="Escribe algo" className="w-full rounded-2xl bg-[var(--bg-card)] p-3 outline-none text-[var(--text-primary)]" />
            <div className="flex gap-2">
              {FONTS.map((f, i) => (
                <button key={f.id} onClick={() => setEditing({ ...editing, font: i })}
                  className={`flex-1 py-2.5 rounded-full text-sm font-semibold ${editing.font === i ? 'bg-[var(--ink,#0B0B0F)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-primary)]'}`}>{f.label}</button>
              ))}
            </div>
            <div className="flex gap-2.5 items-center">
              {COLORS.map((col) => (
                <button key={col} aria-label={`Color ${col}`} onClick={() => setEditing({ ...editing, color: col })}
                  className="w-8 h-8 rounded-full" style={{ backgroundColor: col, outline: editing.color === col ? '3px solid var(--color-primary)' : '1px solid var(--border-light)', outlineOffset: 1 }} />
              ))}
            </div>
            <label className="flex items-center justify-between text-[var(--text-primary)]">
              <span>Fondo detrás del texto</span>
              <input type="checkbox" checked={editing.bg} onChange={(e) => setEditing({ ...editing, bg: e.target.checked })} className="w-5 h-5" />
            </label>
            <button
              onClick={() => {
                const o = editing;
                setEditing(null);
                if (!o.text.trim()) { setOverlays((l) => l.filter((x) => x.id !== o.id)); return; }
                if (o.id === -1) addOverlay({ ...o });
                else setOverlays((l) => l.map((x) => (x.id === o.id ? o : x)));
              }}
              className="w-full py-4 rounded-full bg-[var(--ink,#0B0B0F)] text-white font-bold">Hecho</button>
          </div>
        </div>
      )}
    </div>
  , document.body);
};

export default StoryEditor;
