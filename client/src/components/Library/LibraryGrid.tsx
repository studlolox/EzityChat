import React from 'react';
import { Layers } from 'lucide-react';
import type { UnifiedLibraryItem } from './types';
import LibraryCard from './LibraryCard';
import { useLocalize } from '~/hooks';

interface LibraryGridProps {
  items: UnifiedLibraryItem[];
  onOpenCanvasDoc: (docId: string, conversationId?: string) => void;
  onOpenCanvasBoard: (boardId: string, conversationId?: string) => void;
  onPreviewFile: (item: UnifiedLibraryItem) => void;
  onNavigateToChat: (conversationId: string) => void;
  onShareItem?: (item: UnifiedLibraryItem) => void;
  onDownloadItem: (item: UnifiedLibraryItem) => void;
  onDeleteItem: (item: UnifiedLibraryItem) => void;
  onShowDetails?: (item: UnifiedLibraryItem) => void;
  isSelectMode?: boolean;
  selectedItemIds?: Set<string>;
  onToggleSelect?: (item: UnifiedLibraryItem) => void;
}

export default function LibraryGrid({
  items,
  onOpenCanvasDoc,
  onOpenCanvasBoard,
  onPreviewFile,
  onNavigateToChat,
  onShareItem,
  onDownloadItem,
  onDeleteItem,
  onShowDetails,
  isSelectMode = false,
  selectedItemIds = new Set(),
  onToggleSelect,
}: LibraryGridProps) {
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

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,max(16rem,calc((100%_-_3.75rem)/4))),1fr))] sm:gap-5">
      {items.map((item) => (
        <LibraryCard
          key={item.id}
          item={item}
          onOpenCanvasDoc={onOpenCanvasDoc}
          onOpenCanvasBoard={onOpenCanvasBoard}
          onPreviewFile={onPreviewFile}
          onNavigateToChat={onNavigateToChat}
          onShareItem={onShareItem}
          onDownloadItem={onDownloadItem}
          onDeleteItem={onDeleteItem}
          onShowDetails={onShowDetails}
          isSelectMode={isSelectMode}
          isSelected={selectedItemIds.has(item.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
