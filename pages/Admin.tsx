import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ShieldCheck, Flag, ImageOff, Users, ShoppingBag, Trophy, Bug, BarChart3, Megaphone, FileText, History, LayoutGrid, RefreshCw } from 'lucide-react';
import { adminFetch, getAdminToken, setAdminToken, AdminApiError } from '../services/api';
import { useNotification } from '../src/context/NotificationContext';
import Headline from '../components/Headline';

type Section = 'overview' | 'reports' | 'blocked' | 'users' | 'shop' | 'challenges' | 'crashes' | 'stats' | 'broadcast' | 'privacy' | 'log';

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Resumen', icon: LayoutGrid },
  { id: 'reports', label: 'Denuncias', icon: Flag },
  { id: 'blocked', label: 'Fotos bloqueadas', icon: ImageOff },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'shop', label: 'Tienda', icon: ShoppingBag },
  { id: 'challenges', label: 'Retos', icon: Trophy },
  { id: 'crashes', label: 'Errores', icon: Bug },
  { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
  { id: 'broadcast', label: 'Aviso a todos', icon: Megaphone },
  { id: 'privacy', label: 'Privacidad', icon: FileText },
  { id: 'log', label: 'Registro', icon: History },
];

const ACTION_LABEL: Record<string, string> = {
  PANEL_LOGIN: 'Entró al panel', REPORT_REMOVE: 'Eliminó contenido denunciado', REPORT_DISMISS: 'Descartó una denuncia',
  USER_SUSPEND: 'Suspendió una cuenta', USER_UNSUSPEND: 'Reactivó una cuenta', PRODUCT_REMOVE: 'Retiró un anuncio',
  CHALLENGE_CREATE: 'Creó un reto', CHALLENGE_EDIT: 'Cambió un reto', SUBMISSION_INVALIDATE: 'Anuló una participación',
  CRASH_RESOLVE: 'Marcó un error como arreglado', BROADCAST: 'Envió un aviso a todos', PRIVACY_DONE: 'Respondió una solicitud de privacidad',
  PRIVACY_REJECT: 'Rechazó una solicitud de privacidad',
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const card = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-4';
const btnDark = 'px-4 py-2 rounded-full bg-[var(--ink,#0B0B0F)] text-white text-xs font-bold disabled:opacity-50';
const btnLight = 'px-4 py-2 rounded-full border border-gray-200 text-xs font-bold text-[var(--text-primary)] disabled:opacity-50';
const btnDanger = 'px-4 py-2 rounded-full bg-red-600 text-white text-xs font-bold disabled:opacity-50';
const input = 'w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20';

/** Pide el motivo (se envía a la persona afectada) o una confirmación antes de una acción. */
type Ask = { title: string; message: string; reason?: boolean; confirmLabel: string; danger?: boolean; run: (reason: string) => Promise<void> };

function AskDialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (ask.reason && reason.trim().length < 3) return;
    setBusy(true);
    try { await ask.run(reason.trim()); onClose(); } finally { setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] w-full max-w-sm rounded-3xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{ask.title}</h3>
        <p className="text-sm text-[var(--text-secondary)]">{ask.message}</p>
        {ask.reason && <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Motivo (lo recibirá la persona)" className={`${input} resize-none`} />}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className={btnLight}>Cancelar</button>
          <button onClick={go} disabled={busy || (!!ask.reason && reason.trim().length < 3)} className={ask.danger ? btnDanger : btnDark}>{ask.confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Segundo paso: código de un solo uso enviado al correo de la cuenta. */
function Gate({ onOk }: { onOk: () => void }) {
  const { notify } = useNotification();
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try { const r = await adminFetch<{ email: string }>('/admin/session/start', { method: 'POST', body: {} }); setSent(r.email); }
    catch (e: any) { notify(e?.message || 'No se pudo enviar el código', 'error'); }
    finally { setBusy(false); }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await adminFetch<{ adminToken: string; expiresAt: string }>('/admin/session/verify', { method: 'POST', body: { code } });
      setAdminToken(r.adminToken, r.expiresAt);
      onOk();
    } catch (err: any) { notify(err?.message || 'Código incorrecto', 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className={`${card} space-y-4 max-w-md mx-auto mt-6 text-center`}>
      <ShieldCheck size={40} className="mx-auto text-primary" />
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Confirma que eres tú</h2>
      {!sent ? (
        <>
          <p className="text-sm text-[var(--text-secondary)]">Para entrar al panel te enviamos un código de un solo uso a tu correo. La sesión del panel dura 12 horas.</p>
          <button onClick={start} disabled={busy} className={`${btnDark} w-full py-3 text-sm`}>Enviar código</button>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">Escribe el código que hemos enviado a {sent}. Caduca en 10 minutos.</p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${input} text-center text-2xl tracking-[0.5em] font-bold`} placeholder="000000" aria-label="Código" />
          <button type="submit" disabled={busy || code.length !== 6} className={`${btnDark} w-full py-3 text-sm`}>Entrar al panel</button>
          <button type="button" onClick={start} disabled={busy} className="text-xs font-bold underline text-[var(--text-muted)]">Enviar otro código</button>
        </form>
      )}
    </div>
  );
}

/** Carga datos del panel; si caduca el segundo paso, vuelve a pedir el código. */
function useAdminData<T>(path: string | null, onNeed2fa: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!path) return;
    setError(null);
    adminFetch<T>(path).then(setData).catch((e: any) => {
      if (e instanceof AdminApiError && e.code === 'ADMIN_2FA_REQUIRED') onNeed2fa();
      else setError(e?.message || 'No se pudo cargar');
    });
  }, [path, onNeed2fa]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load, setData };
}

