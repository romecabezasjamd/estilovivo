// "Continuar con Google": comprueba el ID token que da Google (en la web con Google Identity Services y en la app con
// Credential Manager). Solo se usan el identificador de la cuenta, el correo verificado y el nombre; la foto y el resto
// del perfil de Google no se piden ni se guardan (minimización de datos, art. 5.1.c RGPD).
import { OAuth2Client } from 'google-auth-library';

/** IDs de cliente OAuth aceptados (variable GOOGLE_CLIENT_ID, separados por comas). El primero es el de la web. */
export const googleClientIds = (): string[] =>
  (process.env.GOOGLE_CLIENT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);

export const isGoogleEnabled = () => googleClientIds().length > 0;

export interface GoogleIdentity { sub: string; email: string; name: string }

export class GoogleAuthError extends Error {}

let client: OAuth2Client | null = null;

/** Verifica firma, caducidad, emisor y destinatario del token. Lanza GoogleAuthError si no vale. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audience = googleClientIds();
  if (!audience.length) throw new GoogleAuthError('disabled');
  client ??= new OAuth2Client();
  let payload;
  try {
    payload = (await client.verifyIdToken({ idToken, audience })).getPayload();
  } catch {
    throw new GoogleAuthError('invalid');
  }
  if (!payload?.sub || !payload.email) throw new GoogleAuthError('invalid');
  if (payload.email_verified !== true) throw new GoogleAuthError('unverified');
  return { sub: payload.sub, email: payload.email, name: payload.name || '' };
}

/** Nombre para la cuenta nueva: el de Google (recortado) o, si no hay, la parte del correo antes de la @. */
export function googleDisplayName(name: string, email: string): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (clean.length >= 2) return clean;
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim().slice(0, 60);
  return local.length >= 2 ? local : 'Estilo Vivo';
}
