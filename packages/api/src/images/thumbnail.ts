import fs from 'node:fs';
import sharp from 'sharp';
import path from 'node:path';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const RASTER_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export interface ThumbnailHandlerOptions {
  imageOutputDir: string;
  targetWidth?: number;
  quality?: number;
}

/**
 * On-demand Hermes-style image thumbnail generation and disk caching middleware.
 * Intercepts requests with `?thumb=1` or `?thumbnail=true` to serve compact 480px WebP thumbnails.
 */
export function createThumbnailHandler({
  imageOutputDir,
  targetWidth = 480,
  quality = 80,
}: ThumbnailHandlerOptions) {
  const resolvedRoot = path.resolve(imageOutputDir);
  const thumbnailsRoot = path.join(resolvedRoot, 'thumbnails');

  return async function thumbnailMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const isThumbRequested = req.query.thumb === '1' || req.query.thumbnail === 'true';

    if (!isThumbRequested) {
      return next();
    }

    try {
      const decodedPath = decodeURIComponent(req.path);
      const ext = path.extname(decodedPath).toLowerCase();

      if (!RASTER_IMAGE_EXTS.has(ext)) {
        return next();
      }

      // Security: ensure path resolves within imageOutputDir and does not escape
      const fullOriginalPath = path.resolve(resolvedRoot, `.${decodedPath}`);
      if (!fullOriginalPath.startsWith(resolvedRoot)) {
        return next();
      }

      // Verify original file exists
      if (!fs.existsSync(fullOriginalPath)) {
        return next();
      }

      const stat = await fs.promises.stat(fullOriginalPath);
      if (!stat.isFile()) {
        return next();
      }

      // Build target thumbnail path, maintaining subdirectories (e.g. /userId/filename_w480.webp)
      const relativeToRoot = path.relative(resolvedRoot, fullOriginalPath);
      const parsedRel = path.parse(relativeToRoot);
      const thumbDir = path.join(thumbnailsRoot, parsedRel.dir);
      const thumbFileName = `${parsedRel.name}_w${targetWidth}.webp`;
      const thumbFullPath = path.join(thumbDir, thumbFileName);

      // Fast-path: cached thumbnail exists on disk
      if (fs.existsSync(thumbFullPath)) {
        const thumbStat = await fs.promises.stat(thumbFullPath);
        if (thumbStat.isFile() && thumbStat.size > 0) {
          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.sendFile(thumbFullPath);
        }
      }

      // Generate thumbnail via sharp
      const inputBuffer = await fs.promises.readFile(fullOriginalPath);
      const thumbBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: targetWidth,
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({
          quality,
          effort: 4,
        })
        .toBuffer();

      // Atomically write thumbnail to disk
      try {
        if (!fs.existsSync(thumbDir)) {
          await fs.promises.mkdir(thumbDir, { recursive: true });
        }
        const randomSuffix = crypto.randomBytes(6).toString('hex');
        const tmpPath = path.join(thumbDir, `.${thumbFileName}.tmp_${randomSuffix}`);
        await fs.promises.writeFile(tmpPath, thumbBuffer);
        await fs.promises.rename(tmpPath, thumbFullPath);
      } catch (_writeErr) {
        // Non-fatal if disk write fails; buffer can still be returned
      }

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).send(thumbBuffer);
    } catch (_err) {
      // Fall through to default static file server on any thumbnail generation error
      return next();
    }
  };
}
