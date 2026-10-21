import React, { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { privacyApi } from '../services/api';
import { useNotification } from '../src/context/NotificationContext';

const TYPES: [string, string][] = [
  ['ACCESS', 'Saber qué datos tenéis de mí'],
  ['RECTIFY', 'Corregir mis datos'],
  ['DELETE', 'Borrar mis datos'],
  ['OBJECT', 'Oponerme a un uso de mis datos'],
  ['RESTRICT', 'Limitar el uso de mis datos'],
  ['PORTABILITY', 'Llevarme mis datos'],
  ['OTHER', 'Otra consulta de privacidad'],
];

type Mine = Awaited<ReturnType<typeof privacyApi.mine>>;

/** Ajustes › Mis derechos de privacidad (RGPD arts. 15-22): se envía la solicitud y se ve la respuesta. Plazo: un mes. */
const PrivacyRightsCard: React.FC = () => {
  const { notify } = useNotification();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('ACCESS');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Mine>([]);

  const load = useCallback(() => { privacyApi.mine().then(setMine).catch(() => {}); }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) return notify('Explica tu solicitud (mínimo 10 caracteres)', 'error');
    setBusy(true);
    try {
      const r = await privacyApi.send(type, message.trim());
      notify(r.message, 'success');
      setMessage('');
      load();
    } catch (err: any) { notify(err?.message || 'No se pudo enviar', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-gray-700">Mis derechos de privacidad</h3>
        </div>
        <button onClick={() => setOpen(!open)} className="text-primary text-xs font-bold">{open ? 'Cerrar' : 'Abrir'}</button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-gray-500">Puedes pedir ver, corregir, borrar o llevarte tus datos, o limitar su uso. Te responderemos por correo en un mes como máximo.</p>
        {open && (
          <>
            <form onSubmit={send} className="space-y-3">
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo de solicitud"
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={3} placeholder="Cuéntanos qué necesitas"
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              <button type="submit" disabled={busy} className="w-full py-3 rounded-full bg-[var(--ink,#0B0B0F)] text-white text-sm font-bold disabled:opacity-50">Enviar solicitud</button>
            </form>
            {mine.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tus solicitudes</h4>
                {mine.map((m) => (
                  <div key={m.id} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-700">{m.typeLabel}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${m.status === 'OPEN' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {m.status === 'OPEN' ? 'En curso' : 'Respondida'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">{new Date(m.createdAt).toLocaleDateString('es-ES')}</p>
                    {m.response && <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{m.response}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PrivacyRightsCard;