const Loading = ({ error, onRetry }: { error: string | null; onRetry: () => void }) =>
  error ? <p className="text-sm text-red-500">{error} <button onClick={onRetry} className="underline font-bold">Reintentar</button></p>
    : <div className="h-24 rounded-2xl bg-gray-50 animate-pulse" />;

const Empty = ({ text }: { text: string }) => <p className={`${card} text-sm text-[var(--text-muted)] text-center`}>{text}</p>;

interface Props { onBack: () => void }

const Admin: React.FC<Props> = ({ onBack }) => {
  const { notify } = useNotification();
  const [unlocked, setUnlocked] = useState(!!getAdminToken());
  const [section, setSection] = useState<Section>('overview');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const need2fa = useCallback(() => setUnlocked(false), []);

  /** Ejecuta una acción del panel y avisa del resultado. */
  const act = useCallback(async (path: string, body: unknown, after: () => void) => {
    try {
      const r = await adminFetch<{ message?: string }>(path, { method: 'POST', body });
      notify(r?.message || 'Hecho', 'success');
      after();
    } catch (e: any) {
      if (e instanceof AdminApiError && e.code === 'ADMIN_2FA_REQUIRED') need2fa();
      notify(e?.message || 'No se pudo completar', 'error');
    }
  }, [notify, need2fa]);

  const goUser = (id: string | null) => { if (!id) return; setOpenUser(id); setSection('users'); };

  return (
    <div className="px-4 pt-4 pb-28 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4 pr-14">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center" aria-label="Volver"><ArrowLeft size={20} /></button>
        <Headline text="Panel de *admin*" className="text-2xl" />
      </div>
      {!unlocked ? <Gate onOk={() => setUnlocked(true)} /> : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setSection(id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-colors ${section === id ? 'bg-[var(--ink,#0B0B0F)] text-white' : 'bg-white text-[var(--text-secondary)] border border-gray-100'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {section === 'overview' && <Overview need2fa={need2fa} go={setSection} />}
            {section === 'reports' && <Reports need2fa={need2fa} act={act} setAsk={setAsk} goUser={goUser} />}
            {section === 'blocked' && <Blocked need2fa={need2fa} goUser={goUser} />}
            {section === 'users' && <UsersSection need2fa={need2fa} act={act} setAsk={setAsk} openId={openUser} setOpenId={setOpenUser} />}
            {section === 'shop' && <Shop need2fa={need2fa} act={act} setAsk={setAsk} goUser={goUser} />}
            {section === 'challenges' && <Challenges need2fa={need2fa} act={act} setAsk={setAsk} />}
            {section === 'crashes' && <Crashes need2fa={need2fa} act={act} />}
            {section === 'stats' && <Stats need2fa={need2fa} />}
            {section === 'broadcast' && <Broadcast act={act} setAsk={setAsk} />}
            {section === 'privacy' && <Privacy need2fa={need2fa} act={act} setAsk={setAsk} />}
            {section === 'log' && <Log need2fa={need2fa} />}
          </div>
        </>
      )}
      {ask && <AskDialog ask={ask} onClose={() => setAsk(null)} />}
    </div>
  );
};

type ActFn = (path: string, body: unknown, after: () => void) => Promise<void>;
type Common = { need2fa: () => void };

function Overview({ need2fa, go }: Common & { go: (s: Section) => void }) {
  const { data, error, reload } = useAdminData<any>('/admin/overview', need2fa);
  if (!data) return <Loading error={error} onRetry={reload} />;
  const tiles: [string, number, Section, boolean?][] = [
    ['Denuncias pendientes', data.openReports, 'reports', data.openReports > 0],
    ['Fotos bloqueadas (7 días)', data.blocked7, 'blocked'],
    ['Errores (7 días)', data.crashes7, 'crashes'],
    ['Solicitudes de privacidad', data.privacyOpen, 'privacy', data.privacySoon > 0],
    ['Cuentas', data.users, 'users'],
    ['Nuevas esta semana', data.newUsers, 'stats'],
    ['Suspendidas', data.suspended, 'users'],
    ['Prendas a la venta', data.forSale, 'shop'],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(([label, n, s, alert]) => (
          <button key={label} onClick={() => go(s)} className={`${card} text-left ${alert ? 'ring-2 ring-primary/40' : ''}`}>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{n}</p>
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
          </button>
        ))}
      </div>
      {data.privacySoon > 0 && <p className={`${card} text-sm text-red-600 font-semibold`}>{data.privacySoon} solicitud(es) de privacidad vencen en menos de una semana. La ley da un mes para responder.</p>}
    </>
  );
}

