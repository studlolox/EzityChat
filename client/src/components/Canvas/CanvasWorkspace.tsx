import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { cn } from '@librechat/client';
import { Loader2, Network, Plus } from 'lucide-react';
import { dataService } from 'librechat-data-provider';
import {
  canvasOpenAtom,
  activeCanvasDocIdAtom,
  canvasViewModeAtom,
  canvasModeAtom,
  activeBoardIdAtom,
} from './state';
import { normalizeCanvasLanguage, isWebPreviewableLanguage } from './canvas-language-support';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { VisualBoardEditor } from './VisualBoardEditor';
import { CanvasCodeEditor } from './CanvasCodeEditor';
import { CanvasWebPreview } from './CanvasWebPreview';
import { CanvasDiffView } from './CanvasDiffView';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasHeader } from './CanvasHeader';
import { useLocalize } from '~/hooks';

export interface CanvasWorkspaceProps {
  conversationId?: string;
  onClose?: () => void;
  isMobileSheet?: boolean;
}

interface CanvasDocData {
  _id: string;
  title: string;
  docType: 'markdown' | 'code';
  language?: string;
  currentRevisionId?: string;
}

interface CanvasRevData {
  _id: string;
  content: string;
}

interface CanvasCandidateData {
  _id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  proposedContent: string;
  patchSummary?: string;
}

