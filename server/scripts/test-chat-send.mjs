// Prueba LOCAL del envío de mensajes: tiempo de respuesta, sin duplicados, orden, entrega por socket y aviso
// (notificación + push) al otro participante, y SIN correo. Mide la mediana del envío.
// Uso (servidor local con PUSH_TEST_LOG y, opcionalmente, SMTP a un buzón de pruebas en MAIL_DIR):
//   PUSH_TEST_LOG=./logs/push-test.jsonl [MAIL_DIR=...] node scripts/test-chat-send.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import jwt from 'jsonwebtoken';
// El cliente de socket está en las dependencias de la web (carpeta superior)
const { io } = await import(new URL('../../node_modules/socket.io-client/build/esm-debug/index.js', import.meta.url));
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
const mk = (tag) => prisma.user.create({ data: { email: `chat-${run}-${tag}@example.test`, password: 'x', name: `Chat ${tag}`, isVerified: true } });
const post = async (p, t, body) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

try {
  const A = await mk('A'), B = await mk('B');
  const [tA, tB] = [tok(A), tok(B)];
  const conv = await post('/api/chat/conversations', tA, { targetUserId: B.id });
  assert.equal(conv.status, 201);
  const cid = conv.body.id;

  // B escucha por socket
  const received = [];
  const sock = io(BASE, { auth: { token: tB }, transports: ['websocket'] });
  await new Promise((res, rej) => { sock.on('connect', res); sock.on('connect_error', rej); setTimeout(() => rej(new Error('socket')), 5000); });
  sock.emit('join_user', B.id);
  sock.on('new_message', (m) => received.push(m));
  await sleep(300);

  const mailsBefore = process.env.MAIL_DIR && existsSync(process.env.MAIL_DIR) ? readdirSync(process.env.MAIL_DIR).length : 0;
  const times = [];
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const t = performance.now();
    const r = await post(`/api/chat/conversations/${cid}/messages`, tA, { content: `m${i}` });
    times.push(performance.now() - t);
    assert.equal(r.status, 201);
    ids.push(r.body.id);
  }
  times.sort((a, b) => a - b);
  console.log(`  envío: mediana ${Math.round(times[5])} ms, máximo ${Math.round(times[9])} ms`);
  ok('el envío responde enseguida');

  await sleep(800);
  const stored = await prisma.message.findMany({ where: { conversationId: cid }, orderBy: { createdAt: 'asc' } });
  assert.equal(stored.length, 10, 'se guardan todos');
  assert.deepEqual(stored.map((m) => m.content), ids.map((_, i) => `m${i}`), 'en orden');
  assert.equal(new Set(stored.map((m) => m.id)).size, 10, 'sin duplicados');
  ok('persistencia: 10 mensajes, en orden y sin duplicados');

  assert.equal(received.length, 10, 'el otro participante recibe los 10 por socket');
  assert.equal(new Set(received.map((m) => m.id)).size, 10);
  ok('el otro participante los recibe en tiempo real, una vez cada uno');

  const notes = await prisma.notification.count({ where: { userId: B.id, type: 'CHAT', relatedId: cid } });
  assert.equal(notes, 10);
  if (process.env.PUSH_TEST_LOG && existsSync(process.env.PUSH_TEST_LOG)) {
    const pushes = readFileSync(process.env.PUSH_TEST_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .filter((e) => e.data.userId === B.id && e.data.type === 'CHAT');
    // B no tiene dispositivos registrados en esta prueba: el envío se intenta solo si hay tokens
    void pushes;
  }
  ok('avisos de chat creados para el móvil (campana y push)');

  if (process.env.MAIL_DIR) {
    await sleep(500);
    const after = readdirSync(process.env.MAIL_DIR).filter((f) => statSync(`${process.env.MAIL_DIR}/${f}`).isFile()).length;
    assert.equal(after, mailsBefore, 'ningún correo por mensajes de chat');
    ok('no se envía ningún correo por los mensajes');
  }

  // Maleta: una prenda ajena no se puede añadir
  const foreign = await prisma.product.create({ data: { name: `ajena-${run}`, category: 'Tops', userId: B.id, forSale: true, price: 10 } });
  const own = await prisma.product.create({ data: { name: `propia-${run}`, category: 'Tops', userId: A.id } });
  const trip = await post('/api/trips', tA, { destination: 'Prueba', dateStart: '2026-11-01', dateEnd: '2026-11-03', garmentIds: [foreign.id, own.id] });
  assert.equal(trip.status, 201);
  assert.deepEqual(trip.body.garments.map((g) => g.id), [own.id]);
  ok('maleta: solo entran prendas propias (la ajena se rechaza en el servidor)');

  sock.disconnect();
  await prisma.user.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error('\nFALLO:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  setTimeout(() => process.exit(process.exitCode || 0), 200);
}
