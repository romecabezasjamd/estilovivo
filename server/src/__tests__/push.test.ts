import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidPushToken,
  readServiceAccount,
  sendPushForNotification,
  setPushSender,
  toPayload,
  type PushSender,
} from '../push.js';

const notif = {
  id: 'n1',
  type: 'CHAT',
  content: 'Ana te ha enviado un mensaje',
  relatedId: 'conv1',
  createdAt: new Date('2026-10-15T10:00:00.000Z'),
  userId: 'u1',
};

const fakePrisma = (tokens: string[]) => {
  const deleted: string[][] = [];
  const prisma: any = {
    pushToken: {
      findMany: vi.fn(async () => tokens.map((token) => ({ token }))),
      deleteMany: vi.fn(async ({ where }: any) => { deleted.push(where.token.in); return { count: where.token.in.length }; }),
    },
  };
  return { prisma, deleted };
};

describe('push: payload y validación', () => {
  it('convierte la notificación a datos de texto (FCM solo admite strings)', () => {
    const p = toPayload({ ...notif, relatedId: null, content: null });
    expect(p).toEqual({ id: 'n1', type: 'CHAT', content: '', relatedId: '', createdAt: '2026-10-15T10:00:00.000Z', userId: 'u1' });
    Object.values(p).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('recorta contenidos largos', () => {
    expect(toPayload({ ...notif, content: 'x'.repeat(2000) }).content).toHaveLength(500);
  });

  it('acepta tokens de FCM y rechaza basura', () => {
    expect(isValidPushToken('fGx1:APA91bHkZ_abc-def.123456789')).toBe(true);
    expect(isValidPushToken('corto')).toBe(false);
    expect(isValidPushToken('con espacios y más de veinte caracteres')).toBe(false);
    expect(isValidPushToken('<script>alert(1)</script>xxxxxxxxxx')).toBe(false);
    expect(isValidPushToken(123)).toBe(false);
    expect(isValidPushToken('a'.repeat(5000))).toBe(false);
  });
});

describe('push: credencial por entorno', () => {
  const account = { project_id: 'p', client_email: 'x@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\n' };

  it('sin variable: desactivado', () => {
    expect(readServiceAccount({})).toBeNull();
  });

  it('lee JSON directo o en base64', () => {
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account) })?.project_id).toBe('p');
    const b64 = Buffer.from(JSON.stringify(account)).toString('base64');
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT_BASE64: b64 })?.project_id).toBe('p');
  });

  it('JSON inválido o incompleto: desactivado', () => {
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: '{no es json' })).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'p' }) })).toBeNull();
  });
});

describe('push: envío', () => {
  beforeEach(() => setPushSender(null));

  it('desactivado: no consulta la BD', async () => {
    const { prisma } = fakePrisma(['tok-aaaaaaaaaaaaaaaaaaaa']);
    await sendPushForNotification(prisma, notif);
    expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
  });

  it('envía a todos los dispositivos del destinatario y borra los tokens dados de baja', async () => {
    const sender = vi.fn<PushSender>(async (tokens) => tokens.map((t) => (t === 'b' ? 'invalid' : t === 'c' ? 'error' : 'ok')));
    setPushSender(sender);
    const { prisma, deleted } = fakePrisma(['a', 'b', 'c']);
    await sendPushForNotification(prisma, notif);
    expect(prisma.pushToken.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    expect(sender).toHaveBeenCalledWith(['a', 'b', 'c'], expect.objectContaining({ id: 'n1', type: 'CHAT', relatedId: 'conv1' }));
    expect(deleted).toEqual([['b']]); // un error transitorio ('c') no borra el token
  });

  it('sin dispositivos no envía nada', async () => {
    const sender = vi.fn<PushSender>(async () => []);
    setPushSender(sender);
    const { prisma } = fakePrisma([]);
    await sendPushForNotification(prisma, notif);
    expect(sender).not.toHaveBeenCalled();
  });

  it('un fallo del envío nunca se propaga', async () => {
    setPushSender(async () => { throw new Error('FCM caído'); });
    const { prisma } = fakePrisma(['a']);
    await expect(sendPushForNotification(prisma, notif)).resolves.toBeUndefined();
  });
});
