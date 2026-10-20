// Prueba LOCAL: lista de seguidores/seguidos, revisión automática de retos e informe de cierre de la app.
// Uso (servidor local arrancado): node scripts/test-followers-challenges.mjs <foto-real.jpg> <otra-foto.jpg>
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const photo = process.argv[2];
if (!photo) throw new Error('Uso: node scripts/test-followers-challenges.mjs <foto.jpg>');
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
const mk = (tag, extra = {}) => prisma.user.create({ data: { email: `fc-${run}-${tag}@example.test`, password: 'x', name: `FC ${tag}`, isVerified: true, birthDate: new Date('1995-01-01'), ...extra } });
const get = async (p, t) => { const r = await fetch(BASE + p, { headers: { Authorization: `Bearer ${t}` } }); return { status: r.status, body: await r.json().catch(() => null) }; };
const submit = async (t, challengeId, buf) => {
  const form = new FormData();
  form.append('challengeId', challengeId);
  form.append('description', 'Mi look para el reto de esta semana');
  form.append('image', new Blob([buf], { type: 'image/jpeg' }), 'reto.jpg');
  const r = await fetch(`${BASE}/api/challenges/submit`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form });
  return { status: r.status, body: await r.json().catch(() => null) };
};

try {
  // ── Seguidores
  const a = await mk('a'), b = await mk('b'), c = await mk('c'), priv = await mk('priv', { isProfilePublic: false });
  await prisma.follow.createMany({ data: [{ followerId: b.id, followingId: a.id }, { followerId: c.id, followingId: a.id }, { followerId: a.id, followingId: b.id }] });
  const f1 = await get(`/api/users/${a.id}/followers`, tok(a));
  assert.equal(f1.status, 200); assert.equal(f1.body.length, 2); ok('veo quién me sigue (2 personas)');
  assert.equal(f1.body.find((p) => p.id === b.id).isFollowing, true); assert.equal(f1.body.find((p) => p.id === c.id).isFollowing, false); ok('y si yo les sigo o no');
  const f2 = await get(`/api/users/${a.id}/following`, tok(a));
  assert.equal(f2.body.length, 1); assert.equal(f2.body[0].id, b.id); ok('veo a quién sigo');
  assert.equal((await get(`/api/users/${priv.id}/followers`, tok(a))).status, 403); ok('perfil privado: no se ve su lista si no lo sigues');
  await prisma.block.create({ data: { blockerId: a.id, blockedId: c.id } });
  assert.equal((await get(`/api/users/${a.id}/followers`, tok(a))).body.length, 1); ok('las personas bloqueadas no aparecen');

  // ── Retos
  await prisma.weeklyChallenge.updateMany({ data: { active: false } });
  const street = await prisma.weeklyChallenge.create({ data: { title: 'Street prueba', description: 'x', reward: 50, tag: 'Street', endDate: new Date(Date.now() + 864e5), active: true } });
  const real = await sharp(photo).resize({ width: 900 }).jpeg().toBuffer();
  const xpBefore = (await prisma.user.findUnique({ where: { id: b.id } })).experiencePoints;
  const s1 = await submit(tok(b), street.id, real);
  assert.equal(s1.status, 201, JSON.stringify(s1.body)); assert.equal(s1.body.status, 'VALID'); ok('foto real: el reto se acepta solo al momento');
  const xpAfter = (await prisma.user.findUnique({ where: { id: b.id } })).experiencePoints;
  assert.ok(xpAfter >= xpBefore + 50); ok('y se dan los puntos automáticamente');
  const s2 = await submit(tok(c), street.id, real);
  assert.equal(s2.status, 422); assert.match(s2.body.error, /ya se ha usado/); ok('la misma foto en otra cuenta se rechaza (foto repetida)');
  const tiny = await sharp({ create: { width: 120, height: 120, channels: 3, background: '#888' } }).jpeg().toBuffer();
  const s3 = await submit(tok(a), street.id, tiny);
  assert.equal(s3.status, 422); ok('una foto diminuta se rechaza con el motivo');
  assert.equal(await prisma.challengeSubmission.count({ where: { userId: a.id } }), 0); ok('si se rechaza, se puede volver a intentar (no se guarda)');
  const colorBlock = await prisma.weeklyChallenge.create({ data: { title: 'CB prueba', description: 'x', reward: 50, tag: 'Color Block', endDate: new Date(Date.now() + 864e5), active: true } });
  await prisma.weeklyChallenge.update({ where: { id: street.id }, data: { active: false } });
  const plain = await sharp(process.argv[3] || photo).resize({ width: 880 }).modulate({ saturation: 0 }).jpeg().toBuffer();
  const s4 = await submit(tok(a), colorBlock.id, plain);
  assert.equal(s4.status, 422); assert.match(s4.body.error, /3 colores/); ok('Color Block sin colores: se rechaza explicando por qué');

  // ── Informe de cierre de la app
  const crash = await fetch(`${BASE}/api/diagnostics/crash`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trace: 'java.lang.IllegalStateException: prueba\n\tat Prueba.kt:1', appVersion: '1.0.0 (1)', android: '15', device: 'Pixel prueba', at: new Date().toISOString() }) });
  assert.equal(crash.status, 200); ok('el informe de cierre se recibe');
  assert.equal((await fetch(`${BASE}/api/diagnostics/crash`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400); ok('sin traza se rechaza');

  console.log(`TODO OK: ${passed} comprobaciones`);
} finally {
  await prisma.user.deleteMany({ where: { email: { startsWith: `fc-${run}-` } } });
  await prisma.weeklyChallenge.deleteMany({ where: { title: { in: ['Street prueba', 'CB prueba'] } } });
  await prisma.$disconnect();
}
