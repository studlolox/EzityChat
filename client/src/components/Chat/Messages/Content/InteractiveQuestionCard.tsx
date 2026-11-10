import React, { useState } from 'react';
import { cn, disabledFillClasses } from '@librechat/client';
import { HelpCircle, CheckCircle2, Circle } from 'lucide-react';
import type { ParsedOption } from '~/utils/quick-options-parser';
import { useLocalize } from '~/hooks';

export interface InteractiveQuestionCardProps {
  question: string;
  options: ParsedOption[];
  onConfirm: (selectedOption: ParsedOption) => void;
  selectedOptionId?: string | null;
  disabled?: boolean;
}

export function InteractiveQuestionCard({
  question,
  options,
  onConfirm,
  selectedOptionId: initialSelectedId = null,
  disabled = false,
}: InteractiveQuestionCardProps) {
  const localize = useLocalize();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId || options[0]?.id || null,
  );
  const [settledOption, setSettledOption] = useState<ParsedOption | null>(
    initialSelectedId ? options.find((o) => o.id === initialSelectedId) || null : null,
  );

  const handleSelectOption = (opt: ParsedOption) => {
    if (disabled || settledOption) return;
    setSelectedId(opt.id);
  };

  const handleConfirm = () => {
    if (disabled || settledOption || !selectedId) return;
    const opt = options.find((o) => o.id === selectedId);
    if (!opt) return;
    setSettledOption(opt);
    onConfirm(opt);
  };

  if (settledOption) {
    return (
      <div className="border-border-light bg-surface-secondary text-text-primary my-2.5 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm">
        <CheckCircle2 className="text-text-secondary size-4" aria-hidden="true" />
        <span className="text-text-secondary font-medium">{localize('com_ui_selected')}</span>
        <span className="font-semibold">{settledOption.label}</span>
      </div>
    );
  }

  return (
    <div className="border-border-medium bg-surface-secondary my-3 rounded-2xl border p-4 shadow-xs">
      <div className="text-text-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <HelpCircle className="text-text-secondary size-4" aria-hidden="true" />
        <span>{question}</span>
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelectOption(opt)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left text-sm transition',
                isSelected
                  ? 'border-border-heavy bg-surface-primary text-text-primary font-medium'
                  : 'border-border-light bg-surface-primary/60 text-text-secondary hover:bg-surface-primary hover:text-text-primary',
                disabled && 'disabled:pointer-events-none',
                disabled && disabledFillClasses,
              )}
            >
              {isSelected ? (
                <CheckCircle2 className="text-text-primary size-4 shrink-0" />
              ) : (
                <Circle className="text-text-tertiary size-4 shrink-0" />
              )}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={disabled || !selectedId}
          onClick={handleConfirm}
          className={cn(
            'border-border-medium bg-surface-primary text-text-primary hover:bg-surface-tertiary inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-1.5 text-xs font-medium shadow-xs transition active:scale-95 disabled:pointer-events-none disabled:opacity-50',
            disabledFillClasses,
          )}
        >
          {localize('com_ui_confirm_choice')}
        </button>
      </div>
    </div>
  );
}

export default InteractiveQuestionCard;
