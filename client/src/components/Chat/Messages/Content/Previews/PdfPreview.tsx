import React, { useState, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn, disabledInkClasses } from '@librechat/client';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { useLocalize } from '~/hooks';

// Configure PDF worker to load from local origin
if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MiB inline preview cap
export const MAX_PDF_PAGES = 10; // Max pages allowed for inline preview

export interface PdfPreviewProps {
  arrayBuffer: ArrayBuffer;
  fileName?: string;
  onDownload?: () => void;
}

export type PdfStatus =
  | 'loading'
  | 'ready'
  | 'oversize_fallback'
  | 'encrypted_fallback'
  | 'malformed_fallback'
  | 'error_fallback';

export function PdfPreview({
  arrayBuffer,
  fileName = 'document.pdf',
  onDownload,
}: PdfPreviewProps) {
  const localize = useLocalize();
  const [status, setStatus] = useState<PdfStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [pageLoading, setPageLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const fileSource = useMemo(() => {
    if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
      return null;
    }
    return { data: new Uint8Array(arrayBuffer) };
  }, [arrayBuffer]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTotalPages(numPages || 1);
    setStatus('ready');
  };

  const handleDocumentLoadError = (error: Error) => {
    const name = error?.name || '';
    const msg = error?.message || '';

    if (name === 'PasswordException' || msg.toLowerCase().includes('password')) {
      setStatus('encrypted_fallback');
      setErrorMessage('PDF is password-protected. Download the file to view it.');
    } else if (
      name === 'InvalidPDFException' ||
      msg.toLowerCase().includes('invalid') ||
      msg.toLowerCase().includes('corrupt')
    ) {
      setStatus('malformed_fallback');
      setErrorMessage('PDF document is corrupted or malformed. Download the file to inspect.');
    } else {
      setStatus('error_fallback');
      setErrorMessage('Unable to render PDF preview inline. Download the file to view it.');
    }
  };

  const boundedMaxPage = Math.min(totalPages, MAX_PDF_PAGES);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < boundedMaxPage) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handleZoomIn = () => {
    setZoomScale((s) => Math.min(2.5, Math.round((s + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100));
  };

  const handleZoomReset = () => {
    setZoomScale(1.0);
  };

  const getStatusTitle = () => {
    if (status === 'encrypted_fallback') {
      return localize('com_ui_preview_pdf_error');
    }
    if (status === 'malformed_fallback') {
      return localize('com_ui_preview_pdf_error');
    }
    return localize('com_ui_preview_unavailable');
  };

  if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <ShieldAlert className="text-status-warning size-8" />
        <p className="text-text-primary text-sm font-semibold">
          {localize('com_ui_preview_pdf_limit')}
        </p>
        <p className="text-text-secondary max-w-sm text-xs">
          {localize('com_ui_preview_pdf_limit_desc')}
        </p>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" />
            <span>{localize('com_ui_download_named_file', { filename: fileName })}</span>
          </button>
        )}
      </div>
    );
  }

  if (status !== 'ready' && status !== 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <ShieldAlert className="text-status-warning size-8" />
        <p className="text-text-primary text-sm font-semibold">{getStatusTitle()}</p>
        <p className="text-text-secondary max-w-sm text-xs">
          {errorMessage || localize('com_ui_preview_pdf_limit_desc')}
        </p>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" />
            <span>{localize('com_ui_download_named_file', { filename: fileName })}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 select-none">
      {/* Top Controls Toolbar */}
      <div className="border-border-light bg-surface-secondary/80 flex w-full flex-wrap items-center justify-between gap-1 rounded-xl border p-1.5">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1 || pageLoading}
            onClick={handlePrevPage}
            className={cn(
              'hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors disabled:opacity-50',
              disabledInkClasses,
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>

          <span className="text-text-primary px-1.5 font-mono text-xs font-medium">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= boundedMaxPage || pageLoading}
            onClick={handleNextPage}
            className={cn(
              'hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors disabled:opacity-50',
              disabledInkClasses,
            )}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={zoomScale <= 0.5 || pageLoading}
            onClick={handleZoomOut}
            className={cn(
              'hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors disabled:opacity-50',
              disabledInkClasses,
            )}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomReset}
            className="hover:bg-surface-tertiary text-text-primary rounded-lg px-2 py-1 font-mono text-xs font-medium transition-colors"
            aria-label="Reset zoom"
          >
            {Math.round(zoomScale * 100)}%
          </button>

          <button
            type="button"
            disabled={zoomScale >= 2.5 || pageLoading}
            onClick={handleZoomIn}
            className={cn(
              'hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors disabled:opacity-50',
              disabledInkClasses,
            )}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" />
          </button>
        </div>
      </div>

      {totalPages > MAX_PDF_PAGES && (
        <span className="text-text-tertiary text-2xs text-center">
          {localize('com_ui_preview_limited_pages', { count: MAX_PDF_PAGES })}
        </span>
      )}

      {/* PDF View Container */}
      <div
        ref={containerRef}
        className="border-border-light bg-surface-secondary/40 relative flex max-h-[60vh] w-full items-center justify-center overflow-auto rounded-xl border p-3"
      >
        {fileSource && (
          <Document
            file={fileSource}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="flex items-center justify-center py-10">
                <Loader2 className="text-text-tertiary size-6 animate-spin" />
              </div>
            }
            error={
              <div className="text-status-error py-6 text-xs">
                {localize('com_ui_preview_pdf_error')}
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={zoomScale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={() => setPageLoading(false)}
              onRenderError={() => setPageLoading(false)}
              className="overflow-hidden rounded-md shadow-md"
            />
          </Document>
        )}
      </div>
    </div>
  );
}
