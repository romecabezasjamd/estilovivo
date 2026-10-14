// Pruebas LOCALES: exportación de datos (GET /api/auth/export) y borrado de cuenta (DELETE /api/auth/profile).
// Uso (desde server/, servidor local arrancado con el mismo .env; sin EXPORT_RATE_MAX para probar el 3/hora):
//   node scripts/test-export.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
if (!process.env.UPLOADS_DIR) throw new Error('Falta UPLOADS_DIR');
const UP = process.env.UPLOADS_DIR;
mkdirSync(path.join(UP, 'stories'), { recursive: true });
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const raw = async (p, token, init = {}) => fetch(BASE + p, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
const mkUser = (tag, extra = {}) => prisma.user.create({
  data: {
    email: `ex-test-${run}-${tag}@example.test`, password: `$2a$10$FAKEHASHFAKEHASHFAKEHASHFAKEHASH${tag}`, name: `EX ${tag}`, isVerified: true,
    verificationToken: `vtok-${run}-${tag}`, resetToken: `rtok-${run}-${tag}`, resetTokenExpiry: new Date(Date.now() + 3600e3), ...extra,
  },
});
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
const file = (rel) => { const p = path.join(UP, rel); writeFileSync(p, 'x'); return [`/api/uploads/${rel.replace(/\\/g, '/')}`, p]; };

try {
  console.log(`Servidor: ${BASE}`);
  const X = await mkUser('X'), Y = await mkUser('Y');
  const [tX, tY] = [tok(X), tok(Y)];
  const prodX = await prisma.product.create({ data: { name: `mi-prenda-${run}`, category: 'Tops', userId: X.id } });
  const lookX = await prisma.look.create({ data: { title: `mi-look-${run}`, isPublic: true, userId: X.id } });
  const lookY = await prisma.look.create({ data: { title: `SECRETO-look-de-Y-${run}`, isPublic: true, userId: Y.id } });
  await prisma.product.create({ data: { name: `SECRETO-prenda-de-Y-${run}`, category: 'Tops', userId: Y.id } });
  await prisma.comment.create({ data: { content: `mi-comentario-${run}`, userId: X.id, lookId: lookY.id } });
  await prisma.comment.create({ data: { content: `SECRETO-comentario-de-Y-${run}`, userId: Y.id, lookId: lookY.id } });
  await prisma.favorite.create({ data: { userId: X.id, lookId: lookY.id } });
  await prisma.story.create({ data: { userId: X.id, type: 'text', text: `mi-historia-${run}`, expiresAt: new Date(Date.now() + 3600e3) } });
  const conv = await prisma.conversation.create({ data: { participants: { create: [{ userId: X.id }, { userId: Y.id }] } } });
  await prisma.message.create({ data: { conversationId: conv.id, senderId: X.id, content: `msg-enviado-${run}` } });
  await prisma.message.create({ data: { conversationId: conv.id, senderId: Y.id, content: `msg-recibido-${run}` } });
  const otherConv = await prisma.conversation.create({ data: { participants: { create: [{ userId: Y.id }] } } });
  await prisma.message.create({ data: { conversationId: otherConv.id, senderId: Y.id, content: `SECRETO-conv-ajena-${run}` } });
  await prisma.notification.create({ data: { type: 'LIKE', content: `notif-${run}`, userId: X.id } });
  await prisma.notification.create({ data: { type: 'LIKE', content: `SECRETO-notif-de-Y-${run}`, userId: Y.id } });
  await prisma.refreshToken.create({ data: { token: `refresh-secret-${run}`, userId: X.id, expiresAt: new Date(Date.now() + 86400e3) } });

  // ---------- Export ----------
  let res = await raw('/api/auth/export');
  assert.equal(res.status, 401); ok('export sin token -> 401');
  res = await raw('/api/auth/export', tX);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') || '', /^attachment; filename="estilovivo-datos-\d{4}-\d{2}-\d{2}\.json"$/);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const text = await res.text();
  const data = JSON.parse(text);
  ok('export 200, Content-Disposition attachment, JSON válido');
  for (const k of [`mi-prenda-${run}`, `mi-look-${run}`, `mi-comentario-${run}`, `mi-historia-${run}`, `msg-enviado-${run}`, `msg-recibido-${run}`, `notif-${run}`, X.email]) assert.ok(text.includes(k), `falta ${k}`);
  assert.equal(data.favorites.length, 1);
  assert.equal(data.conversations.length, 1);
  assert.equal(data.conversations[0].messages.length, 2);
  ok('contiene perfil, prendas, looks, comentarios, favoritos, historias, notificaciones y mensajes enviados Y recibidos');
  assert.ok(!text.includes('SECRETO'), 'filtra datos de otro usuario');
  assert.ok(!text.includes(Y.email), 'filtra el email de otro');
  ok('NO contiene datos de otros usuarios (looks, prendas, comentarios, notificaciones, conversaciones ajenas, email de Y)');
  const forbidden = [X.password, `vtok-${run}-X`, `rtok-${run}-X`, `refresh-secret-${run}`, '"password"', '"resetToken"', '"verificationToken"', '"refreshTokens"', '"token"'];
  for (const f of forbidden) assert.ok(!text.includes(f), `contiene ${f}`);
  assert.ok(!/\$2[aby]\$/.test(text));
  ok('NO contiene hash de contraseña, verificationToken, resetToken ni refresh tokens');
  assert.equal(data.profile.id, X.id);
  assert.ok(data.preferences && 'emailNotifications' in data.preferences);
  ok('perfil y preferencias presentes');
  res = await raw('/api/auth/export', tX); assert.equal(res.status, 200);
  res = await raw('/api/auth/export', tX); assert.equal(res.status, 200);
  res = await raw('/api/auth/export', tX); assert.equal(res.status, 429);
  res = await raw('/api/auth/export', tY); assert.equal(res.status, 200);
  ok('rate limit estricto por usuario: 3 exportaciones/hora (la 4ª -> 429; otro usuario no afectado)');

  // ---------- Borrado de cuenta ----------
  const D = await mkUser('D');
  const tD = tok(D);
  const [avUrl, avPath] = file(`del-${run}-avatar.jpg`);
  const [stUrl, stPath] = file(`stories/del-${run}-story.jpg`);
  const [thUrl, thPath] = file(`del-${run}-thumb.jpg`);
  const [subUrl, subPath] = file(`del-${run}-sub.jpg`);
  const [prUrl, prPath] = file(`del-${run}-prod.jpg`);
  const [msgUrl, msgPath] = file(`del-${run}-msg.jpg`);
  await prisma.user.update({ where: { id: D.id }, data: { avatar: avUrl } });
  const prodD = await prisma.product.create({ data: { name: `D-prenda-${run}`, category: 'Tops', userId: D.id, images: { create: [{ url: prUrl, filename: path.basename(prUrl) }] } } });
  const lookD = await prisma.look.create({ data: { title: `D-look-${run}`, isPublic: true, userId: D.id } });
  await prisma.plannerEntry.create({ data: { date: '2030-01-01', lookId: lookD.id, userId: D.id } });
  await prisma.comment.create({ data: { content: `D-comenta-en-look-de-Y-${run}`, userId: D.id, lookId: lookY.id } });
  await prisma.comment.create({ data: { content: `Y-comenta-en-look-de-D-${run}`, userId: Y.id, lookId: lookD.id } });
  await prisma.like.create({ data: { userId: D.id, lookId: lookY.id } });
  await prisma.like.create({ data: { userId: Y.id, lookId: lookD.id } });
  await prisma.favorite.create({ data: { userId: D.id, lookId: lookY.id } });
  await prisma.story.create({ data: { userId: D.id, type: 'image', imageUrl: stUrl, expiresAt: new Date(Date.now() + 3600e3) } });
  await prisma.tryonPreset.create({ data: { name: 'p', thumbnail: thUrl, userId: D.id } });
  const wk = await prisma.weeklyChallenge.create({ data: { title: 'r', description: 'd', tag: 'x', endDate: new Date(Date.now() + 86400e3) } });
  await prisma.challengeSubmission.create({ data: { userId: D.id, challengeId: wk.id, imageUrl: subUrl, description: 'd' } });
  await prisma.follow.create({ data: { followerId: D.id, followingId: Y.id } });
  await prisma.follow.create({ data: { followerId: Y.id, followingId: D.id } });
  await prisma.block.create({ data: { blockerId: D.id, blockedId: Y.id } });
  await prisma.notification.create({ data: { type: 'LIKE', content: 'n', userId: D.id } });
  await prisma.refreshToken.create({ data: { token: `rt-${run}`, userId: D.id, expiresAt: new Date(Date.now() + 86400e3) } });
  await prisma.report.create({ data: { reporterId: D.id, targetType: 'USER', targetId: Y.id, reason: 'SPAM' } });
  const convDY = await prisma.conversation.create({ data: { participants: { create: [{ userId: D.id }, { userId: Y.id }] } } });
  await prisma.message.create({ data: { conversationId: convDY.id, senderId: D.id, content: 'mensaje de D', imageUrl: msgUrl } });
  await prisma.message.create({ data: { conversationId: convDY.id, senderId: Y.id, content: 'mensaje de Y a D' } });
  const convSolo = await prisma.conversation.create({ data: { participants: { create: [{ userId: D.id }] } } });

  res = await raw('/api/auth/profile', tD, { method: 'DELETE' });
  assert.equal(res.status, 200);
  ok('DELETE /auth/profile -> 200');
  const gone = {
    user: await prisma.user.count({ where: { id: D.id } }),
    products: await prisma.product.count({ where: { userId: D.id } }),
    productImages: await prisma.productImage.count({ where: { productId: prodD.id } }),
    looks: await prisma.look.count({ where: { userId: D.id } }),
    planner: await prisma.plannerEntry.count({ where: { userId: D.id } }),
    comments: await prisma.comment.count({ where: { userId: D.id } }),
    commentsOnHisLook: await prisma.comment.count({ where: { lookId: lookD.id } }),
    likes: await prisma.like.count({ where: { OR: [{ userId: D.id }, { lookId: lookD.id }] } }),
    favorites: await prisma.favorite.count({ where: { userId: D.id } }),
    stories: await prisma.story.count({ where: { userId: D.id } }),
    tryon: await prisma.tryonPreset.count({ where: { userId: D.id } }),
    submissions: await prisma.challengeSubmission.count({ where: { userId: D.id } }),
    follows: await prisma.follow.count({ where: { OR: [{ followerId: D.id }, { followingId: D.id }] } }),
    blocks: await prisma.block.count({ where: { OR: [{ blockerId: D.id }, { blockedId: D.id }] } }),
    notifications: await prisma.notification.count({ where: { userId: D.id } }),
    refresh: await prisma.refreshToken.count({ where: { userId: D.id } }),
    participants: await prisma.conversationParticipant.count({ where: { userId: D.id } }),
    messagesFromD: await prisma.message.count({ where: { senderId: D.id } }),
    conversationSolo: await prisma.conversation.count({ where: { id: convSolo.id } }),
  };
  assert.deepEqual(Object.values(gone).filter((n) => n !== 0), [], JSON.stringify(gone));
  ok('BD: usuario, prendas+imágenes, looks, planner, comentarios (propios y en sus looks), likes, favoritos, historias, presets, participaciones, follows, bloqueos, notificaciones, refresh tokens y mensajes enviados borrados');
  for (const p of [avPath, stPath, thPath, subPath, msgPath, prPath]) assert.ok(!existsSync(p), `queda fichero ${p}`);
  ok('ficheros subidos asociados borrados (avatar, historia, miniatura de preset, foto de reto, imagen de mensaje)');
  assert.equal(await prisma.look.count({ where: { id: lookY.id } }), 1);
  assert.equal(await prisma.comment.count({ where: { content: `SECRETO-comentario-de-Y-${run}` } }), 1);
  assert.equal(await prisma.message.count({ where: { content: 'mensaje de Y a D' } }), 1);
  assert.equal(await prisma.conversation.count({ where: { id: convDY.id } }), 1);
  assert.equal(await prisma.user.count({ where: { id: Y.id } }), 1);
  ok('datos de otros se CONSERVAN: looks/comentarios de Y, su conversación con D (solo sus propios mensajes) y su cuenta');
  assert.equal(await prisma.report.count({ where: { reporterId: D.id } }), 1);
  ok('las denuncias hechas por D se conservan (moderación)');
  for (const p of ['/api/chat/conversations', `/api/chat/conversations/${convDY.id}/messages`, '/api/looks/feed', '/api/stories', '/api/products/shop', '/api/users/top', `/api/social/comments/${lookY.id}`, `/api/social/likes/${lookY.id}`, '/api/notifications']) {
    res = await raw(p, tY);
    assert.equal(res.status, 200, `${p} -> ${res.status}`);
  }
  ok('sin huérfanos que rompan consultas: las rutas de Y siguen respondiendo 200 tras borrar a D');
  res = await raw('/api/auth/me', tD);
  assert.ok([401, 403, 404].includes(res.status));
  ok(`el token antiguo de D ya no sirve (/auth/me -> ${res.status})`);

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error(`\nFALLO tras ${passed} comprobaciones:`, e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
