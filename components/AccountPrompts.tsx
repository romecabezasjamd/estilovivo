import React, { useEffect, useState } from 'react';
import { Bell, CalendarDays, Check, MapPin } from 'lucide-react';
import { api } from '../services/api';
import type { UserState } from '../types';
import { useNotification } from '../src/context/NotificationContext';
import Headline from './Headline';

const PERMS_KEY = 'ev_permissions_asked';
const MIN_AGE = 14;

const ageOf = (iso: string) => {
  const b = new Date(iso), now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const notifState = (): PermState =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission === 'default' ? 'prompt' : Notification.permission;

async function locationState(): Promise<PermState> {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    const r = await (navigator as any).permissions?.query({ name: 'geolocation' });
    return (r?.state as PermState) || 'prompt';
  } catch { return 'prompt'; }
}

interface Props {
  user: UserState;
  onUpdateUser: (user: UserState, options?: { persist?: boolean }) => void;
}

/**
 * Tras registrarse o entrar por primera vez en este navegador:
 * 1) si la cuenta no tiene fecha de nacimiento, se pide (protección de menores y compraventa);
 * 2) una sola vez, se piden las notificaciones y la ubicación (para el tiempo).
 */
const AccountPrompts: React.FC<Props> = ({ user, onUpdateUser }) => {
  const { notify } = useNotification();
  const [birthDismissed, setBirthDismissed] = useState(false);
  const [birth, setBirth] = useState('');
  const [savingBirth, setSavingBirth] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [notif, setNotif] = useState<PermState>(notifState());
  const [loc, setLoc] = useState<PermState>('prompt');

  useEffect(() => {
    let asked = false;
    try { asked = localStorage.getItem(PERMS_KEY) === '1'; } catch {}
    if (asked) return;
    locationState().then((l) => {
      setLoc(l);
      const n = notifState();
      const pending = (n === 'prompt') || (l === 'prompt');
      if (pending) setShowPerms(true);
      else try { localStorage.setItem(PERMS_KEY, '1'); } catch {}
    });
  }, []);

  const closePerms = () => { try { localStorage.setItem(PERMS_KEY, '1'); } catch {} setShowPerms(false); };

  const allow = async () => {
    if (notifState() === 'prompt') {
      try { setNotif((await Notification.requestPermission()) as PermState); } catch {}
    }
    if ((await locationState()) === 'prompt') {
      await new Promise<void>((done) => navigator.geolocation.getCurrentPosition(
        () => { setLoc('granted'); done(); },
        () => { setLoc('denied'); done(); },
        { timeout: 15000, enableHighAccuracy: false },
      ));
      // El tiempo de Inicio vuelve a leer la ubicación
      window.dispatchEvent(new CustomEvent('ev-location-granted'));
    }
    closePerms();
  };

  const saveBirth = async () => {
    if (!birth) return notify('Elige tu fecha de nacimiento', 'error');
    if (new Date(birth) > new Date()) return notify('La fecha no puede ser futura', 'error');
    if (ageOf(birth) < MIN_AGE) return notify(`Debes tener al menos ${MIN_AGE} años para usar Estilo Vivo`, 'error');
    setSavingBirth(true);
    try {
      const updated = await api.updateProfile({ birthDate: birth });
      onUpdateUser(updated, { persist: false });
      notify('¡Guardado!', 'success');
    } catch (e: any) {
      notify(e?.message || 'No se pudo guardar', 'error');
    } finally { setSavingBirth(false); }
  };

  const card = 'w-full max-w-md bg-[var(--bg-base)] rounded-[28px] p-6 shadow-2xl space-y-4 animate-fade-in';

  if (user.needsBirthDate && !birthDismissed) {
    return (
      <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
        <div className={card} role="dialog" aria-modal="true">
          <Headline text="Tu fecha de *nacimiento*" />
          <p className="text-sm text-[var(--text-secondary)]">La necesitamos para proteger a los menores de edad y para que puedas comprar y vender. No se muestra en tu perfil y solo se indica una vez.</p>
          <div className="relative">
            <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={20} />
            <input type="date" value={birth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirth(e.target.value)}
              className="w-full bg-[var(--bg-soft,#f4f4f5)] rounded-2xl py-4 pl-12 pr-4 outline-none font-medium text-[var(--text-primary)]" />
          </div>
          <button onClick={saveBirth} disabled={savingBirth} className="w-full py-4 rounded-full bg-[var(--ink,#0B0B0F)] text-white font-bold disabled:opacity-50">{savingBirth ? '…' : 'Guardar'}</button>
          <button onClick={() => setBirthDismissed(true)} className="w-full py-2 text-sm font-bold text-[var(--text-muted)]">Más tarde</button>
        </div>
      </div>
    );
  }

  if (!showPerms) return null;
  const row = (icon: React.ReactNode, title: string, body: string, state: PermState) => (
    <div className="flex items-center gap-4 p-4 rounded-3xl bg-[var(--bg-card,#fff)] border border-[var(--border-color,#e5e5e5)]">
      <div className="w-12 h-12 rounded-full bg-[var(--ink,#0B0B0F)] text-white flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-sm text-[var(--text-secondary)]">{body}</p>
      </div>
      {state === 'granted' && <Check className="text-primary shrink-0" size={22} />}
    </div>
  );
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
      <div className={card} role="dialog" aria-modal="true">
        <Headline text="Un último *paso*." />
        <p className="text-sm text-[var(--text-secondary)]">Activa estos permisos para sacarle todo el partido a Estilo Vivo. Puedes cambiarlos cuando quieras en los ajustes del navegador.</p>
        {notif !== 'unsupported' && row(<Bell size={22} />, 'Notificaciones', 'Para avisarte de mensajes, seguidores, ventas y la lavadora.', notif)}
        {loc !== 'unsupported' && row(<MapPin size={22} />, 'Ubicación aproximada', 'Para mostrarte el tiempo de tu ciudad y sugerirte qué ponerte.', loc)}
        <button onClick={allow} className="w-full py-4 rounded-full bg-[var(--ink,#0B0B0F)] text-white font-bold">Permitir</button>
        <button onClick={closePerms} className="w-full py-2 text-sm font-bold text-[var(--text-muted)]">Ahora no</button>
      </div>
    </div>
  );
};

export default AccountPrompts;
