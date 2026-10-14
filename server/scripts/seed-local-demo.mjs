// Datos LOCALES de demostración para probar la app Android contra un servidor local (NO usar en producción).
// Uso (desde server/, con el .env local):   node scripts/seed-local-demo.mjs <ruta-credenciales.json>
// Escribe las credenciales generadas SOLO en el JSON indicado (fuera del repo; no se commitean).
// Deja: autora con look + 3 likes; historia con foto y reacción de otro usuario (la autora ve miniatura) y historia
// de texto con reacción; reto activo "Color Block" con participación de la autora (foto, estado PENDING);
// un usuario extra "Bloqueable" (look, historia y comentario) para probar bloqueo/denuncia;
// 2 prendas propias en venta de la autora (foto, precio) + 1 en venta de otro usuario.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const out = process.argv[2];
if (!out) throw new Error('Uso: node scripts/seed-local-demo.mjs <credenciales.json>');
const dbUrl = process.env.DATABASE_URL || '';
if (!/^file:/.test(dbUrl) || /xyoncloud/.test(dbUrl)) throw new Error('Solo BD SQLite local');
const UPLOADS = process.env.UPLOADS_DIR;
if (!UPLOADS) throw new Error('Falta UPLOADS_DIR');
mkdirSync(path.join(UPLOADS, 'stories'), { recursive: true });

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
const PASS = 'Local-' + Math.random().toString(36).slice(2, 12);
const hash = await bcrypt.hash(PASS, 6);
const run = Date.now().toString(36);

// Imagen de prueba con color + etiqueta (jpg) guardada en UPLOADS (y servida en /api/uploads/..)
const makeImage = async (rel, color, label, w = 540, h = 960) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/>` +
    `<text x="50%" y="50%" font-size="48" fill="#fff" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toFile(path.join(UPLOADS, rel));
  return `/api/uploads/${rel.replace(/\\/g, '/')}`;
};
const mk = async (tag, name, avatarColor) => prisma.user.create({
  data: {
    email: `demo-${run}-${tag}@example.test`, password: hash, name, isVerified: true,
    avatar: avatarColor ? await makeImage(`demo-${run}-av-${tag}.jpg`, avatarColor, name[0], 256, 256) : null,
  },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const author = await mk('author', 'Autora Demo', '#0F4C5C');
const l1 = await mk('l1', 'Lucía Prueba', '#B5651D');
const l2 = await mk('l2', 'Marcos Prueba', '#5C4B8A');
const l3 = await mk('l3', 'Sin Foto Prueba', null);
// Usuario extra para probar bloqueo/denuncia: tiene look público, historia y comentario en el look de la autora
const blockable = await mk('blockable', 'Bloqueable Prueba', '#00796B');

// Look + 3 likes
const look = await prisma.look.create({ data: { title: 'Look demo likes', isPublic: true, userId: author.id } });
for (const u of [l1, l2, l3]) { await prisma.like.create({ data: { userId: u.id, lookId: look.id } }); await sleep(20); }

await prisma.look.create({ data: { title: 'Look de Bloqueable', isPublic: true, userId: blockable.id } });
await prisma.comment.create({ data: { content: 'Comentario de Bloqueable (para probar denuncia/bloqueo)', userId: blockable.id, lookId: look.id } });
await prisma.story.create({ data: { userId: blockable.id, type: 'text', text: 'Historia de Bloqueable', expiresAt: new Date(Date.now() + 23 * 3600 * 1000) } });

// Historias (foto y solo texto) + reacciones: el mensaje lo "envía" quien reacciona, lo ve la autora (receptora)
const expiresAt = new Date(Date.now() + 23 * 3600 * 1000);
const storyImg = await makeImage(`stories/demo-${run}-story.jpg`, '#C2185B', 'Historia demo');
const story = await prisma.story.create({ data: { userId: author.id, type: 'image', imageUrl: storyImg, text: 'Mi outfit de hoy', expiresAt } });
const storyTxt = await prisma.story.create({ data: { userId: author.id, type: 'text', text: 'Solo texto de prueba', expiresAt } });
const react = async (reactor, st, emoji) => {
  const conv = await prisma.conversation.create({ data: { participants: { create: [{ userId: reactor.id }, { userId: author.id }] } } });
  const ref = st.imageUrl ? 'una foto' : `"${st.text.slice(0, 60)}"`;
  await prisma.message.create({
    data: { conversationId: conv.id, senderId: reactor.id, content: `${reactor.name} reaccionó ${emoji} a tu historia: ${ref}`, storyId: st.id, storyThumb: st.imageUrl ?? null },
  });
  await prisma.notification.create({ data: { type: 'STORY_REACTION', content: `${reactor.name} reaccionó ${emoji} a tu historia`, userId: author.id, relatedId: conv.id } });
  return conv.id;
};
const convPhoto = await react(l1, story, '🔥');
const convText = await react(l2, storyTxt, '❤️');

// Reto activo (esta semana) y participación de la autora con foto. Estado PENDING: sin IA no hay evidencia fiable.
await prisma.weeklyChallenge.updateMany({ data: { active: false } });
const start = new Date(Date.now() - 60 * 1000);
const end = new Date(Date.now() + 5 * 24 * 3600 * 1000);
const challenge = await prisma.weeklyChallenge.create({
  data: { title: 'Color Block', description: 'Combina colores vibrantes en un solo look. Usa al menos 3 colores diferentes que contrasten.', reward: 50, tag: 'Color Block', startDate: start, endDate: end, active: true },
});
const subImg = await makeImage(`demo-${run}-challenge.jpg`, '#1E88E5', 'Color Block', 600, 800);
const submission = await prisma.challengeSubmission.create({
  data: {
    userId: author.id, challengeId: challenge.id, imageUrl: subImg, description: 'Mi look color block de prueba',
    verified: true, awarded: false, status: 'PENDING', reason: 'El servidor no puede validar automáticamente este tipo de reto; pendiente de revisión.',
  },
});

// Prendas: 2 propias en venta (foto + precio) + 1 en venta de otro usuario (aparece en la tienda de la autora)
const mkProduct = async (user, name, price, color, forSale = true) => {
  const url = await makeImage(`demo-${run}-${name.replace(/\W+/g, '_')}.jpg`, color, name, 600, 600);
  return prisma.product.create({
    data: {
      name, category: 'Tops', brand: 'Demo', size: 'M', color: 'Azul', condition: 'good', price, forSale, userId: user.id,
      images: { create: [{ url, filename: path.basename(url) }] },
    },
  });
};
const p1 = await mkProduct(author, 'Camisa azul demo', 25, '#1565C0');
const p2 = await mkProduct(author, 'Vestido rojo demo', 40, '#C62828');
const p3 = await mkProduct(l1, 'Chaqueta de Lucía', 55, '#2E7D32');

writeFileSync(out, JSON.stringify({
  note: 'Usuarios y datos SOLO locales. Misma contraseña para todos los usuarios de esta ejecución.',
  password: PASS,
  author: { email: author.email, id: author.id },
  blockableUser: { email: blockable.email, id: blockable.id, name: blockable.name },
  others: [l1, l2, l3].map((u) => ({ email: u.email, id: u.id, name: u.name })),
  lookId: look.id, storyId: story.id, textStoryId: storyTxt.id, conversationPhotoReaction: convPhoto, conversationTextReaction: convText,
  challengeId: challenge.id, submissionId: submission.id, authorProductIds: [p1.id, p2.id], otherSellerProductId: p3.id,
}, null, 2));
console.log('ok. Autora:', author.email, '- credenciales en', out);
await prisma.$disconnect();
