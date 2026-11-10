import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn, disabledFillClasses } from '@librechat/client';
import type { ParsedOption } from '~/utils/quick-options-parser';
import { useLocalize } from '~/hooks';

export interface QuickReplyChipsProps {
  options: ParsedOption[];
  onSelect: (option: ParsedOption) => void;
  disabled?: boolean;
}

export function QuickReplyChips({ options, onSelect, disabled = false }: QuickReplyChipsProps) {
  const localize = useLocalize();

  if (!options || options.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Suggested quick replies"
      className="my-2 flex w-full items-center gap-2 overflow-x-auto py-1"
    >
      <div className="text-text-secondary flex shrink-0 items-center gap-1.5 text-xs font-medium">
        <Sparkles className="text-text-secondary size-3.5" aria-hidden="true" />
        <span>{localize('com_ui_suggested')}</span>
      </div>

      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(opt)}
          className={cn(
            'border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary hover:border-border-heavy inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-xs transition active:scale-95 disabled:pointer-events-none disabled:opacity-50',
            disabledFillClasses,
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default QuickReplyChips;
