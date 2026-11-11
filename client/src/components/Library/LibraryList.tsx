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
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Network,
  Square,
  Trash2,
} from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import type { MenuItemProps } from '~/common';
import { useLocalize } from '~/hooks';
import { formatDate } from '~/utils';

interface LibraryListProps {
  items: UnifiedLibraryItem[];
  onOpenCanvasDoc: (docId: string, conversationId?: string) => void;
  onOpenCanvasBoard: (boardId: string, conversationId?: string) => void;
  onPreviewFile: (item: UnifiedLibraryItem) => void;
  onNavigateToChat: (conversationId: string) => void;
  onDownloadItem: (item: UnifiedLibraryItem) => void;
  onDeleteItem: (item: UnifiedLibraryItem) => void;
  isSelectMode?: boolean;
  selectedItemIds?: Set<string>;
  onToggleSelect?: (item: UnifiedLibraryItem) => void;
  allSelected?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

function getThumbnailUrl(previewUrl?: string): string | undefined {
  if (!previewUrl) {
    return undefined;
  }
  const separator = previewUrl.includes('?') ? '&' : '?';
  return `${previewUrl}${separator}thumb=1`;
}

function ListRowActionMenu({
  item,
  onPreview,
  onDownload,
  onDelete,
}: {
  item: UnifiedLibraryItem;
  onPreview: (item: UnifiedLibraryItem) => void;
  onDownload: (item: UnifiedLibraryItem) => void;
  onDelete: (item: UnifiedLibraryItem) => void;
}) {
  const localize = useLocalize();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems: MenuItemProps[] = [
    {
      id: `list-preview-${item.id}`,
      label: localize('com_ui_preview'),
      icon: <Eye className="size-4" />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onPreview(item);
        setIsOpen(false);
      },
    },
    {
      id: `list-download-${item.id}`,
      label: localize('com_ui_download'),
      icon: <Download className="size-4" />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onDownload(item);
        setIsOpen(false);
      },
    },
    { separate: true },
    {
      id: `list-delete-${item.id}`,
      label: localize('com_ui_delete'),
      icon: <Trash2 className="text-text-destructive size-4" />,
      className: 'text-text-destructive focus:text-text-destructive',
      onClick: (e) => {
        e?.stopPropagation?.();
        onDelete(item);
        setIsOpen(false);
      },
    },
  ];

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center">
      <DropdownPopup
        portal={true}
        menuId={menuId}
        focusLoop={true}
        unmountOnHide={true}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        items={menuItems}
        trigger={
          <Ariakit.MenuButton
            id={`list-item-menu-${item.id}`}
            aria-label={localize('com_ui_actions')}
            aria-expanded={isOpen}
            className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary focus-visible:ring-text-primary flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Ariakit.MenuButton>
        }
      />
    </div>
  );
}

