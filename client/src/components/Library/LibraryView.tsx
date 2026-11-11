import React, { useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { DialogImage } from '@librechat/chat/components';
import { FileSources, apiBaseUrl } from 'librechat-data-provider';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogDescription,
  OGDialogTitle,
  Skeleton,
  Spinner,
} from '@librechat/client';
import type { TFile } from 'librechat-data-provider';
import type { LibraryCategory, LibrarySortOption, UnifiedLibraryItem } from './types';
import {
  canvasOpenAtom,
  activeCanvasDocIdAtom,
  canvasModeAtom,
  activeBoardIdAtom,
} from '~/components/Canvas/state';
import { downloadLibraryItemsAsZip, toAbsoluteFilePath, triggerDownload } from '~/utils';
import FilePreviewDialog from '~/components/Chat/Messages/Content/FilePreviewDialog';
import { useDeleteFilesMutation } from '~/data-provider';
import { SidePanelGroup } from '~/components/SidePanel';
import { useDocumentTitle, useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLibraryItems } from './useLibraryItems';
import LibraryHeader from './LibraryHeader';
import LibraryGrid from './LibraryGrid';
import LibraryList from './LibraryList';

export default function LibraryView() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(`${localize('com_ui_library')} | Ezity AI`);

  const setCanvasOpen = useSetAtom(canvasOpenAtom);
  const setActiveDocId = useSetAtom(activeCanvasDocIdAtom);
  const setCanvasMode = useSetAtom(canvasModeAtom);
  const setActiveBoardId = useSetAtom(activeBoardIdAtom);

  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<LibrarySortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Bulk selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deletion confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    items: UnifiedLibraryItem[];
  }>({ open: false, items: [] });

  // Preview dialog state for documents/code files
  const [previewFileState, setPreviewFileState] = useState<{
    open: boolean;
    file: TFile | null;
  }>({ open: false, file: null });

  // Image lightbox state
  const [lightboxState, setLightboxState] = useState<{
    open: boolean;
    src: string;
    title: string;
  }>({ open: false, src: '', title: '' });

  const deleteFilesMutation = useDeleteFilesMutation();

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
    if (item.kind === 'image' && item.previewUrl) {
      const fullUrl = toAbsoluteFilePath(item.previewUrl, apiBaseUrl());
      setLightboxState({
        open: true,
        src: fullUrl,
        title: item.title,
      });
      return;
    }

    if (item.kind === 'canvas_doc' && item.canvasDoc) {
      handleOpenCanvasDoc(item.canvasDoc._id, item.conversationId);
      return;
    }

    if (item.kind === 'canvas_board' && item.canvasBoard) {
      handleOpenCanvasBoard(item.canvasBoard._id, item.conversationId);
      return;
    }

    if (item.file) {
      setPreviewFileState({ open: true, file: item.file });
    }
  };

  const handleNavigateToChat = (conversationId: string) => {
    navigate(`/c/${conversationId}`);
  };

  const handleDownloadItem = async (item: UnifiedLibraryItem) => {
    await downloadLibraryItemsAsZip([item], user?.id);
  };

  const handleBulkDownload = async () => {
    const selected = filteredItems.filter((i) => selectedItemIds.has(i.id));
    if (selected.length === 0) return;
    setIsZipping(true);
    try {
      await downloadLibraryItemsAsZip(selected, user?.id);
    } catch (err) {
      console.error('Bulk download error:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDeleteItem = (item: UnifiedLibraryItem) => {
    setDeleteDialog({ open: true, items: [item] });
  };

  const handleBulkDelete = () => {
    const selected = filteredItems.filter((i) => selectedItemIds.has(i.id));
    if (selected.length > 0) {
      setDeleteDialog({ open: true, items: selected });
    }
  };

  const confirmDelete = async () => {
    if (deleteDialog.items.length === 0) return;
    setIsDeleting(true);
    try {
      const filesToDelete = deleteDialog.items
        .filter((item) => !!item.file)
        .map((item) => ({
          file_id: item.file!.file_id,
          filepath: item.file!.filepath,
          source: item.file!.source ?? FileSources.local,
          embedded: item.file!.embedded ?? false,
        }));

      if (filesToDelete.length > 0) {
        await deleteFilesMutation.mutateAsync({ files: filesToDelete });
      }

      const deletedIds = new Set(deleteDialog.items.map((i) => i.id));
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });

      refetchAll();
      setDeleteDialog({ open: false, items: [] });
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelect = (item: UnifiedLibraryItem) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedItemIds(new Set());
    } else {
      setIsSelectMode(true);
    }
  };

  const handleDownloadLightboxImage = async () => {
    try {
      const response = await fetch(lightboxState.src);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      triggerDownload(url, lightboxState.title || 'image.png');
    } catch {
      triggerDownload(lightboxState.src, lightboxState.title || 'image.png');
    }
  };

  const allSelected = filteredItems.length > 0 && selectedItemIds.size === filteredItems.length;

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
          onDownloadItem={handleDownloadItem}
          onDeleteItem={handleDeleteItem}
          isSelectMode={isSelectMode}
          selectedItemIds={selectedItemIds}
          onToggleSelect={handleToggleSelect}
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
        onDownloadItem={handleDownloadItem}
        onDeleteItem={handleDeleteItem}
        isSelectMode={isSelectMode}
        selectedItemIds={selectedItemIds}
        onToggleSelect={handleToggleSelect}
        allSelected={allSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
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

          {/* Header */}
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
            isSelectMode={isSelectMode}
            onToggleSelectMode={handleToggleSelectMode}
            selectedCount={selectedItemIds.size}
            allSelected={allSelected}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkDownload={handleBulkDownload}
            onBulkDelete={handleBulkDelete}
            isZipping={isZipping}
            isDeleting={isDeleting}
          />

          {/* Content Area */}
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 scrollbar-gutter-stable overflow-x-hidden overflow-y-auto p-3 sm:p-5"
          >
            {renderContent()}
          </div>
        </main>
      </SidePanelGroup>

      {/* Image Lightbox Dialog */}
      {lightboxState.open && (
        <DialogImage
          isOpen={lightboxState.open}
          onOpenChange={(open) => setLightboxState((prev) => ({ ...prev, open }))}
          src={lightboxState.src}
          title={lightboxState.title}
          downloadImage={handleDownloadLightboxImage}
          showDetails={false}
        />
      )}

      {/* Document & File Preview Dialog */}
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

      {/* Delete Confirmation Modal */}
      <OGDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteDialog((prev) => ({ ...prev, open }));
          }
        }}
      >
        <OGDialogContent className="max-w-md">
          <OGDialogTitle>
            {deleteDialog.items.length > 1
              ? localize('com_ui_library_delete_confirm_title', {
                  count: deleteDialog.items.length,
                })
              : localize('com_ui_library_delete_single_confirm_title')}
          </OGDialogTitle>
          <OGDialogDescription>
            {localize('com_ui_library_delete_confirm_desc')}
          </OGDialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteDialog({ open: false, items: [] })}
            >
              {localize('com_ui_cancel')}
            </Button>
            <Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting && <Spinner className="me-1.5 size-3.5" />}
              <span>{localize('com_ui_delete')}</span>
            </Button>
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
