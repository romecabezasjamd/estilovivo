// Revisión automática (gratis, en nuestro servidor) de las fotos de los retos semanales.
// Se acepta sola si es una foto real y nueva, no es íntima (eso ya lo filtra nsfw.ts antes) y, en los retos con
// una regla de color objetiva, la cumple. Si se acepta, los puntos se dan al momento; si no, se explica el motivo
// y se puede volver a intentar con otra foto.
import sharp from 'sharp';
import { checkImage } from './nsfw.js';

export type ReviewResult = { ok: true; reason: string; hash: string } | { ok: false; reason: string; hash?: string };

const MIN_SIDE = 320;

/** Huella de la imagen (dHash 64 bits en hex): dos fotos casi iguales dan huellas casi iguales. */
export async function imageHash(path: string): Promise<string> {
  const { data } = await sharp(path).rotate().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hashDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

type ColorStats = { hueBuckets: number; neutralShare: number; dominantHueShare: number; variance: number };

/** Estadísticas de color de la parte central de la foto (donde suele estar el look). */
async function colorStats(path: string): Promise<ColorStats> {
  const { data, info } = await sharp(path).rotate().resize(48, 64, { fit: 'cover' })
    .extract({ left: 6, top: 4, width: 36, height: 56 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const buckets = new Array(12).fill(0);
  let neutral = 0, sum = 0, sumSq = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum; sumSq += lum * lum;
    if (sat < 0.22 || l < 0.12 || l > 0.92) { neutral++; continue; }
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    buckets[Math.floor((((h * 60) + 360) % 360) / 30)]++;
  }
  const colored = n - neutral;
  const significant = buckets.filter((c) => c / n >= 0.06).length;
  // Familia de color = dos tramos de tono vecinos (p. ej. azul claro y azul marino cuentan como uno)
  const pairs = buckets.map((c, i) => c + buckets[(i + 1) % 12]);
  const dominant = colored ? Math.max(...pairs) / colored : 1;
  const mean = sum / n;
  return { hueBuckets: significant, neutralShare: neutral / n, dominantHueShare: dominant, variance: sumSq / n - mean * mean };
}

/** Regla de color objetiva según el reto (los demás retos no tienen una comprobable sin IA de pago). */
function colorRule(tag: string, c: ColorStats): string | null {
  const t = tag.toLowerCase();
  if (t.includes('color block') && c.hueBuckets < 3) {
    return 'Este reto pide al menos 3 colores bien distintos y en la foto no se aprecian. Prueba con prendas de colores más vivos o con más luz.';
  }
  if (t.includes('monocromo') && !(c.neutralShare > 0.75 || c.dominantHueShare > 0.6)) {
    return 'Este reto pide una sola familia de color y en la foto se ven varios colores distintos.';
  }
  if ((t.includes('minimal')) && c.neutralShare < 0.55) {
    return 'Este reto pide colores neutros (blanco, negro, gris, beige…) y en la foto predominan colores vivos.';
  }
  return null;
}

/**
 * Revisa la foto de un reto. [previousHashes] = huellas de las fotos ya enviadas a retos (de cualquier persona),
 * para no aceptar la misma foto dos veces ni fotos copiadas.
 */
export async function reviewChallengePhoto(path: string, tag: string, previousHashes: string[]): Promise<ReviewResult> {
  const meta = await sharp(path).metadata();
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_SIDE) {
    return { ok: false, reason: 'La foto es demasiado pequeña. Haz una foto nueva de tu look con la cámara.' };
  }
  const hash = await imageHash(path);
  if (previousHashes.some((h) => hashDistance(h, hash) <= 5)) {
    return { ok: false, reason: 'Esta foto ya se ha usado en un reto. Sube una foto nueva de tu look.', hash };
  }
  const stats = await colorStats(path);
  if (stats.variance < 0.0015) {
    return { ok: false, reason: 'La foto parece vacía o de un solo color. Sube una foto en la que se vea tu look.', hash };
  }
  // Dibujos, capturas con mucho texto o ilustraciones: el detector las marca como "Drawing"
  const kind = await checkImage(path).catch(() => null);
  const drawing = kind?.predictions?.find((p) => p.className === 'Drawing')?.probability ?? 0;
  if (drawing > 0.6) {
    return { ok: false, reason: 'Parece un dibujo o una captura de pantalla. El reto necesita una foto real de tu look.', hash };
  }
  const rule = colorRule(tag, stats);
  if (rule) return { ok: false, reason: rule, hash };
  return { ok: true, reason: 'Revisado automáticamente: ¡reto superado!', hash };
}
