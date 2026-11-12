import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { cn } from '@librechat/client';
import {
  FileText,
  Code2,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  Loader2,
  Eye,
} from 'lucide-react';
import {
  normalizeCanvasLanguage,
  isWebPreviewableLanguage,
  getLanguageDisplayName,
} from './canvas-language-support';
import { canvasOpenAtom, activeCanvasDocIdAtom, activeBoardIdAtom, canvasModeAtom } from './state';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import CanvasWebPreview from './CanvasWebPreview';
import CanvasCodeEditor from './CanvasCodeEditor';
import { useLocalize } from '~/hooks';

export interface CanvasMessageCardProps {
  toolCallId?: string;
  name: string;
  args?: string | Record<string, unknown>;
  output?: string | Record<string, unknown>;
  runStepStatus?: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  isSubmitting?: boolean;
  className?: string;
}

type CardStatus = 'in_progress' | 'completed' | 'failed';
type CardAction = 'create' | 'edit';

function getDocumentIcon(language: string) {
  const lang = (language || '').toLowerCase().trim();
  if (
    [
      'typescript',
      'javascript',
      'python',
      'html',
      'css',
      'json',
      'sql',
      'sh',
      'yaml',
      'c',
      'cpp',
      'rust',
      'go',
      'svg',
      'xml',
    ].includes(lang)
  ) {
    return <Code2 className="text-link size-4 shrink-0" />;
  }
  if (lang === 'board') {
    return <LayoutDashboard className="text-text-secondary size-4 shrink-0" />;
  }
  return <FileText className="text-text-primary size-4 shrink-0" />;
}

function getIconContainerClass(status: CardStatus, action: CardAction): string {
  if (status === 'failed') {
    return 'bg-status-error/15 text-status-error';
  }
  if (action === 'edit') {
    return 'bg-surface-tertiary text-text-primary';
  }
  return 'bg-surface-secondary text-text-primary';
}

function getStatusBadgeClass(status: CardStatus, action: CardAction): string {
  if (status === 'in_progress') {
    return 'bg-status-warning/15 text-status-warning';
  }
  if (status === 'failed') {
    return 'bg-status-error/15 text-status-error';
  }
  if (action === 'edit') {
    return 'bg-surface-tertiary text-text-primary';
  }
  return 'bg-status-success/15 text-status-success';
}

