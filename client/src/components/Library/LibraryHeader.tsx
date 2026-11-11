import React, { useId, useRef, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { Button, DropdownPopup, FilterInput, Spinner } from '@librechat/client';
import {
  CheckSquare,
  Download,
  Ellipsis,
  LayoutGrid,
  List,
  RefreshCw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { LibraryCategory, LibrarySortOption } from './types';
import type { MenuItemProps } from '~/common';
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
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  selectedCount: number;
  allSelected?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onBulkDownload?: () => void;
  onBulkDelete?: () => void;
  isZipping?: boolean;
  isDeleting?: boolean;
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
  isSelectMode,
  onToggleSelectMode,
  selectedCount,
  allSelected = false,
  onSelectAll,
  onDeselectAll,
  onBulkDownload,
  onBulkDelete,
  isZipping = false,
  isDeleting = false,
}: LibraryHeaderProps) {
  const localize = useLocalize();
  const isSmallScreen = useDrawerViewport();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const menuItems: MenuItemProps[] = [
    {
      id: 'library-toggle-select',
      label: localize('com_ui_library_select'),
      icon: <CheckSquare className="size-4" />,
      ariaChecked: isSelectMode,
      onClick: () => {
        onToggleSelectMode();
        setIsMenuOpen(false);
      },
    },
    { separate: true },
    {
      id: 'library-grid-view',
      label: localize('com_ui_library_grid_view'),
      icon: <LayoutGrid className="size-4" />,
      ariaChecked: viewMode === 'grid',
      onClick: () => {
        onViewModeChange('grid');
        setIsMenuOpen(false);
      },
    },
    {
      id: 'library-list-view',
      label: localize('com_ui_library_list_view'),
      icon: <List className="size-4" />,
      ariaChecked: viewMode === 'list',
      onClick: () => {
        onViewModeChange('list');
        setIsMenuOpen(false);
      },
    },
  ];

  return (
    <div className="border-border-light shrink-0 border-b">
      {/* Top Toolbar Row */}
      <div className="flex items-center gap-2 p-3">
        {isSmallScreen && <OpenSidebar className="size-9 shrink-0" />}

        {/* Search Bar */}
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

        {/* More Options Dropdown (Select, Grid view, List view) */}
        <DropdownPopup
          portal={true}
          menuId={menuId}
          focusLoop={true}
          unmountOnHide={true}
          isOpen={isMenuOpen}
          setIsOpen={setIsMenuOpen}
          items={menuItems}
          trigger={
            <Ariakit.MenuButton
              id="library-header-more-btn"
              aria-label={localize('com_ui_library_options')}
              aria-expanded={isMenuOpen}
              render={
                <Button
                  size="icon"
                  variant={isSelectMode ? 'default' : 'outline'}
                  className="size-9 shrink-0"
                />
              }
            >
              <Ellipsis className="size-4" aria-hidden="true" />
            </Ariakit.MenuButton>
          }
        />
      </div>

      {/* Bulk Actions Bar (Shown when select mode is active) */}
      {isSelectMode && (
        <div className="bg-surface-secondary/90 border-border-light flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className="hover:bg-surface-tertiary text-text-secondary hover:text-text-primary inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="text-text-primary size-4" />
              ) : (
                <Square className="text-text-tertiary size-4" />
              )}
              <span className="font-medium">
                {allSelected
                  ? localize('com_ui_library_deselect_all')
                  : localize('com_ui_library_select_all')}
              </span>
            </button>
            <span className="text-border-medium">|</span>
            <span className="text-text-primary font-semibold">
              {localize('com_ui_library_selected_count', { count: selectedCount })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <>
                <Button variant="outline" size="sm" disabled={isZipping} onClick={onBulkDownload}>
                  {isZipping ? (
                    <Spinner className="me-1.5 size-3.5" />
                  ) : (
                    <Download className="me-1.5 size-3.5" />
                  )}
                  <span>
                    {selectedCount > 1
                      ? localize('com_ui_library_download_zip')
                      : localize('com_ui_download')}
                  </span>
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={onBulkDelete}
                >
                  {isDeleting ? (
                    <Spinner className="me-1.5 size-3.5" />
                  ) : (
                    <Trash2 className="me-1.5 size-3.5" />
                  )}
                  <span>{localize('com_ui_delete')}</span>
                </Button>
              </>
            )}

            <Button variant="ghost" size="sm" onClick={onToggleSelectMode}>
              {localize('com_ui_cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Categories Row */}
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
