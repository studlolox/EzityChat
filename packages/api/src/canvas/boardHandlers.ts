import {
  CanvasBoardNotFoundError,
  CanvasBoardCandidateNotFoundError,
  CanvasBoardConflictError,
  logger,
} from '@librechat/data-schemas';
import type { CanvasBoardMethods } from '@librechat/data-schemas';
import type { Request, Response } from 'express';

interface BoardUser {
  id: string;
}

function getUserId(req: Request): string {
  const user = req.user as BoardUser | undefined;
  if (!user?.id) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

export interface CanvasBoardHandlers {
  listBoards(req: Request, res: Response): Promise<void>;
  createBoard(req: Request, res: Response): Promise<void>;
  getBoard(req: Request, res: Response): Promise<void>;
  updateBoard(req: Request, res: Response): Promise<void>;
  listBoardRevisions(req: Request, res: Response): Promise<void>;
  restoreBoardRevision(req: Request, res: Response): Promise<void>;
  createBoardCandidate(req: Request, res: Response): Promise<void>;
  acceptBoardCandidate(req: Request, res: Response): Promise<void>;
  rejectBoardCandidate(req: Request, res: Response): Promise<void>;
}

export function createCanvasBoardHandlers(db: CanvasBoardMethods): CanvasBoardHandlers {
  return {
    async listBoards(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const conversationId = req.query.convoId as string | undefined;

        const boards = await db.listCanvasBoards({
          userId,
          conversationId,
        });

        res.status(200).json({ boards });
      } catch (error) {
        logger.error('[CanvasBoard] listBoards error:', error);
        res.status(500).json({ error: 'Failed to list canvas boards' });
      }
    },

    async createBoard(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { conversationId, title, rootTopic, orientation, nodes, edges } = req.body;

        if (!conversationId || !title || !rootTopic) {
          res.status(400).json({
            error: 'Missing required fields: conversationId, title, rootTopic',
          });
          return;
        }

        const result = await db.createCanvasBoard({
          userId,
          conversationId,
          title,
          rootTopic,
          orientation,
          nodes,
          edges,
        });

        res.status(201).json(result);
      } catch (error) {
        logger.error('[CanvasBoard] createBoard error:', error);
        res.status(500).json({ error: 'Failed to create canvas board' });
      }
    },

    async getBoard(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { boardId } = req.params;

        const result = await db.getCanvasBoard({
          userId,
          boardId,
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasBoardNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] getBoard error:', error);
        res.status(500).json({ error: 'Failed to retrieve canvas board' });
      }
    },

    async updateBoard(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { boardId } = req.params;
        const { nodes, edges, baseRevisionId, patchSummary } = req.body;

        if (!Array.isArray(nodes) || !Array.isArray(edges)) {
          res.status(400).json({ error: 'Missing required array fields: nodes, edges' });
          return;
        }

        const result = await db.updateCanvasBoard({
          userId,
          boardId,
          nodes,
          edges,
          baseRevisionId,
          patchSummary,
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasBoardConflictError) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error instanceof CanvasBoardNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] updateBoard error:', error);
        res.status(500).json({ error: 'Failed to update canvas board' });
      }
    },

    async listBoardRevisions(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { boardId } = req.params;

        const revisions = await db.listCanvasBoardRevisions({
          userId,
          boardId,
        });

        res.status(200).json({ revisions });
      } catch (error) {
        if (error instanceof CanvasBoardNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] listBoardRevisions error:', error);
        res.status(500).json({ error: 'Failed to list canvas board revisions' });
      }
    },

    async restoreBoardRevision(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { boardId } = req.params;
        const { revisionId } = req.body;

        if (!revisionId) {
          res.status(400).json({ error: 'Missing required field: revisionId' });
          return;
        }

        const result = await db.restoreCanvasBoardRevision({
          userId,
          boardId,
          revisionId,
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasBoardNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] restoreBoardRevision error:', error);
        res.status(500).json({ error: 'Failed to restore canvas board revision' });
      }
    },

    async createBoardCandidate(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { boardId } = req.params;
        const { proposedNodes, proposedEdges, patchSummary, conversationId } = req.body;

        if (!Array.isArray(proposedNodes) || !Array.isArray(proposedEdges) || !patchSummary) {
          res.status(400).json({
            error: 'Missing required fields: proposedNodes, proposedEdges, patchSummary',
          });
          return;
        }

        const candidate = await db.createCanvasBoardCandidate({
          userId,
          boardId,
          proposedNodes,
          proposedEdges,
          patchSummary,
          conversationId,
        });

        res.status(201).json({ candidate });
      } catch (error) {
        if (error instanceof CanvasBoardNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] createBoardCandidate error:', error);
        res.status(500).json({ error: 'Failed to create canvas board candidate' });
      }
    },

    async acceptBoardCandidate(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { candId } = req.params;

        const result = await db.resolveCanvasBoardCandidate({
          userId,
          candidateId: candId,
          action: 'accept',
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasBoardCandidateNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] acceptBoardCandidate error:', error);
        res.status(500).json({ error: 'Failed to accept canvas board candidate' });
      }
    },

    async rejectBoardCandidate(req: Request, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        const { candId } = req.params;

        const result = await db.resolveCanvasBoardCandidate({
          userId,
          candidateId: candId,
          action: 'reject',
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasBoardCandidateNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        logger.error('[CanvasBoard] rejectBoardCandidate error:', error);
        res.status(500).json({ error: 'Failed to reject canvas board candidate' });
      }
    },
  };
}
