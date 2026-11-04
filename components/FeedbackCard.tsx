import React, { useState } from 'react';
import { MessageSquareHeart, Star } from 'lucide-react';
import { feedbackApi, type FeedbackKind } from '../services/api';
import { useNotification } from '../src/context/NotificationContext';

const KINDS: [FeedbackKind, string][] = [
  ['idea', '💡 Idea'],
  ['bug', '🐞 Algo falla'],
  ['other', '💬 Otra cosa'],
];

/** Perfil › Enviar opinión: llega por correo al equipo con tu nombre y correo para poder contestarte. */
const FeedbackCard: React.FC = () => {
  const { notify } = useNotification();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) return notify('Cuéntanos un poco más (mínimo 5 caracteres)', 'error');
    setBusy(true);
    try {
      await feedbackApi.send(kind, message.trim(), rating || undefined);
      notify('¡Gracias! Lo leeremos con cariño 💛', 'success');
      setMessage(''); setRating(0); setOpen(false);
    } catch (err: any) { notify(err?.message || 'No se pudo enviar', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center gap-3 text-left" aria-expanded={open}>
        <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
          <MessageSquareHeart size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-700">Enviar opinión</p>
          <p className="text-[10px] text-gray-400">Ideas, fallos o lo que quieras contarnos</p>
        </div>
        <span className="text-primary text-xs font-bold">{open ? 'Cerrar' : 'Abrir'}</span>
      </button>
      {open && (
        <form onSubmit={send} className="px-5 pb-5 space-y-3">
          <div className="flex gap-2" role="radiogroup" aria-label="Tipo de opinión">
            {KINDS.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={kind === v} onClick={() => setKind(v)}
                className={`flex-1 py-2 rounded-full text-xs font-bold border ${kind === v ? 'bg-[var(--ink,#0B0B0F)] text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" aria-label="Valoración (opcional)">
            <span className="text-[11px] text-gray-400 mr-1">¿Qué te parece la app?</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} de 5`} className="p-0.5">
                <Star size={20} className={n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
              </button>
            ))}
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={4} placeholder="Escribe aquí tu opinión"
            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          <p className="text-[10px] text-gray-400">Nos llega por correo con tu nombre y tu correo, solo para poder contestarte.</p>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-full bg-[var(--ink,#0B0B0F)] text-white text-sm font-bold disabled:opacity-50">Enviar</button>
        </form>
      )}
    </div>
  );
};

export default FeedbackCard;
