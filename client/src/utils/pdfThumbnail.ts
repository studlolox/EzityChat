import { pdfjs } from 'react-pdf';
import { cachePreview, getCachedPreview } from './previewCache';

if (
  typeof window !== 'undefined' &&
  pdfjs.GlobalWorkerOptions &&
  !pdfjs.GlobalWorkerOptions.workerSrc
) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const pendingGenerations = new Map<string, Promise<string | null>>();

/**
 * Generates an on-demand 480px WebP thumbnail of Page 1 of a PDF file using PDF.js.
 * Caches the resulting data URL in `previewCache` under `cacheKey`.
 */
export async function getOrGeneratePdfThumbnail(
  cacheKey: string,
  pdfUrl: string,
): Promise<string | null> {
  const cached = getCachedPreview(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingGenerations.get(cacheKey);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const loadingTask = pdfjs.getDocument({
        url: pdfUrl,
        withCredentials: true,
        disableRange: true,
        disableStream: true,
      });

      const pdf = await loadingTask.promise;
      if (pdf.numPages < 1) {
        return null;
      }

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      const targetWidth = 480;
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      const canvasContext = canvas.getContext('2d');

      if (!canvasContext) {
        return null;
      }

      await page.render({
        canvasContext,
        viewport: scaledViewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/webp', 0.82);
      cachePreview(cacheKey, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('[pdfThumbnail] Failed to render PDF thumbnail for', cacheKey, err);
      return null;
    } finally {
      pendingGenerations.delete(cacheKey);
    }
  })();

  pendingGenerations.set(cacheKey, promise);
  return promise;
}
