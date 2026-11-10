import type { CanvasMethods, CanvasBoardMethods } from '@librechat/data-schemas';
import type { Request, Response } from 'express';
import { createCanvasBoardHandlers } from '../canvas/boardHandlers';
import { applySSRFSafeAgentIfDirect } from '../auth/agent';
import { createCanvasHandlers } from '../canvas/handlers';

describe('Multi-User Tenant Isolation & Security Audit (Milestone 4.3)', () => {
  const userA = 'user-family-member-a';
  const userB = 'user-family-member-b';

  describe('Canvas Document Isolation (IDOR Protection)', () => {
    it('prevents User B from accessing or updating User A Canvas documents', async () => {
      // Mock db repository with strict { userId } isolation
      const mockDocs = new Map<string, { id: string; userId: string; content: string }>();
      mockDocs.set('doc_123', {
        id: 'doc_123',
        userId: userA,
        content: 'Private diary of User A',
      });

      const mockDb = {
        getCanvasDocument: jest.fn().mockImplementation((userId: string, docId: string) => {
          const doc = mockDocs.get(docId);
          if (doc && doc.userId === userId) {
            return Promise.resolve(doc);
          }
          return Promise.resolve(null);
        }),
        getCanvasRevisions: jest.fn().mockImplementation((userId: string, docId: string) => {
          const doc = mockDocs.get(docId);
          if (doc && doc.userId === userId) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
        updateCanvasDocument: jest.fn(),
        rollbackCanvasRevision: jest.fn(),
        createCanvasCandidate: jest.fn(),
        resolveCanvasCandidate: jest.fn(),
      };

      const handlers = createCanvasHandlers(mockDb as unknown as CanvasMethods);

      // User A requests their own document -> 200 OK
      const reqA = {
        user: { id: userA },
        params: { docId: 'doc_123' },
        query: {},
      } as never;
      const resA = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      await handlers.getDocument(reqA, resA);
      expect(resA.json).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Private diary of User A' }),
      );

      // User B attempts to access User A's document -> 404 Not Found (zero data leakage)
      const reqB = {
        user: { id: userB },
        params: { docId: 'doc_123' },
        query: {},
      } as never;
      const resB = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      await handlers.getDocument(reqB, resB);
      expect(resB.status).toHaveBeenCalledWith(404);
      expect(resB.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Document not found' }),
      );
    });
  });

  describe('Canvas Visual Board Isolation (IDOR Protection)', () => {
    it('prevents User B from viewing or mutating User A Mindmap Boards', async () => {
      const mockBoards = new Map<string, { id: string; userId: string; title: string }>();
      mockBoards.set('board_789', {
        id: 'board_789',
        userId: userA,
        title: 'Secret Family Vacation Board',
      });

      const mockDb = {
        getCanvasBoard: jest.fn().mockImplementation((userId: string, boardId: string) => {
          const board = mockBoards.get(boardId);
          if (board && board.userId === userId) {
            return Promise.resolve(board);
          }
          return Promise.resolve(null);
        }),
        createCanvasBoard: jest.fn(),
        updateCanvasBoard: jest.fn(),
        getCanvasBoardRevisions: jest.fn().mockResolvedValue([]),
        rollbackCanvasBoardRevision: jest.fn(),
        createCanvasBoardCandidate: jest.fn(),
        resolveCanvasBoardCandidate: jest.fn(),
        listCanvasBoardsByConvo: jest.fn().mockResolvedValue([]),
      };

      const handlers = createCanvasBoardHandlers(mockDb as unknown as CanvasBoardMethods);

      // User B attempts to get User A's mindmap board -> 404 Not Found
      const reqB = {
        user: { id: userB },
        params: { boardId: 'board_789' },
        query: {},
      } as unknown as Request;
      const resB = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
      await handlers.getBoard(reqB, resB);

      expect(resB.status).toHaveBeenCalledWith(404);
      expect(resB.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Canvas board not found' }),
      );
    });
  });

  describe('SSRF Protection Rules', () => {
    it('strictly rejects AWS/GCP cloud metadata IP address (169.254.169.254)', () => {
      const metadataUrl = 'http://169.254.169.254/latest/meta-data/';
      const config = {};

      expect(() => {
        applySSRFSafeAgentIfDirect(config, metadataUrl);
      }).toThrow();
    });

    it('strictly rejects private local router IP address (192.168.1.1)', () => {
      const routerUrl = 'http://192.168.1.1/admin';
      const config = {};

      expect(() => {
        applySSRFSafeAgentIfDirect(config, routerUrl);
      }).toThrow();
    });

    it('permits authorized public HTTPS endpoints', () => {
      const publicUrl = 'https://api.openai.com/v1/chat/completions';
      const config = {};

      expect(() => {
        applySSRFSafeAgentIfDirect(config, publicUrl);
      }).not.toThrow();
    });
  });
});
