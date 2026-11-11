import React from 'react';
import type { UnifiedLibraryItem } from './types';
import { useLocalize } from '~/hooks';

interface MindmapThumbnailProps {
  item: UnifiedLibraryItem;
}

export function MindmapThumbnail({ item }: MindmapThumbnailProps) {
  const localize = useLocalize();
  const rootTitle = item.canvasBoard?.rootTopic || item.title || 'Mindmap';
  const displayTitle = rootTitle.length > 20 ? `${rootTitle.slice(0, 18)}...` : rootTitle;

  return (
    <div className="bg-surface-secondary relative flex h-full w-full items-center justify-center overflow-hidden select-none">
      {/* Background Dot Grid */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20 dark:opacity-30"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="mindmap-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" className="fill-text-secondary" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mindmap-dots)" />
      </svg>

      {/* Mindmap Vector Graph */}
      <svg
        viewBox="0 0 320 180"
        className="relative h-full w-full p-2"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Branch Lines */}
        {/* Top-Left Branch */}
        <path
          d="M 160 90 C 110 90, 80 50, 50 50"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-status-success"
        />
        {/* Bottom-Left Branch */}
        <path
          d="M 160 90 C 110 90, 80 130, 55 130"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-status-warning"
        />
        {/* Top-Right Branch */}
        <path
          d="M 160 90 C 210 90, 240 50, 270 50"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-file-video"
        />
        {/* Bottom-Right Branch */}
        <path
          d="M 160 90 C 210 90, 240 130, 265 130"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-status-info"
        />

        {/* Leaf Nodes */}
        <circle cx="50" cy="50" r="5" className="fill-status-success" />
        <line
          x1="50"
          y1="50"
          x2="25"
          y2="50"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-status-success"
        />

        <circle cx="55" cy="130" r="5" className="fill-status-warning" />
        <line
          x1="55"
          y1="130"
          x2="30"
          y2="130"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-status-warning"
        />

        <circle cx="270" cy="50" r="5" className="fill-file-video" />
        <line
          x1="270"
          y1="50"
          x2="295"
          y2="50"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-file-video"
        />

        <circle cx="265" cy="130" r="5" className="fill-status-info" />
        <line
          x1="265"
          y1="130"
          x2="290"
          y2="130"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-status-info"
        />

        {/* Center Root Node */}
        <rect
          x="95"
          y="70"
          width="130"
          height="40"
          rx="10"
          className="fill-link shadow-xs drop-shadow-xs filter"
        />
        <text
          x="160"
          y="95"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif"
          className="fill-surface-primary"
        >
          {displayTitle}
        </text>
      </svg>

      {/* Corner Type Badge */}
      <div className="bg-surface-primary/90 text-text-secondary text-3xs absolute bottom-2 left-2 flex items-center gap-1 rounded px-1.5 py-0.5 font-medium backdrop-blur-xs">
        <span className="bg-link size-1.5 rounded-full" />
        {localize('com_ui_library_board')}
      </div>
    </div>
  );
}
