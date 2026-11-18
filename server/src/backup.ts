// Copias de seguridad descargables para guardarlas FUERA del servidor (ver COPIAS-DE-SEGURIDAD.txt en la raíz).
//
// GET /api/admin/backup con la cabecera "Authorization: Bearer <BACKUP_TOKEN>" devuelve un único archivo con:
//   - dev.db       instantánea coherente de SQLite (VACUUM INTO: nunca se copia el archivo mientras se usa)
//   - uploads/...  todas las fotos que suben las personas usuarias (UPLOADS_DIR, incluidas las historias)
//   - manifest.json fecha, versión del formato y número de archivos
// empaquetado como .tar.gz y SIEMPRE cifrado con AES-256-GCM a partir de BACKUP_PASSWORD (contiene datos personales).
//
// Si falta BACKUP_TOKEN o BACKUP_PASSWORD, la ruta está desactivada (404). El token se compara en tiempo constante
// y hay un límite de peticiones por IP. Para descifrar: node scripts/restaurar-copia.mjs (mismo formato, ver abajo).
//
// Formato del archivo cifrado (.evbk):
//   "EVBK1\n" (6 bytes) | sal (16) | iv (12) | datos cifrados (tar.gz) | etiqueta GCM (16)
//   clave = scrypt(BACKUP_PASSWORD, sal, 32, { N: 2^15, r: 8, p: 1 })
import type { Express, Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { PassThrough, Transform, type Writable } from 'stream';

export const BACKUP_MAGIC = Buffer.from('EVBK1\n', 'ascii');
export const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MIN_PASSWORD = 12;

type Log = { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };

export interface BackupDeps {
  /** Escribe una instantánea coherente de la base de datos en `dest` (p. ej. VACUUM INTO). */
  snapshotDb: (dest: string) => Promise<void>;
  uploadsDir: string;
  logger: Log;
  /** Por defecto process.env; en las pruebas se pasan valores fijos. */
  env?: { BACKUP_TOKEN?: string; BACKUP_PASSWORD?: string };
  /** Peticiones permitidas por IP y hora (por defecto 6). */
  maxPerHour?: number;
}

/** Compara dos secretos en tiempo constante (también cuando tienen distinta longitud). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}

// ---------- tar (formato ustar + cabecera PAX para nombres largos) ----------
function octal(n: number, len: number): string {
  return n.toString(8).padStart(len - 1, '0') + '\0';
}
function tarHeader(name: string, size: number, mtime: Date, type: '0' | 'x' = '0'): Buffer {
  const h = Buffer.alloc(512, 0);
  h.write(name.slice(0, 100), 0, 'utf8');
  h.write(octal(0o644, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');
  h.write(octal(0, 8), 116, 'ascii');
  h.write(octal(size, 12), 124, 'ascii');
  h.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 'ascii');
  h.write('        ', 148, 'ascii');
  h.write(type, 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(octal(sum, 7) + ' ', 148, 'ascii');
  return h;
}
const pad = (size: number) => Buffer.alloc((512 - (size % 512)) % 512, 0);

async function writeChunk(out: Writable, chunk: Buffer): Promise<void> {
  if (!out.write(chunk)) await new Promise<void>((r) => out.once('drain', r));
}

async function tarAddFile(out: Writable, name: string, file: string): Promise<void> {
  const st = await fs.promises.stat(file);
  if (Buffer.byteLength(name, 'utf8') > 100) {
    // Cabecera PAX con la ruta completa
    const body = (len: number) => `${len} path=${name}\n`;
    let rec = body(0);
    let len = Buffer.byteLength(rec, 'utf8');
    while (Buffer.byteLength(body(len), 'utf8') !== len) len = Buffer.byteLength(body(len), 'utf8');
    rec = body(len);
    const data = Buffer.from(rec, 'utf8');
    await writeChunk(out, tarHeader('PaxHeader', data.length, st.mtime, 'x'));
    await writeChunk(out, data);
    await writeChunk(out, pad(data.length));
  }
  await writeChunk(out, tarHeader(name, st.size, st.mtime));
  for await (const chunk of fs.createReadStream(file)) await writeChunk(out, chunk as Buffer);
  await writeChunk(out, pad(st.size));
}

async function tarAddBuffer(out: Writable, name: string, data: Buffer): Promise<void> {
  await writeChunk(out, tarHeader(name, data.length, new Date()));
  await writeChunk(out, data);
  await writeChunk(out, pad(data.length));
}

/** Lista recursiva de archivos normales (sin seguir enlaces), con rutas relativas con "/". */
export async function listFiles(dir: string, rel = ''): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(dir, r)));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

