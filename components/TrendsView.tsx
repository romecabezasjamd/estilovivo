import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Heart, Trophy, Users, Newspaper } from 'lucide-react';
import { api } from '../services/api';
import type { CommunityTrends, MagazineHeadline } from '../types';
import Headline from './Headline';
import TrendBoard from './TrendBoard';
import UnsplashInspiration from './UnsplashInspiration';

interface Props {
  currentUserId?: string;
  onOpenProfile: (userId: string) => void;
  onParticipate: () => void;
}

const card = 'bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] shadow-sm';

// Sello de cada publicación con diseño PROPIO: su nombre en nuestra tipografía y colores, no su logotipo oficial
// (marca registrada). Solo identifica de dónde viene el titular.
type Brand = { bg: string; fg: string; label: string; font: React.CSSProperties };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-serif)', letterSpacing: '0.08em' };
const SANS: React.CSSProperties = { fontFamily: 'Poppins, sans-serif', fontWeight: 700 };
const BRANDS: Record<string, Brand> = {
  Vogue: { bg: '#0B0B0F', fg: '#FFFFFF', label: 'VOGUE', font: { ...SERIF, fontSize: 30, letterSpacing: '0.18em' } },
  GQ: { bg: '#23232B', fg: '#FFFFFF', label: 'GQ', font: { ...SERIF, fontSize: 32, fontWeight: 700 } },
  Glamour: { bg: '#F9DCE8', fg: '#B0175A', label: 'Glamour', font: { ...SERIF, fontSize: 30, fontStyle: 'italic', letterSpacing: 0 } },
  'Marie Claire': { bg: '#C8102E', fg: '#FFFFFF', label: 'marie claire', font: { ...SANS, fontSize: 20, letterSpacing: '0.02em' } },
  Telva: { bg: '#F2ECE3', fg: '#6E1D2A', label: 'TELVA', font: { ...SERIF, fontSize: 28, letterSpacing: '0.2em' } },
  'Yo Dona': { bg: '#4B2A7A', fg: '#FFFFFF', label: 'YO DONA', font: { ...SANS, fontSize: 18, letterSpacing: '0.12em' } },
  Mujerhoy: { bg: '#F4876B', fg: '#FFFFFF', label: 'mujerhoy', font: { ...SANS, fontSize: 20 } },
  Trendencias: { bg: '#E3F4EF', fg: '#0E6B5B', label: 'Trendencias', font: { ...SANS, fontSize: 18 } },
};
const brandOf = (source: string): Brand => BRANDS[source] || { bg: 'var(--bg-base)', fg: 'var(--text-primary)', label: source, font: { ...SANS, fontSize: 18 } };

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const h = Math.round((Date.now() - d.getTime()) / 3600000);
  if (h < 1) return 'Hace un momento';
  if (h < 24) return `Hace ${h} h`;
  if (h < 48) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Tendencias: primero titulares de revistas y webs de moda (con enlace), después lo que se lleva en Estilo Vivo. */
const TrendsView: React.FC<Props> = ({ currentUserId, onOpenProfile, onParticipate }) => {
  const [community, setCommunity] = useState<CommunityTrends | null>(null);
  const [headlines, setHeadlines] = useState<MagazineHeadline[] | null>(null);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<string>('Todas');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    setError(false);
    api.getCommunityTrends().then(setCommunity).catch(() => setError(true));
    api.getTrends().then((h: MagazineHeadline[]) => setHeadlines(Array.isArray(h) ? h : [])).catch(() => setHeadlines([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const sources = useMemo(() => ['Todas', ...Array.from(new Set((headlines || []).map((h) => h.source)))], [headlines]);
  const filtered = (headlines || []).filter((h) => source === 'Todas' || h.source === source);
  // En "Todas" se ven 3 y el resto con "Ver todas las revistas" (para que el tablero quede a la vista)
  const visible = source === 'Todas' && !showAll ? filtered.slice(0, 3) : filtered;
  const period = community?.period === 'month' ? 'este mes' : 'esta semana';

  return (
    <div className="px-4 pb-6 space-y-5 animate-fade-in">
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
      <div className="space-y-5">
      {/* ── En las revistas ── */}
      <div className="px-1">
        <Headline text="En las *revistas*" as="h2" className="text-3xl" />
        <p className="text-sm text-[var(--text-muted)] mt-1">Lo último de las revistas y webs de moda. Al pulsar se abre el artículo en su web.</p>
      </div>

      {sources.length > 2 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Filtrar por publicación">
          {sources.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={source === s}
              onClick={() => setSource(s)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${source === s ? 'bg-[var(--ink,#0B0B0F)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)]'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {headlines === null && <div className="h-40 rounded-3xl bg-[var(--bg-card)] animate-pulse" />}
      {headlines?.length === 0 && (
        <div className={`${card} p-5 text-sm text-[var(--text-secondary)] flex items-center gap-3`}><Newspaper size={18} /> Ahora mismo no hay titulares disponibles.</div>
      )}
      <div className="space-y-4">
        {visible.map((h) => {
          const b = brandOf(h.source);
          return (
            <a
              key={h.id}
              href={h.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`${card} block overflow-hidden hover:shadow-md transition-shadow`}
              aria-label={`${h.title}. Leer en ${h.sourceName}`}
            >
              <div className="h-16 px-5 flex items-center justify-between" style={{ background: b.bg, color: b.fg }} aria-hidden="true">
                <span style={b.font}>{b.label}</span>
                {h.publishedAt && <span className="text-xs font-semibold opacity-80">{when(h.publishedAt)}</span>}
              </div>
              <div className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{h.category}</span>
                <p className="text-lg font-bold text-[var(--text-primary)] leading-snug mt-1">{h.title}</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--text-primary)] mt-3">
                  Leer en {h.source} <ArrowUpRight size={16} />
                </span>
              </div>
            </a>
          );
        })}
      </div>
      {source === 'Todas' && filtered.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="w-full py-3 rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] text-sm font-bold text-[var(--text-primary)]">
          {showAll ? 'Ver menos' : `Ver todas las revistas (${filtered.length})`}
        </button>
      )}
      {headlines && headlines.length > 0 && (
        <p className="text-[11px] text-[var(--text-muted)] px-1">
          Fuentes: {Array.from(new Set(headlines.map((h) => h.sourceName))).join(', ')}. Los titulares y artículos pertenecen a sus publicaciones; Estilo Vivo no tiene relación con ellas.
        </p>
      )}

      </div>
      {/* ── Tablero de la semana (a la derecha en pantallas grandes) ── */}
      <div className="space-y-4">
        {community && <TrendBoard data={community} currentUserId={currentUserId} onOpenProfile={onOpenProfile} />}
        <UnsplashInspiration />
      </div>
      </div>

      {/* ── Lo que se lleva en Estilo Vivo ── */}
      <div className="px-1 pt-4">
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
          No se pudieron cargar las tendencias de la comunidad. <button onClick={load} className="font-bold underline">Reintentar</button>
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
    </div>
  );
};

export default TrendsView;
