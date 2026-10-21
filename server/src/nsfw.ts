// Detección de fotos íntimas en el propio servidor (nsfwjs + TensorFlow.js, sin enviar fotos a terceros).
// Se usa en TODAS las subidas de imagen: si la foto es explícita, se borra y la petición se rechaza.
import sharp from 'sharp';
import { unlink } from 'fs/promises';
import * as tf from '@tensorflow/tfjs';
import logger from './logger.js';

type Prediction = { className: string; probability: number };
type Model = { classify: (img: tf.Tensor3D, topk?: number) => Promise<Prediction[]> };

// Umbrales: "Porn" y "Hentai" son contenido sexual explícito; "Sexy" (ropa de baño, lencería...) se permite
// porque en una app de moda es normal. Se bloquea:
//  - si la suma de explícito supera EXPLICIT_THRESHOLD, o
//  - si hay desnudo parcial o pose sexual (pecho o glúteos): algo de "Porn" y, sumado a "Sexy", mucho contenido sugerente.
//    Bikinis, lencería de catálogo y ropa deportiva quedan por debajo (probado con fotos de moda).
export const EXPLICIT_THRESHOLD = Number(process.env.NSFW_THRESHOLD || 0.45);
export const PARTIAL_PORN_THRESHOLD = Number(process.env.NSFW_PARTIAL_PORN || 0.25);
export const PARTIAL_TOTAL_THRESHOLD = Number(process.env.NSFW_PARTIAL_TOTAL || 0.75);

export function isExplicit(p: (name: string) => number): boolean {
  const explicitScore = p('Porn') + p('Hentai');
  if (explicitScore >= EXPLICIT_THRESHOLD) return true;
  return explicitScore >= PARTIAL_PORN_THRESHOLD && explicitScore + p('Sexy') >= PARTIAL_TOTAL_THRESHOLD;
}

let modelPromise: Promise<Model | null> | null = null;

async function loadModel(): Promise<Model | null> {
  try {
    try {
      await import('@tensorflow/tfjs-backend-wasm');
      await tf.setBackend('wasm');
    } catch {
      await tf.setBackend('cpu');
    }
    await tf.ready();
    const nsfwjs: any = await import('nsfwjs');
    const model = await (nsfwjs.load ?? nsfwjs.default?.load)('MobileNetV2');
    logger.info('Detector de fotos íntimas listo', { backend: tf.getBackend() });
    return model as Model;
  } catch (error) {
    logger.error('No se pudo cargar el detector de fotos íntimas', { error });
    return null;
  }
}

export function warmUpNsfw() {
  if (!modelPromise) modelPromise = loadModel();
  return modelPromise;
}

export type NsfwResult = { explicit: boolean; score: number; checked: boolean; predictions?: Prediction[] };

/** Clasifica una imagen (ruta o buffer). Si el modelo no carga, no bloquea (checked=false) y se registra. */
export async function checkImage(input: string | Buffer): Promise<NsfwResult> {
  const model = await warmUpNsfw();
  if (!model) return { explicit: false, score: 0, checked: false };
  const { data } = await sharp(input).rotate().resize(224, 224, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [224, 224, 3], 'int32');
  try {
    const predictions = await model.classify(tensor, 5);
    const p = (name: string) => predictions.find((x) => x.className === name)?.probability ?? 0;
    const score = p('Porn') + p('Hentai');
    return { explicit: isExplicit(p), score, checked: true, predictions };
  } finally {
    tensor.dispose();
  }
}

/** Middleware tras multer: revisa todas las imágenes subidas; si alguna es explícita, borra todas y responde 422. */
export async function rejectExplicitImages(req: any, res: any, next: any) {
  const files: { path: string }[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') for (const list of Object.values(req.files)) files.push(...(list as any[]));
  if (files.length === 0) return next();
  try {
    for (const f of files) {
      const r = await checkImage(f.path);
      if (r.explicit) {
        await Promise.all(files.map((x) => unlink(x.path).catch(() => {})));
        logger.warn('Foto íntima bloqueada en la subida', { userId: req.user?.userId, route: req.originalUrl, score: Number(r.score.toFixed(3)) });
        return res.status(422).json({
          error: 'explicitImage',
          message: 'No se puede subir esta foto: parece contenido íntimo o sexual. Las fotos de este tipo no están permitidas en Estilo Vivo.',
        });
      }
    }
  } catch (error) {
    // Si la imagen no se puede analizar (formato raro), no se bloquea por ello: se registra.
    logger.error('Error al revisar una foto subida', { route: req.originalUrl, error });
  }
  next();
}
