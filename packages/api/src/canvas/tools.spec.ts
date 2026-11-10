import type { CanvasToolDatabaseMethods } from './tools';
import {
  CANVAS_TOOL_NAMES,
  createCanvasTool,
  createCanvasTools,
  createCreateCanvasDocumentTool,
  createReadCanvasDocumentTool,
  createProposeCanvasEditTool,
} from './tools';

describe('Canvas AI Tools', () => {
  const userId = 'user-123';
  const conversationId = 'convo-abc';

  let mockDb: CanvasToolDatabaseMethods;

  beforeEach(() => {
    mockDb = {
      createCanvasDocument: jest.fn().mockResolvedValue({
        document: {
          _id: 'doc-001',
          title: 'Roadmap.md',
          docType: 'markdown',
          language: undefined,
        },
        revision: {
          _id: 'rev-001',
          documentId: 'doc-001',
          content: '# Roadmap',
        },
      }) as unknown as CanvasToolDatabaseMethods['createCanvasDocument'],
      getCanvasDocument: jest.fn().mockResolvedValue({
        document: {
          _id: 'doc-001',
          title: 'Roadmap.md',
          docType: 'markdown',
          language: undefined,
        },
        currentRevision: {
          _id: 'rev-001',
          content: '# Roadmap\n- Phase 1',
        },
        activeCandidate: null,
      }) as unknown as CanvasToolDatabaseMethods['getCanvasDocument'],
      createCanvasCandidate: jest.fn().mockResolvedValue({
        _id: 'cand-001',
        documentId: 'doc-001',
        patchSummary: 'Add Phase 2',
        status: 'pending',
      }) as unknown as CanvasToolDatabaseMethods['createCanvasCandidate'],
    };
  });

  describe('create_canvas_document', () => {
    it('creates document and returns formatted JSON result', async () => {
      const tool = createCreateCanvasDocumentTool({
        userId,
        conversationId,
        db: mockDb,
      });

      expect(tool.name).toBe(CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT);

      const rawResult = await tool.invoke({
        title: 'Roadmap.md',
        content: '# Roadmap',
        docType: 'markdown',
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(true);
      expect(parsed.documentId).toBe('doc-001');
      expect(mockDb.createCanvasDocument).toHaveBeenCalledWith({
        userId,
        conversationId,
        title: 'Roadmap.md',
        docType: 'markdown',
        language: undefined,
        initialContent: '# Roadmap',
      });
    });

    it('handles database errors gracefully without throwing', async () => {
      mockDb.createCanvasDocument = jest.fn().mockRejectedValue(new Error('DB failure'));

      const tool = createCreateCanvasDocumentTool({
        userId,
        conversationId,
        db: mockDb,
      });

      const rawResult = await tool.invoke({
        title: 'Roadmap.md',
        content: '# Roadmap',
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('DB failure');
    });
  });

  describe('read_canvas_document', () => {
    it('reads document and returns content with metadata', async () => {
      const tool = createReadCanvasDocumentTool({
        userId,
        db: mockDb,
      });

      expect(tool.name).toBe(CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT);

      const rawResult = await tool.invoke({
        documentId: 'doc-001',
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(true);
      expect(parsed.content).toBe('# Roadmap\n- Phase 1');
      expect(mockDb.getCanvasDocument).toHaveBeenCalledWith(userId, 'doc-001');
    });

    it('returns error JSON if document is not found or fails', async () => {
      mockDb.getCanvasDocument = jest.fn().mockRejectedValue(new Error('Document not found'));

      const tool = createReadCanvasDocumentTool({
        userId,
        db: mockDb,
      });

      const rawResult = await tool.invoke({
        documentId: 'nonexistent',
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Document not found');
    });
  });

  describe('propose_canvas_edit', () => {
    it('proposes edit and returns candidate ID for user diff review', async () => {
      const tool = createProposeCanvasEditTool({
        userId,
        conversationId,
        db: mockDb,
      });

      expect(tool.name).toBe(CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT);

      const rawResult = await tool.invoke({
        documentId: 'doc-001',
        patchSummary: 'Add Phase 2',
        proposedContent: '# Roadmap\n- Phase 1\n- Phase 2',
      });

      const parsed = JSON.parse(rawResult);
      expect(parsed.success).toBe(true);
      expect(parsed.candidateId).toBe('cand-001');
      expect(mockDb.createCanvasCandidate).toHaveBeenCalledWith({
        userId,
        conversationId,
        documentId: 'doc-001',
        prompt: 'Add Phase 2',
        patchSummary: 'Add Phase 2',
        proposedContent: '# Roadmap\n- Phase 1\n- Phase 2',
      });
    });
  });

  describe('createCanvasTool & createCanvasTools factory', () => {
    it('resolves individual tools by name', () => {
      const docTool = createCanvasTool(CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT, {
        userId,
        conversationId,
        db: mockDb,
      });
      expect(docTool?.name).toBe(CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT);

      const readTool = createCanvasTool(CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT, {
        userId,
        conversationId,
        db: mockDb,
      });
      expect(readTool?.name).toBe(CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT);

      const proposeTool = createCanvasTool(CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT, {
        userId,
        conversationId,
        db: mockDb,
      });
      expect(proposeTool?.name).toBe(CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT);

      const unknownTool = createCanvasTool('unknown_tool', {
        userId,
        conversationId,
        db: mockDb,
      });
      expect(unknownTool).toBeNull();
    });

    it('creates all three tools when calling createCanvasTools', () => {
      const allTools = createCanvasTools({
        userId,
        conversationId,
        db: mockDb,
      });
      expect(allTools).toHaveLength(3);
      expect(allTools.map((t) => t.name)).toEqual([
        CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT,
        CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT,
        CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT,
      ]);
    });
  });
});
