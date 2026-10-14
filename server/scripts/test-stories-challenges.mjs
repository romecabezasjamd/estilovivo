// Pruebas de integración LOCALES: reacciones a historias (storyId/storyThumb), retos (status/reason, Color Block),
// compatibilidad con clientes antiguos y tienda (/products, /products/shop).
// Uso (desde server/, servidor local ya arrancado con el mismo .env):  node scripts/test-stories-challenges.mjs
// Para la comprobación por socket: npm i --no-save socket.io-client@4  (si no está, esa prueba se omite y se avisa).
import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const PASS = 'Local-' + Math.random().toString(36).slice(2, 12);
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };

const api = async (path, token, init = {}) => {
  const isForm = init.body instanceof FormData;
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(isForm || !init.body ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const hash = await bcrypt.hash(PASS, 4);
const mkUser = (tag) => prisma.user.create({ data: { email: `sc-test-${run}-${tag}@example.test`, password: hash, name: `SC ${tag}`, isVerified: true } });
const login = async (u) => {
  const r = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: u.email, password: PASS }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.token;
};
const solid = (rgb) => sharp({ create: { width: 64, height: 64, channels: 3, background: rgb } }).jpeg().toBuffer();
const noisy = () => sharp(crypto.randomBytes(64 * 64 * 3), { raw: { width: 64, height: 64, channels: 3 } }).jpeg().toBuffer();
// Mitad negra / mitad blanca: varianza máxima (el umbral actual del servidor es muy permisivo; el ruido aleatorio aún cuenta como 'uniforme')
const contrast = () => { const b = Buffer.alloc(64 * 64 * 3); for (let i = 0; i < 64 * 64; i++) b.fill(i < 2048 ? 0 : 255, i * 3, i * 3 + 3); return sharp(b, { raw: { width: 64, height: 64, channels: 3 } }).jpeg({ quality: 100 }).toBuffer(); };
const form = (fields, files = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const [k, buf] of Object.entries(files)) f.append(k, new Blob([buf], { type: 'image/jpeg' }), `${k}.jpg`);
  return f;
};
const submit = async (token, challengeId, img) =>
  api('/api/challenges/submit', token, { method: 'POST', body: form({ challengeId, description: 'Descripción de prueba suficiente' }, { image: img }) });
