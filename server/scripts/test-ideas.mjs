// Prueba LOCAL de "Ideas con esta prenda" y del tablero de Tendencias: combinaciones con el propio armario,
// inspiración de la comunidad sin menores, y opción "No mostrar mis looks en Tendencias".
// Uso (desde server/, servidor local arrancado):  node scripts/test-ideas.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
const api = async (path, token, init = {}) => {
  const res = await fetch(BASE + path, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const created = [];
const mk = async (tag, birth, extra = {}) => {
  const u = await prisma.user.create({ data: { email: `ideas-${run}-${tag}@example.test`, password: 'x', name: `Ideas ${tag} ${run}`, isVerified: true, birthDate: birth, isProfilePublic: true, ...extra } });
  created.push(u.id);
  return u;
};
const publicLook = async (u, title) => {
  const p = await prisma.product.create({ data: { name: `Jersey ${title}`, category: 'top', color: 'burdeos', userId: u.id } });
  return prisma.look.create({ data: { title, isPublic: true, userId: u.id, products: { connect: [{ id: p.id }] }, images: { create: [{ url: '/api/uploads/x.jpg', filename: 'x.jpg' }] } } });
};

try {
  const U = await mk('yo', new Date('1990-01-01'));
  const Adult = await mk('adulta', new Date('1992-01-01'));
  const Minor = await mk('menor', new Date(new Date().getFullYear() - 15, 0, 1));
  const Hidden = await mk('oculta', new Date('1988-01-01'), { hideFromTrends: true });
  const Dummy = await mk('bloq', new Date('1990-01-01'));
  await prisma.block.create({ data: { blockerId: U.id, blockedId: Dummy.id } }); // así no se usa la caché del tablero
  const tU = tok(U);

  // Mi armario
  const top = await prisma.product.create({ data: { name: 'Jersey burdeos', category: 'top', color: 'burdeos', userId: U.id } });
  const jeans = await prisma.product.create({ data: { name: 'Vaqueros rectos', category: 'bottom', color: 'vaquero', userId: U.id } });
  await prisma.product.create({ data: { name: 'Falda en lavadora', category: 'bottom', color: 'negro', isWashing: true, userId: U.id } });

  const r = await api(`/api/ideas/garment/${top.id}`, tU);
  assert.equal(r.status, 200);
  const first = r.body.ideas[0];
  assert.equal(first.pieces[0].id, top.id);
  assert.ok(first.pieces.some((p) => p.kind === 'own' && p.id === jeans.id), 'usa los vaqueros del armario');
  assert.ok(!JSON.stringify(r.body).includes('Falda en lavadora'), 'no usa prendas que están en la lavadora');
  const drawnShoes = first.pieces.find((p) => p.slot === 'shoes');
  assert.equal(drawnShoes.kind, 'drawn');
  assert.match(drawnShoes.color, /^#[0-9A-F]{6}$/i);
  ok('combina con mi armario (sin lo que está en la lavadora) y dibuja los zapatos que faltan');

  assert.equal((await api(`/api/ideas/garment/${top.id}`, tok(Adult))).status, 404);
  ok('nadie más puede pedir ideas con mi prenda');

  // Inspiración de la comunidad: adultas sí, menores no
  await publicLook(Adult, `Look adulta ${run}`);
  await publicLook(Minor, `Look menor ${run}`);
  await publicLook(Hidden, `Look oculta ${run}`);
  const insp = (await api(`/api/ideas/garment/${top.id}`, tU)).body.community.map((l) => l.title);
  assert.ok(insp.includes(`Look adulta ${run}`));
  assert.ok(!insp.includes(`Look menor ${run}`));
  ok('la inspiración de la comunidad muestra looks parecidos de adultas y nunca de menores');

  // Tablero: sin menores ni quien pidió no aparecer
  const t = await api('/api/trends/community', tU);
  const titles = t.body.topLooks.map((l) => l.title);
  assert.ok(titles.includes(`Look adulta ${run}`));
  assert.ok(!titles.includes(`Look menor ${run}`));
  assert.ok(!titles.includes(`Look oculta ${run}`));
  assert.ok(Array.isArray(t.body.keywords));
  assert.ok(t.body.star && t.body.star.category);
  ok('el tablero no incluye a menores ni a quien eligió no aparecer; trae palabras y prenda estrella');

  // La opción de no aparecer
  assert.equal((await api('/api/auth/preferences', tU, { method: 'PUT', body: JSON.stringify({ hideFromTrends: true }) })).status, 200);
  assert.equal((await api('/api/auth/me', tU)).body.hideFromTrends, true);
  ok('cada persona puede elegir no mostrar sus looks en Tendencias');

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} finally {
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
}
