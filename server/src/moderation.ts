// Moderación de denuncias sin panel ni cuenta de administración: cada denuncia envía un correo al equipo con un
// enlace FIRMADO (HMAC con un secreto del servidor) y con caducidad a una página donde se decide qué hacer.
// GET solo muestra; las acciones van por POST (los antivirus del correo abren enlaces y no deben ejecutar nada).
import crypto from 'crypto';

export const REASON_LABEL: Record<string, string> = {
  SPAM: 'Spam o publicidad',
  HARASSMENT: 'Acoso o insultos',
  INAPPROPRIATE: 'Contenido inapropiado',
  IMPERSONATION: 'Suplantación de identidad',
  OTHER: 'Otro motivo',
};

export const TYPE_LABEL: Record<string, string> = {
  USER: 'Perfil',
  LOOK: 'Publicación',
  COMMENT: 'Comentario',
  STORY: 'Historia',
  MESSAGE: 'Mensaje de chat',
};

export const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Pendiente',
  REMOVED: 'Contenido eliminado',
  SUSPENDED: 'Cuenta suspendida',
  DISMISSED: 'Descartada',
};

const LINK_DAYS = 30;

const sig = (secret: string, reportId: string, exp: number) =>
  crypto.createHmac('sha256', secret).update(`moderation:${reportId}:${exp}`).digest('base64url');

/** Parámetros de un enlace de moderación válido durante LINK_DAYS días. */
export function signModerationLink(secret: string, reportId: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + LINK_DAYS * 24 * 3600;
  return { e: String(exp), s: sig(secret, reportId, exp) };
}

