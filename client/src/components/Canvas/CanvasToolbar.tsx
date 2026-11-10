import React from 'react';
import { cn } from '@librechat/client';
import { Edit3, Eye, Copy, Check } from 'lucide-react';
import { useLocalize } from '~/hooks';

export interface CanvasToolbarProps {
  viewMode: 'edit' | 'preview';
  onViewModeChange: (mode: 'edit' | 'preview') => void;
  onCopy?: () => void;
  copied?: boolean;
}

export function CanvasToolbar({
  viewMode,
  onViewModeChange,
  onCopy,
  copied = false,
}: CanvasToolbarProps) {
  const localize = useLocalize();

  return (
    <div className="border-border-medium bg-surface-primary flex shrink-0 items-center justify-between border-t px-4 py-2">
      {/* Segmented View Mode Toggle */}
      <div className="border-border-medium bg-surface-secondary flex items-center rounded-xl border p-0.5">
        <button
          type="button"
          onClick={() => onViewModeChange('edit')}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition',
            viewMode === 'edit'
              ? 'bg-surface-primary text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <Edit3 className="size-3.5" aria-hidden="true" />
          <span>{localize('com_ui_canvas_edit')}</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('preview')}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition',
            viewMode === 'preview'
              ? 'bg-surface-primary text-text-primary shadow-xs'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <Eye className="size-3.5" aria-hidden="true" />
          <span>{localize('com_ui_canvas_preview')}</span>
        </button>
      </div>

      {/* Copy Action */}
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={localize('com_ui_copy')}
          title={localize('com_ui_copy')}
          className="border-border-medium bg-surface-primary text-text-secondary hover:bg-surface-secondary hover:text-text-primary flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition"
        >
          {copied ? (
            <>
              <Check className="text-status-success size-3.5" />
              <span>{localize('com_ui_copied')}</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>{localize('com_ui_copy')}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default CanvasToolbar;
