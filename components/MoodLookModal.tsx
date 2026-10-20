import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Headline from './Headline';
import { GARMENT_PATHS, type MoodLook } from '../src/utils/moodLooks';

/** Prenda dibujada: silueta del color de la prenda con borde algo más oscuro (igual que en la app). */
export function GarmentArt({ kind, color, label }: { kind: keyof typeof GARMENT_PATHS; color: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full" role="img" aria-label={label}>
      <path d={GARMENT_PATHS[kind]} transform="translate(0 0.6)" fill="rgba(0,0,0,0.08)" />
      <path d={GARMENT_PATHS[kind]} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

interface Props { look: MoodLook; onClose: () => void; onOpenWardrobe: () => void }

/** Aparece al elegir "¿Cómo te sientes hoy?": look de ejemplo con prendas ilustradas y una frase. */
const MoodLookModal: React.FC<Props> = ({ look, onClose, onOpenWardrobe }) => createPortal(
  <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[var(--bg-base)] rounded-t-[28px] sm:rounded-[28px] p-5 space-y-4 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <Headline text={look.title.replace('look', '*look*')} className="text-2xl" as="h2" />
        <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 shrink-0 rounded-full bg-[var(--bg-card)] flex items-center justify-center"><X size={20} /></button>
      </div>
      {look.moodLabel && <span className="inline-block px-3.5 py-2 rounded-full bg-[var(--bg-card)] text-sm font-semibold text-[var(--text-primary)]">{look.moodLabel}</span>}
      <p className="text-sm text-[var(--text-secondary)]">{look.phrase}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {look.items.map((it, i) => (
          <div key={i} className="rounded-[22px] bg-[var(--bg-card)] p-2.5 flex flex-col items-center gap-1.5 stagger-child">
            <div className="w-full aspect-square rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <GarmentArt kind={it.kind} color={it.color} label={it.name} />
            </div>
            <span className="text-[11px] text-center leading-tight text-[var(--text-primary)]">{it.name}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)]">Es un ejemplo para inspirarte. Busca en tu armario prendas parecidas.</p>
      <button onClick={onOpenWardrobe} className="w-full py-4 rounded-full bg-[var(--ink,#0B0B0F)] text-white font-bold">Buscar en mi armario</button>
      <button onClick={onClose} className="w-full py-2 text-sm font-bold text-[var(--text-muted)]">Cerrar</button>
    </div>
  </div>
, document.body);

export default MoodLookModal;
