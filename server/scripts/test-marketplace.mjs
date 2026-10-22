// Prueba LOCAL de las reglas de compraventa: declaración de particular, precio, sin límite en la beta,
// menores sin autorización y denuncias de anuncios (se retiran de la venta sin borrar la prenda del armario).
// Uso (desde server/, servidor local arrancado con ADMIN_EMAILS=admin-panel-test@example.test):  node scripts/test-marketplace.mjs
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
const api = async (path, token, init = {}, adminToken) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
  });
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const product = (t, data) => api('/api/products', t, { method: 'POST', body: JSON.stringify({ name: `Prenda ${run}`, category: 'top', ...data }) });
const created = [];

try {
  const mk = (tag, extra = {}) => prisma.user.create({ data: { email: `mkt-${run}-${tag}@example.test`, password: 'x', name: `Mkt ${tag}`, isVerified: true, birthDate: new Date('1995-01-01'), ...extra } });
  const S = await mk('seller'), B = await mk('buyer'), M = await mk('minor', { birthDate: new Date('2010-05-01') });
  created.push(S.id, B.id, M.id);
  const [tS, tB, tM] = [tok(S), tok(B), tok(M)];

  // Declaración de particular
  let r = await product(tS, { forSale: true, price: 20 });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'SELLER_DECLARATION_REQUIRED');
  assert.equal((await api('/api/auth/me', tS)).body.sellerDeclared, false);
  assert.equal((await api('/api/marketplace/seller-declaration', tS, { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await api('/api/marketplace/seller-declaration', tS, { method: 'POST', body: JSON.stringify({ particular: true }) })).status, 200);
  assert.equal((await api('/api/auth/me', tS)).body.sellerDeclared, true);
  ok('para vender hay que declarar una vez que se vende como particular');

  // Precio
  assert.equal((await product(tS, { forSale: true })).body.code, 'INVALID_PRICE');
  assert.equal((await product(tS, { forSale: true, price: 20000 })).body.code, 'INVALID_PRICE');
  assert.equal((await product(tS, { forSale: true, price: -3 })).status, 400);
  r = await product(tS, { forSale: true, price: '12,50' });
  assert.equal(r.status, 201);
  ok('precio obligatorio entre 0 y 10.000 € (acepta la coma decimal)');

  // Una prenda del armario (no a la venta) se crea sin declaración ni precio
  const tB2 = tB;
  assert.equal((await product(tB2, {})).status, 201);
  ok('las prendas del armario no piden declaración ni precio');

  // Sin límite de anuncios en la beta
  for (let i = 0; i < 5; i++) assert.equal((await product(tS, { forSale: true, price: 5 + i })).status, 201);
  assert.equal(await prisma.product.count({ where: { userId: S.id, forSale: true } }), 6);
  ok('sin límite de anuncios durante la beta (como dice la app)');

  // Editar: poner a la venta una prenda existente pide precio válido
  const wardrobe = await prisma.product.create({ data: { name: 'Falda', category: 'bottom', userId: S.id } });
  assert.equal((await api(`/api/products/${wardrobe.id}`, tS, { method: 'PUT', body: JSON.stringify({ name: 'Falda', category: 'bottom', forSale: true }) })).body.code, 'INVALID_PRICE');
  assert.equal((await api(`/api/products/${wardrobe.id}`, tS, { method: 'PUT', body: JSON.stringify({ name: 'Falda', category: 'bottom', forSale: true, price: 15 }) })).status, 200);
  assert.equal((await api(`/api/products/${wardrobe.id}`, tS, { method: 'PUT', body: JSON.stringify({ name: 'Falda', category: 'bottom', price: 99999 }) })).body.code, 'INVALID_PRICE');
  ok('al editar también se exige precio válido');

  // Menor sin adulto responsable
  await api('/api/marketplace/seller-declaration', tM, { method: 'POST', body: JSON.stringify({ particular: true }) });
  r = await product(tM, { forSale: true, price: 10 });
  assert.equal(r.status, 403);
  assert.notEqual(r.body.code, 'SELLER_DECLARATION_REQUIRED');
  ok('menores sin autorización de su adulto no pueden vender');

  // Denunciar un anuncio
  const listing = await prisma.product.findFirst({ where: { userId: S.id, forSale: true } });
  assert.equal((await api('/api/reports', tB, { method: 'POST', body: JSON.stringify({ targetType: 'PRODUCT', targetId: listing.id, reason: 'ILLEGAL_ITEM', details: 'Parece falsificado' }) })).status, 201);
  assert.equal((await api('/api/reports', tB, { method: 'POST', body: JSON.stringify({ targetType: 'PRODUCT', targetId: wardrobe.id + 'x', reason: 'SCAM' }) })).status, 404);
  assert.equal((await api('/api/reports', tS, { method: 'POST', body: JSON.stringify({ targetType: 'PRODUCT', targetId: listing.id, reason: 'SCAM' }) })).status, 400, 'no a uno mismo');
  ok('se puede denunciar un anuncio (no uno inexistente ni el propio)');

  // La administración lo retira: deja de estar a la venta, pero la prenda sigue en el armario
  const admin = await prisma.user.upsert({ where: { email: 'admin-panel-test@example.test' }, update: {}, create: { email: 'admin-panel-test@example.test', password: 'x', name: 'Admin', isVerified: true } });
  const pA = jwt.sign({ sub: admin.id, scope: 'admin' }, `${process.env.JWT_SECRET}:admin-panel`, { expiresIn: '1h' });
  const rep = await prisma.report.findFirst({ where: { targetType: 'PRODUCT', targetId: listing.id }, orderBy: { createdAt: 'desc' } });
  const reports = await api('/api/admin/reports', tok(admin), {}, pA);
  const item = reports.body.find((x) => x.id === rep.id);
  assert.ok(item && item.targetLabel === 'Anuncio de la tienda' && item.reasonLabel === 'Falsificación o producto prohibido' && item.contentText.includes(listing.name));
  assert.equal((await api(`/api/admin/reports/${rep.id}/action`, tok(admin), { method: 'POST', body: JSON.stringify({ action: 'remove' }) }, pA)).status, 200);
  const after = await prisma.product.findUnique({ where: { id: listing.id } });
  assert.ok(after && after.forSale === false, 'la prenda sigue existiendo, ya no a la venta');
  await new Promise((s) => setTimeout(s, 300));
  assert.ok(await prisma.notification.findFirst({ where: { userId: S.id, type: 'MODERATION' } }));
  ok('al retirar un anuncio deja de estar a la venta, la prenda sigue en su armario y se avisa al vendedor');

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} finally {
  await prisma.report.deleteMany({ where: { reporterId: { in: created } } });
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
}
