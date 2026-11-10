import React from 'react';
import { Globe, ExternalLink, FileText } from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogDescription,
} from '@librechat/client';
import { useLocalize } from '~/hooks';

export interface SourceItem {
  id?: string | number;
  url: string;
  title?: string;
  domain?: string;
  date?: string;
  favicon?: string;
  snippet?: string;
  isFile?: boolean;
  fileId?: string;
  fileName?: string;
  filePages?: number[];
  fileRelevance?: number;
  fileSource?: string;
  fileSize?: number;
  fileType?: string;
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return '';
  }
}

export interface SourcesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: SourceItem[];
  title?: string;
  description?: string;
  onFileClick?: (source: SourceItem) => void;
}

export function SourcesSheet({
  open,
  onOpenChange,
  sources,
  title,
  description,
  onFileClick,
}: SourcesSheetProps) {
  const localize = useLocalize();
  if (!sources || sources.length === 0) return null;

  const displayTitle = title ?? localize('com_citation_source') ?? 'Sources';
  const displayDescription =
    description ?? `${sources.length} ${sources.length === 1 ? 'source' : 'sources'} cited`;

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden p-0">
        <OGDialogHeader className="px-6 pt-5 pb-3">
          <OGDialogTitle className="text-lg font-semibold">{displayTitle}</OGDialogTitle>
          <OGDialogDescription className="mt-0.5 text-xs">{displayDescription}</OGDialogDescription>
        </OGDialogHeader>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-6 py-4">
          {sources.map((source, idx) => {
            const srcDomain = source.domain || (source.url ? extractDomain(source.url) : '');
            const srcFavicon = source.favicon || (source.url ? getFaviconUrl(source.url) : '');
            const itemTitle =
              source.title ?? source.fileName ?? srcDomain ?? localize('com_citation_source');
            let itemSubtitle: string | undefined;
            if (source.title && source.title !== srcDomain) {
              itemSubtitle = srcDomain;
            } else if (!source.date) {
              itemSubtitle = source.url;
            }

            if (source.isFile && source.fileId) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onFileClick?.(source);
                  }}
                  className="border-border-light hover:border-border-medium bg-surface-secondary hover:bg-surface-hover group flex w-full cursor-pointer items-start justify-between rounded-xl border p-3.5 text-left transition-colors"
                >
                  <div className="flex min-w-0 items-start gap-3 pr-3">
                    <div className="bg-surface-tertiary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <FileText className="text-text-secondary size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-text-primary truncate text-sm font-medium">
                        {itemTitle}
                      </div>
                      <div className="text-text-secondary mt-0.5 truncate text-xs">
                        {localize('com_file_source')} {source.date ? `• ${source.date}` : ''}
                      </div>
                      {source.snippet && (
                        <p className="text-text-tertiary mt-1 line-clamp-2 text-xs break-words">
                          {source.snippet}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`citation-source-${idx}`}
                className="border-border-light hover:border-border-medium bg-surface-secondary hover:bg-surface-hover group flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-colors"
              >
                <div className="flex min-w-0 items-start gap-3 pr-3">
                  <div className="bg-surface-tertiary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                    {srcFavicon ? (
                      <img
                        src={srcFavicon}
                        alt=""
                        className="size-4 shrink-0 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe className="text-text-secondary size-4 shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-text-primary group-hover:text-text-primary line-clamp-1 text-sm font-medium">
                      {itemTitle}
                    </div>
                    <div className="text-text-secondary mt-0.5 truncate text-xs">
                      {itemSubtitle || srcDomain} {source.date ? `• ${source.date}` : ''}
                    </div>
                    {source.snippet && (
                      <p className="text-text-tertiary mt-1.5 line-clamp-2 text-xs leading-relaxed break-words">
                        {source.snippet}
                      </p>
                    )}
                  </div>
                </div>
                <ExternalLink
                  className="text-text-secondary mt-1 size-4 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </a>
            );
          })}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
