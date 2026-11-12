import JSZip from 'jszip';
import { apiBaseUrl, dataService } from 'librechat-data-provider';
import type { UnifiedLibraryItem } from '~/components/Library/types';
import { triggerDownload } from './downloadFile';
import { toAbsoluteFilePath } from './media';

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'file';
}

function getUniqueName(usedNames: Map<string, number>, baseName: string): string {
  const count = usedNames.get(baseName) ?? 0;
  usedNames.set(baseName, count + 1);
  if (count === 0) {
    return baseName;
  }
  const dotIdx = baseName.lastIndexOf('.');
  if (dotIdx > 0) {
    const name = baseName.slice(0, dotIdx);
    const ext = baseName.slice(dotIdx);
    return `${name} (${count})${ext}`;
  }
  return `${baseName} (${count})`;
}

/**
 * Downloads multiple library items as a compressed ZIP file.
 * - Files and images are added with their binary content.
 * - Canvas documents are exported as Markdown (.md) files.
 * - Canvas mindmap boards are exported as JSON (.json) files.
 */
export async function downloadLibraryItemsAsZip(
  items: UnifiedLibraryItem[],
  userId?: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  // If only 1 file/image, trigger direct download
  if (items.length === 1) {
    const single = items[0];
    if (single.kind === 'canvas_doc' && single.canvasDoc) {
      try {
        const docData = await dataService.getCanvasDocument(single.canvasDoc._id);
        const content = docData.currentRevision?.content ?? '';
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${sanitizeFilename(single.title)}.md`);
        return;
      } catch {
        // Fall through
      }
    } else if (single.kind === 'canvas_board' && single.canvasBoard) {
      try {
        const boardData = await dataService.getCanvasBoard(single.canvasBoard._id);
        const content = JSON.stringify(boardData.board ?? {}, null, 2);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${sanitizeFilename(single.title)}.json`);
        return;
      } catch {
        // Fall through
      }
    } else if (single.file) {
      const target = single.file.filepath || single.file.file_id;
      if (target) {
        triggerDownload(target, single.file.filename || single.title);
        return;
      }
    }
  }

  // Multi-item ZIP generation
  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  let completed = 0;
  const total = items.length;

  for (const item of items) {
    try {
      if (item.kind === 'canvas_doc' && item.canvasDoc) {
        const docData = await dataService.getCanvasDocument(item.canvasDoc._id);
        const content = docData.currentRevision?.content ?? '';
        const rawName = `${sanitizeFilename(item.title)}.md`;
        const entryName = getUniqueName(usedNames, rawName);
        zip.file(entryName, content);
      } else if (item.kind === 'canvas_board' && item.canvasBoard) {
        const boardData = await dataService.getCanvasBoard(item.canvasBoard._id);
        const content = JSON.stringify(boardData.board ?? {}, null, 2);
        const rawName = `${sanitizeFilename(item.title)}.json`;
        const entryName = getUniqueName(usedNames, rawName);
        zip.file(entryName, content);
      } else if (item.file) {
        let blob: Blob | null = null;
        if (item.file.file_id && userId) {
          try {
            const downloadRes = await dataService.getFileDownload(userId, item.file.file_id);
            if (downloadRes.data) {
              blob = downloadRes.data as Blob;
            }
          } catch {
            // Try fetching by previewUrl if available
          }
        }

        if (!blob && item.previewUrl) {
          try {
            const fetchUrl = toAbsoluteFilePath(item.previewUrl, apiBaseUrl());
            const fileRes = await fetch(fetchUrl);
            if (fileRes.ok) {
              blob = await fileRes.blob();
            }
          } catch {
            // Skip if unreachable
          }
        }

        if (blob) {
          const rawName = sanitizeFilename(item.file.filename || item.title);
          const entryName = getUniqueName(usedNames, rawName);
          zip.file(entryName, blob);
        }
      }
    } catch {
      // Continue bundling remaining files
    } finally {
      completed++;
      onProgress?.(completed, total);
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const zipUrl = URL.createObjectURL(zipBlob);
  triggerDownload(zipUrl, `ezity-library-${dateSlug}.zip`);
}
