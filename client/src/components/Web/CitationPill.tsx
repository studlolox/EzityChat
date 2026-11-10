import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { SourcesSheet, type SourceItem, extractDomain, getFaviconUrl } from './SourcesSheet';

export interface CitationPillProps {
  sources: SourceItem[];
  className?: string;
  onFileClick?: (source: SourceItem) => void;
}

export function CitationPill({ sources, className = '', onFileClick }: CitationPillProps) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  const first = sources[0];
  const domain = first.domain || (first.url ? extractDomain(first.url) : first.title || 'Source');
  const extraCount = sources.length - 1;
  const favicon = first.favicon || (first.url ? getFaviconUrl(first.url) : '');

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        data-testid="citation-pill"
        className={`bg-surface-secondary hover:bg-surface-hover border-border-medium text-2xs text-text-primary my-0.5 inline-flex h-5 max-h-5 !min-h-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0 align-baseline leading-tight font-medium transition-all select-none active:scale-95 ${className}`}
        aria-label={`View sources: ${domain}${extraCount > 0 ? ` and ${extraCount} more` : ''}`}
      >
        {favicon ? (
          <img
            src={favicon}
            alt=""
            className="size-3 shrink-0 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <Globe className="text-text-secondary size-2.5 shrink-0" aria-hidden="true" />
        )}
        <span className="max-w-[85px] truncate">{domain}</span>
        {extraCount > 0 && (
          <span className="bg-surface-tertiary text-3xs text-text-secondary rounded-full px-1 py-0 leading-none font-semibold">
            +{extraCount}
          </span>
        )}
      </button>

      <SourcesSheet
        open={open}
        onOpenChange={setOpen}
        sources={sources}
        onFileClick={onFileClick}
      />
    </>
  );
}
