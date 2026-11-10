import type { CanvasBoardToolDatabaseMethods } from './boardTools';
import {
  CANVAS_BOARD_TOOL_NAMES,
  createCreateMindmapBoardTool,
  createReadMindmapBoardTool,
  createProposeBoardEditTool,
  createCanvasBoardTool,
} from './boardTools';

describe('Canvas Board AI Tools', () => {
  const userId = 'user-123';
  const conversationId = 'convo-abc';

  let mockDb: CanvasBoardToolDatabaseMethods;

  beforeEach(() => {
    mockDb = {
      createCanvasBoard: jest.fn().mockResolvedValue({
        board: {
          _id: 'board-001',
          title: 'Family Vacation',
          rootTopic: 'Family Vacation',
        },
        revision: {
          _id: 'rev-001',
        },
      }) as unknown as CanvasBoardToolDatabaseMethods['createCanvasBoard'],
      getCanvasBoard: jest.fn().mockResolvedValue({
        board: {
          _id: 'board-001',
          title: 'Family Vacation',
          rootTopic: 'Family Vacation',
          orientation: 'horizontal',
        },
        currentRevision: {
          nodes: [{ id: 'root', label: 'Family Vacation', x: 0, y: 0 }],
          edges: [],
        },
        activeCandidate: null,
      }) as unknown as CanvasBoardToolDatabaseMethods['getCanvasBoard'],
      createCanvasBoardCandidate: jest.fn().mockResolvedValue({
        _id: 'cand-001',
        boardId: 'board-001',
        patchSummary: 'Add 2 branches',
      }) as unknown as CanvasBoardToolDatabaseMethods['createCanvasBoardCandidate'],
    };
  });

  describe('create_mindmap_board', () => {
    it('creates board and calculates nodes with edges', async () => {
      const tool = createCreateMindmapBoardTool({
        userId,
        conversationId,
        db: mockDb,
      });

      expect(tool.name).toBe(CANVAS_BOARD_TOOL_NAMES.CREATE_MINDMAP_BOARD);

      const rawResult = await tool.invoke({
        rootTopic: 'Family Vacation',
        branches: [
          { label: 'Hotels', content: 'Book resort' },
          { label: 'Flights', content: 'Direct flight' },
        ],
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(true);
      expect(parsed.boardId).toBe('board-001');
      expect(parsed.nodeCount).toBe(3); // 1 root + 2 branches
      expect(parsed.edgeCount).toBe(2);
      expect(mockDb.createCanvasBoard).toHaveBeenCalledTimes(1);
    });
  });

  describe('read_mindmap_board', () => {
    it('reads board and returns nodes and edges', async () => {
      const tool = createReadMindmapBoardTool({
        userId,
        db: mockDb,
      });

      const rawResult = await tool.invoke({
        boardId: 'board-001',
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(true);
      expect(parsed.nodes).toHaveLength(1);
    });
  });

  describe('propose_board_edit', () => {
    it('creates proposal candidate for user diff review', async () => {
      const tool = createProposeBoardEditTool({
        userId,
        db: mockDb,
      });

      const rawResult = await tool.invoke({
        boardId: 'board-001',
        patchSummary: 'Add Hotels branch',
        branches: [{ label: 'Hotels' }],
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(true);
      expect(parsed.candidateId).toBe('cand-001');
      expect(mockDb.createCanvasBoardCandidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCanvasBoardTool factory', () => {
    it('resolves board tools by name', () => {
      const tool = createCanvasBoardTool(CANVAS_BOARD_TOOL_NAMES.CREATE_MINDMAP_BOARD, {
        userId,
        conversationId,
        db: mockDb,
      });
      expect(tool?.name).toBe(CANVAS_BOARD_TOOL_NAMES.CREATE_MINDMAP_BOARD);
    });
  });
});
