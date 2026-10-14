// Prueba de integración de GET /api/social/likes/:lookId contra un servidor LOCAL ya arrancado.
// Uso (desde server/, con el mismo .env que el servidor):
//   npx tsx src/index.ts                     # terminal 1 (puerto 3000)
//   node scripts/test-likes-endpoint.mjs     # terminal 2 (BASE_URL=http://localhost:3000 por defecto)
// Crea usuarios/looks de PRUEBA (email likes-test-*@example.test) directamente en la BD local de DATABASE_URL.
// Se niega a ejecutarse si BASE_URL no es localhost/127.0.0.1.
import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
// Contraseña aleatoria solo para esta ejecución (los usuarios son de prueba y locales)
const PASS = 'Local-' + Math.random().toString(36).slice(2, 12);
const run = Date.now().toString(36);
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const api = async (path, token, init = {}) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const hash = await bcrypt.hash(PASS, 4);
const mkUser = (tag, extra = {}) => prisma.user.create({
  data: {
    email: `likes-test-${run}-${tag}@example.test`, password: hash, name: `Test ${tag}`, isVerified: true,
    avatar: tag.startsWith('av') ? `/api/uploads/${tag}.jpg` : null, ...extra,
  },
});
const login = async (u) => {
  const r = await api('/api/auth/login', null, { method: 'POST', body: JSON.stringify({ email: u.email, password: PASS }) });
  assert.equal(r.status, 200, `login ${u.email}: ${JSON.stringify(r.body)}`);
  return r.body.token;
};
const toggle = (token, lookId) => api('/api/social/like', token, { method: 'POST', body: JSON.stringify({ lookId }) });
const likes = (token, lookId, qs = '') => api(`/api/social/likes/${lookId}${qs}`, token);
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

