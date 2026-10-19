import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from '../services/api';
import type { GuardianLinkInfo, GuardianOverview } from '../types';
import { useNotification } from '../src/context/NotificationContext';

interface Props {
  isMinor: boolean;
  /** Se llama tras cualquier cambio (para refrescar el usuario y su permiso de compraventa). */
  onChanged?: () => void;
}

/**
 * Ajustes › Adulto responsable. Un menor (14-17) pide la autorización a un adulto con cuenta;
 * un adulto ve a los menores que le han indicado y decide si pueden comprar y vender.
 */
const GuardianSettings: React.FC<Props> = ({ isMinor, onChanged }) => {
  const { notify } = useNotification();
  const [data, setData] = useState<GuardianOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(null);
    api.getGuardian().then(setData).catch((e: any) => setError(e?.message || 'No se pudo cargar'));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Enlace del correo (?guardian=1) o aviso pulsado: se lleva a esta sección
  useEffect(() => {
    let wanted = new URLSearchParams(window.location.search).get('guardian') === '1';
    try { if (localStorage.getItem('ev_open_guardian') === '1') { wanted = true; localStorage.removeItem('ev_open_guardian'); } } catch {}
    const scroll = () => setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    if (wanted) scroll();
    const onOpen = () => { try { localStorage.removeItem('ev_open_guardian'); } catch {} load(); scroll(); };
    window.addEventListener('ev-open-guardian', onOpen);
    return () => window.removeEventListener('ev-open-guardian', onOpen);
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); notify(ok, 'success'); load(); onChanged?.(); }
    catch (e: any) { notify(e?.message || 'No se pudo completar', 'error'); }
    finally { setBusy(false); }
  };

  const person = (l: GuardianLinkInfo, p = isMinor ? l.guardian : l.minor) => (
    <div className="flex items-center gap-3">
      {p?.avatar
        ? <img src={p.avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
        : <div className="w-11 h-11 rounded-full bg-[var(--bg-soft)] flex items-center justify-center"><Users size={20} /></div>}
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{p?.name || 'Usuario'}</p>
        {p?.email && <p className="text-[11px] text-[var(--text-muted)] truncate">{p.email}</p>}
      </div>
    </div>
  );

  const minorLink = data?.asMinor ?? null;
  const links = data?.asGuardian ?? [];

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-50 flex items-center gap-2">
        <Users size={18} className="text-primary" />
        <h3 className="text-sm font-bold text-gray-700">Adulto responsable</h3>
      </div>
      <div className="p-5 space-y-4">
        {error && <p className="text-xs text-red-500">{error} <button onClick={load} className="underline font-bold">Reintentar</button></p>}
        {!data && !error && <div className="h-16 rounded-xl bg-gray-50 animate-pulse" />}

        {data && isMinor && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Como eres menor de edad, para comprar y vender necesitas que un adulto (madre, padre, tutor o familiar mayor de edad) lo autorice. Esa persona debe tener su propia cuenta en Estilo Vivo.</p>
            {!minorLink ? (
              <form onSubmit={(e) => { e.preventDefault(); if (!email.includes('@')) return notify('Escribe un correo válido', 'error'); act(() => api.requestGuardian(email.trim()), 'Solicitud enviada. Cuando la acepte, podrás comprar y vender.'); }} className="flex gap-2">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo del adulto"
                  className="flex-1 bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                <button type="submit" disabled={busy} className="px-4 rounded-xl bg-[var(--ink,#0B0B0F)] text-white text-sm font-bold disabled:opacity-50">Enviar</button>
              </form>
            ) : (
              <div className="rounded-xl bg-gray-50 p-4 space-y-3">
                {person(minorLink)}
                <p className="text-xs text-gray-500">
                  {minorLink.status !== 'APPROVED' ? 'Solicitud pendiente: le hemos avisado por la app y por correo.'
                    : minorLink.marketplaceAllowed ? 'Te ha autorizado: puedes comprar y vender.' : 'Ha pausado la compraventa por ahora.'}
                </p>
                <button onClick={() => act(() => api.removeGuardian(minorLink.id), 'Vínculo eliminado')} disabled={busy} className="text-xs font-bold underline text-[var(--text-muted)]">Quitar vínculo</button>
              </div>
            )}
          </div>
        )}

        {data && links.length === 0 && !isMinor && (
          <p className="text-xs text-gray-500">Si un menor te indica como su adulto responsable, aparecerá aquí para que puedas aceptar y decidir si puede comprar y vender.</p>
        )}

        {links.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Menores a tu cargo</h4>
            {links.map((l) => (
              <div key={l.id} className="rounded-xl bg-gray-50 p-4 space-y-3">
                {person(l, l.minor)}
                {l.status !== 'APPROVED' ? (
                  <div className="flex gap-2">
                    <button onClick={() => act(() => api.approveGuardian(l.id), 'Has aceptado ser su adulto responsable')} disabled={busy} className="px-4 py-2 rounded-full bg-[var(--ink,#0B0B0F)] text-white text-xs font-bold">Aceptar</button>
                    <button onClick={() => act(() => api.removeGuardian(l.id), 'Solicitud rechazada')} disabled={busy} className="px-4 py-2 rounded-full text-xs font-bold text-[var(--text-muted)]">Rechazar</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Puede comprar y vender</span>
                      <button onClick={() => act(() => api.setGuardianMarketplace(l.id, !l.marketplaceAllowed), l.marketplaceAllowed ? 'Compraventa pausada' : 'Compraventa permitida')} disabled={busy}
                        className={`w-11 h-6 rounded-full transition-colors ${l.marketplaceAllowed ? 'bg-gradient-to-r from-primary to-accent' : 'bg-gray-200'}`} aria-label="Permitir comprar y vender">
                        <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${l.marketplaceAllowed ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <button onClick={() => act(() => api.removeGuardian(l.id), 'Has dejado de ser su adulto responsable')} disabled={busy} className="text-xs font-bold underline text-[var(--text-muted)]">Dejar de ser su adulto responsable</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardianSettings;
