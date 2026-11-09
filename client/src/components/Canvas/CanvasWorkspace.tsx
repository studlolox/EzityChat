import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
import { cn } from '@librechat/client';
import { canvasOpenAtom, activeCanvasDocIdAtom, canvasViewModeAtom } from './state';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { CanvasCodeEditor } from './CanvasCodeEditor';
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
  status: 'pending' | 'accepted' | 'rejected';
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

  const [document, setDocument] = useState<CanvasDocData | null>(null);
  const [currentRevision, setCurrentRevision] = useState<CanvasRevData | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<CanvasCandidateData | null>(null);

  const [localContent, setLocalContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingCandidate, setIsResolvingCandidate] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    setCanvasOpen(false);
    if (onClose) onClose();
  }, [setCanvasOpen, onClose]);

  // Load document and revisions
  const loadDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      let targetId = activeDocId;

      if (!targetId && conversationId) {
        // Fetch list of active docs in conversation
        const listRes = await fetch(`/api/canvas?convoId=${encodeURIComponent(conversationId)}`, {
          credentials: 'include',
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.documents && listData.documents.length > 0) {
            targetId = listData.documents[0]._id;
            setActiveDocId(targetId);
          }
        }
      }

      if (!targetId) {
        setIsLoading(false);
        return;
      }

      const res = await fetch(`/api/canvas/${encodeURIComponent(targetId)}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setIsLoading(false);
        return;
      }

      const data = await res.json();
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
        const res = await fetch(`/api/canvas/${encodeURIComponent(document._id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            content: contentToSave,
            baseRevisionId: currentRevision._id,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setCurrentRevision(data.revision);
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
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
      const res = await fetch(
        `/api/canvas/${encodeURIComponent(document._id)}/candidates/${encodeURIComponent(activeCandidate._id)}/accept`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      if (res.ok) {
        const data = await res.json();
        setActiveCandidate(null);
        setCurrentRevision(data.revision);
        setLocalContent(data.revision.content);
        setSaveStatus('saved');
      }
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
      const res = await fetch(
        `/api/canvas/${encodeURIComponent(document._id)}/candidates/${encodeURIComponent(activeCandidate._id)}/reject`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      if (res.ok) {
        setActiveCandidate(null);
      }
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

  if (isLoading) {
    return (
      <div className="bg-surface-primary flex h-full w-full items-center justify-center">
        <Loader2 className="text-text-tertiary size-6 animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="bg-surface-primary text-text-secondary flex h-full w-full flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-medium">{localize('com_ui_canvas_no_document')}</p>
        <button
          type="button"
          onClick={handleClose}
          className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary mt-4 rounded-xl border px-4 py-1.5 text-xs font-medium transition"
        >
          {localize('com_ui_close')}
        </button>
      </div>
    );
  }

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
      return <CanvasCodeEditor content={localContent} onChange={handleContentChange} />;
    }
    return (
      <div className="h-full overflow-y-auto p-4 leading-relaxed">
        <MarkdownLite content={localContent} />
      </div>
    );
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
        language={document.language}
        docType={document.docType}
        saveStatus={saveStatus}
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
