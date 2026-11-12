import React from 'react';
import { X, FileCode2, History, Check, Loader2, FileText, Network } from 'lucide-react';
import { normalizeCanvasLanguage } from './canvas-language-support';
import { useLocalize } from '~/hooks';

export interface CanvasHeaderProps {
  title: string;
  language?: string;
  content?: string;
  docType?: 'markdown' | 'code';
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  mode?: 'document' | 'board';
  onModeChange?: (mode: 'document' | 'board') => void;
  onClose: () => void;
  onOpenHistory?: () => void;
}

export function CanvasHeader({
  title,
  language = 'markdown',
  content,
  docType = 'markdown',
  saveStatus,
  mode = 'document',
  onModeChange,
  onClose,
  onOpenHistory,
}: CanvasHeaderProps) {
  const localize = useLocalize();
  const normalizedLang = normalizeCanvasLanguage(language, content);

  return (
    <div className="border-border-medium bg-surface-primary flex h-12 shrink-0 items-center justify-between border-b px-4">
      {/* Title & Metadata */}
      <div className="flex min-w-0 items-center gap-2.5">
        <FileCode2 className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
        <span className="text-text-primary truncate text-sm font-semibold">{title}</span>
        {mode === 'document' && (
          <span className="bg-surface-secondary text-2xs text-text-secondary rounded-md px-2 py-0.5 font-mono font-medium uppercase">
            {normalizedLang || docType}
          </span>
        )}
      </div>

      {/* Segmented Mode Switcher (Document vs Mindmap) */}
      {onModeChange && (
        <div className="border-border-light bg-surface-secondary/80 flex items-center rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => onModeChange('document')}
            className={`text-2xs flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors ${
              mode === 'document'
                ? 'bg-surface-primary text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="size-3" />
            <span>{localize('com_ui_canvas_document')}</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('board')}
            className={`text-2xs flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors ${
              mode === 'board'
                ? 'bg-surface-primary text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Network className="size-3" />
            <span>{localize('com_ui_canvas_mindmap')}</span>
          </button>
        </div>
      )}

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

        {onOpenHistory && mode === 'document' && (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={localize('com_ui_canvas_history')}
            className="hover:bg-surface-secondary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
          >
            <History className="size-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={localize('com_ui_close')}
          className="hover:bg-surface-secondary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default CanvasHeader;