export function CanvasWorkspace({
  conversationId,
  onClose,
  isMobileSheet = false,
}: CanvasWorkspaceProps) {
  const localize = useLocalize();
  const [, setCanvasOpen] = useAtom(canvasOpenAtom);
  const [activeDocId, setActiveDocId] = useAtom(activeCanvasDocIdAtom);
  const [viewMode, setViewMode] = useAtom(canvasViewModeAtom);
  const [canvasMode, setCanvasMode] = useAtom(canvasModeAtom);
  const [activeBoardId, setActiveBoardId] = useAtom(activeBoardIdAtom);

  const [document, setDocument] = useState<CanvasDocData | null>(null);
  const [currentRevision, setCurrentRevision] = useState<CanvasRevData | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<CanvasCandidateData | null>(null);

  const [localContent, setLocalContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingCandidate, setIsResolvingCandidate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    setCanvasOpen(false);
    if (onClose) onClose();
  }, [setCanvasOpen, onClose]);

  // Load visual board if switching to board mode
  const loadBoard = useCallback(async () => {
    if (!conversationId) return;
    try {
      const listData = await dataService.listCanvasBoards({ convoId: conversationId });
      if (listData.boards && listData.boards.length > 0 && !activeBoardId) {
        setActiveBoardId(listData.boards[0]._id);
      }
    } catch {
      // Ignored
    }
  }, [conversationId, activeBoardId, setActiveBoardId]);

  useEffect(() => {
    if (canvasMode === 'board') {
      loadBoard();
    }
  }, [canvasMode, loadBoard]);

  const handleCreateInitialBoard = async () => {
    if (!conversationId) return;
    try {
      setIsCreatingBoard(true);
      const data = await dataService.createCanvasBoard({
        conversationId,
        title: 'Mindmap',
        rootTopic: 'Main Topic',
      });
      if (data.board?._id) {
        setActiveBoardId(data.board._id);
      }
    } catch {
      // Ignored
    } finally {
      setIsCreatingBoard(false);
    }
  };

  // Load document and revisions
  const loadDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      let targetId = activeDocId;

      if (!targetId && conversationId) {
        // Fetch list of active docs in conversation
        const listData = await dataService.listCanvasDocuments({ convoId: conversationId });
        if (listData.documents && listData.documents.length > 0) {
          targetId = listData.documents[0]._id;
          setActiveDocId(targetId);
        }
      }

      if (!targetId) {
        setIsLoading(false);
        return;
      }

      const data = await dataService.getCanvasDocument(targetId);
      setDocument(data.document);
      setCurrentRevision(data.currentRevision);
      setActiveCandidate(data.activeCandidate || null);
      setLocalContent(data.currentRevision?.content || '');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [activeDocId, conversationId, setActiveDocId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Handle save
  const persistChanges = useCallback(
    async (contentToSave: string) => {
      if (!document || !currentRevision) return;

      try {
        setSaveStatus('saving');
        const data = await dataService.updateCanvasDocument(document._id, {
          content: contentToSave,
          baseRevisionId: currentRevision._id,
        });

        setCurrentRevision(data.revision);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [document, currentRevision],
  );

  const handleContentChange = useCallback(
    (newContent: string) => {
      setLocalContent(newContent);
      setSaveStatus('unsaved');

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        persistChanges(newContent);
      }, 1500);
    },
    [persistChanges],
  );

  // Candidate resolution
  const handleAcceptCandidate = async () => {
    if (!document || !activeCandidate) return;
    try {
      setIsResolvingCandidate(true);
      const data = await dataService.acceptCanvasCandidate(document._id, activeCandidate._id);
      setActiveCandidate(null);
      setCurrentRevision(data.revision);
      setLocalContent(data.revision.content);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsResolvingCandidate(false);
    }
  };

  const handleRejectCandidate = async () => {
    if (!document || !activeCandidate) return;
    try {
      setIsResolvingCandidate(true);
      await dataService.rejectCanvasCandidate(document._id, activeCandidate._id);
      setActiveCandidate(null);
    } catch {
      setSaveStatus('error');
    } finally {
      setIsResolvingCandidate(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (canvasMode === 'board') {
    return (
      <div
        className={cn(
          'bg-surface-primary text-text-primary flex h-full w-full flex-col',
          isMobileSheet && 'border-border-medium rounded-t-3xl border-t shadow-2xl',
        )}
      >
        {isMobileSheet && (
          <div className="flex w-full items-center justify-center pt-2 pb-1">
            <div className="bg-border-heavy/60 h-1.5 w-12 rounded-full" />
          </div>
        )}

        <CanvasHeader
          title="Mindmap Board"
          saveStatus="saved"
          mode="board"
          onModeChange={setCanvasMode}
          onClose={handleClose}
        />

        <div className="relative flex-1 overflow-hidden">
          {activeBoardId ? (
            <VisualBoardEditor boardId={activeBoardId} onClose={handleClose} />
          ) : (
            <div className="bg-surface-primary text-text-secondary flex h-full w-full flex-col items-center justify-center p-6 text-center">
              <Network className="text-text-tertiary mb-3 size-10" />
              <p className="text-text-primary text-sm font-semibold">
                {localize('com_ui_canvas_no_mindmap')}
              </p>
              <p className="text-text-secondary mt-1 text-xs">
                {localize('com_ui_canvas_no_mindmap_desc')}
              </p>
              <button
                type="button"
                onClick={handleCreateInitialBoard}
                disabled={isCreatingBoard}
                className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary mt-4 flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition"
              >
                {isCreatingBoard ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                <span>{localize('com_ui_canvas_create_mindmap')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-surface-primary flex h-full w-full items-center justify-center">
        <Loader2 className="text-text-tertiary size-6 animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div
        className={cn(
          'bg-surface-primary text-text-primary flex h-full w-full flex-col',
          isMobileSheet && 'border-border-medium rounded-t-3xl border-t shadow-2xl',
        )}
      >
        <CanvasHeader
          title="Document"
          saveStatus="saved"
          mode="document"
          onModeChange={setCanvasMode}
          onClose={handleClose}
        />
        <div className="text-text-secondary flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium">{localize('com_ui_canvas_no_document')}</p>
          <button
            type="button"
            onClick={handleClose}
            className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary mt-4 rounded-xl border px-4 py-1.5 text-xs font-medium transition"
          >
            {localize('com_ui_close')}
          </button>
        </div>
      </div>
    );
  }

  const normalizedLang = normalizeCanvasLanguage(document?.language, localContent);

  const renderBodyContent = () => {
    if (activeCandidate && activeCandidate.status === 'pending') {
      return (
        <CanvasDiffView
          baseContent={currentRevision?.content || ''}
          proposedContent={activeCandidate.proposedContent}
          patchSummary={activeCandidate.patchSummary}
          onAccept={handleAcceptCandidate}
          onReject={handleRejectCandidate}
          isResolving={isResolvingCandidate}
        />
      );
    }
    if (viewMode === 'edit') {
      return (
        <CanvasCodeEditor
          content={localContent}
          language={normalizedLang}
          onChange={handleContentChange}
        />
      );
    }
    if (isWebPreviewableLanguage(normalizedLang, localContent)) {
      return <CanvasWebPreview content={localContent} language={normalizedLang} />;
    }
    if (normalizedLang === 'markdown') {
      return (
        <div className="h-full overflow-y-auto p-4 leading-relaxed">
          <MarkdownLite content={localContent} />
        </div>
      );
    }
    return <CanvasCodeEditor content={localContent} language={normalizedLang} readOnly={true} />;
  };

  return (
    <div
      className={cn(
        'bg-surface-primary text-text-primary flex h-full w-full flex-col',
        isMobileSheet && 'border-border-medium rounded-t-3xl border-t shadow-2xl',
      )}
    >
      {/* Mobile Grab Handle */}
      {isMobileSheet && (
        <div className="flex w-full items-center justify-center pt-2 pb-1">
          <div className="bg-border-heavy/60 h-1.5 w-12 rounded-full" />
        </div>
      )}

      {/* Header */}
      <CanvasHeader
        title={document.title}
        language={normalizedLang}
        content={localContent}
        docType={document.docType}
        saveStatus={saveStatus}
        mode="document"
        onModeChange={setCanvasMode}
        onClose={handleClose}
      />

      {/* Body: Diff View OR Editor/Preview */}
      <div className="relative flex-1 overflow-hidden">{renderBodyContent()}</div>

      {/* Toolbar */}
      {(!activeCandidate || activeCandidate.status !== 'pending') && (
        <CanvasToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCopy={handleCopy}
          copied={copied}
        />
      )}
    </div>
  );
}

export default CanvasWorkspace;