export default function LibraryList({
  items,
  onOpenCanvasDoc,
  onOpenCanvasBoard,
  onPreviewFile,
  onNavigateToChat,
  onDownloadItem,
  onDeleteItem,
  isSelectMode = false,
  selectedItemIds = new Set(),
  onToggleSelect,
  allSelected = false,
  onSelectAll,
  onDeselectAll,
}: LibraryListProps) {
  const localize = useLocalize();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <span className="bg-surface-secondary text-text-tertiary flex size-14 items-center justify-center rounded-2xl">
          <Layers className="size-7" />
        </span>
        <p className="text-text-primary text-base font-semibold">
          {localize('com_ui_library_empty_title')}
        </p>
        <p className="text-text-secondary max-w-sm text-xs">
          {localize('com_ui_library_empty_desc')}
        </p>
      </div>
    );
  }

  const renderIcon = (item: UnifiedLibraryItem) => {
    if (item.kind === 'image') {
      const thumbUrl = getThumbnailUrl(item.previewUrl);

      return thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="size-9 rounded-lg object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="bg-surface-tertiary text-text-secondary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <ImageIcon className="size-4" />
        </span>
      );
    }
    if (item.kind === 'canvas_doc') {
      return (
        <span className="bg-surface-tertiary text-text-primary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <FileCode className="size-4" />
        </span>
      );
    }
    if (item.kind === 'canvas_board') {
      return (
        <span className="bg-surface-tertiary text-status-warning ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <Network className="size-4" />
        </span>
      );
    }
    const type = item.file?.type || '';
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) {
      return (
        <span className="bg-surface-tertiary text-status-success ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <FileSpreadsheet className="size-4" />
        </span>
      );
    }
    return (
      <span className="bg-surface-tertiary text-text-secondary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
        <FileText className="size-4" />
      </span>
    );
  };

  const handleRowClick = (item: UnifiedLibraryItem) => {
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

  const handlePreview = (item: UnifiedLibraryItem) => {
    if (item.kind === 'canvas_doc' && item.canvasDoc) {
      onOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
    } else if (item.kind === 'canvas_board' && item.canvasBoard) {
      onOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
    } else {
      onPreviewFile(item);
    }
  };

  return (
    <div className="rounded-theme-surface border-border-light bg-surface-card overflow-hidden border shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-border-light bg-surface-secondary/70 text-text-secondary text-2xs border-b font-semibold tracking-wider uppercase">
            <tr>
              {isSelectMode && (
                <th scope="col" className="w-10 px-3 py-3">
                  <button
                    type="button"
                    onClick={allSelected ? onDeselectAll : onSelectAll}
                    className="hover:bg-surface-tertiary flex size-6 cursor-pointer items-center justify-center rounded transition-colors"
                    aria-label={
                      allSelected
                        ? localize('com_ui_library_deselect_all')
                        : localize('com_ui_library_select_all')
                    }
                  >
                    {allSelected ? (
                      <CheckSquare className="text-text-primary size-4" />
                    ) : (
                      <Square className="text-text-tertiary size-4" />
                    )}
                  </button>
                </th>
              )}
              <th scope="col" className="px-5 py-3">
                {localize('com_ui_name')}
              </th>
              <th scope="col" className="px-4 py-3">
                {localize('com_ui_type')}
              </th>
              <th scope="col" className="px-4 py-3">
                {localize('com_ui_conversation')}
              </th>
              <th scope="col" className="px-4 py-3">
                {localize('com_ui_date')}
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                {localize('com_ui_actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border-light/60 divide-y">
            {items.map((item) => {
              const isSelected = selectedItemIds.has(item.id);

              return (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className={`cursor-pointer transition-colors duration-150 ${
                    isSelected
                      ? 'bg-surface-active-alt/40 hover:bg-surface-active-alt/60'
                      : 'hover:bg-surface-card-hover'
                  }`}
                >
                  {/* Selection Checkbox */}
                  {isSelectMode && (
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect?.(item);
                      }}
                      className="w-10 px-3 py-3"
                    >
                      <button
                        type="button"
                        className="hover:bg-surface-tertiary flex size-6 cursor-pointer items-center justify-center rounded transition-colors"
                        aria-label={localize('com_ui_library_select')}
                      >
                        {isSelected ? (
                          <CheckSquare className="text-text-primary size-4" />
                        ) : (
                          <Square className="text-text-tertiary size-4" />
                        )}
                      </button>
                    </td>
                  )}

                  {/* Name & Icon */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {renderIcon(item)}
                      <div className="min-w-0">
                        <p className="text-text-primary truncate font-medium">{item.title}</p>
                        <p className="text-text-tertiary text-2xs truncate">{item.subtitle}</p>
                      </div>
                    </div>
                  </td>

                  {/* Category / Type badge */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="border-border-chrome bg-surface-secondary text-text-secondary text-3xs rounded-full border px-2.5 py-0.5 font-mono font-medium uppercase">
                      {item.category}
                    </span>
                  </td>

                  {/* Conversation Link */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.conversationId ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.conversationId) {
                            onNavigateToChat(item.conversationId);
                          }
                        }}
                        className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
                      >
                        <MessageSquare className="size-3" />
                        <span>{localize('com_ui_library_from_chat')}</span>
                      </button>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="text-text-secondary text-2xs px-4 py-3 whitespace-nowrap">
                    {item.updatedAt ? formatDate(item.updatedAt) : '-'}
                  </td>

                  {/* Actions Dropdown */}
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <ListRowActionMenu
                      item={item}
                      onPreview={handlePreview}
                      onDownload={onDownloadItem}
                      onDelete={onDeleteItem}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
