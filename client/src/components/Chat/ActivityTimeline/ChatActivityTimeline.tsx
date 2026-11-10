import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Brain,
  Copy,
  Check,
} from 'lucide-react';
import {
  aggregateActivityTimeline,
  formatToolAction,
  type ActivityStep,
  type RawChatEvent,
  type ToolStep,
  type ThoughtStep,
} from '~/utils/activity-aggregator';
import { useLocalize } from '~/hooks';

export interface ChatActivityTimelineProps {
  runId?: string;
  isLive?: boolean;
  startedAt?: number;
  events: RawChatEvent[];
  interimThought?: string | null;
  defaultExpanded?: boolean;
}

interface ThoughtStepRowProps {
  step: ThoughtStep;
  isLive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function ThoughtStepRow({ step, isLive, isExpanded, onToggle }: ThoughtStepRowProps) {
  const localize = useLocalize();
  const contentRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const trimmed = step.text.trim();
  const words = trimmed.length > 0 ? trimmed.split(/\s+/) : [];
  const wordCount = words.length;
  const isThoughtRunning = isLive && step.status === 'running';

  useEffect(() => {
    if (isThoughtRunning && contentRef.current && !userScrolledUpRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [step.text, isThoughtRunning]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    userScrolledUpRef.current = !isAtBottom;
  };

  const thoughtLabel = isThoughtRunning
    ? localize('com_ui_thinking')
    : `${localize('com_ui_thoughts')} (${wordCount})`;

  return (
    <div className="relative text-xs">
      <button
        type="button"
        onClick={onToggle}
        className="text-text-secondary hover:text-text-primary flex w-full cursor-pointer items-center justify-between gap-2 py-1 transition-colors select-none"
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Brain
            className={`text-text-primary size-3 shrink-0 ${isThoughtRunning ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          <span className="font-medium">{thoughtLabel}</span>
        </div>
        <ChevronDown
          className={`text-text-secondary size-3 shrink-0 transition-transform duration-150 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div
          ref={contentRef}
          onScroll={handleScroll}
          data-testid="interim-thought"
          className="border-border-light bg-surface-primary/50 text-text-secondary my-1 max-h-48 overflow-y-auto rounded-lg border-l-2 p-2 text-xs leading-relaxed whitespace-pre-wrap italic select-text"
        >
          {step.text}
        </div>
      )}
    </div>
  );
}

interface ToolStepRowProps {
  tool: ToolStep;
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolStepRow({ tool, isExpanded, onToggle }: ToolStepRowProps) {
  const localize = useLocalize();
  const [copied, setCopied] = useState(false);
  const isToolRunning = tool.status === 'running';
  const isToolFailed = tool.status === 'failed';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tool.outputPreview) return;
    try {
      await navigator.clipboard.writeText(tool.outputPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const renderStatusIcon = () => {
    if (isToolRunning) {
      return <Loader2 className="text-text-secondary size-3 shrink-0 animate-spin" />;
    }
    if (isToolFailed) {
      return <AlertCircle className="text-status-error size-3 shrink-0" />;
    }
    return <CheckCircle2 className="text-text-primary size-3 shrink-0" />;
  };

  return (
    <div className="border-border-light/50 border-t py-1 text-xs">
      <button
        type="button"
        onClick={onToggle}
        className="hover:text-text-primary text-text-secondary flex w-full cursor-pointer items-center justify-between gap-2 py-1 transition-colors select-none"
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          {renderStatusIcon()}
          <span className="text-text-primary truncate font-medium">
            {formatToolAction(tool.toolName)}
          </span>
          {tool.argsPreview && (
            <span className="text-text-secondary text-2xs max-w-[200px] truncate font-mono sm:max-w-[320px]">
              {tool.argsPreview}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {tool.durationSeconds !== undefined && (
            <span className="text-text-secondary text-3xs font-mono">
              {`${tool.durationSeconds.toFixed(2)}s`}
            </span>
          )}
          {isToolFailed && (
            <span className="bg-surface-secondary text-status-error text-3xs rounded px-1 font-medium">
              {localize('com_ui_failed')}
            </span>
          )}
          <ChevronDown
            className={`text-text-secondary size-3 transition-transform duration-150 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-border-light bg-surface-primary/30 my-1 space-y-1.5 rounded-lg border p-2">
          {tool.argsPreview && (
            <div>
              <div className="text-text-secondary text-3xs mb-0.5 font-semibold tracking-wider uppercase">
                {localize('com_ui_parameters')}
              </div>
              <pre className="border-border-light bg-surface-secondary text-text-primary text-2xs max-h-32 overflow-y-auto rounded p-1.5 font-mono break-all whitespace-pre-wrap">
                {tool.argsPreview}
              </pre>
            </div>
          )}

          {tool.outputPreview && (
            <div>
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-text-secondary text-3xs font-semibold tracking-wider uppercase">
                  {isToolFailed ? localize('com_ui_failure_details') : localize('com_ui_output')}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-text-secondary hover:text-text-primary text-3xs flex items-center gap-1 font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="size-2.5" />
                      <span>{localize('com_ui_copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-2.5" />
                      <span>{localize('com_ui_copy')}</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                className={`text-2xs max-h-36 overflow-y-auto rounded border p-1.5 font-mono break-all whitespace-pre-wrap ${
                  isToolFailed
                    ? 'border-status-error/40 bg-surface-primary text-status-error'
                    : 'border-border-light bg-surface-secondary text-text-primary'
                }`}
              >
                {tool.outputPreview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatActivityTimeline({
  isLive = false,
  startedAt,
  events,
  interimThought,
  defaultExpanded,
}: ChatActivityTimelineProps) {
  const summary = useMemo(() => {
    return aggregateActivityTimeline(events, interimThought, isLive, startedAt);
  }, [events, interimThought, isLive, startedAt]);

  const [isOpen, setIsOpen] = useState(isLive || Boolean(defaultExpanded));
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(
    () => new Set(summary.steps.map((s) => s.id)),
  );
  const prevIsLiveRef = useRef(isLive);

  useEffect(() => {
    if (prevIsLiveRef.current && !isLive) {
      setIsOpen(false);
    } else if (!prevIsLiveRef.current && isLive) {
      setIsOpen(true);
    }
    prevIsLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    if (summary.steps.length > 0) {
      setExpandedStepIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const step of summary.steps) {
          if (!next.has(step.id)) {
            next.add(step.id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [summary.steps]);

  if (summary.steps.length === 0) {
    return null;
  }

  const toggleStep = (stepId: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  return (
    <div
      data-testid="chat-activity-timeline"
      className="border-border-light bg-surface-secondary my-2 overflow-hidden rounded-xl border transition-all duration-200"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="hover:text-text-primary text-text-secondary flex w-full cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold transition-colors select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {summary.isRunning ? (
            <Loader2 className="text-text-primary size-3.5 animate-spin" />
          ) : (
            <Terminal className="text-text-primary size-3.5" />
          )}
          <span>{summary.headlineSummary}</span>
        </div>
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="border-border-light bg-surface-primary/40 space-y-1 border-t px-3 py-2">
          {summary.steps.map((step: ActivityStep) => {
            const isStepExpanded = expandedStepIds.has(step.id);
            if (step.kind === 'thought') {
              return (
                <ThoughtStepRow
                  key={step.id}
                  step={step}
                  isLive={isLive}
                  isExpanded={isStepExpanded}
                  onToggle={() => toggleStep(step.id)}
                />
              );
            }
            return (
              <ToolStepRow
                key={step.id}
                tool={step}
                isExpanded={isStepExpanded}
                onToggle={() => toggleStep(step.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChatActivityTimeline;
