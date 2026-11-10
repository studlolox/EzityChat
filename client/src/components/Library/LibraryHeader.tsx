import React, { useRef } from 'react';
import { Button, FilterInput } from '@librechat/client';
import { LayoutGrid, List, RefreshCw, X } from 'lucide-react';
import type { LibraryCategory, LibrarySortOption } from './types';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import useDrawerViewport from '~/hooks/Nav/useDrawerViewport';
import LibrarySortDropdown from './LibrarySortDropdown';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface LibraryHeaderProps {
  activeCategory: LibraryCategory;
  onCategoryChange: (category: LibraryCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sort: LibrarySortOption;
  onSortChange: (sort: LibrarySortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  counts: {
    all: number;
    canvas: number;
    boards: number;
    images: number;
    files: number;
  };
  isLoading: boolean;
  onRefresh: () => void;
}

export default function LibraryHeader({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  counts,
  isLoading,
  onRefresh,
}: LibraryHeaderProps) {
  const localize = useLocalize();
  const isSmallScreen = useDrawerViewport();
  const inputRef = useRef<HTMLInputElement>(null);

  const tabs: { key: LibraryCategory; label: string; count: number }[] = [
    { key: 'all', label: localize('com_ui_library_all'), count: counts.all },
    { key: 'canvas', label: localize('com_ui_library_canvas'), count: counts.canvas },
    { key: 'boards', label: localize('com_ui_library_mindmaps'), count: counts.boards },
    { key: 'images', label: localize('com_ui_library_images'), count: counts.images },
    { key: 'files', label: localize('com_ui_library_files'), count: counts.files },
  ];

  const handleClearSearch = () => {
    onSearchChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="border-border-light shrink-0 border-b">
      {/* Top Toolbar Row */}
      <div className="flex items-center gap-2 p-3">
        {isSmallScreen && <OpenSidebar className="size-9 shrink-0" />}

        {/* Search Bar matching Agent Marketplace */}
        <div className="relative min-w-0 flex-1" role="search">
          <FilterInput
            inputId="library-search"
            label={localize('com_ui_library_search')}
            type="text"
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <Button
              variant="quiet"
              size="icon-sm"
              type="button"
              onClick={handleClearSearch}
              className="absolute end-0.5 top-1/2 -translate-y-1/2"
              aria-label={localize('com_agents_clear_search')}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {/* View Mode Switcher (Grid vs List) */}
        <div className="border-border-chrome bg-surface-secondary flex items-center rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            aria-label={localize('com_ui_library_grid_view')}
            title={localize('com_ui_library_grid_view')}
            className={cn(
              'cursor-pointer rounded-md p-1.5 transition-colors',
              viewMode === 'grid'
                ? 'bg-surface-active-alt text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            aria-label={localize('com_ui_library_list_view')}
            title={localize('com_ui_library_list_view')}
            className={cn(
              'cursor-pointer rounded-md p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-surface-active-alt text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <List className="size-4" />
          </button>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={onRefresh}
          title={localize('com_ui_refresh')}
          className="size-9 shrink-0"
        >
          <RefreshCw className={cn('size-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Categories Row matching Agent Marketplace CategoryTabs */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-3">
        <div className="hide-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeCategory === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onCategoryChange(tab.key)}
                className={cn(
                  'focus-visible:ring-text-primary inline-flex h-8 cursor-pointer items-center justify-center rounded-full border px-3 text-xs font-medium whitespace-nowrap select-none focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset',
                  isActive
                    ? 'border-border-chrome-heavy bg-surface-active-alt text-text-primary font-semibold'
                    : 'border-border-chrome bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'text-3xs ms-1.5 rounded-full px-1.5 py-0.5 font-mono',
                    isActive
                      ? 'bg-surface-tertiary text-text-primary'
                      : 'bg-surface-tertiary/60 text-text-secondary',
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown & Counter on Right */}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <LibrarySortDropdown value={sort} onChange={onSortChange} />
          <div className="text-text-secondary hidden shrink-0 text-xs sm:block">
            {counts.all !== 1
              ? localize('com_ui_library_item_count_plural', { count: counts.all })
              : localize('com_ui_library_item_count', { count: counts.all })}
          </div>
        </div>
      </div>
    </div>
  );
}
