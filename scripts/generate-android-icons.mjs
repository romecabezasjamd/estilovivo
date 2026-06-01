/**
 * Genera iconos de launcher y splash Android desde el logo oficial.
 * Uso: node scripts/generate-android-icons.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ICON_SRC = path.join(ROOT, 'public', 'estilo-vivo-logo-icon.png');
const FULL_SRC = path.join(ROOT, 'public', 'estilo-vivo-logo-full.png');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const LAUNCHER = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const FOREGROUND = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const SPLASH_PORT = {
  'drawable-port-mdpi': { w: 320, h: 480 },
  'drawable-port-hdpi': { w: 480, h: 800 },
  'drawable-port-xhdpi': { w: 720, h: 1280 },
  'drawable-port-xxhdpi': { w: 960, h: 1600 },
  'drawable-port-xxxhdpi': { w: 1280, h: 1920 },
};

const SPLASH_LAND = {
  'drawable-land-mdpi': { w: 480, h: 320 },
  'drawable-land-hdpi': { w: 800, h: 480 },
  'drawable-land-xhdpi': { w: 1280, h: 720 },
  'drawable-land-xxhdpi': { w: 1600, h: 960 },
  'drawable-land-xxxhdpi': { w: 1920, h: 1280 },
};

const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

/** Icono cuadrado con fondo blanco (legacy launcher) */
async function writeLauncherIcon(size, outPath) {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  const logo = await sharp(ICON_SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/** Primer plano adaptativo (fondo transparente, logo en zona segura ~60%) */
async function writeForeground(size, outPath) {
  const inner = Math.round(size * 0.58);
  const logo = await sharp(ICON_SRC)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/** Splash con logo completo centrado */
async function writeSplash(w, h, outPath) {
  const maxW = Math.round(w * 0.72);
  const maxH = Math.round(h * 0.35);
  const logo = await sharp(FULL_SRC)
    .resize(maxW, maxH, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(ICON_SRC)) {
    console.error('No se encuentra', ICON_SRC);
    process.exit(1);
  }

  for (const [folder, size] of Object.entries(LAUNCHER)) {
    const dir = path.join(RES, folder);
    await ensureDir(dir);
    await writeLauncherIcon(size, path.join(dir, 'ic_launcher.png'));
    await writeLauncherIcon(size, path.join(dir, 'ic_launcher_round.png'));
    console.log('✓', folder, 'ic_launcher', size);
  }

  for (const [folder, size] of Object.entries(FOREGROUND)) {
    const dir = path.join(RES, folder);
    await ensureDir(dir);
    await writeForeground(size, path.join(dir, 'ic_launcher_foreground.png'));
    console.log('✓', folder, 'ic_launcher_foreground', size);
  }

  const splashDefault = path.join(RES, 'drawable', 'splash.png');
  await writeSplash(1080, 1920, splashDefault);
  console.log('✓ drawable/splash.png');

  for (const [folder, dim] of Object.entries({ ...SPLASH_PORT, ...SPLASH_LAND })) {
    const dir = path.join(RES, folder);
    await ensureDir(dir);
    await writeSplash(dim.w, dim.h, path.join(dir, 'splash.png'));
    console.log('✓', folder, `${dim.w}x${dim.h}`);
  }

  console.log('\nIconos Android generados correctamente.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
