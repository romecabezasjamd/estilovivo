// Pruebas LOCALES del push (FCM) sin Firebase: el servidor escribe cada envío en un fichero en vez de mandarlo.
// Uso (desde server/):
//   1) Arrancar el servidor local con:  PUSH_TEST_LOG=./logs/push-test.jsonl  (y NODE_ENV distinto de production)
//   2) node scripts/test-push.mjs        (usa el mismo .env; PUSH_TEST_LOG debe apuntar al mismo fichero)
// Crea usuarios de prueba (push-test-*@example.test) en la BD local.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const LOG = process.env.PUSH_TEST_LOG || './logs/push-test.jsonl';
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, token, init = {}) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const J = (o) => JSON.stringify(o);
const mkUser = (tag) => prisma.user.create({ data: { email: `push-test-${run}-${tag}@example.test`, password: 'x-not-a-real-hash', name: `Push ${tag}`, isVerified: true } });
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
const readLog = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
/** Espera a que aparezca en el registro un envío que cumpla [pred] (el push se envía en segundo plano). */
const waitPush = async (pred, label) => {
  for (let i = 0; i < 40; i++) {
    const hit = readLog().find(pred);
    if (hit) return hit;
    await sleep(100);
  }
  throw new Error(`No llegó el push: ${label}`);
};

