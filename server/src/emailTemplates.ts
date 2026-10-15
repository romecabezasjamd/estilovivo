// Plantilla de correo con la estética de la app (editorial, blanco y negro, titular con serif cursiva, tarjetas
// redondeadas, botón píldora negro). Todo con estilos en línea y tablas: así se ve igual en Gmail, Outlook, Apple
// Mail y el correo del móvil (muchos clientes ignoran <style> o recortan el <head>).

export interface EmailParams {
  /** Texto corto que el buzón muestra junto al asunto (no se ve dentro del correo). */
  preheader: string;
  /** Etiqueta pequeña sobre el titular, p. ej. "Tu armario". */
  eyebrow: string;
  /** Titular. Lo que va entre *asteriscos* sale en serif cursiva rosa, como en la app. Se escapa. */
  headline: string;
  /** Párrafo principal (texto plano; se escapa). */
  intro?: string;
  /** Cita destacada: mensaje de chat, comentario… (texto plano; se escapa). */
  quote?: string;
  /** Foto (prenda o look). URL absoluta. */
  imageUrl?: string;
  imageAlt?: string;
  cta?: { label: string; url: string };
  /** Nota pequeña bajo el botón (texto plano; se escapa). */
  note?: string;
  /** Enlace alternativo visible (por si el botón no funciona). */
  fallbackUrl?: string;
  /** Por qué recibe el correo (pie). */
  reason: string;
  /** Origen público para el logo y enlaces, sin barra final. */
  baseUrl: string;
}

const C = {
  canvas: '#F2F2F4',
  card: '#FFFFFF',
  ink: '#0F0F12',
  body: '#4A4A55',
  muted: '#8A8A96',
  line: '#ECECF0',
  soft: '#F6F6F8',
  brand: '#E84393',
  brandSoft: '#FDE7F2',
};

const SANS = "'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Solo http(s): nada de javascript: ni data: en enlaces o imágenes. */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : '#');

/** "Hola, *Ana*" → Hola, <em serif rosa>Ana</em> (todo escapado). */
export const renderHeadline = (text: string) =>
  esc(text).replace(
    /\*([^*]+)\*/g,
    `<em style="font-family:${SERIF};font-style:italic;font-weight:400;color:${C.brand};">$1</em>`,
  );

export function renderEmail(p: EmailParams): string {
  const base = p.baseUrl.replace(/\/+$/, '');
  const image = p.imageUrl
    ? `<tr><td style="padding:0 32px 8px 32px;">
        <img src="${safeUrl(p.imageUrl)}" alt="${esc(p.imageAlt || '')}" width="496"
          style="display:block;width:100%;max-width:496px;height:auto;max-height:420px;object-fit:cover;border-radius:24px;border:0;background:${C.soft};">
      </td></tr>`
    : '';
  const quote = p.quote
    ? `<tr><td style="padding:8px 32px 8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:${C.soft};border-radius:20px;">
          <tr><td style="padding:18px 22px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink};">
            <span style="font-family:${SERIF};font-size:30px;line-height:10px;color:${C.brand};vertical-align:-10px;">“</span>
            ${esc(p.quote)}
          </td></tr>
        </table>
      </td></tr>`
    : '';
  const cta = p.cta
    ? `<tr><td align="left" style="padding:20px 32px 4px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${C.ink};border-radius:999px;">
            <a href="${safeUrl(p.cta.url)}" target="_blank"
              style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;">
              ${esc(p.cta.label)}&nbsp;&nbsp;→
            </a>
          </td>
        </tr></table>
      </td></tr>`
    : '';
  const note = p.note
    ? `<tr><td style="padding:16px 32px 0 32px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted};">${esc(p.note)}</td></tr>`
    : '';
  const fallback = p.fallbackUrl
    ? `<tr><td style="padding:12px 32px 0 32px;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">
        ¿El botón no funciona? Copia este enlace en tu navegador:<br>
        <a href="${safeUrl(p.fallbackUrl)}" style="color:${C.ink};word-break:break-all;">${esc(p.fallbackUrl)}</a>
      </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(p.eyebrow)} · Estilo Vivo</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(p.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.canvas};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 8px 18px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${safeUrl(base + '/estilo-vivo-logo-icon.png')}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px;">
          </td>
          <td style="vertical-align:middle;font-family:${SANS};font-size:20px;font-weight:700;color:${C.ink};letter-spacing:-0.3px;">
            Estilo <em style="font-family:${SERIF};font-style:italic;font-weight:400;font-size:23px;">Vivo</em>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${C.card};border-radius:32px;padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:32px 32px 0 32px;">
            <span style="display:inline-block;padding:7px 14px;border-radius:999px;background:${C.brandSoft};font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${C.brand};">${esc(p.eyebrow)}</span>
          </td></tr>
          <tr><td style="padding:18px 32px 0 32px;font-family:${SANS};font-size:30px;line-height:1.2;font-weight:700;letter-spacing:-0.6px;color:${C.ink};">
            ${renderHeadline(p.headline)}
          </td></tr>
          ${p.intro ? `<tr><td style="padding:14px 32px 12px 32px;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.body};">${esc(p.intro)}</td></tr>` : '<tr><td style="height:12px;"></td></tr>'}
          ${image}
          ${quote}
          ${cta}
          ${note}
          ${fallback}
          <tr><td style="height:32px;"></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:22px 24px 8px 24px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
        ${esc(p.reason)}<br>
        <a href="${safeUrl(base)}" style="color:${C.muted};">estilovivo</a> · Tu armario, tu comunidad, tu estilo
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export const REASON_PREFS =
  'Recibes este correo porque tienes activados los avisos por email. Puedes cambiarlos en la app: Perfil › Ajustes › Avisos por email.';
export const REASON_ACCOUNT =
  'Recibes este correo por una acción de tu cuenta de Estilo Vivo. Si no has sido tú, puedes ignorarlo.';
