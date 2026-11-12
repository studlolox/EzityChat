import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import type {
  CanvasBoardItem,
  CanvasDocItem,
  LibraryCategory,
  LibrarySortOption,
  UnifiedLibraryItem,
} from './types';
import { formatBytes } from '~/components/Chat/Messages/Content/FilePreviewDialog';
import { useGetFiles } from '~/data-provider';

const isImageFile = (file: TFile): boolean => {
  if (file.type?.startsWith('image/')) return true;
  if (typeof file.filepath === 'string' && file.filepath.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
    return true;
  }
  return false;
};

export function useLibraryItems(
  category: LibraryCategory,
  searchQuery: string,
  sort: LibrarySortOption = 'newest',
) {
  // 1. Fetch user files
  const {
    data: allFiles = [],
    isLoading: filesLoading,
    refetch: refetchFiles,
  } = useGetFiles<TFile[]>();

  // 2. Fetch all user Canvas documents
  const {
    data: canvasDocs = [],
    isLoading: docsLoading,
    refetch: refetchDocs,
  } = useQuery<CanvasDocItem[]>({
    queryKey: ['canvas-docs', 'all'],
    queryFn: async () => {
      const data = await dataService.listCanvasDocuments();
      return (data.documents ?? []) as CanvasDocItem[];
    },
    staleTime: 1000 * 30,
  });

  // 3. Fetch all user Canvas mindmap boards
  const {
    data: canvasBoards = [],
    isLoading: boardsLoading,
    refetch: refetchBoards,
  } = useQuery<CanvasBoardItem[]>({
    queryKey: ['canvas-boards', 'all'],
    queryFn: async () => {
      const data = await dataService.listCanvasBoards();
      return (data.boards ?? []) as CanvasBoardItem[];
    },
    staleTime: 1000 * 30,
  });

  // 4. Normalize and merge all items
  const allItems = useMemo<UnifiedLibraryItem[]>(() => {
    const items: UnifiedLibraryItem[] = [];

    // Process files
    for (const file of allFiles) {
      const isImg = isImageFile(file);
      const fileId = file.file_id || file._id || file.filename;
      items.push({
        id: `file-${fileId}`,
        kind: isImg ? 'image' : 'file',
        category: isImg ? 'images' : 'files',
        title: file.filename,
        subtitle: `${formatBytes(file.bytes || 0)} · ${(file.type || 'FILE').toUpperCase()}`,
        updatedAt:
          (file.updatedAt as unknown as string) || (file.createdAt as unknown as string) || '',
        createdAt: file.createdAt as unknown as string,
        size: file.bytes,
        conversationId: file.conversationId,
        previewUrl: file.filepath,
        file,
      });
    }

    // Process Canvas docs
    for (const doc of canvasDocs) {
      items.push({
        id: `canvas-${doc._id}`,
        kind: 'canvas_doc',
        category: 'canvas',
        title: doc.title || 'Untitled Document',
        subtitle: `${(doc.language || doc.docType || 'markdown').toUpperCase()} · Canvas Co-Editor`,
        updatedAt: doc.updatedAt || doc.createdAt || '',
        createdAt: doc.createdAt,
        conversationId: doc.conversationId,
        canvasDoc: doc,
      });
    }

    // Process Canvas boards
    for (const board of canvasBoards) {
      items.push({
        id: `board-${board._id}`,
        kind: 'canvas_board',
        category: 'boards',
        title: board.title || 'Untitled Board',
        subtitle: board.rootTopic ? `Topic: ${board.rootTopic}` : 'Mindmap Board',
        updatedAt: board.updatedAt || board.createdAt || '',
        createdAt: board.createdAt,
        conversationId: board.conversationId,
        canvasBoard: board,
      });
    }

    // Sort descending by updatedAt / createdAt
    return items.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allFiles, canvasDocs, canvasBoards]);

  // 5. Category counts
  const counts = useMemo(() => {
    let canvas = 0;
    let boards = 0;
    let images = 0;
    let files = 0;

    for (const item of allItems) {
      if (item.category === 'canvas') canvas++;
      else if (item.category === 'boards') boards++;
      else if (item.category === 'images') images++;
      else if (item.category === 'files') files++;
    }

    return {
      all: allItems.length,
      canvas,
      boards,
      images,
      files,
    };
  }, [allItems]);

  // 6. Filter by active category, search query, and sort order
  const filteredItems = useMemo(() => {
    let result = allItems;

    if (category !== 'all') {
      result = result.filter((item) => item.category === category);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) => item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q),
      );
    }

    // Sort items
    return [...result].sort((a, b) => {
      if (sort === 'oldest') {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sort === 'name_asc') {
        return a.title.localeCompare(b.title);
      }
      if (sort === 'name_desc') {
        return b.title.localeCompare(a.title);
      }
      // default: newest
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allItems, category, searchQuery, sort]);

  const isLoading = filesLoading || docsLoading || boardsLoading;

  const refetchAll = () => {
    refetchFiles();
    refetchDocs();
    refetchBoards();
  };

  return {
    items: allItems,
    filteredItems,
    counts,
    isLoading,
    refetchAll,
  };
}