try {
  console.log(`Servidor: ${BASE}  registro: ${LOG}`);
  const A = await mkUser('A'), B = await mkUser('B');
  const [tA, tB] = [tok(A), tok(B)];
  const tokenA = `fcm-${run}-A:APA91b_device_token_A`;
  const tokenA2 = `invalid-${run}-A2:APA91b_device_token`;

  // Registro: validación, autenticación y alta
  assert.equal((await api('/api/push/register', null, { method: 'POST', body: J({ token: tokenA }) })).status, 401);
  assert.equal((await api('/api/push/register', tA, { method: 'POST', body: J({ token: 'malo' }) })).status, 400);
  assert.equal((await api('/api/push/register', tA, { method: 'POST', body: J({ token: 'con espacios no vale nada' }) })).status, 400);
  const reg = await api('/api/push/register', tA, { method: 'POST', body: J({ token: tokenA, platform: 'android' }) });
  assert.equal(reg.status, 200);
  assert.equal(reg.body.enabled, true, 'el servidor debe estar arrancado con PUSH_TEST_LOG');
  assert.equal((await api('/api/push/register', tA, { method: 'POST', body: J({ token: tokenA }) })).status, 200); // idempotente
  assert.equal(await prisma.pushToken.count({ where: { token: tokenA } }), 1);
  ok('registro: 401 sin sesión, 400 con token inválido, alta idempotente');

  // Me gusta → push a A con tipo LIKE y relatedId del look
  const lookA = await prisma.look.create({ data: { title: `look-${run}`, isPublic: true, userId: A.id } });
  assert.equal((await api('/api/social/like', tB, { method: 'POST', body: J({ lookId: lookA.id }) })).status, 200);
  const like = await waitPush((e) => e.data.userId === A.id && e.data.type === 'LIKE', 'like');
  assert.deepEqual(like.tokens, [tokenA]);
  assert.equal(like.data.relatedId, lookA.id);
  const notifLike = await prisma.notification.findUnique({ where: { id: like.data.id } });
  assert.ok(notifLike && notifLike.userId === A.id, 'el id del push es el de la notificación guardada (deduplicación en la app)');
  Object.values(like.data).forEach((v) => assert.equal(typeof v, 'string'));
  ok('me gusta: push con id de la notificación, tipo y relatedId');

  // Comentario
  assert.equal((await api('/api/social/comment', tB, { method: 'POST', body: J({ lookId: lookA.id, content: 'qué bonito' }) })).status, 201);
  await waitPush((e) => e.data.userId === A.id && e.data.type === 'COMMENT', 'comment');
  ok('comentario: push');

  // Seguir
  const fol = await api('/api/social/follow', tB, { method: 'POST', body: J({ targetUserId: A.id }) });
  assert.ok([200, 201].includes(fol.status), `follow ${fol.status}`);
  await waitPush((e) => e.data.userId === A.id && e.data.type === 'FOLLOW', 'follow');
  ok('seguir: push');

  // Chat: conversación nueva con primer mensaje (antes no avisaba) y mensaje posterior
  const conv = await api('/api/chat/conversations', tB, { method: 'POST', body: J({ targetUserId: A.id, initialMessage: 'hola' }) });
  assert.equal(conv.status, 201);
  const first = await waitPush((e) => e.data.userId === A.id && e.data.type === 'CHAT' && e.data.relatedId === conv.body.id, 'primer mensaje');
  assert.match(first.data.content, /Push B te ha enviado un mensaje/);
  const before = readLog().filter((e) => e.data.type === 'CHAT' && e.data.relatedId === conv.body.id).length;
  assert.equal((await api(`/api/chat/conversations/${conv.body.id}/messages`, tB, { method: 'POST', body: J({ content: 'segundo' }) })).status, 201);
  for (let i = 0; i < 40 && readLog().filter((e) => e.data.type === 'CHAT' && e.data.relatedId === conv.body.id).length === before; i++) await sleep(100);
  assert.equal(readLog().filter((e) => e.data.type === 'CHAT' && e.data.relatedId === conv.body.id).length, before + 1);
  ok('chat: push en el primer mensaje y en los siguientes (relatedId = conversación)');

  // El emisor no recibe su propio push
  assert.equal(readLog().some((e) => e.data.userId === B.id), false);
  ok('el emisor no recibe push');

  // Token dado de baja en FCM: se borra solo tras el envío
  assert.equal((await api('/api/push/register', tA, { method: 'POST', body: J({ token: tokenA2 }) })).status, 200);
  await api('/api/social/like', tB, { method: 'POST', body: J({ lookId: lookA.id }) }); // quitar
  await api('/api/social/like', tB, { method: 'POST', body: J({ lookId: lookA.id }) }); // poner (nueva notificación)
  await waitPush((e) => e.tokens.includes(tokenA2), 'envío con token inválido');
  for (let i = 0; i < 40 && (await prisma.pushToken.count({ where: { token: tokenA2 } })) > 0; i++) await sleep(100);
  assert.equal(await prisma.pushToken.count({ where: { token: tokenA2 } }), 0);
  assert.equal(await prisma.pushToken.count({ where: { token: tokenA } }), 1);
  ok('tokens dados de baja en FCM se borran; los válidos se conservan');

  // Cambio de cuenta en el mismo móvil: el token pasa a B
  assert.equal((await api('/api/push/register', tB, { method: 'POST', body: J({ token: tokenA }) })).status, 200);
  assert.equal((await prisma.pushToken.findUnique({ where: { token: tokenA } })).userId, B.id);
  // A ya no puede anular un token que no es suyo
  assert.equal((await api('/api/push/register', tA, { method: 'DELETE', body: J({ token: tokenA }) })).body.removed, 0);
  assert.equal(await prisma.pushToken.count({ where: { token: tokenA } }), 1);
  ok('el token se reasigna al iniciar sesión otra cuenta; nadie borra tokens ajenos');

  // Cierre de sesión: DELETE anula el registro
  const del = await api('/api/push/register', tB, { method: 'DELETE', body: J({ token: tokenA }) });
  assert.equal(del.status, 200);
  assert.equal(del.body.removed, 1);
  assert.equal(await prisma.pushToken.count({ where: { token: tokenA } }), 0);
  ok('cierre de sesión: DELETE /api/push/register borra el token');

  // Borrar la cuenta borra sus tokens (cascade)
  await api('/api/push/register', tA, { method: 'POST', body: J({ token: tokenA }) });
  await prisma.user.delete({ where: { id: A.id } });
  assert.equal(await prisma.pushToken.count({ where: { token: tokenA } }), 0);
  ok('borrar la cuenta borra sus dispositivos');

  await prisma.user.delete({ where: { id: B.id } });
  console.log(`\n${passed} comprobaciones OK`);
} catch (e) {
  console.error('\nFALLO:', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
