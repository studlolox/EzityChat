import type { TFile } from 'librechat-data-provider';

export type LibraryCategory = 'all' | 'canvas' | 'boards' | 'images' | 'files';

export type LibrarySortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export interface CanvasDocItem {
  _id: string;
  title: string;
  docType: 'markdown' | 'code';
  language?: string;
  conversationId?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface CanvasBoardItem {
  _id: string;
  title: string;
  rootTopic: string;
  conversationId?: string;
  updatedAt?: string;
  createdAt?: string;
}

export type LibraryItemKind = 'canvas_doc' | 'canvas_board' | 'image' | 'file';

export interface UnifiedLibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  subtitle?: string;
  category: LibraryCategory;
  updatedAt: string;
  createdAt?: string;
  size?: number;
  conversationId?: string;
  previewUrl?: string;
  file?: TFile;
  canvasDoc?: CanvasDocItem;
  canvasBoard?: CanvasBoardItem;
}
