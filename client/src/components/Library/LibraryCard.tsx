import React, { useId, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { DropdownPopup } from '@librechat/client';
import {
  CheckSquare,
  Download,
  Ellipsis,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Network,
  Square,
  Trash2,
} from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import type { MenuItemProps } from '~/common';
import { useLocalize } from '~/hooks';
import { formatDate } from '~/utils';
import { cn } from '~/utils';

interface LibraryCardProps {
  item: UnifiedLibraryItem;
  onOpenCanvasDoc: (docId: string, conversationId?: string) => void;
  onOpenCanvasBoard: (boardId: string, conversationId?: string) => void;
  onPreviewFile: (item: UnifiedLibraryItem) => void;
  onNavigateToChat: (conversationId: string) => void;
  onDownloadItem: (item: UnifiedLibraryItem) => void;
  onDeleteItem: (item: UnifiedLibraryItem) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: UnifiedLibraryItem) => void;
}

function getDocumentIcon(item: UnifiedLibraryItem) {
  if (item.kind === 'canvas_doc') {
    return <FileCode className="text-text-primary size-6" />;
  }
  if (item.kind === 'canvas_board') {
    return <Network className="text-status-warning size-6" />;
  }
  const type = item.file?.type || '';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) {
    return <FileSpreadsheet className="text-status-success size-6" />;
  }
  if (
    type.includes('code') ||
    type.includes('json') ||
    type.includes('javascript') ||
    type.includes('typescript')
  ) {
    return <FileCode className="text-status-info size-6" />;
  }
  return <FileText className="text-text-secondary size-6" />;
}

function getThumbnailUrl(previewUrl?: string): string | undefined {
  if (!previewUrl) {
    return undefined;
  }
  const separator = previewUrl.includes('?') ? '&' : '?';
  return `${previewUrl}${separator}thumb=1`;
}

function getBadgeText(item: UnifiedLibraryItem): string {
  if (item.kind === 'canvas_doc') {
    return (item.canvasDoc?.language || item.canvasDoc?.docType || 'CANVAS').toUpperCase();
  }
  if (item.kind === 'canvas_board') {
    return 'MINDMAP';
  }
  const ext = item.file?.filename?.split('.').pop();
  if (ext) {
    return ext.toUpperCase();
  }
  return (item.file?.type?.split('/')[1] || item.category).toUpperCase();
}

export default function LibraryCard({
  item,
  onOpenCanvasDoc,
  onOpenCanvasBoard,
  onPreviewFile,
  onNavigateToChat,
  onDownloadItem,
  onDeleteItem,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}: LibraryCardProps) {
  const localize = useLocalize();
  const menuId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isImage = item.kind === 'image' && !!item.previewUrl;
  const thumbnailUrl = isImage ? getThumbnailUrl(item.previewUrl) : undefined;

  const handleCardClick = () => {
    if (isSelectMode) {
      onToggleSelect?.(item);
      return;
    }
    if (item.kind === 'canvas_doc' && item.canvasDoc) {
      onOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
    } else if (item.kind === 'canvas_board' && item.canvasBoard) {
      onOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
    } else {
      onPreviewFile(item);
    }
  };

  const handlePreview = () => {
    if (item.kind === 'canvas_doc' && item.canvasDoc) {
      onOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
    } else if (item.kind === 'canvas_board' && item.canvasBoard) {
      onOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
    } else {
      onPreviewFile(item);
    }
  };

  const menuItems: MenuItemProps[] = [
    {
      id: `preview-${item.id}`,
      label: localize('com_ui_preview'),
      icon: <Eye className="size-4" />,
      onClick: (e) => {
        e?.stopPropagation?.();
        handlePreview();
        setIsMenuOpen(false);
      },
    },
    {
      id: `download-${item.id}`,
      label: localize('com_ui_download'),
      icon: <Download className="size-4" />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onDownloadItem(item);
        setIsMenuOpen(false);
      },
    },
    { separate: true },
    {
      id: `delete-${item.id}`,
      label: localize('com_ui_delete'),
      icon: <Trash2 className="text-text-destructive size-4" />,
      className: 'text-text-destructive focus:text-text-destructive',
      onClick: (e) => {
        e?.stopPropagation?.();
        onDeleteItem(item);
        setIsMenuOpen(false);
      },
    },
  ];

  return (
    <article
      onClick={handleCardClick}
      className={cn(
        'group rounded-theme-surface bg-surface-card relative flex h-full min-h-[17.5rem] min-w-0 cursor-pointer flex-col overflow-hidden border transition-all duration-150',
        isSelected
          ? 'border-border-chrome-heavy ring-border-chrome-heavy ring-2'
          : 'border-border-light hover:border-border-medium hover:bg-surface-card-hover',
      )}
    >
      {/* Selection Checkbox (Visible in select mode or when hovered) */}
      {isSelectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item);
          }}
          className="bg-surface-secondary/90 hover:bg-surface-tertiary border-border-chrome absolute start-3 top-3 z-30 flex size-7 cursor-pointer items-center justify-center rounded-lg border shadow-xs backdrop-blur-xs transition-colors"
          aria-label={localize('com_ui_library_select')}
        >
          {isSelected ? (
            <CheckSquare className="text-text-primary size-4" />
          ) : (
            <Square className="text-text-tertiary size-4" />
          )}
        </button>
      )}

      {/* Image Thumbnail: Fills Edge-to-Edge */}
      {isImage ? (
        <div className="bg-surface-tertiary relative h-44 w-full shrink-0 overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        /* Full-Height Document Card Header */
        <div className="bg-surface-secondary/50 border-border-inset flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-surface-tertiary ring-border-chrome flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
              {getDocumentIcon(item)}
            </div>
            <span className="border-border-chrome bg-surface-card text-text-secondary text-3xs rounded-md border px-2 py-0.5 font-mono font-medium tracking-wider">
              {getBadgeText(item)}
            </span>
          </div>
        </div>
      )}

      {/* Card Body */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {/* Title */}
        <h2 className="text-text-primary line-clamp-2 text-sm leading-snug font-semibold break-words">
          {item.title}
        </h2>

        {/* Subtitle / Metadata */}
        <p className="text-text-secondary mt-1.5 mb-3 line-clamp-2 text-xs leading-relaxed break-words">
          {item.subtitle}
        </p>

        {/* Footer */}
        <footer className="border-border-inset relative mt-auto flex min-w-0 items-center justify-between gap-2 border-t pt-3">
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
                className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors"
              >
                <MessageSquare className="size-3 shrink-0" />
                <span className="truncate">{localize('com_ui_library_from_chat')}</span>
              </button>
            ) : (
              <span className="text-text-tertiary text-2xs">
                {item.updatedAt ? formatDate(item.updatedAt) : ''}
              </span>
            )}
          </div>

          {/* Bottom-right More Actions Dropdown */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <DropdownPopup
              portal={true}
              menuId={menuId}
              focusLoop={true}
              unmountOnHide={true}
              isOpen={isMenuOpen}
              setIsOpen={setIsMenuOpen}
              items={menuItems}
              trigger={
                <Ariakit.MenuButton
                  id={`library-item-menu-${item.id}`}
                  aria-label={localize('com_ui_actions')}
                  aria-expanded={isMenuOpen}
                  className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary focus-visible:ring-text-primary flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Ariakit.MenuButton>
              }
            />
          </div>
        </footer>
      </div>
    </article>
  );
}
