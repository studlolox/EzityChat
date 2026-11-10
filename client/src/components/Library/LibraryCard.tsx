import React from 'react';
import { FileText, Network, Download, MessageSquare, FileCode, ArrowUpRight } from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import { formatDate, triggerDownload } from '~/utils';
import { useLocalize } from '~/hooks';

interface LibraryCardProps {
  item: UnifiedLibraryItem;
  onOpenCanvasDoc: (docId: string, conversationId?: string) => void;
  onOpenCanvasBoard: (boardId: string, conversationId?: string) => void;
  onPreviewFile: (item: UnifiedLibraryItem) => void;
  onNavigateToChat: (conversationId: string) => void;
}

function renderCategoryIcon(item: UnifiedLibraryItem) {
  if (item.kind === 'canvas_doc') {
    return <FileCode className="text-text-secondary size-6" />;
  }
  if (item.kind === 'canvas_board') {
    return <Network className="text-text-secondary size-6" />;
  }
  return <FileText className="text-text-secondary size-6" />;
}

function getCategoryLabel(
  item: UnifiedLibraryItem,
  localize: ReturnType<typeof useLocalize>,
): string {
  if (item.kind === 'canvas_doc') {
    return item.canvasDoc?.language || item.canvasDoc?.docType || 'Canvas';
  }
  if (item.kind === 'canvas_board') {
    return localize('com_ui_mindmap_badge');
  }
  return item.file?.type?.split('/')[1] || item.category;
}

export default function LibraryCard({
  item,
  onOpenCanvasDoc,
  onOpenCanvasBoard,
  onPreviewFile,
  onNavigateToChat,
}: LibraryCardProps) {
  const localize = useLocalize();

  const handlePrimaryClick = () => {
    if (item.kind === 'canvas_doc' && item.canvasDoc) {
      onOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
    } else if (item.kind === 'canvas_board' && item.canvasBoard) {
      onOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
    } else {
      onPreviewFile(item);
    }
  };

  const getActionLabel = () => {
    if (item.kind === 'canvas_doc') return localize('com_ui_open_in_canvas');
    if (item.kind === 'canvas_board') return localize('com_ui_view_mindmap');
    return localize('com_ui_preview_file');
  };

  const categoryLabel = getCategoryLabel(item, localize);

  return (
    <article className="group rounded-theme-surface bg-surface-card relative flex h-full min-h-[17.5rem] min-w-0 cursor-pointer flex-col p-5">
      {/* Background & Hover Surface matching AgentCard */}
      <div
        aria-hidden="true"
        className="rounded-theme-surface border-border-light bg-surface-card group-hover:border-border-medium group-hover:bg-surface-card-hover pointer-events-none absolute inset-0 z-0 border transition-colors duration-150"
      />

      {/* Surface Click Button for keyboard accessibility */}
      <button
        type="button"
        onClick={handlePrimaryClick}
        className="rounded-theme-surface focus-visible:ring-text-primary absolute inset-0 z-10 cursor-pointer border-0 bg-transparent p-0 text-start focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
        aria-label={item.title}
      />

      {/* Content Layer */}
      <div className="relative z-20 flex min-h-0 flex-1 flex-col">
        {/* Top Header: Icon & Category Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="bg-surface-tertiary ring-border-chrome group-hover:ring-border-chrome-medium flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 transition-colors duration-150">
            {renderCategoryIcon(item)}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="border-border-chrome bg-surface-secondary text-text-secondary text-3xs group-hover:border-border-medium rounded-full border px-2.5 py-0.5 font-mono font-medium tracking-wide uppercase transition-colors duration-150">
              {categoryLabel}
            </span>

            {/* Download button if physical file exists */}
            {item.file && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const target = item.file?.filepath || item.file?.file_id;
                  if (target) {
                    triggerDownload(target, item.file?.filename || item.title);
                  }
                }}
                title={localize('com_ui_download_file')}
                className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary pointer-events-auto rounded-lg p-1 transition-colors"
              >
                <Download className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Image Preview Banner (if image item) */}
        {item.kind === 'image' && item.previewUrl && (
          <div className="border-border-light/60 bg-surface-tertiary/40 mt-3 aspect-video w-full overflow-hidden rounded-xl border">
            <img
              src={item.previewUrl}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        )}

        {/* Title */}
        <h2 className="text-text-primary mt-4 line-clamp-2 text-base leading-snug font-semibold break-words">
          {item.title}
        </h2>

        {/* Subtitle / Details */}
        <p className="text-text-secondary mt-1.5 mb-3 line-clamp-2 text-xs leading-relaxed break-words">
          {item.subtitle}
        </p>

        {/* Footer matching AgentCard */}
        <footer className="border-border-inset relative mt-auto flex min-w-0 items-center justify-between gap-2 border-t pt-4">
          <div className="min-w-0">
            {item.conversationId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.conversationId) {
                    onNavigateToChat(item.conversationId);
                  }
                }}
                title={localize('com_ui_library_from_chat')}
                className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary pointer-events-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors"
              >
                <MessageSquare className="size-3 shrink-0" />
                <span className="truncate">{localize('com_ui_library_from_chat')}</span>
              </button>
            ) : (
              <span className="text-text-tertiary text-xs">
                {item.updatedAt ? formatDate(item.updatedAt) : ''}
              </span>
            )}
          </div>

          <span className="text-text-primary ms-auto flex shrink-0 items-center gap-1 text-xs font-medium">
            <span>{getActionLabel()}</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </span>
        </footer>
      </div>
    </article>
  );
}
