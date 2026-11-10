import React, { useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { Skeleton } from '@librechat/client';
import { useNavigate } from 'react-router-dom';
import type { TFile } from 'librechat-data-provider';
import type { LibraryCategory, LibrarySortOption, UnifiedLibraryItem } from './types';
import {
  canvasOpenAtom,
  activeCanvasDocIdAtom,
  canvasModeAtom,
  activeBoardIdAtom,
} from '~/components/Canvas/state';
import FilePreviewDialog from '~/components/Chat/Messages/Content/FilePreviewDialog';
import { SidePanelGroup } from '~/components/SidePanel';
import { useDocumentTitle, useLocalize } from '~/hooks';
import { useLibraryItems } from './useLibraryItems';
import LibraryHeader from './LibraryHeader';
import LibraryGrid from './LibraryGrid';
import LibraryList from './LibraryList';

export default function LibraryView() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(`${localize('com_ui_library')} | LibreChat`);

  const setCanvasOpen = useSetAtom(canvasOpenAtom);
  const setActiveDocId = useSetAtom(activeCanvasDocIdAtom);
  const setCanvasMode = useSetAtom(canvasModeAtom);
  const setActiveBoardId = useSetAtom(activeBoardIdAtom);

  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<LibrarySortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Preview dialog state for files & images
  const [previewFileState, setPreviewFileState] = useState<{
    open: boolean;
    file: TFile | null;
  }>({ open: false, file: null });

  const { filteredItems, counts, isLoading, refetchAll } = useLibraryItems(
    activeCategory,
    searchQuery,
    sort,
  );

  const handleOpenCanvasDoc = (docId: string, conversationId?: string) => {
    setActiveDocId(docId);
    setCanvasMode('document');
    setCanvasOpen(true);
    if (conversationId) {
      navigate(`/c/${conversationId}`);
    }
  };

  const handleOpenCanvasBoard = (boardId: string, conversationId?: string) => {
    setActiveBoardId(boardId);
    setCanvasMode('board');
    setCanvasOpen(true);
    if (conversationId) {
      navigate(`/c/${conversationId}`);
    }
  };

  const handlePreviewFile = (item: UnifiedLibraryItem) => {
    if (item.file) {
      setPreviewFileState({ open: true, file: item.file });
    }
  };

  const handleNavigateToChat = (conversationId: string) => {
    navigate(`/c/${conversationId}`);
  };

  const renderSkeleton = () => (
    <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,max(20rem,calc((100%_-_3.75rem)/4))),1fr))] gap-5">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="rounded-theme-surface border-border-light bg-surface-card flex h-full min-h-[17.5rem] flex-col border p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="size-12 rounded-2xl" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-6 w-3/4" />
          <div className="mt-3 mb-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="border-border-inset mt-auto flex justify-between gap-3 border-t pt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    if (isLoading && filteredItems.length === 0) {
      return renderSkeleton();
    }

    if (viewMode === 'grid') {
      return (
        <LibraryGrid
          items={filteredItems}
          onOpenCanvasDoc={handleOpenCanvasDoc}
          onOpenCanvasBoard={handleOpenCanvasBoard}
          onPreviewFile={handlePreviewFile}
          onNavigateToChat={handleNavigateToChat}
        />
      );
    }

    return (
      <LibraryList
        items={filteredItems}
        onOpenCanvasDoc={handleOpenCanvasDoc}
        onOpenCanvasBoard={handleOpenCanvasBoard}
        onPreviewFile={handlePreviewFile}
        onNavigateToChat={handleNavigateToChat}
      />
    );
  };

  return (
    <div className="bg-surface-primary-alt relative flex w-full grow overflow-hidden">
      <SidePanelGroup>
        <main
          className="flex h-full min-w-0 flex-col overflow-hidden"
          aria-labelledby="library-heading"
        >
          <h1 id="library-heading" className="sr-only">
            {localize('com_ui_library')}
          </h1>

          {/* Header matching Agent Marketplace Toolbar */}
          <LibraryHeader
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sort={sort}
            onSortChange={setSort}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            counts={counts}
            isLoading={isLoading}
            onRefresh={refetchAll}
          />

          {/* Content Area matching Agent Marketplace Grid */}
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 scrollbar-gutter-stable overflow-x-hidden overflow-y-auto p-3 sm:p-5"
          >
            {renderContent()}
          </div>
        </main>
      </SidePanelGroup>

      {/* File & Image Preview Dialog */}
      {previewFileState.file && (
        <FilePreviewDialog
          open={previewFileState.open}
          onOpenChange={(open) => setPreviewFileState((prev) => ({ ...prev, open }))}
          fileId={previewFileState.file.file_id}
          fileName={previewFileState.file.filename}
          fileType={previewFileState.file.type}
          fileSize={previewFileState.file.bytes}
        />
      )}
    </div>
  );
}
