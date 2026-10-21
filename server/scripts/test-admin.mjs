// Prueba LOCAL del panel de administración. Arranca el servidor local con ADMIN_EMAILS=admin-panel-test@example.test
// Uso (desde server/):  node scripts/test-admin.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
const ADMIN_EMAIL = 'admin-panel-test@example.test';
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
const panelTok = (u) => jwt.sign({ sub: u.id, scope: 'admin' }, `${process.env.JWT_SECRET}:admin-panel`, { expiresIn: '1h' });
const api = async (path, token, init = {}, adminToken) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
  });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const created = [];

try {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  const A = await prisma.user.create({ data: { email: ADMIN_EMAIL, password: 'x', name: 'Admin Panel', isVerified: true } });
  const B = await prisma.user.create({ data: { email: `adm-${run}-b@example.test`, password: 'x', name: `Usuaria B ${run}`, isVerified: true, birthDate: new Date('2010-01-01') } });
  const C = await prisma.user.create({ data: { email: `adm-${run}-c@example.test`, password: 'x', name: `Usuario C ${run}`, isVerified: true } });
  created.push(A.id, B.id, C.id);
  const [tA, tB, tC] = [tok(A), tok(B), tok(C)];
  const pA = panelTok(A);
  const adm = (path, init) => api(path, tA, init, pA);

  // Permisos
  assert.equal((await api('/api/auth/me', tA)).body.isAdmin, true);
  assert.equal((await api('/api/auth/me', tB)).body.isAdmin, false);
  assert.equal((await api('/api/admin/overview', tB)).body.code, 'NOT_ADMIN');
  assert.equal((await api('/api/admin/overview', tA)).body.code, 'ADMIN_2FA_REQUIRED');
  assert.equal((await api('/api/admin/overview', tB, {}, pA)).status, 403, 'el token del panel de otra cuenta no sirve');
  assert.equal((await api('/api/admin/overview', tA, {}, 'falso')).body.code, 'ADMIN_2FA_REQUIRED');
  ok('solo la cuenta de administración entra, y solo con el segundo paso');

  const start = await api('/api/admin/session/start', tA, { method: 'POST', body: '{}' });
  assert.equal(start.status, 200);
  assert.ok(start.body.email.includes('•'));
  assert.equal((await api('/api/admin/session/verify', tA, { method: 'POST', body: JSON.stringify({ code: '000000x' }) })).status, 400);
  assert.equal((await api('/api/admin/session/start', tB, { method: 'POST', body: '{}' })).status, 403);
  ok('código por correo: se pide, uno incorrecto se rechaza, otra cuenta no puede pedirlo');

  const ov = await adm('/api/admin/overview');
  assert.equal(ov.status, 200);
  assert.ok(ov.body.users >= 3);
  ok('resumen del panel');

  // Denuncias
  const look = await prisma.look.create({ data: { title: `look-${run}`, isPublic: true, userId: C.id } });
  const rep = await prisma.report.create({ data: { reporterId: B.id, targetType: 'LOOK', targetId: look.id, reason: 'INAPPROPRIATE', details: 'no es ropa' } });
  let reports = await adm('/api/admin/reports');
  const item = reports.body.find((x) => x.id === rep.id);
  assert.ok(item && item.contentText.includes(`look-${run}`) && item.ownerName === C.name && item.reasonLabel === 'Contenido inapropiado');
  let r = await adm(`/api/admin/reports/${rep.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'remove' }) });
  assert.equal(r.status, 200);
  assert.equal(await prisma.look.findUnique({ where: { id: look.id } }), null);
  assert.equal((await prisma.report.findUnique({ where: { id: rep.id } })).status, 'REMOVED');
  await new Promise((s) => setTimeout(s, 300));
  const notif = await prisma.notification.findFirst({ where: { userId: C.id, type: 'MODERATION' } });
  assert.ok(notif && notif.content.includes('Contenido inapropiado'));
  ok('denuncia: se ve el contenido, se elimina y el autor recibe el motivo');

  // Usuarios
  const found = await adm(`/api/admin/users?q=${encodeURIComponent(run)}`);
  assert.equal(found.body.length, 2);
  const detB = await adm(`/api/admin/users/${B.id}`);
  assert.equal(detB.body.ageBand, 'Menor (14-17)');
  assert.equal(detB.body.password, undefined);
  assert.equal(detB.body.birthDate, undefined);
  ok('usuarios: búsqueda y ficha sin contraseña ni fecha de nacimiento');

  assert.equal((await adm(`/api/admin/users/${B.id}/suspend`, { method: 'POST', body: '{}' })).status, 400, 'sin motivo no');
  assert.equal((await adm(`/api/admin/users/${A.id}/suspend`, { method: 'POST', body: JSON.stringify({ reason: 'prueba' }) })).status, 400, 'a sí misma no');
  assert.equal((await adm(`/api/admin/users/${B.id}/suspend`, { method: 'POST', body: JSON.stringify({ reason: 'Acoso a otras cuentas' }) })).status, 200);
  assert.equal((await api('/api/auth/me', tB)).body.code, 'ACCOUNT_SUSPENDED');
  assert.equal((await adm(`/api/admin/users/${B.id}/unsuspend`, { method: 'POST', body: '{}' })).status, 200);
  assert.equal((await api('/api/auth/me', tB)).status, 200);
  ok('suspender (con motivo, nunca a la administración) y reactivar');

  // Tienda
  const prod = await prisma.product.create({ data: { name: `Bolso falso ${run}`, category: 'bags', forSale: true, price: 10, userId: C.id } });
  const prods = await adm(`/api/admin/products?q=${encodeURIComponent(run)}`);
  assert.equal(prods.body.length, 1);
  assert.equal((await adm(`/api/admin/products/${prod.id}/remove`, { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await adm(`/api/admin/products/${prod.id}/remove`, { method: 'POST', body: JSON.stringify({ reason: 'Imitación de marca' }) })).status, 200);
  assert.equal(await prisma.product.findUnique({ where: { id: prod.id } }), null);
  ok('tienda: retirar un anuncio con motivo');

  // Retos
  const before = await prisma.weeklyChallenge.findFirst({ where: { active: true } });
  const end = new Date(Date.now() + 5 * 86400000).toISOString();
  assert.equal((await adm('/api/admin/challenges', { method: 'POST', body: JSON.stringify({ title: 'X', description: 'corta', tag: 'a', endDate: end }) })).status, 400);
  const ch = await adm('/api/admin/challenges', { method: 'POST', body: JSON.stringify({ title: `Reto ${run}`, description: 'Un look todo en tonos tierra', tag: 'Tierra', reward: 80, endDate: end }) });
  assert.equal(ch.status, 201);
  assert.equal(await prisma.weeklyChallenge.count({ where: { active: true } }), 1);
  assert.equal((await adm(`/api/admin/challenges/${ch.body.id}`, { method: 'PUT', body: JSON.stringify({ reward: 120 }) })).body.reward, 120);
  await prisma.user.update({ where: { id: C.id }, data: { experiencePoints: 500 } });
  const sub = await prisma.challengeSubmission.create({ data: { userId: C.id, challengeId: ch.body.id, imageUrl: '/api/uploads/x.jpg', status: 'VALID', verified: true, awarded: true } });
  assert.equal((await adm(`/api/admin/challenges/${ch.body.id}/submissions`)).body.length, 1);
  assert.equal((await adm(`/api/admin/submissions/${sub.id}/invalidate`, { method: 'POST', body: JSON.stringify({ reason: 'La foto no es tuya' }) })).status, 200);
  assert.equal((await prisma.challengeSubmission.findUnique({ where: { id: sub.id } })).status, 'INVALID');
  assert.equal((await prisma.user.findUnique({ where: { id: C.id } })).experiencePoints, 380);
  await prisma.weeklyChallenge.delete({ where: { id: ch.body.id } });
  if (before) await prisma.weeklyChallenge.update({ where: { id: before.id }, data: { active: true } });
  ok('retos: crear, cambiar y anular una participación quitando sus puntos');

  // Errores
  const trace = `TypeError: prueba ${run}\n    at x (a.js:1:1)`;
  for (let i = 0; i < 2; i++) await api('/api/diagnostics/crash', tC, { method: 'POST', body: JSON.stringify({ trace, appVersion: '1.0' }) });
  const crashes = await adm('/api/admin/crashes');
  const g = crashes.body.find((x) => x.title === `TypeError: prueba ${run}`);
  assert.ok(g && g.count === 2);
  await adm(`/api/admin/crashes/${g.signature}/resolve`, { method: 'POST', body: '{}' });
  assert.equal((await adm('/api/admin/crashes')).body.find((x) => x.signature === g.signature), undefined);
  ok('avisos de errores agrupados y marcar como arreglado');

  // Fotos bloqueadas
  for (let i = 0; i < 3; i++) await prisma.blockedUpload.create({ data: { userId: C.id, route: '/api/looks', score: 0.8 } });
  const bl = await adm('/api/admin/blocked-uploads');
  assert.ok(bl.body.items.some((x) => x.userId === C.id && x.where === 'Publicación'));
  assert.ok(bl.body.repeatOffenders.some((x) => x.userId === C.id && x.count >= 3));
  ok('fotos bloqueadas (sin la foto) y cuentas que lo repiten');

  // Estadísticas y aviso general
  const st = await adm('/api/admin/stats');
  assert.equal(st.body.weeks.length, 8);
  assert.ok(st.body.series.users[7] >= 3);
  assert.equal((await adm('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ message: 'x' }) })).status, 400);
  const bc = await adm('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ message: `Mantenimiento esta noche ${run}` }) });
  assert.equal(bc.status, 200);
  assert.ok(await prisma.notification.findFirst({ where: { userId: B.id, type: 'ANNOUNCEMENT', content: { contains: run } } }));
  assert.equal((await adm('/api/admin/broadcast', { method: 'POST', body: JSON.stringify({ message: 'Otro aviso seguido' }) })).status, 429);
  await prisma.notification.deleteMany({ where: { type: 'ANNOUNCEMENT', content: { contains: run } } });
  ok('estadísticas por semana y aviso a todos (con límite)');

  // Privacidad
  assert.equal((await api('/api/privacy-requests', tB, { method: 'POST', body: JSON.stringify({ type: 'NOPE', message: 'quiero mis datos ya' }) })).status, 400);
  const pr = await api('/api/privacy-requests', tB, { method: 'POST', body: JSON.stringify({ type: 'ACCESS', message: 'Quiero saber qué datos tenéis' }) });
  assert.equal(pr.status, 201);
  const list = await adm('/api/admin/privacy-requests');
  const req = list.body.find((x) => x.id === pr.body.id);
  assert.ok(req && req.typeLabel === 'Acceso a mis datos' && new Date(req.dueAt) > new Date());
  assert.equal((await adm(`/api/admin/privacy-requests/${req.id}/resolve`, { method: 'POST', body: JSON.stringify({ response: 'Te adjuntamos tus datos en la app: Ajustes > Descargar mis datos.' }) })).status, 200);
  const mine = await api('/api/privacy-requests/mine', tB);
  assert.equal(mine.body[0].status, 'DONE');
  ok('solicitudes de privacidad: la persona la envía, se responde y ve la respuesta');

  // Registro
  const logRows = await adm('/api/admin/log');
  const actions = logRows.body.filter((x) => x.adminId === A.id).map((x) => x.action);
  for (const a of ['REPORT_REMOVE', 'USER_SUSPEND', 'USER_UNSUSPEND', 'PRODUCT_REMOVE', 'CHALLENGE_CREATE', 'SUBMISSION_INVALIDATE', 'BROADCAST', 'PRIVACY_DONE']) assert.ok(actions.includes(a), a);
  ok('cada acción queda registrada');

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} finally {
  await prisma.privacyRequest.deleteMany({ where: { userId: { in: created } } });
  await prisma.blockedUpload.deleteMany({ where: { userId: { in: created } } });
  await prisma.adminAction.deleteMany({ where: { adminId: { in: created } } });
  await prisma.report.deleteMany({ where: { reporterId: { in: created } } });
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
}
