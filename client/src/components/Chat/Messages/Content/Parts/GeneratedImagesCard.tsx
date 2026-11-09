import React, { useState, useRef } from 'react';
import { DialogImage } from '@librechat/chat/components';
import { Download, Eye, Copy, Check, Sparkles } from 'lucide-react';
import { useLocalize } from '~/hooks';

export interface GeneratedImagesCardProps {
  url: string;
  prompt?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  workflow?: string;
  filename?: string;
}

export function GeneratedImagesCard({
  url,
  prompt,
  aspectRatio,
  width,
  height,
  workflow,
  filename,
}: GeneratedImagesCardProps) {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const resolvedFilename =
    filename || (prompt ? `${prompt.slice(0, 30).trim()}.png` : 'generated-image.png');

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = resolvedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="border-border-light bg-surface-primary/70 my-2 max-w-lg overflow-hidden rounded-2xl border shadow-xs transition-shadow">
      {/* Image Preview Container */}
      <div className="group relative overflow-hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          className="focus-visible:ring-text-primary block w-full focus:outline-hidden focus-visible:ring-2"
          aria-label={localize('com_ui_preview')}
        >
          <img
            src={url}
            alt={prompt || 'Generated Image'}
            className="h-auto max-h-[50vh] w-full object-contain"
            loading="lazy"
          />
        </button>

        {/* Hover Quick Action Buttons */}
        <div className="bg-surface-primary/80 absolute top-2.5 right-2.5 flex items-center gap-1 rounded-xl p-1 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="hover:bg-surface-secondary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
            title={localize('com_ui_preview')}
          >
            <Eye className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="hover:bg-surface-secondary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
            title={localize('com_ui_download')}
          >
            <Download className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Image Metadata Footer */}
      <div className="border-border-light bg-surface-secondary/40 border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="bg-surface-tertiary text-text-secondary text-3xs inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium">
              <Sparkles className="size-3" />
              <span>{localize('com_ui_generated_with_comfy')}</span>
            </span>
            {(aspectRatio || (width && height)) && (
              <span className="border-border-light bg-surface-primary text-text-tertiary text-3xs rounded-md border px-1.5 py-0.5 font-mono">
                {aspectRatio || `${width}×${height}`}
              </span>
            )}
            {workflow && (
              <span className="border-border-light bg-surface-primary text-text-tertiary text-3xs rounded-md border px-1.5 py-0.5 font-mono">
                {workflow}
              </span>
            )}
          </div>

          {prompt && (
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="text-text-secondary hover:text-text-primary text-3xs inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition-colors"
              title={localize('com_ui_copy_prompt')}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              <span>{copied ? localize('com_ui_copied') : localize('com_ui_copy_prompt')}</span>
            </button>
          )}
        </div>

        {prompt && (
          <p
            className="text-text-secondary mt-1.5 line-clamp-2 text-xs leading-relaxed"
            title={prompt}
          >
            {prompt}
          </p>
        )}
      </div>

      {/* Zoom Dialog */}
      <DialogImage
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        src={url}
        downloadImage={handleDownload}
        triggerRef={triggerRef}
      />
    </div>
  );
}

export default GeneratedImagesCard;