export function CanvasMessageCard({
  name,
  args,
  output,
  runStepStatus,
  isSubmitting = false,
  className = '',
}: CanvasMessageCardProps) {
  const localize = useLocalize();
  const setCanvasOpen = useSetAtom(canvasOpenAtom);
  const setActiveDocId = useSetAtom(activeCanvasDocIdAtom);
  const setActiveBoardId = useSetAtom(activeBoardIdAtom);
  const setCanvasMode = useSetAtom(canvasModeAtom);

  const parsedArgs = useMemo<Record<string, unknown>>(() => {
    if (!args) return {};
    if (typeof args === 'object') return args;
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }, [args]);

  const parsedOutput = useMemo<Record<string, unknown>>(() => {
    if (!output) return {};
    if (typeof output === 'object') return output;
    try {
      return JSON.parse(output);
    } catch {
      return {};
    }
  }, [output]);

  const docId = (parsedOutput.documentId as string) || (parsedArgs.documentId as string) || null;
  const boardId = (parsedOutput.boardId as string) || (parsedArgs.boardId as string) || null;
  const isBoard = name.includes('board') || Boolean(boardId);

  const initialContent =
    (parsedArgs.content as string) ||
    (parsedArgs.proposedContent as string) ||
    (parsedArgs.initialContent as string) ||
    '';

  const defaultTitle = isBoard
    ? localize('com_ui_canvas_mindmap')
    : localize('com_ui_canvas_document');
  const rawTitle = (parsedOutput.title as string) || (parsedArgs.title as string) || defaultTitle;

  const rawLang =
    (parsedOutput.language as string) ||
    (parsedArgs.language as string) ||
    (parsedArgs.docType as string) ||
    '';

  const normalizedLang = normalizeCanvasLanguage(rawLang, initialContent);

  const status: CardStatus = useMemo(() => {
    if (runStepStatus === 'failed' || parsedOutput.success === false) {
      return 'failed';
    }
    if (isSubmitting || runStepStatus === 'in_progress') {
      return 'in_progress';
    }
    return 'completed';
  }, [runStepStatus, parsedOutput.success, isSubmitting]);

  const action: CardAction = name.includes('edit') || name.includes('propose') ? 'edit' : 'create';

  const [isExpanded, setIsExpanded] = useState(() => status === 'in_progress');
  const wasLiveRef = useRef(status === 'in_progress');
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (status === 'in_progress') {
      wasLiveRef.current = true;
      if (!userToggledRef.current) {
        setIsExpanded(true);
      }
    }
  }, [status]);

  const [streamedLength, setStreamedLength] = useState<number>(() => {
    if (status === 'in_progress') return 0;
    return initialContent.length;
  });
  const [isTyping, setIsTyping] = useState<boolean>(status === 'in_progress');

  useEffect(() => {
    if (!initialContent) {
      setIsTyping(status === 'in_progress');
      return;
    }

    if (!wasLiveRef.current) {
      setStreamedLength(initialContent.length);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timer = setInterval(() => {
      setStreamedLength((prev) => {
        const target = initialContent.length;
        if (prev >= target) {
          if (status === 'completed') {
            setIsTyping(false);
          }
          return prev;
        }
        const remaining = target - prev;
        const step = Math.max(3, Math.ceil(remaining / 14));
        const next = Math.min(prev + step, target);
        if (next >= target && status === 'completed') {
          setIsTyping(false);
        }
        return next;
      });
    }, 20);

    return () => clearInterval(timer);
  }, [initialContent, status]);

  const displayedContent =
    status === 'in_progress' && isTyping ? initialContent.slice(0, streamedLength) : initialContent;

  const isWebLanguage = isWebPreviewableLanguage(normalizedLang, initialContent);
  const hasPreview = isWebLanguage || normalizedLang === 'markdown';

  const [userSelectedMode, setUserSelectedMode] = useState<'code' | 'preview' | null>(null);

  const activeMode: 'code' | 'preview' = useMemo(() => {
    if (userSelectedMode != null) {
      return userSelectedMode;
    }
    if (status === 'in_progress' || isTyping) {
      return 'code';
    }
    return hasPreview ? 'preview' : 'code';
  }, [userSelectedMode, status, isTyping, hasPreview]);

  const handleOpenWorkspace = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isBoard && boardId) {
        setActiveBoardId(boardId);
        setCanvasMode('board');
        setCanvasOpen(true);
      } else if (docId) {
        setActiveDocId(docId);
        setCanvasMode('document');
        setCanvasOpen(true);
      }
    },
    [isBoard, boardId, docId, setActiveBoardId, setActiveDocId, setCanvasMode, setCanvasOpen],
  );

  const handleToggleExpand = () => {
    userToggledRef.current = true;
    setIsExpanded((prev) => !prev);
  };

  const handleToggleViewMode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isExpanded) {
        setIsExpanded(true);
        userToggledRef.current = true;
      }
      setUserSelectedMode((prev) => {
        if (prev != null) {
          return prev === 'code' ? 'preview' : 'code';
        }
        if (status === 'in_progress' || isTyping) {
          return 'preview';
        }
        return hasPreview ? 'code' : 'preview';
      });
    },
    [isExpanded, isTyping, status, hasPreview],
  );

  const renderStatusBadgeContent = () => {
    if (status === 'in_progress') {
      return (
        <>
          <Loader2 className="size-2.5 animate-spin" />
          <span>{localize('com_ui_canvas_drafting')}</span>
        </>
      );
    }
    if (status === 'failed') {
      return <span>{localize('com_ui_canvas_failed')}</span>;
    }
    if (action === 'edit') {
      return <span>{localize('com_ui_canvas_edited')}</span>;
    }
    return <span>{localize('com_ui_canvas_created')}</span>;
  };

  const renderDocumentPreview = () => {
    if (activeMode !== 'preview') {
      return (
        <div className="border-border-light bg-surface-primary h-[360px] w-full overflow-hidden rounded-xl border sm:h-[420px]">
          <CanvasCodeEditor content={displayedContent} language={normalizedLang} readOnly={true} />
        </div>
      );
    }

    if (isWebLanguage) {
      return (
        <CanvasWebPreview
          content={displayedContent}
          language={normalizedLang}
          variant="inline"
          className="h-full w-full"
        />
      );
    }

    return (
      <div className="max-h-[380px] overflow-y-auto pr-1">
        <MarkdownLite content={displayedContent} />
      </div>
    );
  };

  const renderExpandedContent = () => {
    if (isBoard) {
      return (
        <div className="bg-surface-primary flex flex-col items-center justify-center gap-3 rounded-xl p-6 text-center">
          <div className="bg-surface-secondary text-text-primary flex size-12 items-center justify-center rounded-2xl">
            <LayoutDashboard className="size-6" />
          </div>
          <div>
            <h4 className="text-text-primary text-sm font-semibold">{rawTitle}</h4>
            <p className="text-text-secondary mt-0.5 text-xs">
              {localize('com_ui_canvas_visual_mindmap_desc')}
            </p>
          </div>
          {boardId && (
            <button
              type="button"
              onClick={handleOpenWorkspace}
              className="bg-surface-primary border-border-medium text-text-primary hover:bg-surface-secondary mt-1 flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-medium shadow-xs transition-all active:scale-95"
            >
              <ExternalLink className="size-3.5" />
              <span>{localize('com_ui_canvas_open_mindmap')}</span>
            </button>
          )}
        </div>
      );
    }

    if (!displayedContent) {
      return (
        <div className="text-text-tertiary flex items-center justify-center py-8 italic">
          {localize('com_ui_canvas_no_content')}
        </div>
      );
    }

    return renderDocumentPreview();
  };

  return (
    <div
      data-testid="canvas-message-card"
      className={cn(
        'border-border-medium bg-surface-primary my-2.5 flex flex-col overflow-hidden rounded-2xl border shadow-xs transition-all duration-200',
        isExpanded ? 'w-full max-w-2xl' : 'w-full max-w-[480px]',
        className,
      )}
    >
      {/* 1. Header Bar: Slim 1-Line (Always Visible) */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} Canvas document ${rawTitle}`}
        className="hover:bg-surface-secondary/60 flex min-h-[44px] cursor-pointer items-center justify-between gap-2 p-2.5 transition-colors select-none"
      >
        {/* Left: Icon, Title, Badge & Language */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
              getIconContainerClass(status, action),
            )}
          >
            {status === 'failed' ? (
              <AlertCircle className="text-status-error size-3.5 shrink-0" />
            ) : (
              getDocumentIcon(normalizedLang)
            )}
          </div>

          <span className="text-text-primary max-w-[150px] truncate text-xs font-semibold sm:max-w-[220px] sm:text-sm">
            {rawTitle}
          </span>

          {/* Status Action Badge */}
          <span
            className={cn(
              'text-3xs inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium tracking-wider uppercase',
              getStatusBadgeClass(status, action),
            )}
          >
            {renderStatusBadgeContent()}
          </span>

          {/* Language tag */}
          <span className="text-text-tertiary text-3xs hidden shrink-0 font-mono font-medium tracking-wider uppercase sm:inline">
            {isBoard ? localize('com_ui_canvas_mindmap') : getLanguageDisplayName(normalizedLang)}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Code / Preview toggle */}
          {hasPreview && !isBoard && (
            <button
              type="button"
              title={
                activeMode === 'code'
                  ? localize('com_ui_canvas_preview')
                  : localize('com_ui_canvas_code')
              }
              onClick={handleToggleViewMode}
              className="border-border-light bg-surface-secondary text-text-secondary hover:text-text-primary flex min-h-[36px] items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition sm:min-h-0"
            >
              {activeMode === 'code' ? (
                <>
                  <Eye className="text-link size-3.5" />
                  <span className="hidden sm:inline">{localize('com_ui_canvas_preview')}</span>
                </>
              ) : (
                <>
                  <Code2 className="text-link size-3.5" />
                  <span className="hidden sm:inline">{localize('com_ui_canvas_code')}</span>
                </>
              )}
            </button>
          )}

          {/* Open full workspace button */}
          {(docId || boardId) && (
            <button
              type="button"
              title={localize('com_ui_open_in_canvas')}
              onClick={handleOpenWorkspace}
              className="border-border-medium bg-surface-primary text-text-primary hover:bg-surface-secondary flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border p-1.5 transition-all active:scale-95 sm:min-h-0 sm:min-w-0"
            >
              <ExternalLink className="size-3.5" />
            </button>
          )}

          {/* Accordion toggle button */}
          <button
            type="button"
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
            className="text-text-tertiary hover:text-text-primary flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1 transition-colors sm:min-h-0 sm:min-w-0"
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {/* 2. Expanded Inline Document Body */}
      {isExpanded && (
        <div
          data-testid="canvas-inline-expanded-preview"
          className={cn(
            'border-border-light bg-surface-secondary/40 border-t text-xs',
            activeMode === 'preview' && isWebLanguage
              ? 'h-[460px] overflow-hidden p-0'
              : 'p-3 sm:p-4',
          )}
        >
          {renderExpandedContent()}
        </div>
      )}
    </div>
  );
}

export default CanvasMessageCard;
