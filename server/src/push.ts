// Push en tiempo real (Firebase Cloud Messaging) para la app Android.
//
// La credencial de la cuenta de servicio llega SOLO por variable de entorno (nunca en el repositorio):
//   FIREBASE_SERVICE_ACCOUNT          JSON completo de la cuenta de servicio, o
//   FIREBASE_SERVICE_ACCOUNT_BASE64   el mismo JSON en base64 (más cómodo en paneles como Coolify).
// Sin ninguna de las dos el push queda desactivado y todo lo demás funciona igual (la app sigue con su
// consulta periódica de respaldo).
//
// Solo en local (NODE_ENV distinto de production) se puede usar PUSH_TEST_LOG=<ruta.jsonl>: en lugar de enviar a
// Firebase, cada envío se escribe en ese fichero (lo usan los scripts de prueba).
import { appendFileSync } from 'fs';
import type { PrismaClient } from '@prisma/client';
import logger from './logger.js';

/** Lo que se envía por cada notificación: un mensaje solo de datos (la app pinta el aviso ella misma). */
export interface PushPayload {
  id: string;
  type: string;
  content: string;
  relatedId: string;
  createdAt: string;
  userId: string;
}

export interface PushNotificationLike {
  id: string;
  type: string;
  content?: string | null;
  relatedId?: string | null;
  createdAt: Date | string;
  userId: string;
}

/** Resultado por token: `invalid` = el token ya no existe en FCM y se debe borrar. */
export type PushResult = 'ok' | 'invalid' | 'error';

export type PushSender = (tokens: string[], data: PushPayload) => Promise<PushResult[]>;

const MAX_CONTENT = 500;
const MAX_TOKENS_PER_USER = 10;
const INVALID_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

let sender: PushSender | null = null;
let initialized = false;

/** Lee la credencial del entorno. Devuelve null si no hay o no es válida (sin registrar su contenido). */
export function readServiceAccount(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim()
    || (env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim()
      ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim(), 'base64').toString('utf8')
      : '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.project_id && parsed.client_email && parsed.private_key) return parsed;
  } catch { /* se informa abajo */ }
  logger.error('FIREBASE_SERVICE_ACCOUNT no es un JSON de cuenta de servicio válido: push desactivado');
  return null;
}

/** Prepara el envío. Idempotente; se llama al arrancar el servidor. */
export async function initPush(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (initialized) return sender !== null;
  initialized = true;

  const testLog = env.PUSH_TEST_LOG?.trim();
  if (testLog && env.NODE_ENV !== 'production') {
    sender = async (tokens, data) => {
      appendFileSync(testLog, JSON.stringify({ tokens, data }) + '\n');
      // Convención de prueba: los tokens que empiezan por "invalid-" se tratan como dados de baja en FCM
      return tokens.map((t) => (t.startsWith('invalid-') ? 'invalid' : 'ok'));
    };
    logger.warn(`Push en modo prueba: los envíos se escriben en ${testLog}`);
    return true;
  }

  const account = readServiceAccount(env);
  if (!account) {
    logger.warn('Push (FCM) desactivado: falta FIREBASE_SERVICE_ACCOUNT. La app usará su consulta periódica.');
    return false;
  }
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const fbApp = getApps()[0] ?? initializeApp({ credential: cert(account as any) });
    const messaging = getMessaging(fbApp);
    sender = async (tokens, data) => {
      const res = await messaging.sendEachForMulticast({
        tokens,
        data: data as unknown as Record<string, string>,
        android: { priority: 'high', ttl: 24 * 3600 * 1000 },
      });
      return res.responses.map((r) => {
        if (r.success) return 'ok';
        return INVALID_CODES.has(r.error?.code ?? '') ? 'invalid' : 'error';
      });
    };
    logger.info('Push (FCM) activo', { projectId: account.project_id });
    return true;
  } catch (error: any) {
    logger.error('No se pudo iniciar Firebase Admin: push desactivado', { error: error?.message });
    sender = null;
    return false;
  }
}

/** Para pruebas: sustituye el envío (null = desactivado). */
export function setPushSender(s: PushSender | null) {
  sender = s;
  initialized = true;
}

export function isPushEnabled() {
  return sender !== null;
}

export function toPayload(n: PushNotificationLike): PushPayload {
  return {
    id: n.id,
    type: n.type,
    content: (n.content ?? '').slice(0, MAX_CONTENT),
    relatedId: n.relatedId ?? '',
    createdAt: (n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt)).toISOString(),
    userId: n.userId,
  };
}

/** Formato de token de FCM: sin espacios ni caracteres raros, longitud razonable. */
export function isValidPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 20 && token.length <= 4096 && /^[A-Za-z0-9_:\-.]+$/.test(token);
}

/**
 * Envía la notificación como push a todos los dispositivos del destinatario. Nunca lanza: un fallo del push no
 * debe romper la acción que creó la notificación. Los tokens dados de baja en FCM se borran.
 */
export async function sendPushForNotification(prisma: PrismaClient, n: PushNotificationLike): Promise<void> {
  if (!sender) return;
  try {
    const rows = await prisma.pushToken.findMany({
      where: { userId: n.userId },
      select: { token: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_TOKENS_PER_USER,
    });
    if (rows.length === 0) return;
    const tokens = rows.map((r) => r.token);
    const results = await sender(tokens, toPayload(n));
    const invalid = tokens.filter((_, i) => results[i] === 'invalid');
    if (invalid.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
    }
    const failed = results.filter((r) => r === 'error').length;
    if (failed > 0) logger.warn('Push: algunos envíos fallaron', { failed, total: tokens.length, type: n.type });
  } catch (error: any) {
    logger.error('Push: error al enviar', { error: error?.message, type: n.type });
  }
}

/** Registra (o reasigna a este usuario) el token del dispositivo. Mantiene como mucho MAX_TOKENS_PER_USER. */
export async function registerPushToken(prisma: PrismaClient, userId: string, token: string, platform: string) {
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, userId, platform },
    update: { userId, platform },
  });
  const extra = await prisma.pushToken.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    skip: MAX_TOKENS_PER_USER,
    select: { id: true },
  });
  if (extra.length > 0) await prisma.pushToken.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
}

/** Anula el token, solo si pertenece a este usuario. Devuelve cuántos se borraron. */
export async function unregisterPushToken(prisma: PrismaClient, userId: string, token: string) {
  const res = await prisma.pushToken.deleteMany({ where: { token, userId } });
  return res.count;
}
