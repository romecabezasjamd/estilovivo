import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Users, X } from 'lucide-react';
import { api } from '../services/api';
import type { FollowPerson } from '../types';
import Headline from './Headline';

interface Props {
  userId: string;
  initial: 'followers' | 'following';
  onClose: () => void;
  /** Abrir el perfil de una persona de la lista. */
  onOpenProfile?: (id: string) => void;
}

/** Quién sigue a una persona y a quién sigue, con botón de seguir (como en la app). */
const FollowListModal: React.FC<Props> = ({ userId, initial, onClose, onOpenProfile }) => {
  const [tab, setTab] = useState(initial);
  const [people, setPeople] = useState<FollowPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPeople(null); setError(null); setLocked(false);
    api.getFollowList(userId, tab)
      .then((p) => { if (alive) setPeople(p); })
      .catch((e: any) => {
        if (!alive) return;
        if (/privado/i.test(e?.message || '')) setLocked(true);
        setError(e?.message || 'No se pudo cargar');
        setPeople([]);
      });
    return () => { alive = false; };
  }, [userId, tab]);

  const toggle = async (p: FollowPerson) => {
    if (busy) return;
    setBusy(p.id);
    try {
      const r = await api.toggleFollow(p.id);
      setPeople((list) => list?.map((x) => (x.id === p.id ? { ...x, isFollowing: r.following } : x)) ?? null);
    } catch { /* se mantiene como estaba */ }
    setBusy(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] bg-[var(--bg-base)] rounded-t-[28px] sm:rounded-[28px] p-5 flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <Headline text="Tu *comunidad*" className="text-2xl" as="h2" />
          <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center"><X size={20} /></button>
        </div>
        <div className="flex rounded-full p-1 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
          {(['followers', 'following'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${tab === k ? 'bg-[var(--ink,#0B0B0F)] text-white' : 'text-[var(--text-secondary)]'}`}>
              {k === 'followers' ? 'Seguidores' : 'Seguidos'}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto space-y-2.5 pb-2">
          {people === null && [0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-card)] animate-pulse" />)}
          {people !== null && people.length === 0 && (
            <div className="text-center py-10 text-[var(--text-secondary)]">
              {locked ? <Lock className="mx-auto mb-2" /> : <Users className="mx-auto mb-2" />}
              <p className="font-semibold text-[var(--text-primary)]">
                {locked ? 'Perfil privado' : tab === 'followers' ? 'Todavía sin seguidores' : 'Todavía no sigue a nadie'}
              </p>
              <p className="text-sm mt-1">{locked ? 'Sigue a esta persona para ver su comunidad.' : error && !locked ? error : ''}</p>
            </div>
          )}
          {people?.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-card)]">
              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => { onOpenProfile?.(p.id); onClose(); }}>
                <img src={p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}`} alt="" className="w-12 h-12 rounded-full object-cover" />
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--text-primary)] truncate">{p.name}</span>
                  <span className="block text-xs text-[var(--text-muted)]">Nivel {p.level ?? 1}</span>
                </span>
              </button>
              {!p.isMe && (
                <button onClick={() => toggle(p)} disabled={busy === p.id}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap disabled:opacity-50 ${p.isFollowing ? 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-light)]' : 'bg-[var(--ink,#0B0B0F)] text-white'}`}>
                  {busy === p.id ? '…' : p.isFollowing ? 'Siguiendo' : 'Seguir'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  , document.body);
};

export default FollowListModal;
