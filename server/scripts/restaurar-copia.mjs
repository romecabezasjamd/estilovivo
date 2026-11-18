#!/usr/bin/env node
// Descifra y descomprime una copia de seguridad de Estilo Vivo (.evbk) generada por GET /api/admin/backup.
//
// Uso:  node restaurar-copia.mjs <copia.evbk> <carpeta-destino>
// La contraseña (BACKUP_PASSWORD) se pide por teclado sin mostrarse, o se lee de la variable EVBK_PASSWORD.
// Resultado en <carpeta-destino>:  dev.db  (base de datos)  ·  uploads/  (fotos)  ·  manifest.json
// Necesita Node 18 o superior y el programa "tar" (viene con Windows 10/11, Linux y macOS).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';

const MAGIC = Buffer.from('EVBK1\n', 'ascii');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function fail(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}

async function askHidden(question) {
  if (process.env.EVBK_PASSWORD) return process.env.EVBK_PASSWORD;
  if (!process.stdin.isTTY) fail('Escribe la contraseña en la variable EVBK_PASSWORD.');
  process.stdout.write(question);
  return new Promise((resolve) => {
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '\u0003') {
        process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

const [file, dest] = process.argv.slice(2);
if (!file || !dest) fail('Uso: node restaurar-copia.mjs <copia.evbk> <carpeta-destino>');
if (!fs.existsSync(file)) fail(`No existe el archivo ${file}`);
const size = fs.statSync(file).size;
if (size < MAGIC.length + 16 + 12 + 16) fail('El archivo es demasiado pequeño: no es una copia válida.');

const fd = fs.openSync(file, 'r');
const head = Buffer.alloc(MAGIC.length + 28);
fs.readSync(fd, head, 0, head.length, 0);
const tag = Buffer.alloc(16);
fs.readSync(fd, tag, 0, 16, size - 16);
fs.closeSync(fd);
if (!head.subarray(0, MAGIC.length).equals(MAGIC)) fail('Este archivo no es una copia de Estilo Vivo.');
const salt = head.subarray(MAGIC.length, MAGIC.length + 16);
const iv = head.subarray(MAGIC.length + 16, MAGIC.length + 28);

const password = await askHidden('Contraseña de las copias (BACKUP_PASSWORD): ');
const key = crypto.scryptSync(password, salt, 32, SCRYPT);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);

fs.mkdirSync(dest, { recursive: true });
const tgz = path.join(dest, 'copia.tar.gz');
try {
  await pipeline(fs.createReadStream(file, { start: head.length, end: size - 17 }), decipher, fs.createWriteStream(tgz));
} catch {
  fs.rmSync(tgz, { force: true });
  fail('La contraseña no es correcta o el archivo está dañado.');
}

const r = spawnSync('tar', ['-xzf', 'copia.tar.gz'], { cwd: dest, stdio: 'inherit' });
if (r.status !== 0) fail(`No se pudo descomprimir. Queda el archivo ${tgz} para abrirlo a mano.`);
fs.rmSync(tgz, { force: true });

let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8')); } catch {}
console.log('\nCopia restaurada en:', path.resolve(dest));
console.log('  Fecha de la copia:', manifest.createdAt || '(desconocida)');
console.log('  Base de datos:    dev.db');
console.log('  Fotos:           ', manifest.uploads?.files ?? '?', 'archivos en uploads/');
