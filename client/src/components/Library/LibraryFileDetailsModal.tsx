import React from 'react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogDescription,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import {
  Calendar,
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  HardDrive,
  ImageIcon,
  Maximize2,
  MessageSquare,
  Network,
  Share2,
  Tag,
} from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import { formatFileSize } from '~/utils/files';
import { useLocalize } from '~/hooks';
import { formatDate } from '~/utils';

interface LibraryFileDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedLibraryItem | null;
  onPreview?: (item: UnifiedLibraryItem) => void;
  onShare?: (item: UnifiedLibraryItem) => void;
  onDownload?: (item: UnifiedLibraryItem) => void;
  onNavigateToChat?: (conversationId: string) => void;
}

function getItemIcon(item: UnifiedLibraryItem) {
  if (item.kind === 'image') {
    return <ImageIcon className="text-status-info size-6" />;
  }
  if (item.kind === 'canvas_board') {
    return <Network className="text-status-warning size-6" />;
  }
  if (item.kind === 'canvas_doc') {
    return <FileCode className="text-file-code size-6" />;
  }
  const type = item.file?.type || '';
  if (type.includes('spreadsheet') || type.includes('csv')) {
    return <FileSpreadsheet className="text-status-success size-6" />;
  }
  return <FileText className="text-text-secondary size-6" />;
}

function getExtension(item: UnifiedLibraryItem): string {
  if (item.kind === 'canvas_doc') {
    return (item.canvasDoc?.language || item.canvasDoc?.docType || 'MD').toUpperCase();
  }
  if (item.kind === 'canvas_board') {
    return 'BOARD';
  }
  const ext = item.file?.filename?.split('.').pop() || item.title.split('.').pop();
  if (ext && ext !== item.title) {
    return ext.toUpperCase();
  }
  return (item.file?.type?.split('/')[1] || item.category || 'FILE').toUpperCase();
}

export default function LibraryFileDetailsModal({
  open,
  onOpenChange,
  item,
  onPreview,
  onShare,
  onDownload,
  onNavigateToChat,
}: LibraryFileDetailsModalProps) {
  const localize = useLocalize();

  if (!item) {
    return null;
  }

  const rawBytes = item.size ?? item.file?.bytes;
  const formattedSize =
    rawBytes != null && rawBytes > 0
      ? `${formatFileSize(rawBytes)} (${rawBytes.toLocaleString()} bytes)`
      : null;
  const extension = getExtension(item);
  const mimeType = item.file?.type || null;
  const dimensions =
    item.file?.width && item.file?.height ? `${item.file.width} × ${item.file.height} px` : null;
  const source = item.file?.source || null;

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="flex max-h-[85dvh] max-w-lg flex-col overflow-hidden p-0 sm:max-h-[90dvh]">
        {/* Pinned Header */}
        <OGDialogHeader className="flex shrink-0 flex-row items-center gap-3 ps-5 pe-12 pt-5 pb-3">
          <div className="bg-surface-tertiary ring-border-chrome flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 sm:size-12">
            {getItemIcon(item)}
          </div>
          <div className="min-w-0 flex-1">
            <OGDialogTitle className="truncate text-sm font-semibold sm:text-base">
              {item.title}
            </OGDialogTitle>
            <OGDialogDescription className="text-2xs mt-0.5">
              {localize('com_ui_details')}
            </OGDialogDescription>
          </div>
        </OGDialogHeader>

        {/* Scrollable Metadata Details Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4 text-xs sm:p-5">
          {/* File Name */}
          <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
            <span className="text-text-tertiary text-3xs font-medium tracking-wider uppercase">
              {localize('com_ui_name')}
            </span>
            <span className="text-text-primary font-mono font-medium break-all select-all">
              {item.title}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* File Size */}
            {formattedSize && (
              <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
                <span className="text-text-tertiary text-3xs flex items-center gap-1 font-medium tracking-wider uppercase">
                  <HardDrive className="size-3 shrink-0" />
                  {localize('com_ui_file_size')}
                </span>
                <span className="text-text-primary font-medium break-words">{formattedSize}</span>
              </div>
            )}

            {/* Extension / Type */}
            <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
              <span className="text-text-tertiary text-3xs flex items-center gap-1 font-medium tracking-wider uppercase">
                <Tag className="size-3 shrink-0" />
                {localize('com_ui_type')}
              </span>
              <span className="text-text-primary font-mono font-medium uppercase">{extension}</span>
            </div>

            {/* MIME Type */}
            {mimeType && (
              <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
                <span className="text-text-tertiary text-3xs font-medium tracking-wider uppercase">
                  MIME
                </span>
                <span className="text-text-primary truncate font-mono" title={mimeType}>
                  {mimeType}
                </span>
              </div>
            )}

            {/* Dimensions (if image) */}
            {dimensions && (
              <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
                <span className="text-text-tertiary text-3xs flex items-center gap-1 font-medium tracking-wider uppercase">
                  <Maximize2 className="size-3 shrink-0" />
                  {localize('com_ui_dimensions')}
                </span>
                <span className="text-text-primary font-mono">{dimensions}</span>
              </div>
            )}

            {/* Date Modified */}
            {item.updatedAt && (
              <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
                <span className="text-text-tertiary text-3xs flex items-center gap-1 font-medium tracking-wider uppercase">
                  <Calendar className="size-3 shrink-0" />
                  {localize('com_ui_date')}
                </span>
                <span className="text-text-primary">{formatDate(item.updatedAt)}</span>
              </div>
            )}

            {/* Storage Backend Source */}
            {source && (
              <div className="bg-surface-secondary/50 border-border-light flex min-w-0 flex-col gap-1 rounded-lg border p-2.5">
                <span className="text-text-tertiary text-3xs font-medium tracking-wider uppercase">
                  {localize('com_ui_storage')}
                </span>
                <span className="text-text-primary font-mono capitalize">{source}</span>
              </div>
            )}
          </div>

          {/* Associated Conversation */}
          {item.conversationId && (
            <div className="bg-surface-secondary/50 border-border-light flex min-w-0 items-center justify-between rounded-lg border p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquare className="text-text-secondary size-4 shrink-0" />
                <span className="text-text-primary truncate text-xs font-medium">
                  {localize('com_ui_library_from_chat')}
                </span>
              </div>
              {onNavigateToChat && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    if (item.conversationId) {
                      onNavigateToChat(item.conversationId);
                      onOpenChange(false);
                    }
                  }}
                >
                  {localize('com_ui_open_chat')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Pinned Modal Action Buttons Footer */}
        <div className="border-border-inset bg-surface-dialog flex shrink-0 flex-col-reverse gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          {onPreview && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                onPreview(item);
                onOpenChange(false);
              }}
            >
              <Eye className="me-1.5 size-3.5" />
              {localize('com_ui_preview')}
            </Button>
          )}

          {onShare && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                onShare(item);
                onOpenChange(false);
              }}
            >
              <Share2 className="me-1.5 size-3.5" />
              {localize('com_ui_share')}
            </Button>
          )}

          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                onDownload(item);
                onOpenChange(false);
              }}
            >
              <Download className="me-1.5 size-3.5" />
              {localize('com_ui_download')}
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {localize('com_ui_close')}
          </Button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
