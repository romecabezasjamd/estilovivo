// Prueba de integración contra un servidor LOCAL ya arrancado (mismo patrón que test-likes-endpoint.mjs):
//  - GET /api/users/:id: para otra persona, lookCount solo cuenta looks públicos; para ti, todos.
//  - GET /eliminar-cuenta y /delete-account: página pública de borrado (Google Play), sin sesión.
// Uso (desde server/, con el .env local): npx tsx src/index.ts  y luego  node scripts/test-profile-and-pages.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const PASS = 'Local-' + Math.random().toString(36).slice(2, 12);
const run = Date.now().toString(36);
let passed = 0;
const ok = (name) => { passed++; console.log(`  ok  ${name}`); };

const api = async (path, token) => {
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const hash = await bcrypt.hash(PASS, 4);
const mkUser = (tag) => prisma.user.create({
  data: { email: `profile-test-${run}-${tag}@example.test`, password: hash, name: `Test ${tag}`, isVerified: true },
});
const login = async (u) => {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: PASS }),
  });
  assert.equal(res.status, 200, `login ${u.email}`);
  return (await res.json()).token;
};

try {
  console.log(`Servidor: ${BASE}`);
  const owner = await mkUser('owner');
  const viewer = await mkUser('viewer');
  const tO = await login(owner), tV = await login(viewer);
  await prisma.look.create({ data: { title: 'publico', isPublic: true, userId: owner.id } });
  await prisma.look.create({ data: { title: 'privado 1', isPublic: false, userId: owner.id } });
  await prisma.look.create({ data: { title: 'privado 2', isPublic: false, userId: owner.id } });

  let r = await api(`/api/users/${owner.id}`, tV);
  assert.equal(r.status, 200);
  assert.equal(r.body.lookCount, 1, 'otra persona solo cuenta los públicos');
  assert.equal(r.body.looks.length, 1);
  ok('perfil ajeno: lookCount (1) == looks públicos visibles (1), sin contar 2 privados');

  r = await api(`/api/users/${owner.id}`, tO);
  assert.equal(r.status, 200);
  assert.equal(r.body.lookCount, 3, 'el propio perfil cuenta todos');
  ok('perfil propio: lookCount cuenta también los privados (3)');

  for (const path of ['/eliminar-cuenta', '/delete-account']) {
    const res = await fetch(BASE + path);
    const html = await res.text();
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    assert.match(html, /Eliminar tu cuenta de Estilo Vivo/);
    assert.match(html, /mailto:/);
    assert.match(html, /<!--email_off-->.*mailto:.*<!--\/email_off-->/s, "correo protegido de la ofuscación de Cloudflare");
    assert.doesNotMatch(html, /<script/i, 'sin JavaScript');
    ok(`${path}: 200, HTML público sin sesión ni scripts`);
  }

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} finally {
  await prisma.$disconnect();
}
