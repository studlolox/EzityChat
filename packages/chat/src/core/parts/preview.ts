import { FileSources } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';

type PreviewKind = 'pdf' | 'docx' | 'xlsx' | 'text' | false;

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'xml',
  'yaml',
  'yml',
  'html',
  'css',
  'js',
  'ts',
  'jsx',
  'tsx',
  'py',
  'rb',
  'java',
  'c',
  'cpp',
  'h',
  'go',
  'rs',
  'sh',
  'sql',
  'log',
]);

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export function shouldUseSharedFileDownload(shareId?: string, fileId?: string): boolean {
  return !!shareId && !!fileId;
}

export function shouldUseExtractedTextPreview(deliveryPath?: TFile['llmDeliveryPath']): boolean {
  return deliveryPath === 'text';
}

export function isExtractedTextPreviewLoading(
  status: 'pending' | 'ready' | 'failed' | undefined,
  isInitialLoading: boolean,
  isError: boolean,
): boolean {
  return !isError && (isInitialLoading || status === 'pending');
}

function getPreviewKindByMime(mime?: string): PreviewKind {
  if (!mime) {
    return false;
  }
  if (mime.includes('pdf')) {
    return 'pdf';
  }
  if (mime.includes('wordprocessingml.document') || mime.includes('application/msword')) {
    return 'docx';
  }
  if (mime.includes('spreadsheetml.sheet') || mime.includes('application/vnd.ms-excel')) {
    return 'xlsx';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('yaml') ||
    mime.includes('csv')
  ) {
    return 'text';
  }
  return false;
}

function getPreviewKindByExtension(filename: string): PreviewKind {
  const extension = getFileExtension(filename);
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (extension === 'docx') {
    return 'docx';
  }
  if (extension === 'xlsx') {
    return 'xlsx';
  }
  return TEXT_EXTENSIONS.has(extension) ? 'text' : false;
}

export function getPreviewKind(
  fileName: string,
  fileType?: string,
  fileSource?: string,
): PreviewKind {
  if (fileSource === FileSources.text) {
    return 'text';
  }
  return getPreviewKindByMime(fileType) || getPreviewKindByExtension(fileName);
}
