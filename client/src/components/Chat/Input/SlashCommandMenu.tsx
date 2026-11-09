import React, { useEffect, useRef } from 'react';
import { FileCode2, Sparkles, Search, Bot, PlusCircle, Command } from 'lucide-react';
import { useLocalize } from '~/hooks';

export interface SlashCommand {
  name: string;
  description: string;
  syntax: string;
  category: 'workspace' | 'creative' | 'search' | 'session' | 'model';
}

export const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'canvas',
    description: 'Create or edit documents in the Canvas code workspace',
    syntax: '/canvas',
    category: 'workspace',
  },
  {
    name: 'image',
    description: 'Generate or modify images using local ComfyUI',
    syntax: '/image',
    category: 'creative',
  },
  {
    name: 'search',
    description: 'Ground response with live web search',
    syntax: '/search',
    category: 'search',
  },
  {
    name: 'mindmap',
    description: 'Generate or open an interactive visual mindmap board',
    syntax: '/mindmap',
    category: 'workspace',
  },
  {
    name: 'model',
    description: 'Check or switch active AI model and settings',
    syntax: '/model',
    category: 'model',
  },
  {
    name: 'new',
    description: 'Start a clean chat conversation',
    syntax: '/new',
    category: 'session',
  },
  {
    name: 'clear',
    description: 'Clear the current composer input',
    syntax: '/clear',
    category: 'session',
  },
  {
    name: 'help',
    description: 'Display platform instructions and shortcuts',
    syntax: '/help',
    category: 'session',
  },
];

export interface SlashCommandMenuProps {
  filter: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  selectedIndex?: number;
}

export function SlashCommandMenu({
  filter,
  onSelect,
  onClose,
  selectedIndex = 0,
}: SlashCommandMenuProps) {
  const localize = useLocalize();
  const listRef = useRef<HTMLDivElement | null>(null);

  const cleanFilter = filter.toLowerCase().replace(/^\//, '').trim();
  const filteredCommands = BUILTIN_SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(cleanFilter) ||
      cmd.description.toLowerCase().includes(cleanFilter) ||
      cmd.syntax.toLowerCase().includes(cleanFilter),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (filteredCommands.length === 0) {
    return null;
  }

  const getCategoryIcon = (category: SlashCommand['category']) => {
    switch (category) {
      case 'workspace':
        return <FileCode2 className="text-text-primary size-4" aria-hidden="true" />;
      case 'creative':
        return <Sparkles className="text-text-primary size-4" aria-hidden="true" />;
      case 'search':
        return <Search className="text-text-primary size-4" aria-hidden="true" />;
      case 'model':
        return <Bot className="text-text-primary size-4" aria-hidden="true" />;
      case 'session':
        return <PlusCircle className="text-text-secondary size-4" aria-hidden="true" />;
      default:
        return <Command className="text-text-secondary size-4" aria-hidden="true" />;
    }
  };

  return (
    <div
      role="listbox"
      aria-label="Slash commands"
      ref={listRef}
      className="border-border-medium bg-surface-primary/95 text-text-primary absolute right-0 bottom-full left-0 z-50 mb-2 max-h-64 overflow-y-auto rounded-2xl border p-2 shadow-lg backdrop-blur-md"
    >
      <div className="text-text-secondary text-2xs mb-1 flex items-center gap-1.5 px-3 py-1 font-semibold tracking-wider uppercase">
        <Command className="size-3" aria-hidden="true" />
        <span>{localize('com_ui_ezity_commands')}</span>
      </div>

      <div className="space-y-1">
        {filteredCommands.map((cmd, idx) => {
          const isSelected = idx === Math.min(selectedIndex, filteredCommands.length - 1);
          return (
            <button
              key={cmd.name}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(cmd)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                isSelected
                  ? 'bg-surface-secondary text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-secondary/70 hover:text-text-primary'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {getCategoryIcon(cmd.category)}
                <div className="min-w-0">
                  <div className="text-text-primary text-xs font-semibold md:text-sm">
                    {cmd.syntax}
                  </div>
                  <div className="text-text-secondary text-2xs truncate md:text-xs">
                    {cmd.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SlashCommandMenu;
