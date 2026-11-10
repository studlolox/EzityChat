import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

export interface ChatThinkingAccordionProps {
  thought: string;
  isLive?: boolean;
}

export function ChatThinkingAccordion({ thought, isLive = false }: ChatThinkingAccordionProps) {
  const [isOpen, setIsOpen] = useState(isLive);

  if (!thought || thought.trim() === '') return null;

  const wordCount = thought.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      data-testid="interim-thought"
      className="border-border-light bg-surface-secondary my-2 overflow-hidden rounded-xl border transition-all duration-200"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-text-secondary hover:text-text-primary flex w-full cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium transition-colors select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles
            className={`text-text-primary size-3.5 ${isLive ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          <span className="font-semibold">
            {isLive ? 'Thinking...' : `Thought process (${wordCount} words)`}
          </span>
        </div>
        <ChevronDown
          className={`text-text-secondary size-3.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="border-border-light bg-surface-primary/40 text-text-secondary max-h-52 overflow-y-auto border-t px-3.5 pt-1.5 pb-2.5 text-xs leading-relaxed whitespace-pre-wrap italic select-text">
          {thought}
        </div>
      )}
    </div>
  );
}

export default ChatThinkingAccordion;
