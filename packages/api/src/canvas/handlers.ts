import {
  CanvasNotFoundError,
  CanvasCandidateNotFoundError,
  CanvasConflictError,
  logger,
} from '@librechat/data-schemas';
import type { CanvasMethods } from '@librechat/data-schemas';
import type { Request, Response } from 'express';

interface CanvasUser {
  id: string;
  _id?: {
    toString(): string;
  };
}

interface CanvasRequest extends Request {
  user?: CanvasUser;
}

export type CanvasHandlerDependencies = Pick<
  CanvasMethods,
  | 'createCanvasDocument'
  | 'getCanvasDocument'
  | 'listCanvasDocuments'
  | 'updateCanvasDocument'
  | 'listCanvasRevisions'
  | 'restoreCanvasRevision'
  | 'createCanvasCandidate'
  | 'getCanvasCandidate'
  | 'resolveCanvasCandidate'
>;

const getUserId = (req: CanvasRequest): string => req.user?.id ?? req.user?._id?.toString() ?? '';

export function createCanvasHandlers(deps: CanvasHandlerDependencies) {
  return {
    async listDocuments(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const conversationId =
          typeof req.query.convoId === 'string' ? req.query.convoId : undefined;
        const documents = await deps.listCanvasDocuments(userId, conversationId);
        res.status(200).json({ documents });
      } catch (error) {
        logger.error('[Canvas] listDocuments error:', error);
        res.status(500).json({ message: 'Failed to list canvas documents' });
      }
    },

    async createDocument(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { conversationId, title, docType, language, initialContent, patchSummary } = req.body;
        if (!conversationId || typeof conversationId !== 'string') {
          res.status(400).json({ message: 'conversationId is required' });
          return;
        }
        if (!title || typeof title !== 'string' || !title.trim()) {
          res.status(400).json({ message: 'title is required' });
          return;
        }
        if (typeof initialContent !== 'string') {
          res.status(400).json({ message: 'initialContent must be a string' });
          return;
        }

        const result = await deps.createCanvasDocument({
          userId,
          conversationId,
          title: title.trim(),
          docType: docType === 'code' ? 'code' : 'markdown',
          language: typeof language === 'string' ? language : undefined,
          initialContent,
          patchSummary: typeof patchSummary === 'string' ? patchSummary : undefined,
        });

        res.status(201).json(result);
      } catch (error) {
        logger.error('[Canvas] createDocument error:', error);
        res.status(500).json({ message: 'Failed to create canvas document' });
      }
    },

    async getDocument(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { docId } = req.params;
        const result = await deps.getCanvasDocument(userId, docId);
        if (!result) {
          res.status(404).json({ message: 'Document not found' });
          return;
        }

        res.status(200).json(result);
      } catch (error) {
        logger.error('[Canvas] getDocument error:', error);
        res.status(500).json({ message: 'Failed to get canvas document' });
      }
    },

    async updateDocument(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { docId } = req.params;
        const { content, baseRevisionId, patchSummary } = req.body;

        if (typeof content !== 'string') {
          res.status(400).json({ message: 'content must be a string' });
          return;
        }

        const result = await deps.updateCanvasDocument({
          userId,
          documentId: docId,
          content,
          baseRevisionId: typeof baseRevisionId === 'string' ? baseRevisionId : undefined,
          patchSummary: typeof patchSummary === 'string' ? patchSummary : undefined,
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasConflictError) {
          res.status(409).json({
            message: error.message,
            currentRevisionId: error.currentRevisionId,
            currentContent: error.currentContent,
          });
          return;
        }
        if (error instanceof CanvasNotFoundError) {
          res.status(404).json({ message: 'Document not found' });
          return;
        }
        logger.error('[Canvas] updateDocument error:', error);
        res.status(500).json({ message: 'Failed to update canvas document' });
      }
    },

    async listRevisions(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { docId } = req.params;
        const revisions = await deps.listCanvasRevisions(userId, docId);
        res.status(200).json({ revisions });
      } catch (error) {
        logger.error('[Canvas] listRevisions error:', error);
        res.status(500).json({ message: 'Failed to list canvas revisions' });
      }
    },

    async restoreRevision(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { docId } = req.params;
        const { revisionId } = req.body;
        if (!revisionId || typeof revisionId !== 'string') {
          res.status(400).json({ message: 'revisionId is required' });
          return;
        }

        const result = await deps.restoreCanvasRevision(userId, docId, revisionId);
        res.status(200).json(result);
      } catch (error) {
        if (error instanceof CanvasNotFoundError) {
          res.status(404).json({ message: 'Document or revision not found' });
          return;
        }
        logger.error('[Canvas] restoreRevision error:', error);
        res.status(500).json({ message: 'Failed to restore canvas revision' });
      }
    },

    async createCandidate(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { docId } = req.params;
        const { conversationId, messageId, prompt, proposedContent, patchSummary } = req.body;

        if (!prompt || typeof prompt !== 'string') {
          res.status(400).json({ message: 'prompt is required' });
          return;
        }
        if (typeof proposedContent !== 'string') {
          res.status(400).json({ message: 'proposedContent must be a string' });
          return;
        }

        const candidate = await deps.createCanvasCandidate({
          userId,
          conversationId: conversationId || '',
          documentId: docId,
          messageId: typeof messageId === 'string' ? messageId : undefined,
          prompt,
          proposedContent,
          patchSummary: typeof patchSummary === 'string' ? patchSummary : undefined,
        });

        res.status(201).json({ candidate });
      } catch (error) {
        if (error instanceof CanvasNotFoundError) {
          res.status(404).json({ message: 'Target canvas document not found' });
          return;
        }
        logger.error('[Canvas] createCandidate error:', error);
        res.status(500).json({ message: 'Failed to create canvas candidate' });
      }
    },

    async acceptCandidate(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { candId } = req.params;
        const result = await deps.resolveCanvasCandidate(userId, candId, 'accept');
        res.status(200).json({ success: true, ...result });
      } catch (error) {
        if (error instanceof CanvasCandidateNotFoundError) {
          res.status(404).json({ message: 'Proposal not found or already resolved' });
          return;
        }
        logger.error('[Canvas] acceptCandidate error:', error);
        res.status(500).json({ message: 'Failed to accept candidate proposal' });
      }
    },

    async rejectCandidate(req: CanvasRequest, res: Response): Promise<void> {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: 'Unauthorized' });
          return;
        }

        const { candId } = req.params;
        const result = await deps.resolveCanvasCandidate(userId, candId, 'reject');
        res.status(200).json({ success: true, ...result });
      } catch (error) {
        if (error instanceof CanvasCandidateNotFoundError) {
          res.status(404).json({ message: 'Proposal not found or already resolved' });
          return;
        }
        logger.error('[Canvas] rejectCandidate error:', error);
        res.status(500).json({ message: 'Failed to reject candidate proposal' });
      }
    },
  };
}
