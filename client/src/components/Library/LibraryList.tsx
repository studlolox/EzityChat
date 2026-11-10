import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Network,
  Download,
  Eye,
  MessageSquare,
  FileCode,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import { formatDate, triggerDownload } from '~/utils';
import { useLocalize } from '~/hooks';

interface LibraryListProps {
  items: UnifiedLibraryItem[];
  onOpenCanvasDoc: (docId: string, conversationId?: string) => void;
  onOpenCanvasBoard: (boardId: string, conversationId?: string) => void;
  onPreviewFile: (item: UnifiedLibraryItem) => void;
  onNavigateToChat: (conversationId: string) => void;
}

export default function LibraryList({
  items,
  onOpenCanvasDoc,
  onOpenCanvasBoard,
  onPreviewFile,
  onNavigateToChat,
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
      return item.previewUrl ? (
        <img
          src={item.previewUrl}
          alt=""
          className="size-9 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <span className="bg-surface-tertiary text-text-secondary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <ImageIcon className="size-4" />
        </span>
      );
    }
    if (item.kind === 'canvas_doc') {
      return (
        <span className="bg-surface-tertiary text-text-secondary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <FileCode className="size-4" />
        </span>
      );
    }
    if (item.kind === 'canvas_board') {
      return (
        <span className="bg-surface-tertiary text-text-secondary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
          <Network className="size-4" />
        </span>
      );
    }
    return (
      <span className="bg-surface-tertiary text-text-secondary ring-border-chrome flex size-9 items-center justify-center rounded-xl ring-1">
        <FileText className="size-4" />
      </span>
    );
  };

  return (
    <div className="rounded-theme-surface border-border-light bg-surface-card overflow-hidden border shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-border-light bg-surface-secondary/70 text-text-secondary text-2xs border-b font-semibold tracking-wider uppercase">
            <tr>
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
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => {
                  if (item.kind === 'canvas_doc' && item.canvasDoc) {
                    onOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
                  } else if (item.kind === 'canvas_board' && item.canvasBoard) {
                    onOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
                  } else {
                    onPreviewFile(item);
                  }
                }}
                className="hover:bg-surface-card-hover cursor-pointer transition-colors duration-150"
              >
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

                {/* Actions */}
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5"
                  >
                    {item.file && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = item.file?.filepath || item.file?.file_id;
                          if (target) {
                            triggerDownload(target, item.file?.filename || item.title);
                          }
                        }}
                        title={localize('com_ui_download_file')}
                        className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
                      >
                        <Download className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (item.kind === 'canvas_doc' && item.canvasDoc) {
                          onOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
                        } else if (item.kind === 'canvas_board' && item.canvasBoard) {
                          onOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
                        } else {
                          onPreviewFile(item);
                        }
                      }}
                      title={localize('com_ui_preview_file')}
                      className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary flex items-center gap-1 rounded-lg p-1.5 transition-colors"
                    >
                      <Eye className="size-3.5" />
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