/** Cifra un flujo con AES-256-GCM. Escribe cabecera + datos + etiqueta. */
export function encryptStream(password: string): Transform {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32, SCRYPT);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let started = false;
  return new Transform({
    transform(chunk, _enc, cb) {
      if (!started) {
        started = true;
        this.push(Buffer.concat([BACKUP_MAGIC, salt, iv]));
      }
      cb(null, cipher.update(chunk));
    },
    flush(cb) {
      if (!started) this.push(Buffer.concat([BACKUP_MAGIC, salt, iv]));
      const last = cipher.final();
      if (last.length) this.push(last);
      this.push(cipher.getAuthTag());
      cb();
    },
  });
}

/** Descifra un archivo .evbk completo y devuelve el .tar.gz (lanza un error si la contraseña no es correcta). */
export function decryptBuffer(data: Buffer, password: string): Buffer {
  if (data.length < BACKUP_MAGIC.length + 16 + 12 + 16 || !data.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new Error('No es una copia de Estilo Vivo');
  }
  let o = BACKUP_MAGIC.length;
  const salt = data.subarray(o, (o += 16));
  const iv = data.subarray(o, (o += 12));
  const tag = data.subarray(data.length - 16);
  const body = data.subarray(o, data.length - 16);
  const key = crypto.scryptSync(password, salt, 32, SCRYPT);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
}

/** Genera la copia completa (tar.gz cifrado) y la escribe en `out`. Devuelve cuántas fotos incluye. */
export async function writeBackup(deps: Pick<BackupDeps, 'snapshotDb' | 'uploadsDir'>, password: string, out: Writable): Promise<{ files: number; dbBytes: number }> {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'evbk-'));
  const dbFile = path.join(tmp, 'dev.db');
  try {
    await deps.snapshotDb(dbFile);
    const head = Buffer.alloc(16);
    const fd = await fs.promises.open(dbFile, 'r');
    await fd.read(head, 0, 16, 0);
    await fd.close();
    if (head.toString('latin1') !== 'SQLite format 3\0') throw new Error('La instantánea de la base de datos no es válida');
    const dbBytes = (await fs.promises.stat(dbFile)).size;
    const uploads = await listFiles(deps.uploadsDir);

    const tar = new PassThrough();
    const done = pipeline(tar, zlib.createGzip({ level: 6 }), encryptStream(password), out);
    const manifest = {
      app: 'Estilo Vivo',
      format: 1,
      createdAt: new Date().toISOString(),
      database: { file: 'dev.db', bytes: dbBytes },
      uploads: { dir: 'uploads', files: uploads.length },
    };
    await tarAddBuffer(tar, 'manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
    await tarAddFile(tar, 'dev.db', dbFile);
    for (const rel of uploads) {
      try {
        await tarAddFile(tar, `uploads/${rel}`, path.join(deps.uploadsDir, rel));
      } catch {
        // la foto se borró mientras se hacía la copia: se omite
      }
    }
    await writeChunk(tar, Buffer.alloc(1024, 0)); // fin del tar
    tar.end();
    await done;
    return { files: uploads.length, dbBytes };
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

export function registerBackupRoutes(app: Express, deps: BackupDeps) {
  const env = deps.env ?? process.env;
  const limiter: RequestHandler = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: deps.maxPerHour ?? 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones de copia. Espera una hora.' },
  });
  let running = false;

  app.get('/api/admin/backup', limiter, async (req: Request, res: Response) => {
    const token = env.BACKUP_TOKEN || '';
    const password = env.BACKUP_PASSWORD || '';
    if (!token || password.length < MIN_PASSWORD) return res.status(404).json({ error: 'No disponible' });

    const auth = String(req.headers.authorization || '');
    const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!given || !safeEqual(given, token)) {
      deps.logger.warn('Copia de seguridad: token incorrecto', { ip: req.ip });
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (running) return res.status(429).json({ error: 'Ya se está generando una copia. Prueba en unos minutos.' });

    running = true;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="estilovivo-copia-${stamp}.evbk"`);
    res.setHeader('Cache-Control', 'no-store');
    const started = Date.now();
    try {
      const r = await writeBackup(deps, password, res);
      deps.logger.info('Copia de seguridad descargada', { ip: req.ip, fotos: r.files, dbBytes: r.dbBytes, ms: Date.now() - started });
    } catch (error) {
      deps.logger.error('Copia de seguridad: error', { error: String(error) });
      if (!res.headersSent) { res.removeHeader('Content-Disposition'); res.status(500).json({ error: 'No se pudo generar la copia' }); }
      else res.destroy(error as Error); // corta la descarga para que el script detecte el fallo
    } finally {
      running = false;
    }
  });
}

