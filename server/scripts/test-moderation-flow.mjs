// Prueba LOCAL del circuito de moderación: denuncia → enlace firmado → eliminar / descartar / suspender / reactivar.
// Uso (desde server/, con el servidor local arrancado con el mismo .env):  node scripts/test-moderation-flow.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
const mkUser = (tag) => prisma.user.create({ data: { email: `mod-test-${run}-${tag}@example.test`, password: 'x', name: `Mod ${tag}`, isVerified: true } });
const api = async (path, token, init = {}) => {
  const res = await fetch(BASE + path, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
// Misma firma que moderation.ts (secreto = JWT_SECRET + ':moderation')
const link = (reportId) => {
  const exp = Math.floor(Date.now() / 1000) + 30 * 86400;
  const s = crypto.createHmac('sha256', `${process.env.JWT_SECRET}:moderation`).update(`moderation:${reportId}:${exp}`).digest('base64url');
  return { url: `${BASE}/moderacion/${reportId}?e=${exp}&s=${encodeURIComponent(s)}`, e: String(exp), s };
};
const page = async (reportId, form) => {
  const l = link(reportId);
  const res = form
    ? await fetch(l.url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ e: l.e, s: l.s, ...form }) })
    : await fetch(l.url);
  return { status: res.status, html: await res.text(), csp: res.headers.get('content-security-policy') };
};
const reportOf = (reporter, type, id) => prisma.report.findFirst({ where: { reporterId: reporter, targetType: type, targetId: id }, orderBy: { createdAt: 'desc' } });

try {
  const A = await mkUser('A'), B = await mkUser('B');
  const [tA, tB] = [tok(A), tok(B)];
  const look = await prisma.look.create({ data: { title: `look-${run}`, isPublic: true, userId: B.id } });
  const comment = await prisma.comment.create({ data: { content: `insulto-${run}`, userId: B.id, lookId: look.id } });

  // Denuncia de un comentario
  assert.equal((await api('/api/reports', tA, { method: 'POST', body: JSON.stringify({ targetType: 'COMMENT', targetId: comment.id, reason: 'HARASSMENT', details: 'me insulta' }) })).status, 201);
  const r1 = await reportOf(A.id, 'COMMENT', comment.id);
  assert.ok(r1);

  // Enlace: sin firma o falsificado → 403; correcto → página con el contenido
  assert.equal((await fetch(`${BASE}/moderacion/${r1.id}`)).status, 403);
  assert.equal((await fetch(`${BASE}/moderacion/${r1.id}?e=9999999999&s=falsa`)).status, 403);
  let p = await page(r1.id);
  assert.equal(p.status, 200);
  assert.ok(p.html.includes(`insulto-${run}`) && p.html.includes('me insulta') && p.html.includes('Acoso o insultos'));
  assert.ok(p.csp.includes("default-src 'none'"));
  assert.ok(await prisma.comment.findUnique({ where: { id: comment.id } }), 'un GET no borra nada');
  ok('enlace firmado: sin firma 403, con firma muestra la denuncia; GET no ejecuta acciones');

  // Eliminar el contenido
  p = await page(r1.id, { action: 'remove' });
  assert.equal(p.status, 200);
  assert.equal(await prisma.comment.findUnique({ where: { id: comment.id } }), null);
  assert.equal((await prisma.report.findUnique({ where: { id: r1.id } })).status, 'REMOVED');
  ok('eliminar: borra el comentario y cierra la denuncia');

  // Descartar
  assert.equal((await api('/api/reports', tA, { method: 'POST', body: JSON.stringify({ targetType: 'LOOK', targetId: look.id, reason: 'SPAM' }) })).status, 201);
  const r2 = await reportOf(A.id, 'LOOK', look.id);
  p = await page(r2.id, { action: 'dismiss' });
  assert.equal((await prisma.report.findUnique({ where: { id: r2.id } })).status, 'DISMISSED');
  assert.ok(await prisma.look.findUnique({ where: { id: look.id } }));
  ok('descartar: cierra la denuncia sin tocar el contenido');

  // Suspender: sin confirmar no hace nada; confirmado bloquea la API, el login y el refresh
  assert.equal((await api('/api/reports', tA, { method: 'POST', body: JSON.stringify({ targetType: 'USER', targetId: B.id, reason: 'IMPERSONATION' }) })).status, 201);
  const r3 = await reportOf(A.id, 'USER', B.id);
  await page(r3.id, { action: 'suspend' });
  assert.equal((await prisma.user.findUnique({ where: { id: B.id } })).suspendedAt, null);
  await prisma.refreshToken.create({ data: { token: `rt-${run}`, userId: B.id, expiresAt: new Date(Date.now() + 86400e3) } });
  p = await page(r3.id, { action: 'suspend', confirm: '1' });
  assert.ok((await prisma.user.findUnique({ where: { id: B.id } })).suspendedAt);
  assert.equal((await prisma.report.findUnique({ where: { id: r3.id } })).status, 'SUSPENDED');
  assert.equal(await prisma.refreshToken.count({ where: { userId: B.id } }), 0);
  const me = await api('/api/auth/me', tB);
  assert.equal(me.status, 403);
  assert.equal(me.body.code, 'ACCOUNT_SUSPENDED');
  assert.equal((await api('/api/auth/me', tA)).status, 200, 'las demás cuentas siguen funcionando');
  ok('suspender: pide confirmación; luego la API responde 403 ACCOUNT_SUSPENDED y se borran sus sesiones');

  // Reactivar
  p = await page(r3.id, { action: 'unsuspend' });
  assert.equal((await prisma.user.findUnique({ where: { id: B.id } })).suspendedAt, null);
  assert.equal((await api('/api/auth/me', tB)).status, 200);
  ok('reactivar: la cuenta vuelve a funcionar al momento');

  // Páginas públicas
  const pol = await fetch(`${BASE}/privacidad`);
  const polHtml = await pol.text();
  assert.equal(pol.status, 200);
  assert.ok(polHtml.includes('Política de') && polHtml.includes('appestilovivo@gmail.com') && polHtml.includes('14 años'));
  assert.ok(!/<script/i.test(polHtml));
  assert.ok(!polHtml.includes('privacidad@estilovivo.com'));
  ok('/privacidad: pública, sin scripts, con el correo único y la edad mínima');

  await prisma.user.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  await prisma.report.deleteMany({ where: { reporterId: A.id } });
  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error('\nFALLO:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