const mkChallenge = (tag, past = false) => prisma.weeklyChallenge.create({
  data: {
    title: `Reto ${tag}`, description: 'x', reward: 50, tag, active: !past,
    startDate: new Date(Date.now() - (past ? 14 : 1) * 86400000), endDate: new Date(Date.now() + (past ? -7 : 3) * 86400000),
  },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let socket;
try {
  console.log(`Servidor: ${BASE}`);
  const author = await mkUser('author'), reactor = await mkUser('reactor');
  const tA = await login(author), tR = await login(reactor);

  // ---------- Reacciones a historias ----------
  const sImg = await api('/api/stories', tA, { method: 'POST', body: form({ type: 'image', text: 'pie' }, { image: await solid({ r: 200, g: 20, b: 90 }) }) });
  assert.equal(sImg.status, 201, JSON.stringify(sImg.body));
  const sTxt = await api('/api/stories', tA, { method: 'POST', body: form({ type: 'text', text: 'Hola solo texto' }) });
  assert.equal(sTxt.status, 201, JSON.stringify(sTxt.body));
  ok('historias creadas por API (foto y texto)');

  let io;
  try { ({ io } = await import('socket.io-client')); } catch {}
  let socketMsgs = [];
  if (io) {
    socket = io(BASE, { auth: { token: tA }, transports: ['websocket'] });
    await new Promise((res, rej) => { socket.on('connect', res); socket.on('connect_error', rej); setTimeout(() => rej(new Error('socket timeout')), 5000); });
    socket.on('new_message', (m) => socketMsgs.push(m));
  }

  let r = await api(`/api/stories/${sImg.body.id}/reaction`, tR, { method: 'POST', body: JSON.stringify({ emoji: '🔥' }) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const convId = r.body.conversationId;
  assert.equal(r.body.message.storyId, sImg.body.id);
  assert.equal(r.body.message.storyThumb, sImg.body.imageUrl);
  assert.ok(r.body.message.storyThumb.startsWith('/api/uploads/stories/'));
  ok('POST reaction (foto) -> message.storyId y storyThumb = imageUrl de la historia');

  r = await api(`/api/chat/conversations/${convId}/messages`, tA);
  const m = r.body.find((x) => x.storyId === sImg.body.id);
  assert.ok(m && m.storyThumb === sImg.body.imageUrl && m.sender.id === reactor.id);
  ok('el RECEPTOR ve storyId/storyThumb en GET .../messages');

  r = await api('/api/chat/conversations', tA);
  const conv = r.body.find((c) => c.id === convId);
  assert.equal(conv.messages[0].storyId, sImg.body.id);
  assert.equal(conv.messages[0].storyThumb, sImg.body.imageUrl);
  ok('el receptor ve storyId/storyThumb en el último mensaje de GET /chat/conversations');

  r = await api('/api/notifications', tA);
  const n = r.body.find((x) => x.type === 'STORY_REACTION');
  assert.equal(n.relatedId, convId);
  ok('Notification STORY_REACTION mantiene relatedId = conversationId');

  r = await api(`/api/stories/${sTxt.body.id}/reaction`, tR, { method: 'POST', body: JSON.stringify({ emoji: '❤️' }) });
  assert.equal(r.status, 201);
  assert.equal(r.body.message.storyId, sTxt.body.id);
  assert.equal(r.body.message.storyThumb, null);
  ok('historia solo texto -> storyId y storyThumb = null');

  r = await api(`/api/stories/${sImg.body.id}/reaction`, tA, { method: 'POST', body: JSON.stringify({ emoji: '🔥' }) });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { message: null, conversationId: null });
  ok('reaccionar a la propia historia sigue igual (200 {message:null, conversationId:null})');

  if (io) {
    await sleep(300);
    const sm = socketMsgs.filter((x) => x.storyId);
    assert.equal(sm.length, 2);
    assert.equal(sm.find((x) => x.storyId === sImg.body.id).storyThumb, sImg.body.imageUrl);
    assert.equal(sm.find((x) => x.storyId === sTxt.body.id).storyThumb, null);
    ok('evento socket new_message del receptor lleva storyId/storyThumb');
  } else console.log('  --  socket OMITIDO (socket.io-client no instalado)');

  // compatibilidad: mensaje normal conserva todos los campos antiguos; los nuevos son null (opcionales)
  r = await api(`/api/chat/conversations/${convId}/messages`, tR, { method: 'POST', body: JSON.stringify({ content: 'hola normal' }) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  for (const k of ['id', 'conversationId', 'senderId', 'content', 'imageUrl', 'productId', 'createdAt', 'sender']) assert.ok(k in r.body, `falta ${k}`);
  assert.equal(r.body.storyId, null);
  assert.equal(r.body.storyThumb, null);
  ok('compat: mensaje normal conserva campos antiguos; storyId/storyThumb = null');
  r = await api('/api/chat/messages', tR, { method: 'POST', body: JSON.stringify({ conversationId: convId, content: 'otra ruta' }) });
  assert.equal(r.status, 201);
  assert.equal(r.body.storyId, null);
  ok('compat: POST /chat/messages igual');

  // ---------- Retos ----------
  const cBlock = await mkChallenge('Color Block'), cMono = await mkChallenge('Monocromo'), cOther = await mkChallenge('Total Look');
  const u = {};
  for (const k of ['a', 'b', 'c', 'd']) { const x = await mkUser(`ch-${k}`); u[k] = { x, t: await login(x) }; }

  r = await submit(u.a.t, cBlock.id, await noisy());
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.status, 'PENDING');
  assert.equal(r.body.verified, true);
  assert.ok(r.body.reason && r.body.reason.length > 10);
  assert.equal(r.body.validationMessage, null);
  assert.equal(r.body.awarded, true);
  ok('Color Block con foto de muchos colores -> PENDING, verified=true, reason explicativa, sin validationMessage (ya NO exige color uniforme)');
  const colorBlockSubId = r.body.id;

  r = await submit(u.b.t, cMono.id, await contrast());
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'INVALID');
  assert.equal(r.body.verified, false);
  assert.match(r.body.reason, /uniforme/);
  assert.ok(r.body.validationMessage);
  ok('Monocromo con foto de contraste máximo (varianza alta) -> INVALID, verified=false, reason clara');

  r = await submit(u.c.t, cMono.id, await solid({ r: 30, g: 30, b: 120 }));
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'PENDING');
  assert.equal(r.body.verified, true);
  ok('Monocromo uniforme -> PENDING (verified=true; sin IA no se declara VALID)');

  r = await submit(u.d.t, cOther.id, await noisy());
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'PENDING');
  ok('reto sin criterio objetivo -> PENDING');

  r = await submit(u.a.t, cBlock.id, await noisy());
  assert.equal(r.status, 400);
  ok('segunda participación -> 400 (sin cambios)');

  r = await api('/api/challenges/my-submissions', u.a.t);
  const mine = r.body.find((s) => s.id === colorBlockSubId);
  assert.equal(mine.status, 'PENDING');
  assert.ok(mine.reason);
  for (const k of ['verified', 'awarded', 'imageUrl', 'description', 'createdAt', 'challenge']) assert.ok(k in mine);
  ok('my-submissions devuelve status/reason y conserva campos antiguos');

  const past = await mkChallenge('Monocromo', true);
  await prisma.challengeSubmission.create({ data: { userId: u.a.x.id, challengeId: past.id, imageUrl: '/api/uploads/x.jpg', description: 'histórica', verified: false, status: 'INVALID', reason: 'motivo de prueba', awarded: true } });
  r = await api('/api/challenges/history', u.a.t);
  const hs = r.body.challenges.find((c) => c.id === past.id).submissions[0];
  assert.equal(hs.status, 'INVALID');
  assert.equal(hs.reason, 'motivo de prueba');
  assert.equal(hs.verified, false);
  ok('history devuelve status/reason por participación');

  const xp = await prisma.user.findUnique({ where: { id: u.b.x.id }, select: { experiencePoints: true } });
  assert.ok(xp.experiencePoints >= 50);
  ok('XP sin cambios: se sigue concediendo también con INVALID (decisión pendiente, documentada)');

  // ---------- Tienda ----------
  const seller = await mkUser('seller'), buyer = await mkUser('buyer');
  const tS = await login(seller), tB = await login(buyer);
  const img = await solid({ r: 10, g: 150, b: 90 });
  const p1 = await api('/api/products', tS, { method: 'POST', body: form({ name: 'En venta', category: 'Tops', forSale: 'true', price: '19.5' }, { images: img }) });
  assert.ok([200, 201].includes(p1.status), JSON.stringify(p1.body));
  const p2 = await api('/api/products', tS, { method: 'POST', body: form({ name: 'No venta', category: 'Tops', forSale: 'false' }, { images: img }) });
  assert.ok([200, 201].includes(p2.status));
  r = await api('/api/products', tS);
  const names = r.body.items.map((p) => p.name);
  assert.ok(names.includes('En venta') && names.includes('No venta'));
  const own = r.body.items.find((p) => p.name === 'En venta');
  assert.equal(own.forSale, true);
  assert.equal(own.price, 19.5);
  assert.ok(own.images.length === 1);
  ok('GET /products devuelve las propias (forSale/price/imagen)');
  r = await api('/api/products/shop', tS);
  assert.ok(!r.body.some((p) => p.userId === seller.id));
  ok('GET /products/shop EXCLUYE las propias (por diseño, sin cambios)');
  r = await api('/api/products/shop', tB);
  assert.ok(r.body.some((p) => p.name === 'En venta') && !r.body.some((p) => p.name === 'No venta'));
  ok('GET /products/shop de otra usuaria ve las en venta (y no las que no)');

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error(`\nFALLO tras ${passed} comprobaciones:`, e);
  process.exitCode = 1;
} finally {
  socket?.close();
  await prisma.$disconnect();
}
