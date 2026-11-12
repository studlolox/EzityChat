import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { dataService } from 'librechat-data-provider';
import {
  Folder,
  FileText,
  Network,
  Download,
  Eye,
  Search,
  Upload,
  Loader2,
  Layers,
} from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogDescription,
} from '@librechat/client';
import type { TFile, TConversation } from 'librechat-data-provider';
import {
  canvasOpenAtom,
  activeCanvasDocIdAtom,
  canvasModeAtom,
  activeBoardIdAtom,
} from '~/components/Canvas/state';
import FilePreviewDialog, {
  formatBytes,
} from '~/components/Chat/Messages/Content/FilePreviewDialog';
import { normalizeCanvasLanguage } from '~/components/Canvas/canvas-language-support';
import ExportModal from '~/components/Nav/ExportConversation/ExportModal';
import { useGetFiles } from '~/data-provider';
import { triggerDownload } from '~/utils';
import { useLocalize } from '~/hooks';

export interface ChatFilesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: TConversation | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

interface CanvasDocItem {
  _id: string;
  title: string;
  docType: 'markdown' | 'code';
  language?: string;
  updatedAt?: string;
}

interface CanvasBoardItem {
  _id: string;
  title: string;
  rootTopic: string;
  updatedAt?: string;
}

export function ChatFilesDrawer({
  open,
  onOpenChange,
  conversation,
  triggerRef,
}: ChatFilesDrawerProps) {
  const localize = useLocalize();
  const conversationId = conversation?.conversationId ?? '';

  const setCanvasOpen = useSetAtom(canvasOpenAtom);
  const setActiveDocId = useSetAtom(activeCanvasDocIdAtom);
  const setCanvasMode = useSetAtom(canvasModeAtom);
  const setActiveBoardId = useSetAtom(activeBoardIdAtom);

  const [activeTab, setActiveTab] = useState<'all' | 'files' | 'canvas' | 'boards'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingExtras, setLoadingExtras] = useState(false);

  const [canvasDocs, setCanvasDocs] = useState<CanvasDocItem[]>([]);
  const [canvasBoards, setCanvasBoards] = useState<CanvasBoardItem[]>([]);

  // Preview dialog state for files
  const [previewFileState, setPreviewFileState] = useState<{
    open: boolean;
    file: TFile | null;
  }>({ open: false, file: null });

  // Export modal state
  const [exportOpen, setExportOpen] = useState(false);

  // Fetch all user files
  const { data: allFiles = [] } = useGetFiles<TFile[]>({
    enabled: open,
  });

  // Filter files that belong to this conversation
  const chatFiles = useMemo(() => {
    if (!conversationId) return [];
    return allFiles.filter(
      (f) =>
        f.conversationId === conversationId ||
        (f as unknown as { convoId?: string }).convoId === conversationId,
    );
  }, [allFiles, conversationId]);

  // Load Canvas documents and mindmap boards for this conversation
  const loadExtras = useCallback(async () => {
    if (!conversationId) return;
    try {
      setLoadingExtras(true);
      const [docsData, boardsData] = await Promise.all([
        dataService.listCanvasDocuments({ convoId: conversationId }),
        dataService.listCanvasBoards({ convoId: conversationId }),
      ]);

      setCanvasDocs(docsData.documents ?? []);
      setCanvasBoards(boardsData.boards ?? []);
    } catch {
      // Ignored
    } finally {
      setLoadingExtras(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open) {
      loadExtras();
    }
  }, [open, loadExtras]);

  // Handle opening Canvas Document
  const handleOpenDoc = (docId: string) => {
    setActiveDocId(docId);
    setCanvasMode('document');
    setCanvasOpen(true);
    onOpenChange(false);
  };

  // Handle opening Mindmap Board
  const handleOpenBoard = (boardId: string) => {
    setActiveBoardId(boardId);
    setCanvasMode('board');
    setCanvasOpen(true);
    onOpenChange(false);
  };

  // Filter items by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return chatFiles;
    const q = searchQuery.toLowerCase();
    return chatFiles.filter((f) => f.filename.toLowerCase().includes(q));
  }, [chatFiles, searchQuery]);

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return canvasDocs;
    const q = searchQuery.toLowerCase();
    return canvasDocs.filter((d) => d.title.toLowerCase().includes(q));
  }, [canvasDocs, searchQuery]);

  const filteredBoards = useMemo(() => {
    if (!searchQuery.trim()) return canvasBoards;
    const q = searchQuery.toLowerCase();
    return canvasBoards.filter(
      (b) => b.title.toLowerCase().includes(q) || b.rootTopic.toLowerCase().includes(q),
    );
  }, [canvasBoards, searchQuery]);

  const totalCount = chatFiles.length + canvasDocs.length + canvasBoards.length;

  return (
    <>
      <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
        <OGDialogContent
          className="flex h-[80vh] w-full max-w-3xl flex-col !overflow-hidden p-0"
          showCloseButton={true}
        >
          <div className="border-border-light bg-surface-primary shrink-0 border-b px-6 pt-6 pb-4">
            <OGDialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="bg-surface-secondary text-text-primary flex size-8 items-center justify-center rounded-xl">
                    <Folder className="size-4" />
                  </span>
                  <div>
                    <OGDialogTitle className="text-base font-semibold">
                      {localize('com_ui_chat_files_artifacts')}
                    </OGDialogTitle>
                    <OGDialogDescription className="text-xs">
                      {totalCount !== 1
                        ? localize('com_ui_chat_files_summary_plural', {
                            title: conversation?.title || localize('com_ui_current_conversation'),
                            count: totalCount,
                          })
                        : localize('com_ui_chat_files_summary', {
                            title: conversation?.title || localize('com_ui_current_conversation'),
                            count: totalCount,
                          })}
                    </OGDialogDescription>
                  </div>
                </div>

                {/* One-Tap Export Button */}
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition"
                  title={localize('com_ui_export_chat')}
                >
                  <Upload className="size-3.5" />
                  <span>{localize('com_ui_export_chat')}</span>
                </button>
              </div>
            </OGDialogHeader>

            {/* Search Bar & Filter Tabs */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Filter Tabs */}
              <div className="border-border-light bg-surface-secondary/70 flex items-center rounded-xl border p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-surface-primary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {localize('com_ui_all_count', { count: totalCount })}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeTab === 'files'
                      ? 'bg-surface-primary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {localize('com_ui_files_count', { count: chatFiles.length })}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('canvas')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeTab === 'canvas'
                      ? 'bg-surface-primary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {localize('com_ui_canvas_count', { count: canvasDocs.length })}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('boards')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeTab === 'boards'
                      ? 'bg-surface-primary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {localize('com_ui_boards_count', { count: canvasBoards.length })}
                </button>
              </div>

              {/* Search input */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="text-text-tertiary absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={localize('com_ui_search_files_artifacts')}
                  className="border-border-light bg-surface-secondary text-text-primary focus:border-border-medium w-full rounded-xl border py-1.5 pr-3 pl-8 text-xs focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Drawer Body Items */}
          <div className="bg-surface-primary flex-1 overflow-y-auto p-6">
            {loadingExtras && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="text-text-tertiary size-6 animate-spin" />
              </div>
            )}

            {!loadingExtras && totalCount === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Layers className="text-text-tertiary size-10" />
                <p className="text-text-primary text-sm font-semibold">
                  {localize('com_ui_no_files_artifacts_title')}
                </p>
                <p className="text-text-secondary max-w-sm text-xs">
                  {localize('com_ui_no_files_artifacts_desc')}
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              {/* Files */}
              {(activeTab === 'all' || activeTab === 'files') &&
                filteredFiles.map((file) => (
                  <div
                    key={file.file_id}
                    className="border-border-light bg-surface-secondary/50 hover:bg-surface-secondary hover:border-border-medium flex items-center justify-between rounded-2xl border p-3.5 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-surface-tertiary text-text-secondary flex size-9 shrink-0 items-center justify-center rounded-xl">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-text-primary truncate text-sm font-medium">
                          {file.filename}
                        </p>
                        <p className="text-text-secondary text-2xs flex items-center gap-2">
                          <span>{formatBytes(file.bytes || 0)}</span>
                          <span>·</span>
                          <span className="uppercase">{file.type || 'FILE'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewFileState({ open: true, file })}
                        className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-2 transition-colors"
                        title={localize('com_ui_preview_file')}
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownload(file.filepath || file.file_id, file.filename)
                        }
                        className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary rounded-lg p-2 transition-colors"
                        title={localize('com_ui_download_file')}
                      >
                        <Download className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}

              {/* Canvas Documents */}
              {(activeTab === 'all' || activeTab === 'canvas') &&
                filteredDocs.map((doc) => (
                  <div
                    key={doc._id}
                    className="border-border-light bg-surface-secondary/50 hover:bg-surface-secondary hover:border-border-medium flex items-center justify-between rounded-2xl border p-3.5 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-surface-tertiary text-text-secondary flex size-9 shrink-0 items-center justify-center rounded-xl">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-text-primary truncate text-sm font-medium">
                          {doc.title}
                        </p>
                        <p className="text-text-secondary text-2xs flex items-center gap-2">
                          <span className="bg-surface-primary text-text-primary rounded px-1.5 py-0.5 font-mono">
                            {localize('com_ui_canvas_coeditor_badge')}
                          </span>
                          <span>·</span>
                          <span className="uppercase">
                            {normalizeCanvasLanguage(doc.language, doc.title) || doc.docType}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenDoc(doc._id)}
                      className="border-border-medium bg-surface-primary text-text-primary hover:bg-surface-secondary inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition"
                    >
                      <Eye className="size-3.5" />
                      <span>{localize('com_ui_open_in_canvas')}</span>
                    </button>
                  </div>
                ))}

              {/* Mindmap Boards */}
              {(activeTab === 'all' || activeTab === 'boards') &&
                filteredBoards.map((board) => (
                  <div
                    key={board._id}
                    className="border-border-light bg-surface-secondary/50 hover:bg-surface-secondary hover:border-border-medium flex items-center justify-between rounded-2xl border p-3.5 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-surface-tertiary text-text-secondary flex size-9 shrink-0 items-center justify-center rounded-xl">
                        <Network className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-text-primary truncate text-sm font-medium">
                          {board.title}
                        </p>
                        <p className="text-text-secondary text-2xs flex items-center gap-2">
                          <span className="bg-surface-primary text-text-primary rounded px-1.5 py-0.5 font-mono">
                            {localize('com_ui_mindmap_badge')}
                          </span>
                          <span>·</span>
                          <span>{localize('com_ui_topic_prefix', { topic: board.rootTopic })}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenBoard(board._id)}
                      className="border-border-medium bg-surface-primary text-text-primary hover:bg-surface-secondary inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition"
                    >
                      <Eye className="size-3.5" />
                      <span>{localize('com_ui_view_mindmap')}</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>

      {/* File Preview Dialog */}
      {previewFileState.file && (
        <FilePreviewDialog
          open={previewFileState.open}
          onOpenChange={(isOpen) => setPreviewFileState((prev) => ({ ...prev, open: isOpen }))}
          fileId={previewFileState.file.file_id}
          fileName={previewFileState.file.filename}
          fileType={previewFileState.file.type}
          fileSize={previewFileState.file.bytes}
        />
      )}

      {/* One-Tap Export Dialog */}
      {conversation && (
        <ExportModal
          open={exportOpen}
          onOpenChange={setExportOpen}
          conversation={conversation}
          aria-label={localize('com_ui_export_convo_modal')}
        />
      )}
    </>
  );
}

export default ChatFilesDrawer;
