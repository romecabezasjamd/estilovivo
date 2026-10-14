// Pruebas LOCALES de moderación: bloqueos (ambos sentidos) y denuncias.
// Uso (desde server/, servidor local arrancado con el mismo .env):  node scripts/test-moderation.mjs
// Crea usuarios de prueba (sm-test-*@example.test) en la BD local. Los tokens se firman con JWT_SECRET del .env
// (así se gastan pocas peticiones del rate limit general de 100/min; el script se auto-limita).
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamps = [];
const api = async (path, token, init = {}) => {
  // auto-limitación: el servidor admite 100 peticiones/min por IP
  const now = Date.now();
  while (stamps.length && now - stamps[0] > 60000) stamps.shift();
  if (stamps.length >= 90) { await sleep(60000 - (now - stamps[0]) + 500); stamps.length = 0; }
  stamps.push(Date.now());
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
};
const J = (o) => JSON.stringify(o);
const mkUser = (tag, extra = {}) => prisma.user.create({ data: { email: `sm-test-${run}-${tag}@example.test`, password: 'x-not-a-real-hash', name: `SM ${tag}`, isVerified: true, ...extra } });
const tok = (u) => jwt.sign({ userId: u.id }, process.env.JWT_SECRET, { expiresIn: '30m' });

try {
  console.log(`Servidor: ${BASE}`);
  const A = await mkUser('A'), B = await mkUser('B', { experiencePoints: 900000000 }), C = await mkUser('C');
  const [tA, tB, tC] = [tok(A), tok(B), tok(C)];
  const lookA = await prisma.look.create({ data: { title: `lookA-${run}`, isPublic: true, userId: A.id } });
  const lookB = await prisma.look.create({ data: { title: `lookB-${run}`, isPublic: true, userId: B.id } });
  const lookC = await prisma.look.create({ data: { title: `lookC-${run}`, isPublic: true, userId: C.id } });
  const cmA = await prisma.comment.create({ data: { content: 'comentario de A', userId: A.id, lookId: lookC.id } });
  const cmB = await prisma.comment.create({ data: { content: 'comentario de B', userId: B.id, lookId: lookC.id } });
  const cmBreply = await prisma.comment.create({ data: { content: 'respuesta de B', userId: B.id, lookId: lookC.id, parentId: cmA.id } });
  await prisma.comment.create({ data: { content: 'comentario de C', userId: C.id, lookId: lookC.id } });
  const exp = new Date(Date.now() + 3600e3);
  const stA = await prisma.story.create({ data: { userId: A.id, type: 'text', text: 'historia A', expiresAt: exp } });
  const stB = await prisma.story.create({ data: { userId: B.id, type: 'text', text: 'historia B', expiresAt: exp } });
  for (const u of [A, B]) await prisma.like.create({ data: { userId: u.id, lookId: lookC.id } });
  const prodB = await prisma.product.create({ data: { name: `prodB-${run}`, category: 'Tops', forSale: true, price: 10, userId: B.id } });
  const prodA = await prisma.product.create({ data: { name: `prodA-${run}`, category: 'Tops', forSale: true, price: 10, userId: A.id } });
  await prisma.favorite.create({ data: { userId: A.id, lookId: lookB.id } });
  const conv = await prisma.conversation.create({ data: { participants: { create: [{ userId: A.id }, { userId: B.id }] } } });
  const msg = await prisma.message.create({ data: { conversationId: conv.id, senderId: B.id, content: 'hola A' } });
  // follows en ambos sentidos + solicitud pendiente: el bloqueo debe eliminarlos
  await prisma.follow.create({ data: { followerId: A.id, followingId: B.id } });
  await prisma.follow.create({ data: { followerId: B.id, followingId: A.id } });
  await prisma.followRequest.create({ data: { requesterId: B.id, targetId: A.id, status: 'pending' } });

  const feedIds = async (t) => (await api('/api/looks/feed?limit=100', t)).body.items.map((l) => l.id);
  const state = async (t, me, other, otherLook, otherStory, otherProd, mine) => {
    const [feed, comments, stories, likes, shop, top, profile, convs, msgs, favs] = await Promise.all([
      feedIds(t), api(`/api/social/comments/${lookC.id}`, t), api('/api/stories', t), api(`/api/social/likes/${lookC.id}`, t),
      api('/api/products/shop', t), api('/api/users/top', t), api(`/api/users/${other.id}`, t), api('/api/chat/conversations', t),
      api(`/api/chat/conversations/${conv.id}/messages`, t), api('/api/social/favorites', t),
    ]);
    return {
      feedHasOther: feed.includes(otherLook.id),
      commentsHaveOther: JSON.stringify(comments.body).includes(`de ${other.name.slice(-1)}"`),
      storiesHaveOther: stories.body.some((s) => s.id === otherStory.id),
      likesHaveOther: likes.body.users.some((u) => u.id === other.id),
      shopHasOther: shop.body.some((p) => p.id === otherProd.id),
      topHasOther: top.body.some((u) => u.id === other.id),
      profileStatus: profile.status,
      convListed: convs.body.some((c) => c.id === conv.id),
      msgsStatus: msgs.status,
      favHasOtherLook: favs.body.some((f) => f.lookId === lookB.id),
    };
  };
  // ---- Antes del bloqueo: todo visible
  let sA = await state(tA, A, B, lookB, stB, prodB), sB = await state(tB, B, A, lookA, stA, prodA);
  assert.deepEqual({ ...sA, ...{} }, { feedHasOther: true, commentsHaveOther: true, storiesHaveOther: true, likesHaveOther: true, shopHasOther: true, topHasOther: true, profileStatus: 200, convListed: true, msgsStatus: 200, favHasOtherLook: true });
  assert.equal(sB.feedHasOther && sB.storiesHaveOther && sB.likesHaveOther && sB.shopHasOther && sB.convListed && sB.profileStatus === 200, true);
  ok('sin bloqueo: feed, comentarios, historias, likes, tienda, top, perfil, chat y favoritos visibles en ambos sentidos');

  // ---- Bloqueo
  let r = await api('/api/blocks', tA, { method: 'POST', body: J({ userId: B.id }) });
  assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true });
  r = await api('/api/blocks', tA, { method: 'POST', body: J({ userId: B.id }) });
  assert.equal(r.status, 200);
  assert.equal(await prisma.block.count({ where: { blockerId: A.id, blockedId: B.id } }), 1);
  ok('POST /blocks 200 {ok:true} e idempotente (1 fila)');
  r = await api('/api/blocks', tA, { method: 'POST', body: J({ userId: A.id }) }); assert.equal(r.status, 400);
  r = await api('/api/blocks', tA, { method: 'POST', body: J({ userId: 'no-existe' }) }); assert.equal(r.status, 404);
  r = await api('/api/blocks', tA, { method: 'POST', body: J({}) }); assert.equal(r.status, 400);
  r = await api('/api/blocks', null, { method: 'POST', body: J({ userId: B.id }) }); assert.equal(r.status, 401);
  ok('bloquearte a ti mismo 400; usuario inexistente 404; sin userId 400; sin token 401');
  assert.equal(await prisma.follow.count({ where: { OR: [{ followerId: A.id, followingId: B.id }, { followerId: B.id, followingId: A.id }] } }), 0);
  assert.equal(await prisma.followRequest.count({ where: { OR: [{ requesterId: A.id, targetId: B.id }, { requesterId: B.id, targetId: A.id }] } }), 0);
  ok('al bloquear se eliminan follows en ambos sentidos y solicitudes pendientes');

  const hidden = { feedHasOther: false, commentsHaveOther: false, storiesHaveOther: false, likesHaveOther: false, shopHasOther: false, topHasOther: false, profileStatus: 404, convListed: false, msgsStatus: 404, favHasOtherLook: false };
  sA = await state(tA, A, B, lookB, stB, prodB);
  sB = await state(tB, B, A, lookA, stA, prodA);
  assert.deepEqual(sA, hidden); ok('BLOQUEADORA (A) ya no ve nada de B: feed, comentarios, historias, likes, tienda, top, perfil 404, conversación y mensajes, favoritos');
  assert.deepEqual({ ...sB, favHasOtherLook: false }, hidden); ok('BLOQUEADO (B) tampoco ve nada de A (ocultación en ambos sentidos)');
  r = await api(`/api/social/comments/${lookC.id}`, tC);
  assert.ok(JSON.stringify(r.body).includes('comentario de A') && JSON.stringify(r.body).includes('comentario de B'));
  ok('un tercero (C) sigue viendo ambos comentarios (el bloqueo no afecta a terceros)');
  assert.ok(!JSON.stringify((await api(`/api/social/comments/${lookC.id}`, tA)).body).includes('respuesta de B'));
  ok('las respuestas de B también se ocultan a A');

  // acciones entre bloqueados
  r = await api(`/api/chat/conversations/${conv.id}/messages`, tA, { method: 'POST', body: J({ content: 'hola' }) }); assert.equal(r.status, 403);
  r = await api('/api/chat/messages', tB, { method: 'POST', body: J({ conversationId: conv.id, content: 'hola' }) }); assert.equal(r.status, 403);
  r = await api('/api/chat/conversations', tB, { method: 'POST', body: J({ targetUserId: A.id }) }); assert.equal(r.status, 403);
  assert.equal(await prisma.message.count({ where: { conversationId: conv.id } }), 1);
  ok('no se crean mensajes ni conversaciones nuevas entre bloqueados (403, 0 mensajes nuevos)');
  const notifsBefore = await prisma.notification.count({ where: { userId: { in: [A.id, B.id] } } });
  r = await api('/api/social/follow', tB, { method: 'POST', body: J({ targetUserId: A.id }) }); assert.equal(r.status, 404);
  r = await api('/api/social/like', tA, { method: 'POST', body: J({ lookId: lookB.id }) }); assert.equal(r.status, 404);
  r = await api('/api/social/comment', tB, { method: 'POST', body: J({ lookId: lookA.id, content: 'hola' }) }); assert.equal(r.status, 404);
  r = await api(`/api/stories/${stB.id}/reaction`, tA, { method: 'POST', body: J({ emoji: '🔥' }) }); assert.equal(r.status, 404);
  r = await api(`/api/stories/${stA.id}/view`, tB, { method: 'POST' }); assert.equal(r.status, 404);
  assert.equal(await prisma.notification.count({ where: { userId: { in: [A.id, B.id] } } }), notifsBefore);
  ok('seguir, like, comentar, reaccionar y ver historia entre bloqueados -> 404 y sin notificaciones nuevas');

  r = await api('/api/blocks', tA); assert.deepEqual(r.body.users.map((u) => u.id), [B.id]); assert.deepEqual(Object.keys(r.body.users[0]).sort(), ['avatar', 'id', 'name']);
  r = await api('/api/blocks', tB); assert.deepEqual(r.body.users, []);
  ok('GET /blocks lista solo a quien YO bloqueé ({id,name,avatar}); B no ve que lo han bloqueado');

  // ---- Desbloqueo
  r = await api(`/api/blocks/${B.id}`, tA, { method: 'DELETE' }); assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true });
  r = await api(`/api/blocks/${B.id}`, tA, { method: 'DELETE' }); assert.equal(r.status, 200);
  sA = await state(tA, A, B, lookB, stB, prodB); sB = await state(tB, B, A, lookA, stA, prodA);
  assert.deepEqual(sA, { feedHasOther: true, commentsHaveOther: true, storiesHaveOther: true, likesHaveOther: true, shopHasOther: true, topHasOther: true, profileStatus: 200, convListed: true, msgsStatus: 200, favHasOtherLook: true });
  assert.equal(sB.feedHasOther && sB.storiesHaveOther && sB.likesHaveOther && sB.shopHasOther && sB.convListed && sB.profileStatus === 200, true);
  ok('DELETE /blocks/:id 200 (idempotente) y todo vuelve a ser visible en ambos sentidos');
  r = await api(`/api/chat/conversations/${conv.id}/messages`, tA, { method: 'POST', body: J({ content: 'otra vez hola' }) }); assert.equal(r.status, 201);
  ok('tras desbloquear se puede escribir de nuevo');

  // ---- Denuncias
  const rep = (t, body) => api('/api/reports', t, { method: 'POST', body: J(body) });
  r = await rep(tA, { targetType: 'USER', targetId: B.id, reason: 'SPAM' }); assert.equal(r.status, 201); assert.deepEqual(r.body, { ok: true });
  r = await rep(tA, { targetType: 'LOOK', targetId: lookB.id, reason: 'INAPPROPRIATE', details: 'texto' }); assert.equal(r.status, 201);
  r = await rep(tA, { targetType: 'COMMENT', targetId: cmB.id, reason: 'HARASSMENT' }); assert.equal(r.status, 201);
  r = await rep(tA, { targetType: 'STORY', targetId: stB.id, reason: 'IMPERSONATION' }); assert.equal(r.status, 201);
  r = await rep(tA, { targetType: 'MESSAGE', targetId: msg.id, reason: 'OTHER' }); assert.equal(r.status, 201);
  assert.equal(await prisma.report.count({ where: { reporterId: A.id, status: 'OPEN' } }), 5);
  ok('denuncias USER/LOOK/COMMENT/STORY/MESSAGE -> 201 {ok:true} y 5 filas OPEN');
  r = await rep(tA, { targetType: 'USER', targetId: B.id, reason: 'HARASSMENT' }); assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.equal(await prisma.report.count({ where: { reporterId: A.id, targetType: 'USER', targetId: B.id } }), 1);
  ok('denuncia duplicada abierta: no se duplica (200 {ok:true,duplicate:true})');
  for (const t of ['USER', 'LOOK', 'COMMENT', 'STORY', 'MESSAGE']) {
    r = await rep(tA, { targetType: t, targetId: 'inexistente-123', reason: 'SPAM' }); assert.equal(r.status, 404, t);
  }
  ok('objetivo inexistente -> 404 (los 5 tipos)');
  r = await rep(tA, { targetType: 'USER', targetId: A.id, reason: 'SPAM' }); assert.equal(r.status, 400);
  r = await rep(tA, { targetType: 'LOOK', targetId: lookA.id, reason: 'SPAM' }); assert.equal(r.status, 400);
  r = await rep(tA, { targetType: 'COMMENT', targetId: cmA.id, reason: 'SPAM' }); assert.equal(r.status, 400);
  r = await rep(tA, { targetType: 'STORY', targetId: stA.id, reason: 'SPAM' }); assert.equal(r.status, 400);
  r = await rep(tB, { targetType: 'MESSAGE', targetId: msg.id, reason: 'SPAM' }); assert.equal(r.status, 400);
  ok('auto-denuncia -> 400 (usuario, look, comentario, historia, mensaje propios)');
  r = await rep(tC, { targetType: 'MESSAGE', targetId: msg.id, reason: 'SPAM' }); assert.equal(r.status, 404);
  ok('denunciar un mensaje de una conversación ajena -> 404');
  r = await rep(tA, { targetType: 'USER', targetId: C.id, reason: 'NOPE' }); assert.equal(r.status, 400);
  r = await rep(tA, { targetType: 'THING', targetId: C.id, reason: 'SPAM' }); assert.equal(r.status, 400);
  r = await rep(tA, { targetType: 'USER', targetId: C.id, reason: 'SPAM', details: 'x'.repeat(501) }); assert.equal(r.status, 400);
  r = await rep(tA, { targetType: 'USER', reason: 'SPAM' }); assert.equal(r.status, 400);
  r = await rep(null, { targetType: 'USER', targetId: C.id, reason: 'SPAM' }); assert.equal(r.status, 401);
  ok('validación: reason/targetType inválidos, details>500, falta targetId -> 400; sin token -> 401');
  await prisma.report.updateMany({ where: { reporterId: A.id, targetId: B.id, targetType: 'USER' }, data: { status: 'CLOSED' } });
  r = await rep(tA, { targetType: 'USER', targetId: B.id, reason: 'SPAM' }); assert.equal(r.status, 201);
  ok('cerrada la anterior, se admite una nueva denuncia');

  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error(`\nFALLO tras ${passed} comprobaciones:`, e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
