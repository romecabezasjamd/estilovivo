import React, { useEffect, useState } from 'react';
import { Camera, Sparkles, X } from 'lucide-react';
import OutfitIdeasModal from './OutfitIdeasModal';
import { api } from '../services/api';
import type { InspirationPhoto } from '../types';

// Elección de este navegador: las fotos se cargan desde Unsplash (que recibe la IP) solo si la persona lo decide
const KEY = 'ev_unsplash_ok';
const readChoice = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const saveChoice = (ok: boolean) => { try { if (ok) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } };

/** Inspiración de fuera: fotos libres de Unsplash buscadas con las palabras de la semana, cada una con su crédito. */
const UnsplashInspiration: React.FC = () => {
  const [photos, setPhotos] = useState<InspirationPhoto[] | null>(null);
  const [allowed, setAllowed] = useState(readChoice);
  const [recreate, setRecreate] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getInspiration().then((d: { photos: InspirationPhoto[] }) => { if (alive) setPhotos(d.photos || []); }).catch(() => { if (alive) setPhotos([]); });
    return () => { alive = false; };
  }, []);

  if (!photos || photos.length === 0) return null;

  return (
    <section className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] shadow-sm p-4 space-y-3" aria-labelledby="insp-fuera">
      <div className="flex items-start justify-between gap-2 px-1">
        <div>
          <h3 id="insp-fuera" className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Inspiración de fuera</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">Fotos libres de Unsplash elegidas con las palabras de la semana.</p>
        </div>
        {allowed && (
          <button onClick={() => { saveChoice(false); setAllowed(false); }} className="text-[11px] text-[var(--text-muted)] underline shrink-0 flex items-center gap-1">
            <X size={12} /> Dejar de verlas
          </button>
        )}
      </div>

      {!allowed ? (
        <div className="rounded-2xl bg-[var(--bg-base)] p-4 space-y-3 text-center">
          <Camera className="mx-auto text-[var(--text-muted)]" size={22} />
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Al verlas, tu navegador se conecta a Unsplash, que recibe tu dirección IP. No le enviamos nada de tu cuenta.{' '}
            <a href="/privacidad" target="_blank" rel="noopener" className="underline">Más información</a>
          </p>
          <button onClick={() => { saveChoice(true); setAllowed(true); }} className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-base)] text-sm font-semibold">
            Ver fotos de Unsplash
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <figure key={p.id} className="space-y-1">
              <a href={p.photoUrl} target="_blank" rel="noopener noreferrer" className="block aspect-[3/4] rounded-2xl overflow-hidden" style={{ background: p.color || 'var(--bg-base)' }}>
                <img src={p.image} alt={p.alt} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </a>
              <figcaption className="text-[10px] text-[var(--text-muted)] leading-tight px-0.5">
                <span className="font-semibold text-[var(--text-secondary)]">{p.keyword}</span> · Foto de{' '}
                <a href={p.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">{p.photographer}</a> en{' '}
                <a href={p.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>
              </figcaption>
              <button onClick={() => setRecreate(p.keyword)} className="w-full mt-1 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-base)] text-[11px] font-bold flex items-center justify-center gap-1">
                <Sparkles size={12} /> Recrea este look
              </button>
            </figure>
          ))}
        </div>
      )}
      {recreate && <OutfitIdeasModal keyword={recreate} onClose={() => setRecreate(null)} />}
    </section>
  );
};

export default UnsplashInspiration;
