import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Lock, X } from 'lucide-react';
import { api } from '../services/api';
import type { GarmentIdeas, IdeaPiece } from '../types';
import { GarmentArt } from './MoodLookModal';
import type { ExampleKind } from '../src/utils/moodLooks';
import Headline from './Headline';

interface Props {
  garmentId: string;
  onClose: () => void;
  onOpenProfile?: (userId: string) => void;
}

/** Una pieza del tablero: foto recortada de tu armario o silueta dibujada (si no la tienes). */
function Piece({ p, big = false }: { p: IdeaPiece; big?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white border border-black/5 p-2 flex flex-col ${big ? 'h-full' : ''}`}>
      <div className={`flex-1 flex items-center justify-center ${big ? 'min-h-[200px]' : 'min-h-[88px]'}`}>
        {p.kind === 'own'
          ? (p.image ? <img src={p.image} alt={p.name} className="max-h-full max-w-full object-contain" style={{ maxHeight: big ? 220 : 96 }} /> : <span className="text-xs text-gray-400">Sin foto</span>)
          : <div style={{ width: big ? 160 : 76, height: big ? 160 : 76 }}><GarmentArt kind={p.shape as ExampleKind} color={p.color} label={p.label} /></div>}
      </div>
      <p className="text-[11px] font-semibold text-[#0B0B0F] text-center leading-tight mt-1 line-clamp-2">{p.kind === 'own' ? p.name : p.label}</p>
      <p className="text-[9px] text-center text-[#8A8A96]">{p.kind === 'own' ? 'De tu armario' : 'Idea: no la tienes'}</p>
    </div>
  );
}

/** "Ideas con esta prenda": tableros con tu armario + inspiración de looks públicos de la comunidad. */
const OutfitIdeasModal: React.FC<Props> = ({ garmentId, onClose, onOpenProfile }) => {
  const [data, setData] = useState<GarmentIdeas | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getGarmentIdeas(garmentId).then((d: GarmentIdeas) => { if (alive) setData(d); }).catch((e: any) => { if (alive) setError(e?.message || 'No se pudieron cargar las ideas'); });
    return () => { alive = false; };
  }, [garmentId]);

  return createPortal(
    <div className="fixed inset-0 z-[220] bg-black/55 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-[var(--bg-base)] w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ideas con esta prenda">
        <div className="sticky top-0 z-10 bg-[var(--bg-base)] px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div>
            <Headline text="Ideas con *tu prenda*" as="h2" className="text-2xl" />
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1"><Lock size={12} /> Solo tú ves estas ideas con tu armario.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center shrink-0"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-5">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!data && !error && <div className="h-64 rounded-3xl bg-[var(--bg-card)] animate-pulse" />}
          {data?.ideas.map((idea) => {
            const [base, ...rest] = idea.pieces;
            return (
              <section key={idea.title} className="rounded-3xl p-3" style={{ background: '#EFEAE4' }} aria-label={idea.title}>
                <p className="text-sm font-bold text-[#0B0B0F] px-1 mb-2" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20 }}>{idea.title}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Piece p={base} big />
                  <div className="grid grid-cols-1 gap-2 content-start">
                    {rest.map((p, i) => <Piece key={i} p={p} />)}
                  </div>
                </div>
              </section>
            );
          })}
          {data && data.community.length > 0 && (
            <section aria-labelledby="insp">
              <h3 id="insp" className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Inspiración de la comunidad</h3>
              <div className="grid grid-cols-3 gap-2">
                {data.community.map((l) => (
                  <button key={l.id} onClick={() => onOpenProfile?.(l.userId)} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--bg-card)]" aria-label={`${l.title}, de ${l.userName}`}>
                    {l.image && <img src={l.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    <span className="absolute left-1.5 bottom-1.5 text-[10px] font-semibold text-white bg-black/45 rounded-full px-2 py-0.5 flex items-center gap-1"><Heart size={9} fill="currentColor" /> {l.likes}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OutfitIdeasModal;
