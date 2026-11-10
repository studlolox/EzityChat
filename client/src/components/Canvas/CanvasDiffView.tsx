import React, { useMemo } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { cn, disabledFillClasses } from '@librechat/client';
import { useLocalize } from '~/hooks';

export interface CanvasDiffViewProps {
  baseContent: string;
  proposedContent: string;
  patchSummary?: string;
  onAccept: () => void;
  onReject: () => void;
  isResolving?: boolean;
}

interface DiffLine {
  type: 'added' | 'deleted' | 'unchanged';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function getDiffSymbol(type: DiffLine['type']): string {
  if (type === 'added') return '+';
  if (type === 'deleted') return '-';
  return ' ';
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  const matrix: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    new Array(newLines.length + 1).fill(0),
  );

  for (let i = 0; i < oldLines.length; i++) {
    for (let j = 0; j < newLines.length; j++) {
      if (oldLines[i] === newLines[j]) {
        matrix[i + 1][j + 1] = matrix[i][j] + 1;
      } else {
        matrix[i + 1][j + 1] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: 'unchanged',
        text: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      diff.unshift({
        type: 'added',
        text: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      diff.unshift({
        type: 'deleted',
        text: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return diff;
}

export function CanvasDiffView({
  baseContent,
  proposedContent,
  patchSummary,
  onAccept,
  onReject,
  isResolving = false,
}: CanvasDiffViewProps) {
  const localize = useLocalize();
  const diffLines = useMemo(
    () => computeDiff(baseContent, proposedContent),
    [baseContent, proposedContent],
  );

  const stats = useMemo(() => {
    let added = 0;
    let deleted = 0;
    for (const l of diffLines) {
      if (l.type === 'added') added++;
      if (l.type === 'deleted') deleted++;
    }
    return { added, deleted };
  }, [diffLines]);

  return (
    <div className="bg-surface-primary text-text-primary flex h-full w-full flex-col">
      {/* Diff Banner */}
      <div className="border-border-medium bg-surface-secondary flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="text-text-primary size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">
                {localize('com_ui_canvas_proposal_title')}
              </span>
              <span className="text-2xs text-status-success font-mono font-medium">
                +{stats.added}
              </span>
              <span className="text-2xs text-status-error font-mono font-medium">
                -{stats.deleted}
              </span>
            </div>
            {patchSummary && (
              <div className="text-2xs text-text-secondary truncate">{patchSummary}</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={isResolving}
            onClick={onReject}
            className={cn(
              'border-border-medium bg-surface-primary text-text-secondary hover:bg-surface-secondary hover:text-text-primary inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition',
              isResolving && 'disabled:pointer-events-none',
              isResolving && disabledFillClasses,
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>{localize('com_ui_canvas_reject')}</span>
          </button>
          <button
            type="button"
            disabled={isResolving}
            onClick={onAccept}
            className={cn(
              'border-border-heavy bg-surface-primary text-text-primary hover:bg-surface-secondary inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium shadow-xs transition',
              isResolving && 'disabled:pointer-events-none',
              isResolving && disabledFillClasses,
            )}
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>{localize('com_ui_canvas_accept')}</span>
          </button>
        </div>
      </div>

      {/* Diff Content View */}
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
        {diffLines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-start px-2 py-0.5 select-text',
              line.type === 'added' &&
                'bg-status-success-subtle/30 text-text-primary border-status-success border-l-2',
              line.type === 'deleted' &&
                'bg-status-error-subtle/30 text-text-secondary border-status-error border-l-2 line-through',
              line.type === 'unchanged' && 'text-text-primary',
            )}
          >
            <span className="text-text-tertiary w-10 shrink-0 pr-3 text-right select-none">
              {line.oldLineNumber || line.newLineNumber || ''}
            </span>
            <span className="w-4 shrink-0 font-bold select-none">{getDiffSymbol(line.type)}</span>
            <span className="flex-1 break-all whitespace-pre-wrap">{line.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CanvasDiffView;
