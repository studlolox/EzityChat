import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ShieldAlert, Download, FileText } from 'lucide-react';
import {
  inspectOoxmlZip,
  sanitizeDocxDom,
  MAX_PREVIEW_BYTES,
} from '~/utils/document-preview-security';
import { useLocalize } from '~/hooks';

export interface DocxPreviewProps {
  arrayBuffer: ArrayBuffer;
  fileName?: string;
  onDownload?: () => void;
}

export type DocxStatus =
  | 'loading'
  | 'ready'
  | 'oversize_fallback'
  | 'zipbomb_fallback'
  | 'malformed_fallback'
  | 'error_fallback';

export function DocxPreview({
  arrayBuffer,
  fileName = 'document.docx',
  onDownload,
}: DocxPreviewProps) {
  const localize = useLocalize();
  const [status, setStatus] = useState<DocxStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [blockedImages, setBlockedImages] = useState(0);
  const [blockedLinks, setBlockedLinks] = useState(0);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setErrorMessage('');
    setBlockedImages(0);
    setBlockedLinks(0);

    if (arrayBuffer.byteLength > MAX_PREVIEW_BYTES) {
      setStatus('oversize_fallback');
      setErrorMessage('Document exceeds the 15 MiB inline preview size limit.');
      return;
    }

    const loadDocx = async () => {
      try {
        // Strict OOXML ZIP validation
        const zipCheck = inspectOoxmlZip(arrayBuffer, 'docx');
        if (!zipCheck.valid) {
          setStatus('zipbomb_fallback');
          setErrorMessage(zipCheck.error || 'Document failed archive safety validation.');
          return;
        }

        const docx = await import('docx-preview');
        if (cancelled) return;

        const hostEl = hostRef.current;
        if (!hostEl) return;

        let shadow = shadowRootRef.current;
        if (!shadow) {
          shadow = hostEl.attachShadow({ mode: 'open' });
          shadowRootRef.current = shadow;
        } else {
          shadow.innerHTML = '';
        }

        const styleEl = document.createElement('style');
        styleEl.textContent = `
          :host {
            display: block;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: auto;
            box-sizing: border-box;
            background: #f8fafc;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            -webkit-overflow-scrolling: touch;
          }
          .docx-wrapper {
            background: transparent !important;
            padding: 12px !important;
            min-height: 100%;
            box-sizing: border-box;
          }
          .docx-wrapper > section.docx {
            box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;
            margin: 0 auto 16px auto !important;
            max-width: 100% !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #1e293b !important;
            border-radius: 12px !important;
            padding: 20px 16px !important;
            box-sizing: border-box !important;
            border: 1px solid rgba(0,0,0,0.06) !important;
          }
          table {
            border-collapse: collapse !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            display: block !important;
          }
          td, th {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 10px !important;
          }
          img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 6px;
          }
          a {
            color: #0284c7;
          }
        `;
        shadow.appendChild(styleEl);

        const styleContainer = document.createElement('div');
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'docx-body-container';
        shadow.appendChild(styleContainer);
        shadow.appendChild(bodyContainer);

        await docx.renderAsync(arrayBuffer, bodyContainer, styleContainer, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: true,
          breakPages: true,
          experimental: false,
          useBase64URL: false,
          trimXmlDeclaration: true,
        });

        if (cancelled) return;

        const sanitization = sanitizeDocxDom(shadow);
        setBlockedImages(sanitization.blockedImagesCount);
        setBlockedLinks(sanitization.blockedLinksCount);

        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error_fallback');
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to render Word document preview.',
        );
      }
    };

    void loadDocx();

    return () => {
      cancelled = true;
      if (shadowRootRef.current) {
        shadowRootRef.current.innerHTML = '';
      }
    };
  }, [arrayBuffer]);

  const getStatusTitle = () => {
    if (status === 'zipbomb_fallback') {
      return localize('com_ui_preview_docx_archive_limit');
    }
    if (status === 'oversize_fallback') {
      return localize('com_ui_preview_docx_limit');
    }
    return localize('com_ui_preview_docx_error');
  };

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
    <div className="flex w-full flex-col gap-2">
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Loader2 className="text-text-tertiary size-6 animate-spin" />
          <span className="text-text-secondary text-xs">
            {localize('com_ui_preview_preparing')}
          </span>
        </div>
      )}

      {(blockedImages > 0 || blockedLinks > 0) && status === 'ready' && (
        <div className="border-border-light bg-surface-secondary/60 text-2xs text-text-secondary flex items-center gap-2 rounded-lg border px-3 py-1.5">
          <FileText className="size-3.5 shrink-0" />
          <span>
            {localize('com_ui_docx_external_blocked', {
              images: blockedImages,
              links: blockedLinks,
            })}
          </span>
        </div>
      )}

      {/* Shadow Host Container */}
      <div
        ref={hostRef}
        className={`border-border-light bg-surface-primary max-h-[65vh] w-full overflow-hidden rounded-xl border ${
          status === 'loading' ? 'hidden' : 'block'
        }`}
      />
    </div>
  );
}