export function verifyModerationLink(secret: string, reportId: string, e: unknown, s: unknown, now = Date.now()): boolean {
  if (typeof e !== 'string' || typeof s !== 'string' || !/^\d{9,11}$/.test(e)) return false;
  const exp = Number(e);
  if (exp * 1000 < now) return false;
  const expected = Buffer.from(sig(secret, reportId, exp));
  const given = Buffer.from(s);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ModerationView {
  reportId: string;
  e: string;
  s: string;
  targetType: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: Date;
  reporterName: string;
  ownerName: string;
  ownerSuspended: boolean;
  contentText?: string | null;
  contentImage?: string | null;
  /** Ya no existe el contenido (borrado por su autor o por moderación). */
  contentGone: boolean;
  otherOpenReports: number;
  flash?: string;
}

const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self'";
export const MODERATION_CSP = PAGE_CSP;

export function renderModerationPage(v: ModerationView): string {
  const hidden = `<input type="hidden" name="e" value="${esc(v.e)}"><input type="hidden" name="s" value="${esc(v.s)}">`;
  const btn = (action: string, label: string, kind: 'danger' | 'dark' | 'light', confirm?: string) =>
    `<form method="post" style="margin:0">${hidden}<input type="hidden" name="action" value="${action}">` +
    (confirm ? `<label class="chk"><input type="checkbox" name="confirm" value="1" required> ${esc(confirm)}</label>` : '') +
    `<button class="${kind}" type="submit">${esc(label)}</button></form>`;
  const open = v.status === 'OPEN';
  const actions: string[] = [];
  if (open && !v.contentGone && v.targetType !== 'USER') actions.push(btn('remove', 'Eliminar el contenido', 'danger'));
  if (!v.ownerSuspended) actions.push(btn('suspend', 'Suspender la cuenta del autor', 'dark', 'Confirmo que esta cuenta incumple las normas'));
  else actions.push(btn('unsuspend', 'Reactivar la cuenta del autor', 'light'));
  if (open) actions.push(btn('dismiss', 'Descartar: no incumple las normas', 'light'));

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Revisar denuncia · Estilo Vivo</title>
<style>
body{margin:0;background:#F2F2F4;color:#0F0F12;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.55}
main{max-width:640px;margin:0 auto;padding:28px 16px 48px}h1{font-size:28px;margin:0 0 4px}h1 em{font-family:Georgia,serif;font-weight:400;color:#E84393}
.card{background:#fff;border-radius:24px;padding:18px 20px;margin:12px 0}.muted{color:#8A8A96;font-size:14px}
.pill{display:inline-block;padding:5px 12px;border-radius:999px;background:#FDE7F2;color:#E84393;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.quote{background:#F6F6F8;border-radius:16px;padding:12px 16px;white-space:pre-wrap;word-break:break-word}
img{max-width:100%;border-radius:16px;display:block;margin-top:10px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0}dt{color:#8A8A96}dd{margin:0}
button{width:100%;padding:14px 18px;border-radius:999px;font:inherit;font-weight:600;font-size:15px;border:0;cursor:pointer;margin-top:8px}
.danger{background:#D92D20;color:#fff}.dark{background:#0F0F12;color:#fff}.light{background:#fff;color:#0F0F12;border:1px solid #DADAE0}
.chk{display:block;font-size:14px;color:#4A4A55;margin-top:12px}.flash{background:#E8F7EE;color:#146C2E;border-radius:16px;padding:12px 16px;font-weight:600}
</style></head><body><main>
<span class="pill">Moderación</span>
<h1>Revisar <em>denuncia</em></h1>
<p class="muted">Enlace privado: no lo compartas. Caduca en ${LINK_DAYS} días desde el aviso.</p>
${v.flash ? `<div class="flash">${esc(v.flash)}</div>` : ''}
<div class="card"><dl>
<dt>Estado</dt><dd><strong>${esc(STATUS_LABEL[v.status] || v.status)}</strong></dd>
<dt>Qué</dt><dd>${esc(TYPE_LABEL[v.targetType] || v.targetType)}</dd>
<dt>Motivo</dt><dd>${esc(REASON_LABEL[v.reason] || v.reason)}</dd>
<dt>Autor</dt><dd>${esc(v.ownerName)}${v.ownerSuspended ? ' · <strong>suspendida</strong>' : ''}</dd>
<dt>Denuncia</dt><dd>${esc(v.reporterName)} · ${esc(v.createdAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))}</dd>
${v.otherOpenReports > 0 ? `<dt>Otras</dt><dd>${v.otherOpenReports} denuncia(s) más pendientes sobre lo mismo</dd>` : ''}
</dl>
${v.details ? `<p class="muted" style="margin:12px 0 4px">Comentario de quien denuncia:</p><div class="quote">${esc(v.details)}</div>` : ''}
</div>
<div class="card"><p class="muted" style="margin:0 0 6px">Contenido denunciado</p>
${v.contentGone ? '<p><strong>Ya no existe</strong> (lo borró su autor o ya se eliminó).</p>' : ''}
${v.contentText ? `<div class="quote">${esc(v.contentText)}</div>` : ''}
${v.contentImage ? `<img src="${esc(v.contentImage)}" alt="Imagen denunciada">` : ''}
</div>
<div class="card"><p class="muted" style="margin:0">¿Qué hacemos?</p>${actions.join('')}</div>
<p class="muted">Suspender impide a esa persona entrar y usar la app hasta que la reactives. Eliminar el contenido no se puede deshacer.</p>
</main></body></html>`;
}

export function renderModerationError(message: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Moderación · Estilo Vivo</title><style>body{font-family:Helvetica,Arial,sans-serif;background:#F2F2F4;margin:0}main{max-width:560px;margin:60px auto;background:#fff;border-radius:24px;padding:24px}</style>
</head><body><main><h1>No se puede abrir</h1><p>${esc(message)}</p></main></body></html>`;
}

// ============= AVISO A LA PERSONA AFECTADA =============
// Reglamento de Servicios Digitales (UE 2022/2065, art. 17): quien sufre una decisión de moderación recibe una
// explicación clara con el motivo, si fue automática o no, y cómo reclamar.
export type ModerationDecision =
  | { kind: 'removed'; what: string; reason: string }
  | { kind: 'suspended'; reason: string }
  | { kind: 'unsuspended'; reason: string }
  | { kind: 'submission_invalid'; what: string; reason: string };

export function decisionMessage(d: ModerationDecision, contactEmail: string): { subject: string; text: string; notification?: string } {
  const appeal = `Si crees que es un error, responde a este correo o escribe a ${contactEmail} explicando por qué y lo revisaremos de nuevo. También puedes acudir a un órgano de resolución extrajudicial o a los tribunales.`;
  const manual = 'La decisión la ha tomado una persona del equipo de Estilo Vivo tras revisarlo.';
  switch (d.kind) {
    case 'removed':
      return {
        subject: 'Hemos retirado contenido tuyo - Estilo Vivo',
        text: `Hola:\n\nHemos retirado tu ${d.what} porque incumple las normas de la comunidad de Estilo Vivo.\n\nMotivo: ${d.reason}.\n${manual}\n\n${appeal}\n\nEstilo Vivo`,
        notification: `Hemos retirado tu ${d.what}. Motivo: ${d.reason}. Te hemos enviado los detalles por correo.`,
      };
    case 'suspended':
      return {
        subject: 'Tu cuenta está suspendida - Estilo Vivo',
        text: `Hola:\n\nHemos suspendido tu cuenta de Estilo Vivo por incumplir las normas de la comunidad. Mientras esté suspendida no podrás entrar ni usar la app.\n\nMotivo: ${d.reason}.\n${manual}\n\n${appeal}\n\nTus datos siguen protegidos y puedes pedir una copia o su borrado escribiendo a ${contactEmail}.\n\nEstilo Vivo`,
      };
    case 'unsuspended':
      return {
        subject: 'Tu cuenta vuelve a estar activa - Estilo Vivo',
        text: `Hola:\n\nHemos revisado tu caso y tu cuenta de Estilo Vivo vuelve a estar activa. Ya puedes entrar con normalidad.\n\nEstilo Vivo`,
      };
    case 'submission_invalid':
      return {
        subject: 'Hemos invalidado una participación en un reto - Estilo Vivo',
        text: `Hola:\n\nHemos invalidado ${d.what} y retirado sus puntos.\n\nMotivo: ${d.reason}.\n${manual}\n\n${appeal}\n\nEstilo Vivo`,
        notification: `Hemos invalidado ${d.what}. Motivo: ${d.reason}.`,
      };
  }
}
