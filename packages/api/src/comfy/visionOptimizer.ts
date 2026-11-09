import sharp from 'sharp';

export interface OptimizedVisionImage {
  data: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  originalBytes: number;
  optimizedBytes: number;
  isOptimized: boolean;
}

export const DEFAULT_MAX_VISION_DIMENSION = 1536;
export const DEFAULT_VISION_JPEG_QUALITY = 85;

export async function optimizeImageForVision(
  buffer: Buffer,
  mimeType: string,
  maxDimension: number = DEFAULT_MAX_VISION_DIMENSION,
  quality: number = DEFAULT_VISION_JPEG_QUALITY,
): Promise<OptimizedVisionImage> {
  const originalBytes = buffer.length;

  if (mimeType === 'image/svg+xml' || mimeType === 'image/gif') {
    return {
      data: buffer,
      mimeType,
      originalBytes,
      optimizedBytes: originalBytes,
      isOptimized: false,
    };
  }

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (
      width > 0 &&
      height > 0 &&
      width <= maxDimension &&
      height <= maxDimension &&
      originalBytes <= 800 * 1024
    ) {
      return {
        data: buffer,
        mimeType,
        width,
        height,
        originalBytes,
        optimizedBytes: originalBytes,
        isOptimized: false,
      };
    }

    const resizedBuffer = await image
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const resizedMeta = await sharp(resizedBuffer).metadata();

    return {
      data: resizedBuffer,
      mimeType: 'image/jpeg',
      width: resizedMeta.width || width,
      height: resizedMeta.height || height,
      originalBytes,
      optimizedBytes: resizedBuffer.length,
      isOptimized: true,
    };
  } catch {
    // If sharp fails to parse, return original untouched
    return {
      data: buffer,
      mimeType,
      originalBytes,
      optimizedBytes: originalBytes,
      isOptimized: false,
    };
  }
}
