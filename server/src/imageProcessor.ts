import sharp from 'sharp';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import logger from './logger.js';
import { removeBackground, Config } from '@imgly/background-removal-node';

// Stabilization: Simple semaphore to ensure only one heavy AI task runs at a time
let isProcessingAI = false;
const aiQueue: (() => void)[] = [];

async function acquireAILock(): Promise<void> {
  if (!isProcessingAI) {
    isProcessingAI = true;
    return;
  }
  return new Promise(resolve => aiQueue.push(resolve));
}

function releaseAILock(): void {
  if (aiQueue.length > 0) {
    const next = aiQueue.shift();
    if (next) next();
  } else {
    isProcessingAI = false;
  }
}

interface ImageSizes {
  thumbnail: { width: number; height: number };
  medium: { width: number; height: number };
  large: { width: number; height: number };
}

const SIZES: ImageSizes = {
  thumbnail: { width: 200, height: 200 },
  medium: { width: 800, height: 800 },
  large: { width: 1600, height: 1600 },
};

export interface ProcessedImages {
  original: string;
  thumbnail: string;
  medium: string;
}

/**
 * Process and optimize uploaded image
 * Creates thumbnail and medium sizes, optimizes original
 */
export async function processImage(
  inputPath: string,
  outputDir: string,
  filename: string,
  removeBg: boolean = false
): Promise<ProcessedImages> {
  try {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    
    // Output paths
    const originalPath = removeBg 
      ? path.join(outputDir, `${basename}-original.webp`)
      : path.join(outputDir, `${basename}-original${ext}`);
    const thumbnailPath = path.join(outputDir, `${basename}-thumb.webp`);
    const mediumPath = path.join(outputDir, `${basename}-medium.webp`);

    let sourceInput: string | Buffer = inputPath;
    
    if (removeBg) {
      await acquireAILock();
      try {
        const memBefore = process.memoryUsage().rss / 1024 / 1024;
        logger.info(`Starting AI removal (Model: small). Memory: ${memBefore.toFixed(2)} MB`, { filename });
        
        // Timeout wrapper
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI Processing Timeout (15s)')), 15000)
        );

        const config: Config = {
          model: 'small', // Lightest model to prevent OOM
          debug: false,
        };

        const removalPromise = removeBackground(inputPath, config);
        
        const blob = await Promise.race([removalPromise, timeoutPromise]) as Blob;
        sourceInput = Buffer.from(await blob.arrayBuffer());
        
        const memAfter = process.memoryUsage().rss / 1024 / 1024;
        logger.info(`AI removal successful. Memory: ${memAfter.toFixed(2)} MB`, { filename });
      } catch (aiError) {
        logger.warn('AI background removal failed or timed out, applying smart fallback...', { error: aiError, filename });
        // Smart fallback: If it's a studio photo (on white/grey), Sharp can trim it
        try {
          const buffer = await sharp(inputPath)
            .rotate()
            .ensureAlpha()
            .trim({ threshold: 12 }) // Trims near-white surroundings
            .toBuffer();
          sourceInput = buffer;
          logger.info('Smart fallback removal applied', { filename });
        } catch (fallbackError) {
          logger.error('Background removal fallback failed as well', { error: fallbackError, filename });
          sourceInput = inputPath; // Fallback to original if everything fails
        }
      } finally {
        releaseAILock();
      }
    }

    // Process original (optimize but keep original size)
    const originalProcessor = sharp(sourceInput)
      .rotate() // Auto-rotate based on EXIF
      .resize(SIZES.large.width, SIZES.large.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    if (removeBg || ext.toLowerCase() === '.webp') {
      await originalProcessor.webp({ quality: 90 }).toFile(originalPath);
    } else {
      await originalProcessor.jpeg({ quality: 90, progressive: true }).toFile(originalPath);
    }

    // Process thumbnail
    await sharp(sourceInput)
      .rotate()
      .resize(SIZES.thumbnail.width, SIZES.thumbnail.height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 60 })
      .toFile(thumbnailPath);

    // Process medium size
    await sharp(sourceInput)
      .rotate()
      .resize(SIZES.medium.width, SIZES.medium.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toFile(mediumPath);

    logger.info('Image processed successfully', {
      filename,
      sizes: ['original', 'thumbnail', 'medium'],
    });

    return {
      original: path.basename(originalPath),
      thumbnail: path.basename(thumbnailPath),
      medium: path.basename(mediumPath),
    };
  } catch (error) {
    logger.error('Image processing failed', { error, filename });
    throw new Error(`Failed to process image: ${error}`);
  }
}

/**
 * Get image metadata
 */
export async function getImageMetadata(filePath: string) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    };
  } catch (error) {
    logger.error('Failed to get image metadata', { error, filePath });
    return null;
  }
}
