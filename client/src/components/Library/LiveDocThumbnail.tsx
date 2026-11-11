import React from 'react';
import { Heading1 } from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import { useLocalize } from '~/hooks';

interface LiveDocThumbnailProps {
  item: UnifiedLibraryItem;
}

export function LiveDocThumbnail({ item }: LiveDocThumbnailProps) {
  const localize = useLocalize();
  const isCode =
    item.canvasDoc?.docType === 'code' ||
    /\.(ts|tsx|js|jsx|py|json|sql|sh|html|css|cpp|c|go|rs|rb|php|yaml|yml)$/i.test(item.title);

  const language =
    item.canvasDoc?.language ||
    item.title.split('.').pop()?.toUpperCase() ||
    localize('com_ui_library_code');

  if (isCode) {
    return (
      <div className="bg-surface-secondary text-text-primary relative flex h-full w-full flex-col overflow-hidden select-none">
        {/* macOS Window Title Bar */}
        <div className="border-border-light bg-surface-tertiary/60 flex h-7 items-center justify-between border-b px-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="bg-status-error size-2 rounded-full" />
            <span className="bg-status-warning size-2 rounded-full" />
            <span className="bg-status-success size-2 rounded-full" />
          </div>
          <span className="text-text-secondary text-3xs font-mono font-medium tracking-wide uppercase">
            {language}
          </span>
        </div>

        {/* Visual Code Skeleton Lines */}
        <div className="flex flex-1 flex-col gap-2 p-3 font-mono" aria-hidden="true">
          {/* Line 1: import ... from ... */}
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-3xs w-3 text-right opacity-40">1</span>
            <div className="flex items-center gap-1.5">
              <span className="bg-file-video h-2.5 w-10 rounded-xs opacity-80" />
              <span className="bg-text-secondary h-2.5 w-12 rounded-xs opacity-60" />
              <span className="bg-file-video h-2.5 w-8 rounded-xs opacity-80" />
              <span className="bg-status-success h-2.5 w-16 rounded-xs opacity-80" />
            </div>
          </div>

          {/* Line 2: function name() { */}
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-3xs w-3 text-right opacity-40">2</span>
            <div className="flex items-center gap-1.5">
              <span className="bg-status-info h-2.5 w-12 rounded-xs opacity-80" />
              <span className="bg-text-primary h-2.5 w-14 rounded-xs opacity-80" />
              <span className="bg-text-secondary h-2.5 w-3 rounded-xs opacity-50" />
            </div>
          </div>

          {/* Line 3: indent return value; */}
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-3xs w-3 text-right opacity-40">3</span>
            <div className="flex items-center gap-1.5 pl-3">
              <span className="bg-file-video h-2.5 w-10 rounded-xs opacity-80" />
              <span className="bg-status-warning h-2.5 w-8 rounded-xs opacity-80" />
            </div>
          </div>

          {/* Line 4: } */}
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-3xs w-3 text-right opacity-40">4</span>
            <span className="bg-text-secondary h-2.5 w-3 rounded-xs opacity-50" />
          </div>
        </div>

        {/* Corner Type Badge */}
        <div className="bg-surface-primary/90 text-text-secondary text-3xs absolute right-2 bottom-2 flex items-center gap-1 rounded px-1.5 py-0.5 font-medium shadow-xs backdrop-blur-xs">
          <span className="bg-file-code size-1.5 rounded-full" />
          {localize('com_ui_library_code')}
        </div>
      </div>
    );
  }

  // Markdown & Document Layout
  return (
    <div className="bg-surface-secondary relative flex h-full w-full flex-col overflow-hidden p-4 select-none">
      {/* Title / Heading Preview */}
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="bg-surface-tertiary flex size-5 items-center justify-center rounded">
          <Heading1 className="text-text-secondary size-3.5" />
        </span>
        <div className="bg-text-primary/20 h-3 w-3/5 rounded-xs" />
      </div>

      {/* Text Body Lines */}
      <div className="mt-4 flex flex-col gap-2 opacity-60" aria-hidden="true">
        <div className="bg-text-secondary/20 h-2 w-full rounded-xs" />
        <div className="bg-text-secondary/20 h-2 w-5/6 rounded-xs" />
        <div className="bg-text-secondary/20 h-2 w-4/5 rounded-xs" />
        <div className="bg-text-secondary/20 h-2 w-3/4 rounded-xs" />
      </div>

      {/* Corner Type Badge */}
      <div className="bg-surface-primary/90 text-text-secondary text-3xs absolute right-2 bottom-2 flex items-center gap-1 rounded px-1.5 py-0.5 font-medium shadow-xs backdrop-blur-xs">
        <span className="bg-status-success size-1.5 rounded-full" />
        {localize('com_ui_canvas_document')}
      </div>
    </div>
  );
}