try {
  console.log(`Servidor: ${BASE}`);
  const author = await mkUser('author');
  const viewer = await mkUser('viewer');
  const stranger = await mkUser('stranger');
  const tA = await login(author), tV = await login(viewer), tS = await login(stranger);
  const look = await prisma.look.create({ data: { title: 'look test', isPublic: true, userId: author.id } });

  // 1) vacío
  let r = await likes(tV, look.id);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { users: [], nextCursor: null });
  ok('look sin likes -> {users:[], nextCursor:null}');

  // 2) likes reales vía POST /like; orden más reciente primero; solo id/name/avatar
  const l1 = await mkUser('av1'), l2 = await mkUser('av2'), l3 = await mkUser('plain');
  for (const u of [l1, l2, l3]) {
    const t = await login(u);
    assert.equal((await toggle(t, look.id)).body.liked, true);
    await sleep(15);
  }
  r = await likes(tV, look.id);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.users.map((u) => u.id), [l3.id, l2.id, l1.id]);
  ok('orden createdAt desc (el último en dar like, primero)');
  assert.deepEqual(Object.keys(r.body.users[0]).sort(), ['avatar', 'id', 'name']);
  ok('solo id/name/avatar');
  assert.equal(r.body.users[1].avatar, '/api/uploads/av2.jpg');
  assert.equal(r.body.users[0].avatar, null);
  ok('avatar tal cual BD (ruta /api/uploads/.. o null; el cliente lo resuelve)');
  assert.equal(r.body.nextCursor, null);
  assert.ok(!JSON.stringify(r.body).includes('@example.test'));
  ok('no se filtra el email');

  // 3) like doble (toggle) no duplica; quitar like lo elimina de la lista
  const t1 = await login(l1);
  assert.equal((await toggle(t1, look.id)).body.liked, false);
  r = await likes(tV, look.id);
  assert.deepEqual(r.body.users.map((u) => u.id), [l3.id, l2.id]);
  ok('quitar like elimina al usuario de la lista');
  await sleep(15);
  assert.equal((await toggle(t1, look.id)).body.liked, true);
  r = await likes(tV, look.id);
  assert.deepEqual(r.body.users.map((u) => u.id), [l1.id, l3.id, l2.id]);
  assert.equal(new Set(r.body.users.map((u) => u.id)).size, 3);
  ok('volver a dar like: sin duplicados y aparece el primero');
  assert.equal(await prisma.like.count({ where: { lookId: look.id } }), 3);
  ok('BD: 3 filas Like (unique userId+lookId)');

  // 4) paginación: 35 likes sembrados en BD, con empates de createdAt a propósito
  const big = await prisma.look.create({ data: { title: 'look grande', isPublic: true, userId: author.id } });
  const base = Date.now() - 100000;
  const seeded = [];
  for (let i = 0; i < 35; i++) {
    const u = await mkUser(`bulk${i}`);
    // grupos de 3 con el mismo instante exacto
    await prisma.like.create({ data: { userId: u.id, lookId: big.id, createdAt: new Date(base + Math.floor(i / 3) * 1000) } });
    seeded.push(u.id);
  }
  const all = [], pages = [];
  let cursor = null;
  do {
    r = await likes(tV, big.id, `?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    assert.equal(r.status, 200);
    pages.push(r.body.users.length);
    all.push(...r.body.users.map((u) => u.id));
    cursor = r.body.nextCursor;
  } while (cursor);
  assert.deepEqual(pages, [10, 10, 10, 5]);
  ok('limit=10 sobre 35 likes -> páginas 10/10/10/5; la última con nextCursor null');
  assert.equal(new Set(all).size, 35);
  assert.deepEqual([...all].sort(), [...seeded].sort());
  ok('sin duplicados ni omisiones con cursor (incluidos empates de createdAt)');
  const dbOrder = (await prisma.like.findMany({ where: { lookId: big.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map((x) => x.userId);
  assert.deepEqual(all, dbOrder);
  ok('orden de la paginación == createdAt desc, id desc de la BD');
  r = await likes(tV, big.id);
  assert.equal(r.body.users.length, 30);
  assert.ok(r.body.nextCursor);
  ok('limit por defecto = 30 con nextCursor');
  r = await likes(tV, big.id, '?limit=35');
  assert.equal(r.body.users.length, 35);
  assert.equal(r.body.nextCursor, null);
  ok('limit == total -> nextCursor null (sin página vacía extra)');

  // 5) validación
  for (const qs of ['?limit=0', '?limit=51', '?limit=abc', '?limit=-1', '?limit=1.5', '?cursor=%25%25', '?cursor=bm9wZQ', '?limit=1&limit=2']) {
    r = await likes(tV, big.id, qs);
    assert.equal(r.status, 400, `${qs} -> ${r.status}`);
    assert.equal(r.body.error, 'Error de validación');
  }
  ok('limit 0/51/abc/-1/1.5/repetido y cursor inválido -> 400 {error:"Error de validación"}');
  r = await likes(tV, big.id, '?limit=50');
  assert.equal(r.status, 200);
  ok('limit=50 válido');

  // 6) 401 / 403 / 404
  r = await likes(null, look.id);
  assert.equal(r.status, 401);
  ok('sin token -> 401');
  r = await likes('token-falso', look.id);
  assert.equal(r.status, 403);
  ok('token inválido -> 403 (convención de authenticateToken)');
  r = await likes(tV, 'no-existe-123');
  assert.equal(r.status, 404);
  assert.deepEqual(r.body, { error: 'Look no encontrado' });
  ok('look inexistente -> 404');

  // 7) privacidad
  const priv = await mkUser('private', { isProfilePublic: false });
  const privLook = await prisma.look.create({ data: { title: 'privado', isPublic: true, userId: priv.id } });
  await prisma.like.create({ data: { userId: l1.id, lookId: privLook.id } });
  const tP = await login(priv);
  r = await likes(tS, privLook.id);
  assert.equal(r.status, 404);
  ok('autor con perfil privado, consulta sin seguirle -> 404');
  await prisma.followRequest.create({ data: { requesterId: viewer.id, targetId: priv.id, status: 'pending' } });
  r = await likes(tV, privLook.id);
  assert.equal(r.status, 404);
  ok('solicitud de seguimiento pendiente -> sigue 404');
  await prisma.follow.create({ data: { followerId: viewer.id, followingId: priv.id } });
  r = await likes(tV, privLook.id);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.users.map((u) => u.id), [l1.id]);
  ok('seguidor aceptado (fila Follow) -> 200');
  r = await likes(tP, privLook.id);
  assert.equal(r.status, 200);
  ok('el propio autor -> 200');
  const draft = await prisma.look.create({ data: { title: 'borrador', isPublic: false, userId: author.id } });
  r = await likes(tV, draft.id);
  assert.equal(r.status, 404);
  r = await likes(tA, draft.id);
  assert.equal(r.status, 200);
  ok('look no público: 404 a terceros, 200 al autor');

  // 8) cuentas eliminadas: el Like se borra en cascada
  await prisma.user.delete({ where: { id: l2.id } });
  r = await likes(tV, look.id);
  assert.deepEqual(r.body.users.map((u) => u.id), [l1.id, l3.id]);
  ok('usuario eliminado desaparece de la lista (onDelete: Cascade)');

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error(`\nFALLO tras ${passed} comprobaciones:`, e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
