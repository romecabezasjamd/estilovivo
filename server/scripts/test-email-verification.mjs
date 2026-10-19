// Prueba LOCAL: registro → sin verificar no se entra → llega el correo → enlace → ya se entra.
// Requiere el servidor local con SMTP apuntando a un buzón de pruebas que guarde los .eml en MAIL_DIR.
// Uso: MAIL_DIR=<carpeta de .eml> node scripts/test-email-verification.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`Solo local: ${BASE}`);
const MAIL_DIR = process.env.MAIL_DIR;
if (!MAIL_DIR) throw new Error('Falta MAIL_DIR');
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const run = Date.now().toString(36);
let passed = 0;
const ok = (m) => { passed++; console.log(`  ok  ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, body) => {
  const res = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
};
const mailTo = async (to, since) => {
  for (let i = 0; i < 50; i++) {
    for (const f of readdirSync(MAIL_DIR)) {
      const full = path.join(MAIL_DIR, f);
      if (statSync(full).mtimeMs < since) continue;
      const raw = readFileSync(full, 'utf8');
      if (raw.includes(to)) return raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
    }
    await sleep(200);
  }
  throw new Error(`No llegó correo a ${to}`);
};

const email = `verif-${run}@example.test`;
const password = 'Prueba-segura-1';
try {
  const since = Date.now();
  const reg = await post('/api/auth/register', { email, password, name: 'Verif Test', gender: 'other', birthDate: '1995-05-05' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.requiresVerification, true);
  assert.equal(reg.body.token, undefined, 'el registro no da sesión');
  ok('registro: pide verificación y no da sesión');

  const blocked = await post('/api/auth/login', { email, password });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, 'emailNotVerified');
  assert.equal(blocked.body.token, undefined);
  ok('sin verificar no se puede entrar (403 emailNotVerified, lo que muestran app y web como "Revisa tu correo")');

  const mail = await mailTo(email, since);
  const token = mail.match(/verifyToken=([a-f0-9]{64})/)?.[1];
  assert.ok(token, 'el correo trae el enlace de verificación');
  assert.ok(mail.includes('Estilo Vivo'));
  ok('llega el correo de verificación con el enlace');

  const v = await post('/api/auth/verify-email', { token });
  assert.ok([200, 201].includes(v.status), `verify ${v.status}`);
  const login = await post('/api/auth/login', { email, password });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  ok('tras pulsar el enlace ya se entra');

  // Cuentas antiguas (anteriores al corte) sin verificar: siguen entrando
  const legacyEmail = `legacy-${run}@example.test`;
  const legacy = await prisma.user.create({ data: { email: legacyEmail, password: await bcrypt.hash(password, 6), name: 'Legacy', isVerified: false, createdAt: new Date('2026-09-01T00:00:00Z') } });
  assert.equal((await post('/api/auth/login', { email: legacyEmail, password })).status, 200);
  ok('las cuentas anteriores al cambio no se quedan fuera');

  await prisma.user.deleteMany({ where: { id: { in: [legacy.id] } } });
  await prisma.user.deleteMany({ where: { email } });
  console.log(`\nTODO OK: ${passed} comprobaciones`);
} catch (e) {
  console.error('\nFALLO:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
