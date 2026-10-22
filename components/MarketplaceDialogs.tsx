import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, UserCheck } from 'lucide-react';
import { marketplaceApi, reportApi, ReportTargetType } from '../services/api';
import { useNotification } from '../src/context/NotificationContext';

const overlay = 'fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-4 animate-fade-in';
const sheet = 'bg-[var(--bg-card)] w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl';

/**
 * Declaración única antes de vender: la tienda es solo entre particulares (las condiciones prohíben vender como
 * profesional) y el comprador debe saber a quién compra (LGDCU art. 97 bis).
 */
export function SellerDeclarationDialog({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { notify } = useNotification();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await marketplaceApi.declareSeller(); onDone(); }
    catch (e: any) { notify(e?.message || 'No se pudo guardar', 'error'); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div className={overlay} onClick={onCancel}>
      <div className={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="seller-title">
        <UserCheck size={32} className="text-primary" />
        <h3 id="seller-title" className="text-lg font-bold text-[var(--text-primary)]">Vendes como particular</h3>
        <ul className="text-sm text-[var(--text-secondary)] space-y-2 list-disc pl-5">
          <li>La tienda de Estilo Vivo es solo para que particulares vendan su propia ropa. No está permitido vender como profesional o empresa.</li>
          <li>El acuerdo (precio, estado, entrega) es entre quien vende y quien compra. Estilo Vivo no cobra ni gestiona pagos.</li>
          <li>No se pueden vender falsificaciones ni productos prohibidos.</li>
        </ul>
        <label className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 w-4 h-4" />
          Confirmo que vendo como particular, no como profesional, y acepto las condiciones de compraventa.
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-full border border-[var(--border-light)] text-sm font-bold">Cancelar</button>
          <button onClick={confirm} disabled={!checked || busy} className="px-4 py-2 rounded-full bg-[var(--ink,#0B0B0F)] text-white text-sm font-bold disabled:opacity-50">Continuar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const PRODUCT_REASONS: [string, string][] = [
  ['ILLEGAL_ITEM', 'Falsificación o producto prohibido'],
  ['SCAM', 'Posible estafa'],
  ['INAPPROPRIATE', 'Contenido inapropiado'],
  ['SPAM', 'Spam o publicidad'],
  ['OTHER', 'Otro motivo'],
];

/** Denunciar contenido (de momento, anuncios de la tienda). La revisa una persona del equipo. */
export function ReportDialog({ targetType, targetId, what, onClose }: { targetType: ReportTargetType; targetId: string; what: string; onClose: () => void }) {
  const { notify } = useNotification();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await reportApi.send(targetType, targetId, reason, details.trim() || undefined);
      notify('Gracias. Lo revisaremos lo antes posible.', 'success');
      onClose();
    } catch (e: any) { notify(e?.message || 'No se pudo enviar la denuncia', 'error'); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div className={overlay} onClick={onClose}>
      <div className={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <Flag size={28} className="text-red-600" />
        <h3 id="report-title" className="text-lg font-bold text-[var(--text-primary)]">Denunciar {what}</h3>
        <div className="space-y-2" role="radiogroup" aria-label="Motivo">
          {PRODUCT_REASONS.map(([v, l]) => (
            <label key={v} className={`flex items-center gap-3 p-3 rounded-2xl border text-sm cursor-pointer ${reason === v ? 'border-[var(--ink,#0B0B0F)] bg-[var(--bg-base)]' : 'border-[var(--border-light)]'}`}>
              <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} />
              {l}
            </label>
          ))}
        </div>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder="Cuéntanos más (opcional)"
          className="w-full bg-[var(--bg-base)] rounded-2xl p-3 text-sm outline-none resize-none" />
        <p className="text-[11px] text-[var(--text-muted)]">La revisará una persona del equipo. Quien publicó el anuncio no sabrá quién lo ha denunciado.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-[var(--border-light)] text-sm font-bold">Cancelar</button>
          <button onClick={send} disabled={!reason || busy} className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-bold disabled:opacity-50">Enviar denuncia</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
