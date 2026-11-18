import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import Database from 'better-sqlite3';
import { registerBackupRoutes, decryptBuffer, safeEqual } from '../backup.js';

const TOKEN = 'token-de-prueba-0123456789abcdef';
const PASSWORD = 'contraseña larga de prueba';
const silent = { info: () => {}, warn: () => {}, error: () => {} };

let tmp: string;
let dbPath: string;
let uploads: string;
const longName = 'a'.repeat(120) + '.webp';

function makeApp(env: Record<string, string | undefined>, maxPerHour = 50) {
  const app = express();
  app.set('trust proxy', false);
  registerBackupRoutes(app, {
    snapshotDb: async (dest) => {
      const db = new Database(dbPath);
      db.prepare('VACUUM INTO ?').run(dest);
      db.close();
    },
    uploadsDir: uploads,
    logger: silent,
    env,
    maxPerHour,
  });
  return app;
}

/** Lector mínimo de tar (ustar + PAX) para comprobar el contenido. */
function untar(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let o = 0;
  let paxName: string | null = null;
  while (o + 512 <= buf.length) {
    const h = buf.subarray(o, o + 512);
    if (h.every((b) => b === 0)) break;
    const name = h.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(h.subarray(124, 136).toString('ascii').replace(/\0.*$/s, '').trim(), 8);
    const type = String.fromCharCode(h[156]);
    const data = buf.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const m = data.toString('utf8').match(/ path=(.*)\n/);
      paxName = m ? m[1] : null;
      continue;
    }
    files.set(paxName ?? name, Buffer.from(data));
    paxName = null;
  }
  return files;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evbk-test-'));
  dbPath = path.join(tmp, 'dev.db');
  uploads = path.join(tmp, 'uploads');
  fs.mkdirSync(path.join(uploads, 'stories'), { recursive: true });
  fs.writeFileSync(path.join(uploads, 'foto1.webp'), Buffer.from('foto-uno'));
  fs.writeFileSync(path.join(uploads, 'stories', 'historia.jpg'), Buffer.from('historia'));
  fs.writeFileSync(path.join(uploads, longName), Buffer.from('nombre-largo'));
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE User (id TEXT PRIMARY KEY, email TEXT)');
  db.prepare('INSERT INTO User VALUES (?, ?)').run('u1', 'lucia@ejemplo.es');
  db.close();
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const binary = (res: any, cb: (e: Error | null, b: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('GET /api/admin/backup', () => {
  const env = { BACKUP_TOKEN: TOKEN, BACKUP_PASSWORD: PASSWORD };

  it('sin token → 401', async () => {
    const res = await request(makeApp(env)).get('/api/admin/backup');
    expect(res.status).toBe(401);
  });

  it('token incorrecto → 401', async () => {
    const res = await request(makeApp(env)).get('/api/admin/backup').set('Authorization', 'Bearer otro-token');
    expect(res.status).toBe(401);
  });

  it('el token no vale en la URL (no queda en los registros)', async () => {
    const res = await request(makeApp(env)).get(`/api/admin/backup?token=${TOKEN}`);
    expect(res.status).toBe(401);
  });

  it('desactivado si falta BACKUP_TOKEN o BACKUP_PASSWORD → 404', async () => {
    for (const e of [{ BACKUP_PASSWORD: PASSWORD }, { BACKUP_TOKEN: TOKEN }, { BACKUP_TOKEN: TOKEN, BACKUP_PASSWORD: 'corta' }]) {
      const res = await request(makeApp(e)).get('/api/admin/backup').set('Authorization', `Bearer ${TOKEN}`);
      expect(res.status).toBe(404);
    }
  });

  it('token correcto → copia cifrada válida con la base de datos y todas las fotos', async () => {
    const res = await request(makeApp(env))
      .get('/api/admin/backup')
      .set('Authorization', `Bearer ${TOKEN}`)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/estilovivo-copia-\d{8}-\d{6}\.evbk/);
    expect(res.headers['cache-control']).toBe('no-store');
    const enc: Buffer = res.body;
    expect(enc.subarray(0, 6).toString()).toBe('EVBK1\n');
    // el contenido no se ve en claro
    expect(enc.includes(Buffer.from('lucia@ejemplo.es'))).toBe(false);

    const files = untar(zlib.gunzipSync(decryptBuffer(enc, PASSWORD)));
    expect(files.get('uploads/foto1.webp')?.toString()).toBe('foto-uno');
    expect(files.get('uploads/stories/historia.jpg')?.toString()).toBe('historia');
    expect(files.get(`uploads/${longName}`)?.toString()).toBe('nombre-largo');
    const manifest = JSON.parse(files.get('manifest.json')!.toString());
    expect(manifest.uploads.files).toBe(3);

    const restored = path.join(tmp, 'restaurada.db');
    fs.writeFileSync(restored, files.get('dev.db')!);
    const db = new Database(restored, { readonly: true });
    expect(db.prepare('SELECT email FROM User WHERE id = ?').get('u1')).toEqual({ email: 'lucia@ejemplo.es' });
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    db.close();

    expect(() => decryptBuffer(enc, 'contraseña equivocada')).toThrow();
  });

  it('limita la frecuencia de llamadas', async () => {
    const app = makeApp(env, 2);
    await request(app).get('/api/admin/backup');
    await request(app).get('/api/admin/backup');
    const res = await request(app).get('/api/admin/backup');
    expect(res.status).toBe(429);
  });
});

describe('safeEqual', () => {
  it('compara secretos', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
  });
});
