import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Heart, Trophy, Users, Newspaper } from 'lucide-react';
import { api } from '../services/api';
import type { CommunityTrends, MagazineHeadline } from '../types';
import Headline from './Headline';

interface Props {
  currentUserId?: string;
  onOpenProfile: (userId: string) => void;
  onParticipate: () => void;
}

const card = 'bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] shadow-sm';

// Diseño propio de cada revista (no se usan sus fotos ni logotipos)
const MAGAZINE_STYLE: Record<MagazineHeadline['source'], { bg: string; fg: string; mark: string }> = {
  Vogue: { bg: 'linear-gradient(135deg,#F7D6E6 0%,#E84393 100%)', fg: '#FFFFFF', mark: 'V' },
  GQ: { bg: 'linear-gradient(135deg,#2B2B33 0%,#0B0B0F 100%)', fg: '#FFFFFF', mark: 'GQ' },
};

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const h = Math.round((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return 'Hace un momento';
  if (h < 24) return `Hace ${h} h`;
  if (h < 48) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Tendencias: lo que se lleva en Estilo Vivo (looks públicos de la semana) y titulares de Vogue y GQ con enlace. */
const TrendsView: React.FC<Props> = ({ currentUserId, onOpenProfile, onParticipate }) => {
  const [community, setCommunity] = useState<CommunityTrends | null>(null);
  const [headlines, setHeadlines] = useState<MagazineHeadline[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    api.getCommunityTrends().then(setCommunity).catch(() => setError(true));
    api.getTrends().then((h: MagazineHeadline[]) => setHeadlines(Array.isArray(h) ? h : [])).catch(() => setHeadlines([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const period = community?.period === 'month' ? 'este mes' : 'esta semana';

  return (
    <div className="px-4 pb-6 space-y-5 animate-fade-in">
      {/* ── En la comunidad ── */}
      <div className="px-1">
        <Headline text="Lo que se *lleva*" as="h2" className="text-3xl" />
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {community
            ? community.looks > 0
              ? `En Estilo Vivo ${period}: ${community.looks} looks de ${community.people} ${community.people === 1 ? 'persona' : 'personas'}`
              : 'Aún no hay looks públicos suficientes. ¡Comparte el tuyo!'
            : 'Calculado con los looks públicos de la comunidad'}
        </p>
      </div>

      {error && (
        <div className={`${card} p-5 text-center text-sm text-[var(--text-secondary)]`}>
          No se pudieron cargar las tendencias. <button onClick={load} className="font-bold underline">Reintentar</button>
        </div>
      )}
      {!community && !error && <div className="h-40 rounded-3xl bg-[var(--bg-card)] animate-pulse" />}

      {community && community.colors.length > 0 && (
        <section className={`${card} p-5`} aria-labelledby="t-colores">
          <h3 id="t-colores" className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Colores {period}</h3>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {community.colors.map((c) => (
              <div key={c.name} className="flex flex-col items-center gap-2 min-w-[64px]">
                <div
                  className="w-14 h-14 rounded-full shadow-inner border border-black/10"
                  style={{ background: c.hex || 'conic-gradient(#F28AB2,#F2C230,#3A9D5D,#2F6FD6,#7B4FB8,#F28AB2)' }}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-[var(--text-primary)] text-center leading-tight">{c.name}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{c.share}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {community && community.categories.length > 0 && (
        <section className={`${card} p-5 space-y-3`} aria-labelledby="t-prendas">
          <h3 id="t-prendas" className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Prendas más usadas</h3>
          {community.categories.map((c, i) => (
            <div key={c.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-[var(--text-primary)]">{c.name}</span>
                <span className="text-[var(--text-muted)]">{c.share}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(6, c.share)}%`, background: i === 0 ? 'var(--ink, #0B0B0F)' : '#9A9AA0' }} />
              </div>
            </div>
          ))}
          {community.moods.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-[var(--text-muted)] mr-1 self-center">Ánimo:</span>
              {community.moods.map((m) => (
                <span key={m.name} className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--bg-base)] text-[var(--text-primary)]">{m.name} · {m.share}%</span>
              ))}
            </div>
          )}
        </section>
      )}

      {community && community.topLooks.length > 0 && (
        <section aria-labelledby="t-looks">
          <h3 id="t-looks" className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 px-1">Looks más queridos</h3>
          <div className="grid grid-cols-3 gap-2">
            {community.topLooks.map((l) => (
              <button
                key={l.id}
                onClick={() => { if (l.userId !== currentUserId) onOpenProfile(l.userId); }}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--bg-base)] text-left"
                aria-label={`${l.title}, de ${l.userName}, ${l.likes} me gusta`}
              >
                {l.image && <img src={l.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-[11px] font-semibold text-white truncate">{l.userName}</p>
                  <p className="text-[10px] text-white/85 flex items-center gap-1"><Heart size={10} fill="currentColor" /> {l.likes}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {community?.challenge && (
        <section className="rounded-3xl p-5 text-white" style={{ background: 'var(--ink, #0B0B0F)' }} aria-labelledby="t-reto">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70"><Trophy size={14} /> Reto de la semana</div>
          <h3 id="t-reto" className="text-xl font-bold mt-2">{community.challenge.title}</h3>
          <p className="text-sm text-white/80 mt-1">{community.challenge.description}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-white/70 flex items-center gap-1"><Users size={14} /> {community.challenge.participants} participantes</span>
            <button onClick={onParticipate} className="px-4 py-2 rounded-full bg-white text-[#0B0B0F] text-sm font-bold">Participar</button>
          </div>
        </section>
      )}

      {/* ── En las revistas ── */}
      <div className="px-1 pt-2">
        <Headline text="En las *revistas*" as="h2" className="text-3xl" />
        <p className="text-sm text-[var(--text-muted)] mt-1">Titulares de moda de Vogue España y GQ España. Al pulsar se abre el artículo en su web.</p>
      </div>
      {headlines === null && <div className="h-24 rounded-3xl bg-[var(--bg-card)] animate-pulse" />}
      {headlines?.length === 0 && (
        <div className={`${card} p-5 text-sm text-[var(--text-secondary)] flex items-center gap-3`}><Newspaper size={18} /> Ahora mismo no hay titulares disponibles.</div>
      )}
      <div className="space-y-3">
        {headlines?.map((h) => {
          const st = MAGAZINE_STYLE[h.source] || MAGAZINE_STYLE.Vogue;
          return (
            <a
              key={h.id}
              href={h.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`${card} p-3 flex gap-3 items-stretch hover:shadow-md transition-shadow`}
              aria-label={`${h.title}. Leer en ${h.sourceName}`}
            >
              <div className="w-20 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: st.bg }} aria-hidden="true">
                <span className="font-serif italic text-3xl" style={{ color: st.fg }}>{st.mark}</span>
              </div>
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="font-bold uppercase tracking-wider">{h.category}</span>
                  {h.publishedAt && <span>· {when(h.publishedAt)}</span>}
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug mt-1 line-clamp-3">{h.title}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-primary)] mt-2">
                  Leer en {h.source} <ArrowUpRight size={14} />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default TrendsView;
