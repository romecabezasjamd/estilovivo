import React from 'react';
import { Heart, Trophy } from 'lucide-react';
import type { CommunityTrends } from '../types';
import { GarmentArt } from './MoodLookModal';
import type { ExampleKind } from '../src/utils/moodLooks';
import Headline from './Headline';

// Silueta propia para la prenda estrella según su tipo
const STAR_KIND: Record<string, ExampleKind> = {
  'Partes de arriba': 'sweater', 'Partes de abajo': 'jeans', 'Vestidos y monos': 'dress', 'Abrigos y chaquetas': 'coat',
  Calzado: 'boots', Accesorios: 'bag',
};

interface Props {
  data: CommunityTrends;
  currentUserId?: string;
  onOpenProfile: (userId: string) => void;
}

/**
 * Tablero de la semana: collage hecho SOLO con contenido propio o de la comunidad (looks públicos de personas adultas
 * que no han pedido quedar fuera), colores y palabras propias. Sin fotos de revistas ni marcas.
 */
const TrendBoard: React.FC<Props> = ({ data, currentUserId, onOpenProfile }) => {
  const looks = data.topLooks.filter((l) => l.image).slice(0, 3);
  const palette = data.colors.slice(0, 3);
  const period = data.period === 'month' ? 'del mes' : 'de la semana';
  if (looks.length === 0 && palette.length === 0) return null;

  const LookTile = ({ i, className = '' }: { i: number; className?: string }) => {
    const l = looks[i];
    if (!l) return <div className={`rounded-2xl bg-[var(--bg-base)] ${className}`} />;
    return (
      <button
        onClick={() => { if (l.userId !== currentUserId) onOpenProfile(l.userId); }}
        className={`relative rounded-2xl overflow-hidden bg-[var(--bg-base)] ${className}`}
        aria-label={`${l.title}, de ${l.userName}, ${l.likes} me gusta`}
      >
        <img src={l.image!} alt="" loading="lazy" className="w-full h-full object-cover" />
        <span className="absolute left-2 bottom-2 text-[10px] font-semibold text-white bg-black/45 rounded-full px-2 py-0.5 flex items-center gap-1">
          <Heart size={9} fill="currentColor" /> {l.likes} · {l.userName}
        </span>
      </button>
    );
  };

  return (
    <section className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] shadow-sm p-4 space-y-3" aria-labelledby="tablero">
      <div className="px-1">
        <Headline text={data.period === 'month' ? 'Tablero *del mes*' : 'Tablero *de la semana*'} as="h2" className="text-2xl" />
        <p className="text-xs text-[var(--text-muted)] mt-1" id="tablero">Hecho con los looks públicos de la comunidad, sus colores y las palabras de moda {period}.</p>
      </div>
      <div className="grid grid-cols-3 gap-2" style={{ gridAutoRows: '96px' }}>
        <LookTile i={0} className="col-span-2 row-span-3" />
        {/* Paleta: muestras de color con nombre propio (no se usan códigos ni marcas de cartas de color) */}
        <div className="row-span-3 flex flex-col gap-2">
          {palette.map((c) => (
            <div key={c.name} className="flex-1 rounded-2xl overflow-hidden border border-black/10 flex flex-col bg-white">
              <div className="flex-1" style={{ background: c.hex || '#C9C9CE' }} />
              <div className="px-2 py-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#0B0B0F] leading-tight">{c.name}</p>
                <p className="text-[9px] text-[#6B6B75]">{c.share}% de las prendas</p>
              </div>
            </div>
          ))}
        </div>
        {data.keywords.length > 0 && (
          <div className="col-span-2 row-span-1 rounded-2xl p-3 flex items-center" style={{ background: 'var(--ink, #0B0B0F)' }}>
            <p className="text-white leading-snug" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18 }}>
              {data.keywords.join(' · ')}
            </p>
          </div>
        )}
        <LookTile i={1} className={data.keywords.length > 0 ? 'row-span-2' : 'row-span-2'} />
        {data.star && (
          <div className="col-span-2 row-span-1 rounded-2xl bg-[var(--bg-base)] p-2 flex items-center gap-3">
            <div className="w-16 h-16 shrink-0">
              <GarmentArt kind={STAR_KIND[data.star.category] || 'tshirt'} color={data.star.hex || '#8C8F96'} label={`${data.star.category} ${data.star.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Prenda estrella</p>
              <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{data.star.category}</p>
              <p className="text-xs text-[var(--text-secondary)]">en {data.star.color.toLowerCase()}</p>
            </div>
          </div>
        )}
        {looks[2] && <LookTile i={2} className="col-span-2 row-span-2" />}
        {data.challenge && (
          <div className="row-span-2 rounded-2xl p-3 flex flex-col justify-between text-white" style={{ background: 'linear-gradient(160deg,#E84393,#7B1F35)' }}>
            <Trophy size={18} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Reto</p>
              <p className="text-sm font-bold leading-tight">{data.challenge.title}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TrendBoard;