function Reports({ need2fa, act, setAsk, goUser }: Common & { act: ActFn; setAsk: (a: Ask) => void; goUser: (id: string | null) => void }) {
  const [closed, setClosed] = useState(false);
  const { data, error, reload } = useAdminData<any[]>(`/admin/reports${closed ? '?status=CLOSED' : ''}`, need2fa);
  const run = (id: string, action: string) => act(`/admin/reports/${id}/action`, { action }, reload);
  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setClosed(false)} className={!closed ? btnDark : btnLight}>Pendientes</button>
        <button onClick={() => setClosed(true)} className={closed ? btnDark : btnLight}>Cerradas</button>
      </div>
      {!data ? <Loading error={error} onRetry={reload} /> : data.length === 0 ? <Empty text={closed ? 'No hay denuncias cerradas.' : 'No hay denuncias pendientes.'} /> : data.map((r) => (
        <div key={r.id} className={`${card} space-y-3`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-pink-50 text-primary">{r.targetLabel} · {r.reasonLabel}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{fmt(r.createdAt)}</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Denuncia <b>{r.reporterName}</b> contra <button onClick={() => goUser(r.ownerId)} className="font-bold underline">{r.ownerName}</button>
            {r.ownerSuspended && <span className="ml-1 text-red-600 font-bold">(suspendida)</span>}
            {r.otherOpenReports > 0 && <span className="ml-1">· {r.otherOpenReports} denuncia(s) más sobre lo mismo</span>}
          </p>
          {r.details && <p className="text-xs bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">“{r.details}”</p>}
          {r.contentGone ? <p className="text-xs font-bold">El contenido ya no existe.</p> : (
            <div className="rounded-xl bg-gray-50 p-3 space-y-2">
              {r.contentText && <p className="text-sm whitespace-pre-wrap break-words">{r.contentText}</p>}
              {r.contentImage && <img src={r.contentImage} alt="Contenido denunciado" className="rounded-xl max-h-72 object-contain" />}
            </div>
          )}
          {r.status === 'OPEN' ? (
            <div className="flex flex-wrap gap-2">
              {!r.contentGone && r.targetType !== 'USER' && <button onClick={() => setAsk({ title: 'Eliminar el contenido', message: 'Se borra para siempre y su autor recibe el motivo por correo y en la app.', confirmLabel: 'Eliminar', danger: true, run: () => run(r.id, 'remove') })} className={btnDanger}>Eliminar contenido</button>}
              {r.ownerId && !r.ownerSuspended && <button onClick={() => setAsk({ title: 'Suspender la cuenta', message: `${r.ownerName} no podrá entrar hasta que la reactives. Recibirá el motivo (${r.reasonLabel}) por correo.`, confirmLabel: 'Suspender', danger: true, run: () => run(r.id, 'suspend') })} className={btnDark}>Suspender cuenta</button>}
              {r.ownerSuspended && <button onClick={() => run(r.id, 'unsuspend')} className={btnLight}>Reactivar cuenta</button>}
              <button onClick={() => run(r.id, 'dismiss')} className={btnLight}>Descartar</button>
            </div>
          ) : <p className="text-xs font-bold text-[var(--text-muted)]">{({ REMOVED: 'Contenido eliminado', SUSPENDED: 'Cuenta suspendida', DISMISSED: 'Descartada' } as any)[r.status] || r.status}</p>}
        </div>
      ))}
    </>
  );
}

