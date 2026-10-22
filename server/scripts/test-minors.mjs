// Prueba LOCAL de la protección de menores y del bloqueo de fotos íntimas.
// Uso (servidor local arrancado; para probar el bloqueo de fotos, con NSFW_THRESHOLD bajo, p. ej. 0.05):
//   node scripts/test-minors.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const yearsAgo = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setDate(d.getDate() - 2); return d.toISOString().slice(0, 10); };
const mk = (tag, birth) => prisma.user.create({ data: { email: `minor-${run}-${tag}@example.test`, password: 'x', name: `Menores ${tag}`, isVerified: true, birthDate: birth ? new Date(birth) : null } });
const call = async (method, p, t, body) => {
  const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const post = (p, t, b) => call('POST', p, t, b);

try {
  // --- Registro: fecha obligatoria y edad mínima 14 ---
  const reg = (b) => post('/api/auth/register', null, { email: `minor-${run}-${Math.random().toString(36).slice(2)}@example.test`, password: 'password123', name: 'Registro', ...b });
  assert.equal((await reg({})).status, 400); ok('registro sin fecha de nacimiento: rechazado');
  assert.equal((await reg({ birthDate: yearsAgo(12) })).status, 400); ok('registro con 12 años: rechazado');
  const teen = await reg({ birthDate: yearsAgo(15) });
  assert.equal(teen.status, 201); assert.equal(teen.body.user.isProfilePublic, false); assert.equal(teen.body.user.isMinor, true);
  ok('registro con 15 años: permitido, perfil privado y marcado como menor');
  const adultReg = await reg({ birthDate: yearsAgo(30) });
  assert.equal(adultReg.body.user.isProfilePublic, true); assert.equal(adultReg.body.user.isMinor, false); ok('registro adulto: perfil público por defecto');

  // --- Chat de menores ---
  const minor = await mk('menor', yearsAgo(15)), adult = await mk('adulto', yearsAgo(30)), friend = await mk('amiga', yearsAgo(16));
  const [tM, tA, tF] = [tok(minor), tok(adult), tok(friend)];
  // Compraventa solo entre particulares: el menor ya declaró vender como particular (lo que se prueba aquí es el permiso)
  await prisma.user.update({ where: { id: minor.id }, data: { sellerDeclaredAt: new Date() } });
  assert.equal((await post('/api/chat/conversations', tA, { targetUserId: minor.id })).status, 403); ok('un adulto desconocido no puede escribir a un menor');
  assert.equal((await post('/api/chat/conversations', tM, { targetUserId: adult.id })).status, 403); ok('un menor no puede escribir a un desconocido');
  await prisma.follow.createMany({ data: [{ followerId: minor.id, followingId: friend.id }, { followerId: friend.id, followingId: minor.id }] });
  const conv = await post('/api/chat/conversations', tM, { targetUserId: friend.id });
  assert.equal(conv.status, 201); ok('con seguimiento mutuo sí pueden hablar');
  assert.equal((await post(`/api/chat/conversations/${conv.body.id}/messages`, tF, { content: 'hola' })).status, 201); ok('y enviar mensajes');
  await prisma.follow.deleteMany({ where: { followerId: friend.id, followingId: minor.id } });
  assert.equal((await post(`/api/chat/conversations/${conv.body.id}/messages`, tF, { content: 'hola?' })).status, 403); ok('si dejan de seguirse, el chat se corta');
  const adults = await post('/api/chat/conversations', tA, { targetUserId: (await mk('adulto2', yearsAgo(40))).id });
  assert.equal(adults.status, 201); ok('entre adultos el chat no cambia');

  // --- Tienda: menor sin autorización ---
  const sellTry = await post('/api/products', tM, { name: 'Camiseta', category: 'Tops', forSale: true, price: 5 });
  assert.equal(sellTry.status, 403); assert.equal(sellTry.body.code, 'guardianRequired'); ok('un menor sin autorización no puede vender');
  const noDate = await mk('sinfecha', null);
  assert.equal((await post('/api/products', tok(noDate), { name: 'Bolso', category: 'Accesorios', forSale: true, price: 5 })).body.code, 'birthDateRequired');
  ok('una cuenta sin fecha de nacimiento no puede vender hasta indicarla');
  const adultItem = await prisma.product.create({ data: { name: 'Falda', category: 'Bottoms', forSale: true, price: 10, userId: adult.id } });
  assert.equal((await post('/api/chat/conversations', tM, { targetUserId: adult.id, itemId: adultItem.id, itemTitle: 'Falda' })).status, 403);
  ok('un menor sin autorización no puede contactar para comprar');

  // --- Adulto responsable ---
  const notAdult = await post('/api/guardian/request', tM, { email: friend.email });
  assert.equal(notAdult.body.code, 'guardianNotAdult'); ok('otro menor no puede ser adulto responsable');
  assert.equal((await post('/api/guardian/request', tM, { email: `nadie-${run}@example.test` })).body.code, 'guardianNotFound'); ok('correo sin cuenta: se avisa de que debe registrarse');
  const guardian = await mk('tutora', yearsAgo(45));
  const req1 = await post('/api/guardian/request', tM, { email: guardian.email });
  assert.equal(req1.status, 201); assert.equal(req1.body.status, 'PENDING'); ok('solicitud enviada al adulto');
  const notif = await prisma.notification.findFirst({ where: { userId: guardian.id, type: 'GUARDIAN_REQUEST' } });
  assert.ok(notif); ok('el adulto recibe aviso');
  assert.equal((await post(`/api/guardian/${req1.body.id}/approve`, tA, {})).status, 404); ok('otra persona no puede aprobarla');
  assert.equal((await post('/api/products', tM, { name: 'Camiseta', category: 'Tops', forSale: true, price: 5 })).status, 403); ok('pendiente de aprobar: sigue sin poder vender');
  assert.equal((await post(`/api/guardian/${req1.body.id}/approve`, tok(guardian), {})).status, 200); ok('el adulto aprueba');
  const me = await call('GET', '/api/auth/me', tM);
  assert.equal(me.body.marketplaceAllowed, true); ok('el menor ve la compraventa activada');
  const sold = await post('/api/products', tM, { name: 'Camiseta', category: 'Tops', forSale: true, price: 5 });
  assert.equal(sold.status, 201); ok('con autorización ya puede vender');
  assert.equal((await post('/api/chat/conversations', tM, { targetUserId: adult.id, itemId: adultItem.id, itemTitle: 'Falda' })).status, 201); ok('y contactar por una prenda');
  assert.equal((await post('/api/chat/conversations', tM, { targetUserId: adult.id })).status, 403); ok('pero no chatear con desconocidos fuera de la compraventa');
  assert.equal((await post(`/api/guardian/${req1.body.id}/marketplace`, tok(guardian), { allowed: false })).status, 200);
  const unlisted = await prisma.product.findUnique({ where: { id: sold.body.id } });
  assert.equal(unlisted.forSale, false); ok('al pausar el permiso, sus prendas dejan de estar a la venta');
  const view = await call('GET', '/api/guardian', tok(guardian));
  assert.equal(view.body.asGuardian.length, 1); ok('el adulto ve a su menor vinculado');
  assert.equal((await call('DELETE', `/api/guardian/${req1.body.id}`, tM)).status, 200); ok('el vínculo se puede quitar');

  // --- Fecha de nacimiento: solo se indica una vez ---
  const set = await call('PUT', '/api/auth/profile', tok(noDate), { birthDate: yearsAgo(25) });
  assert.equal(set.status, 200); assert.equal(set.body.needsBirthDate, false); ok('una cuenta sin fecha puede indicarla');
  assert.equal((await call('PUT', '/api/auth/profile', tok(noDate), { birthDate: yearsAgo(17) })).body.code, 'birthDateLocked'); ok('después no se puede cambiar');

  // --- Fotos íntimas (si el servidor corre con NSFW_THRESHOLD bajo, cualquier foto con algo de piel se bloquea) ---
  if (process.env.TEST_NSFW_IMAGE) {
    const form = new FormData();
    form.append('image', new Blob([readFileSync(process.env.TEST_NSFW_IMAGE)], { type: 'image/jpeg' }), 'foto.jpg');
    const r = await fetch(`${BASE}/api/chat/upload`, { method: 'POST', headers: { Authorization: `Bearer ${tA}` }, body: form });
    const body = await r.json();
    assert.equal(r.status, 422); assert.equal(body.error, 'explicitImage'); ok('la foto marcada como íntima se rechaza con 422');
  }
  if (process.env.TEST_SAFE_IMAGE) {
    const form = new FormData();
    form.append('image', new Blob([readFileSync(process.env.TEST_SAFE_IMAGE)], { type: 'image/jpeg' }), 'foto.jpg');
    const r = await fetch(`${BASE}/api/chat/upload`, { method: 'POST', headers: { Authorization: `Bearer ${tA}` }, body: form });
    assert.equal(r.status, 200, 'foto normal'); ok('una foto normal de ropa se sube sin problema');
  }
  console.log(`TODO OK: ${passed} comprobaciones`);
} finally {
  await prisma.user.deleteMany({ where: { email: { startsWith: `minor-${run}-` } } });
  await prisma.$disconnect();
}
