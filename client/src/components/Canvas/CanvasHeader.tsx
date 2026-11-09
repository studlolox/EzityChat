import React from 'react';
import { X, FileCode2, History, Check, Loader2 } from 'lucide-react';
import { useLocalize } from '~/hooks';

export interface CanvasHeaderProps {
  title: string;
  language?: string;
  docType?: 'markdown' | 'code';
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  onClose: () => void;
  onOpenHistory?: () => void;
}

export function CanvasHeader({
  title,
  language = 'markdown',
  docType = 'markdown',
  saveStatus,
  onClose,
  onOpenHistory,
}: CanvasHeaderProps) {
  const localize = useLocalize();

  return (
    <div className="border-border-medium bg-surface-primary flex h-12 shrink-0 items-center justify-between border-b px-4">
      {/* Title & Metadata */}
      <div className="flex min-w-0 items-center gap-2.5">
        <FileCode2 className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
        <span className="text-text-primary truncate text-sm font-semibold">{title}</span>
        <span className="bg-surface-secondary text-2xs text-text-secondary rounded-md px-2 py-0.5 font-mono font-medium uppercase">
          {language || docType}
        </span>
      </div>

      {/* Save Status & Action Controls */}
      <div className="flex items-center gap-2">
        <div className="text-2xs text-text-secondary flex items-center gap-1.5">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="text-text-tertiary size-3 animate-spin" />
              <span>{localize('com_ui_saving')}</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="text-status-success size-3" />
              <span>{localize('com_ui_saved')}</span>
            </>
          )}
          {saveStatus === 'unsaved' && <span>{localize('com_ui_unsaved')}</span>}
          {saveStatus === 'error' && (
            <span className="text-status-error">{localize('com_ui_error')}</span>
          )}
        </div>

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={localize('com_ui_canvas_history')}
            title={localize('com_ui_canvas_history')}
            className="text-text-secondary hover:bg-surface-secondary hover:text-text-primary flex size-8 cursor-pointer items-center justify-center rounded-lg transition"
          >
            <History className="size-4" aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={localize('com_ui_close')}
          title={localize('com_ui_close')}
          className="text-text-secondary hover:bg-surface-secondary hover:text-text-primary flex size-8 cursor-pointer items-center justify-center rounded-lg transition"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default CanvasHeader;
