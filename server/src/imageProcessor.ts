import sharp from 'sharp';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import logger from './logger.js';
import { removeBackground } from '@imgly/background-removal-node';

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
    const originalPath = path.join(outputDir, `${basename}-original${ext}`);
    const thumbnailPath = path.join(outputDir, `${basename}-thumb.webp`);
    const mediumPath = path.join(outputDir, `${basename}-medium.webp`);

    let sourceInput: string | Buffer = inputPath;
    
    if (removeBg) {
      logger.info('Removing background...', { filename });
      const blob = await removeBackground(inputPath);
      sourceInput = Buffer.from(await blob.arrayBuffer());
    }

    // Process original (optimize but keep original size)
    await sharp(sourceInput)
      .rotate() // Auto-rotate based on EXIF
      .resize(SIZES.large.width, SIZES.large.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90, progressive: true })
      .toFile(originalPath);

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