function Blocked({ need2fa, goUser }: Common & { goUser: (id: string | null) => void }) {
  const { data, error, reload } = useAdminData<any>('/admin/blocked-uploads', need2fa);
  if (!data) return <Loading error={error} onRetry={reload} />;
  return (
    <>
      <p className="text-xs text-[var(--text-muted)]">Por seguridad y por ley, las fotos bloqueadas no se guardan: solo quién, dónde y cuándo. Se borran a los 90 días.</p>
      {data.repeatOffenders.length > 0 && (
        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-bold">Cuentas que lo repiten (30 días)</h3>
          {data.repeatOffenders.map((o: any) => (
            <button key={o.userId} onClick={() => goUser(o.userId)} className="w-full flex justify-between text-sm py-1">
              <span className="font-semibold underline">{o.userName}{o.suspended ? ' (suspendida)' : ''}</span><span className="font-bold text-red-600">{o.count} intentos</span>
            </button>
          ))}
        </div>
      )}
      {data.items.length === 0 ? <Empty text="No se ha bloqueado ninguna foto." /> : (
        <div className={`${card} divide-y divide-gray-100`}>
          {data.items.map((b: any) => (
            <div key={b.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <button onClick={() => goUser(b.userId)} className="font-bold underline truncate">{b.userName}</button>
                <p className="text-[var(--text-muted)]">{b.where} · {fmt(b.createdAt)}</p>
              </div>
              <span className="shrink-0 font-bold">{b.score}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function UsersSection({ need2fa, act, setAsk, openId, setOpenId }: Common & { act: ActFn; setAsk: (a: Ask) => void; openId: string | null; setOpenId: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const list = useAdminData<any[]>(`/admin/users?q=${encodeURIComponent(query)}`, need2fa);
  const detail = useAdminData<any>(openId ? `/admin/users/${openId}` : null, need2fa);
  const u = openId ? detail.data : null;
  if (openId) {
    if (!u || u.id !== openId) return <Loading error={detail.error} onRetry={detail.reload} />;
    const c = u.counts;
    return (
      <div className="space-y-3">
        <button onClick={() => setOpenId(null)} className="text-xs font-bold underline">← Volver a la lista</button>
        <div className={`${card} space-y-3`}>
          <div className="flex items-center gap-3">
            {u.avatar ? <img src={u.avatar} alt="" className="w-14 h-14 rounded-full object-cover" /> : <div className="w-14 h-14 rounded-full bg-gray-100" />}
            <div className="min-w-0">
              <p className="font-bold truncate">{u.name}{u.isAdmin && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-primary">ADMIN</span>}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
            </div>
          </div>
          {u.suspendedAt && <p className="text-xs font-bold text-red-600">Suspendida desde {fmt(u.suspendedAt)}</p>}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span>Alta: <b>{fmt(u.createdAt)}</b></span><span>Edad: <b>{u.ageBand}</b></span>
            <span>Correo verificado: <b>{u.isVerified ? 'Sí' : 'No'}</b></span><span>Perfil: <b>{u.isProfilePublic ? 'Público' : 'Privado'}</b></span>
            {u.guardian && <span className="col-span-2">Adulto responsable: <b>{u.guardian.status === 'APPROVED' ? (u.guardian.marketplaceAllowed ? 'aceptado, compraventa permitida' : 'aceptado, compraventa pausada') : 'pendiente'}</b></span>}
            <span>Looks: <b>{c.looks}</b></span><span>Prendas: <b>{c.products}</b> ({c.forSale} a la venta)</span>
            <span>Seguidores: <b>{c.followers}</b></span><span>Historias: <b>{c.stories}</b></span>
            <span>Denuncias recibidas (perfil): <b>{c.reportsAgainst}</b></span><span>Denuncias hechas: <b>{c.reportsMade}</b></span>
            <span className="col-span-2">Fotos íntimas bloqueadas: <b className={c.blockedUploads ? 'text-red-600' : ''}>{c.blockedUploads}</b></span>
          </div>
          {u.bio && <p className="text-xs bg-gray-50 rounded-xl p-3">{u.bio}</p>}
          {!u.isAdmin && (u.suspendedAt
            ? <button onClick={() => act(`/admin/users/${u.id}/unsuspend`, {}, detail.reload)} className={btnLight}>Reactivar cuenta</button>
            : <button onClick={() => setAsk({ title: 'Suspender la cuenta', message: `${u.name} no podrá entrar hasta que la reactives. Recibirá el motivo por correo.`, reason: true, confirmLabel: 'Suspender', danger: true, run: (reason) => act(`/admin/users/${u.id}/suspend`, { reason }, detail.reload) })} className={btnDanger}>Suspender cuenta</button>)}
        </div>
        {u.history.length > 0 && (
          <div className={`${card} space-y-1`}>
            <h3 className="text-sm font-bold">Historial de moderación</h3>
            {u.history.map((h: any, i: number) => <p key={i} className="text-xs">{fmt(h.createdAt)} · {ACTION_LABEL[h.action] || h.action}{h.details ? `: ${h.details}` : ''}</p>)}
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" className={input} />
        <button type="submit" className={btnDark}>Buscar</button>
      </form>
      {!list.data ? <Loading error={list.error} onRetry={list.reload} /> : list.data.length === 0 ? <Empty text="Ninguna cuenta coincide." /> : (
        <div className={`${card} divide-y divide-gray-100`}>
          {list.data.map((x) => (
            <button key={x.id} onClick={() => setOpenId(x.id)} className="w-full py-2.5 flex items-center gap-3 text-left">
              {x.avatar ? <img src={x.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-gray-100" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{x.name}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{x.email} · {x.ageBand}</p>
              </div>
              {x.suspendedAt && <span className="text-[10px] font-bold text-red-600">SUSPENDIDA</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Shop({ need2fa, act, setAsk, goUser }: Common & { act: ActFn; setAsk: (a: Ask) => void; goUser: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, reload } = useAdminData<any[]>(`/admin/products?q=${encodeURIComponent(query)}`, need2fa);
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar anuncios" className={input} />
        <button type="submit" className={btnDark}>Buscar</button>
      </form>
      {!data ? <Loading error={error} onRetry={reload} /> : data.length === 0 ? <Empty text="No hay anuncios." /> : (
        <div className="grid grid-cols-2 gap-3">
          {data.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              {p.image ? <img src={p.image} alt="" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-gray-100" />}
              <div className="p-3 space-y-1 flex-1 flex flex-col">
                <p className="text-sm font-bold truncate">{p.name}</p>
                <p className="text-xs">{p.price != null ? `${p.price} €` : 'Sin precio'}{p.brand ? ` · ${p.brand}` : ''}</p>
                <button onClick={() => goUser(p.ownerId)} className="text-[11px] underline text-left text-[var(--text-muted)] truncate">{p.ownerName}</button>
                <div className="flex-1" />
                <button onClick={() => setAsk({ title: 'Retirar anuncio', message: `Se borra "${p.name}" y su vendedor/a recibe el motivo.`, reason: true, confirmLabel: 'Retirar', danger: true, run: (reason) => act(`/admin/products/${p.id}/remove`, { reason }, reload) })} className={`${btnDanger} mt-2`}>Retirar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Challenges({ need2fa, act, setAsk }: Common & { act: ActFn; setAsk: (a: Ask) => void }) {
  const { notify } = useNotification();
  const { data, error, reload } = useAdminData<any[]>('/admin/challenges', need2fa);
  const [openId, setOpenId] = useState<string | null>(null);
  const subs = useAdminData<any[]>(openId ? `/admin/challenges/${openId}/submissions` : null, need2fa);
  const [form, setForm] = useState({ title: '', description: '', tag: '', reward: '50', endDate: '' });
  const [creating, setCreating] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch('/admin/challenges', { method: 'POST', body: { ...form, reward: Number(form.reward) } });
      notify('Reto creado y activado', 'success');
      setForm({ title: '', description: '', tag: '', reward: '50', endDate: '' }); setCreating(false); reload();
    } catch (err: any) { notify(err?.message || 'No se pudo crear', 'error'); }
  };
  const toggle = async (c: any) => {
    try { await adminFetch(`/admin/challenges/${c.id}`, { method: 'PUT', body: { active: !c.active } }); notify(c.active ? 'Reto desactivado' : 'Reto activado', 'success'); reload(); }
    catch (err: any) { notify(err?.message || 'No se pudo cambiar', 'error'); }
  };
  return (
    <>
      <button onClick={() => setCreating(!creating)} className={btnDark}>{creating ? 'Cancelar' : 'Nuevo reto'}</button>
      {creating && (
        <form onSubmit={save} className={`${card} space-y-2`}>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título (p. ej. Tonos tierra)" maxLength={80} className={input} />
          <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Qué hay que hacer" maxLength={400} rows={2} className={`${input} resize-none`} />
          <div className="grid grid-cols-3 gap-2">
            <input required value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Etiqueta" maxLength={40} className={input} />
            <input required type="number" min={10} max={500} value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} aria-label="Puntos" className={input} />
            <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} aria-label="Fecha de fin" className={input} />
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">Etiquetas con revisión de color automática: Color Block, Monocromo, Minimalista. Al crearlo pasa a ser el reto activo.</p>
          <button type="submit" className={`${btnDark} w-full py-3`}>Crear y activar</button>
        </form>
      )}
      {!data ? <Loading error={error} onRetry={reload} /> : data.map((c) => (
        <div key={c.id} className={`${card} space-y-2`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold">{c.title} {c.active && <span className="text-[10px] ml-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700">ACTIVO</span>}</p>
              <p className="text-xs text-[var(--text-muted)]">{c.tag} · {c.reward} puntos · hasta {new Date(c.endDate).toLocaleDateString('es-ES')} · {c.submissions} participaciones</p>
            </div>
          </div>
          <p className="text-xs">{c.description}</p>
          <div className="flex gap-2">
            <button onClick={() => toggle(c)} className={btnLight}>{c.active ? 'Desactivar' : 'Activar'}</button>
            <button onClick={() => setOpenId(openId === c.id ? null : c.id)} className={btnLight}>{openId === c.id ? 'Ocultar fotos' : 'Ver participaciones'}</button>
          </div>
          {openId === c.id && (!subs.data ? <Loading error={subs.error} onRetry={subs.reload} /> : subs.data.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Nadie ha participado aún.</p> : (
            <div className="grid grid-cols-3 gap-2">
              {subs.data.map((s) => (
                <div key={s.id} className="space-y-1">
                  {s.imageUrl && <img src={s.imageUrl} alt="" className={`w-full aspect-square object-cover rounded-xl ${s.status === 'INVALID' ? 'opacity-40' : ''}`} />}
                  <p className="text-[10px] font-bold truncate">{s.userName}</p>
                  {s.status !== 'INVALID'
                    ? <button onClick={() => setAsk({ title: 'Anular participación', message: `Se quitan los puntos a ${s.userName} y recibe el motivo.`, reason: true, confirmLabel: 'Anular', danger: true, run: (reason) => act(`/admin/submissions/${s.id}/invalidate`, { reason }, subs.reload) })} className="text-[10px] font-bold text-red-600 underline">Anular</button>
                    : <p className="text-[10px] text-red-600">Anulada</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Crashes({ need2fa, act }: Common & { act: ActFn }) {
  const { data, error, reload } = useAdminData<any[]>('/admin/crashes', need2fa);
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <Loading error={error} onRetry={reload} />;
  if (data.length === 0) return <Empty text="Sin errores en los últimos 90 días." />;
  return (
    <>
      {data.map((c) => (
        <div key={c.signature} className={`${card} space-y-2`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold break-words min-w-0">{c.title}</p>
            <span className="shrink-0 text-xs font-bold text-red-600">{c.count}×</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">{c.source === 'web' ? 'Web' : 'App'} · versiones {c.versions.join(', ') || '?'} · último {fmt(c.lastAt)}{c.device ? ` · ${c.device}` : ''}</p>
          <div className="flex gap-2">
            <button onClick={() => setOpen(open === c.signature ? null : c.signature)} className={btnLight}>{open === c.signature ? 'Ocultar detalle' : 'Ver detalle'}</button>
            <button onClick={() => act(`/admin/crashes/${c.signature}/resolve`, {}, reload)} className={btnDark}>Marcar arreglado</button>
          </div>
          {open === c.signature && <pre className="text-[10px] bg-gray-50 rounded-xl p-3 whitespace-pre-wrap break-all max-h-64 overflow-auto">{c.trace}</pre>}
        </div>
      ))}
    </>
  );
}

function Stats({ need2fa }: Common) {
  const { data, error, reload } = useAdminData<any>('/admin/stats', need2fa);
  if (!data) return <Loading error={error} onRetry={reload} />;
  const rows: [string, number[]][] = [
    ['Cuentas nuevas', data.series.users], ['Looks publicados', data.series.looks], ['Prendas puestas a la venta', data.series.sales],
    ['Historias', data.series.stories], ['Participaciones en retos', data.series.challenges], ['Denuncias', data.series.reports],
  ];
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {[['Cuentas', data.totals.users], ['Looks', data.totals.looks], ['A la venta', data.totals.forSale]].map(([l, n]) => (
          <div key={l as string} className={card}><p className="text-xl font-bold">{n}</p><p className="text-[11px] text-[var(--text-muted)]">{l}</p></div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)]">Últimas 8 semanas (de lunes a domingo). Solo números, sin datos personales.</p>
      {rows.map(([label, series]) => {
        const max = Math.max(1, ...series);
        return (
          <div key={label} className={`${card} space-y-2`}>
            <div className="flex justify-between text-sm"><span className="font-bold">{label}</span><span className="text-[var(--text-muted)]">esta semana: <b className="text-[var(--text-primary)]">{series[series.length - 1]}</b></span></div>
            <div className="flex items-end gap-1.5 h-16">
              {series.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`Semana del ${new Date(data.weeks[i]).toLocaleDateString('es-ES')}: ${v}`}>
                  <div className={`w-full rounded-t-md ${i === series.length - 1 ? 'bg-[var(--ink,#0B0B0F)]' : 'bg-gray-300'}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Broadcast({ act, setAsk }: { act: ActFn; setAsk: (a: Ask) => void }) {
  const [message, setMessage] = useState('');
  return (
    <div className={`${card} space-y-3`}>
      <p className="text-sm">Envía un aviso a todas las cuentas (en la app y como notificación).</p>
      <p className="text-xs text-[var(--text-muted)]">Solo avisos del servicio: mantenimiento, cambios de normas o de la política, fallos. Nunca publicidad ni ofertas: la ley exige consentimiento expreso para eso.</p>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={300} placeholder="Ej.: Esta noche de 2:00 a 3:00 haremos una mejora y la app puede no funcionar." className={`${input} resize-none`} />
      <p className="text-[11px] text-right text-[var(--text-muted)]">{message.length}/300</p>
      <button disabled={message.trim().length < 5} onClick={() => setAsk({ title: 'Enviar a todas las cuentas', message: `"${message.trim()}"`, confirmLabel: 'Enviar', run: () => act('/admin/broadcast', { message: message.trim() }, () => setMessage('')) })} className={`${btnDark} w-full py-3`}>Enviar aviso</button>
    </div>
  );
}

function Privacy({ need2fa, act, setAsk }: Common & { act: ActFn; setAsk: (a: Ask) => void }) {
  const [closed, setClosed] = useState(false);
  const { data, error, reload } = useAdminData<any[]>(`/admin/privacy-requests${closed ? '?status=CLOSED' : ''}`, need2fa);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setClosed(false)} className={!closed ? btnDark : btnLight}>Pendientes</button>
        <button onClick={() => setClosed(true)} className={closed ? btnDark : btnLight}>Respondidas</button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">La ley da un mes para responder. Para el acceso o la copia, la persona puede descargar sus datos en Ajustes; para borrar, puede eliminar su cuenta. Si te lo pide aquí, hazlo tú o explícale cómo.</p>
      {!data ? <Loading error={error} onRetry={reload} /> : data.length === 0 ? <Empty text={closed ? 'No hay solicitudes respondidas.' : 'No hay solicitudes pendientes.'} /> : data.map((p) => {
        const days = Math.ceil((new Date(p.dueAt).getTime() - Date.now()) / 86400000);
        const text = answers[p.id] || '';
        return (
          <div key={p.id} className={`${card} space-y-2`}>
            <div className="flex justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold">{p.typeLabel}</span>
              {p.status === 'OPEN'
                ? <span className={`text-[11px] font-bold ${days <= 7 ? 'text-red-600' : 'text-[var(--text-muted)]'}`}>{days > 0 ? `Quedan ${days} días` : 'Plazo vencido'}</span>
                : <span className="text-[11px] font-bold text-green-700">{p.status === 'DONE' ? 'Atendida' : 'Rechazada'} · {fmt(p.resolvedAt)}</span>}
            </div>
            <p className="text-xs text-[var(--text-muted)]">{p.name} · {p.email} · {fmt(p.createdAt)}</p>
            <p className="text-sm bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{p.message}</p>
            {p.status === 'OPEN' ? (
              <>
                <textarea value={text} onChange={(e) => setAnswers({ ...answers, [p.id]: e.target.value })} rows={3} maxLength={2000} placeholder="Respuesta (se envía por correo)" className={`${input} resize-none`} />
                <div className="flex gap-2">
                  <button disabled={text.trim().length < 10} onClick={() => act(`/admin/privacy-requests/${p.id}/resolve`, { status: 'DONE', response: text.trim() }, reload)} className={btnDark}>Responder y cerrar</button>
                  <button disabled={text.trim().length < 10} onClick={() => setAsk({ title: 'Rechazar la solicitud', message: 'Solo si no procede (p. ej. no se puede verificar la identidad). La persona recibirá tu respuesta y que puede reclamar ante la AEPD.', confirmLabel: 'Rechazar', danger: true, run: () => act(`/admin/privacy-requests/${p.id}/resolve`, { status: 'REJECTED', response: text.trim() }, reload) })} className={btnLight}>Rechazar</button>
                </div>
              </>
            ) : p.response && <p className="text-xs whitespace-pre-wrap"><b>Respuesta:</b> {p.response}</p>}
          </div>
        );
      })}
    </>
  );
}

function Log({ need2fa }: Common) {
  const { data, error, reload } = useAdminData<any[]>('/admin/log', need2fa);
  if (!data) return <Loading error={error} onRetry={reload} />;
  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-xs text-[var(--text-muted)]">Todo lo que se hace en el panel queda aquí (se guarda 3 años).</p>
        <button onClick={reload} aria-label="Actualizar"><RefreshCw size={16} /></button>
      </div>
      {data.length === 0 ? <Empty text="Aún no hay acciones." /> : (
        <div className={`${card} divide-y divide-gray-100`}>
          {data.map((x) => (
            <div key={x.id} className="py-2 text-xs">
              <p><b>{x.adminName}</b> · {ACTION_LABEL[x.action] || x.action}</p>
              {x.details && <p className="text-[var(--text-muted)] break-words">{x.details}</p>}
              <p className="text-[10px] text-[var(--text-muted)]">{fmt(x.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default Admin;
