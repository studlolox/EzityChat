import crypto from 'crypto';
import type { Model, Types } from 'mongoose';
import type {
  ICanvasBoardDocument,
  ICanvasBoardRevisionDocument,
  ICanvasBoardCandidateDocument,
  BoardNode,
  BoardEdge,
  BoardCandidateStatus,
} from '../types/canvasBoard';

export class CanvasBoardNotFoundError extends Error {
  constructor(message = 'Canvas board not found') {
    super(message);
    this.name = 'CanvasBoardNotFoundError';
  }
}

export class CanvasBoardCandidateNotFoundError extends Error {
  constructor(message = 'Canvas board candidate not found') {
    super(message);
    this.name = 'CanvasBoardCandidateNotFoundError';
  }
}

export class CanvasBoardConflictError extends Error {
  constructor(
    message = 'Canvas board has been modified by another session. Please reload the latest revision.',
  ) {
    super(message);
    this.name = 'CanvasBoardConflictError';
  }
}

export interface CreateCanvasBoardInput {
  userId: string | Types.ObjectId;
  conversationId: string;
  title: string;
  rootTopic: string;
  orientation?: 'horizontal' | 'vertical';
  nodes?: BoardNode[];
  edges?: BoardEdge[];
}

export interface UpdateCanvasBoardInput {
  userId: string | Types.ObjectId;
  boardId: string | Types.ObjectId;
  nodes: BoardNode[];
  edges: BoardEdge[];
  baseRevisionId?: string | Types.ObjectId;
  patchSummary?: string;
}

export interface CreateCanvasBoardCandidateInput {
  userId: string | Types.ObjectId;
  conversationId?: string;
  boardId: string | Types.ObjectId;
  proposedNodes: BoardNode[];
  proposedEdges: BoardEdge[];
  patchSummary: string;
}

function computeBoardHash(nodes: BoardNode[], edges: BoardEdge[]): string {
  return crypto.createHash('sha256').update(JSON.stringify({ nodes, edges })).digest('hex');
}

export function createCanvasBoardMethods(mongoose: typeof import('mongoose')) {
  const getCanvasBoardModel = (): Model<ICanvasBoardDocument> =>
    mongoose.models.CanvasBoard as Model<ICanvasBoardDocument>;

  const getCanvasBoardRevisionModel = (): Model<ICanvasBoardRevisionDocument> =>
    mongoose.models.CanvasBoardRevision as Model<ICanvasBoardRevisionDocument>;

  const getCanvasBoardCandidateModel = (): Model<ICanvasBoardCandidateDocument> =>
    mongoose.models.CanvasBoardCandidate as Model<ICanvasBoardCandidateDocument>;

  return {
    async createCanvasBoard({
      userId,
      conversationId,
      title,
      rootTopic,
      orientation = 'horizontal',
      nodes = [],
      edges = [],
    }: CreateCanvasBoardInput): Promise<{
      board: ICanvasBoardDocument;
      revision: ICanvasBoardRevisionDocument;
    }> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardRevision = getCanvasBoardRevisionModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      const defaultNodes: BoardNode[] =
        nodes.length > 0
          ? nodes
          : [
              {
                id: 'root',
                label: rootTopic,
                content: '',
                color: '#007AFF',
                x: 0,
                y: 0,
              },
            ];

      const board = new CanvasBoard({
        userId: userObjectId,
        conversationId,
        title,
        rootTopic,
        orientation,
      });

      const revision = new CanvasBoardRevision({
        boardId: board._id,
        userId: userObjectId,
        nodes: defaultNodes,
        edges,
        contentHash: computeBoardHash(defaultNodes, edges),
        provenance: 'user_create',
        patchSummary: 'Initial board creation',
      });

      await revision.save();

      board.currentRevisionId = revision._id as Types.ObjectId;
      await board.save();

      return { board, revision };
    },

    async getCanvasBoard({
      userId,
      boardId,
    }: {
      userId: string | Types.ObjectId;
      boardId: string | Types.ObjectId;
    }): Promise<{
      board: ICanvasBoardDocument;
      currentRevision: ICanvasBoardRevisionDocument | null;
      activeCandidate: ICanvasBoardCandidateDocument | null;
    }> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardRevision = getCanvasBoardRevisionModel();
      const CanvasBoardCandidate = getCanvasBoardCandidateModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const boardObjectId =
        typeof boardId === 'string' ? new mongoose.Types.ObjectId(boardId) : boardId;

      const board = await CanvasBoard.findOne({
        _id: boardObjectId,
        userId: userObjectId,
      });

      if (!board) {
        throw new CanvasBoardNotFoundError();
      }

      const currentRevision = board.currentRevisionId
        ? await CanvasBoardRevision.findOne({
            _id: board.currentRevisionId,
            userId: userObjectId,
          })
        : null;

      const activeCandidate = await CanvasBoardCandidate.findOne({
        boardId: boardObjectId,
        userId: userObjectId,
        status: 'pending',
      }).sort({ createdAt: -1 });

      return { board, currentRevision, activeCandidate };
    },

    async listCanvasBoards({
      userId,
      conversationId,
    }: {
      userId: string | Types.ObjectId;
      conversationId?: string;
    }): Promise<ICanvasBoardDocument[]> {
      const CanvasBoard = getCanvasBoardModel();
      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      const query: Record<string, unknown> = { userId: userObjectId };
      if (conversationId) {
        query.conversationId = conversationId;
      }

      return CanvasBoard.find(query).sort({ updatedAt: -1 });
    },

    async updateCanvasBoard({
      userId,
      boardId,
      nodes,
      edges,
      baseRevisionId,
      patchSummary = 'Manual board edit',
    }: UpdateCanvasBoardInput): Promise<{
      board: ICanvasBoardDocument;
      revision: ICanvasBoardRevisionDocument;
    }> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardRevision = getCanvasBoardRevisionModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const boardObjectId =
        typeof boardId === 'string' ? new mongoose.Types.ObjectId(boardId) : boardId;

      const board = await CanvasBoard.findOne({
        _id: boardObjectId,
        userId: userObjectId,
      });

      if (!board) {
        throw new CanvasBoardNotFoundError();
      }

      if (baseRevisionId && board.currentRevisionId) {
        const baseRevStr = baseRevisionId.toString();
        const currentRevStr = board.currentRevisionId.toString();
        if (baseRevStr !== currentRevStr) {
          throw new CanvasBoardConflictError();
        }
      }

      const revision = new CanvasBoardRevision({
        boardId: board._id,
        userId: userObjectId,
        parentRevisionId: board.currentRevisionId,
        nodes,
        edges,
        contentHash: computeBoardHash(nodes, edges),
        provenance: 'user_edit',
        patchSummary,
      });

      await revision.save();

      board.currentRevisionId = revision._id as Types.ObjectId;
      board.updatedAt = new Date();
      await board.save();

      return { board, revision };
    },

    async listCanvasBoardRevisions({
      userId,
      boardId,
    }: {
      userId: string | Types.ObjectId;
      boardId: string | Types.ObjectId;
    }): Promise<ICanvasBoardRevisionDocument[]> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardRevision = getCanvasBoardRevisionModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const boardObjectId =
        typeof boardId === 'string' ? new mongoose.Types.ObjectId(boardId) : boardId;

      const board = await CanvasBoard.findOne({
        _id: boardObjectId,
        userId: userObjectId,
      });

      if (!board) {
        throw new CanvasBoardNotFoundError();
      }

      return CanvasBoardRevision.find({
        boardId: boardObjectId,
        userId: userObjectId,
      }).sort({ createdAt: -1 });
    },

    async restoreCanvasBoardRevision({
      userId,
      boardId,
      revisionId,
    }: {
      userId: string | Types.ObjectId;
      boardId: string | Types.ObjectId;
      revisionId: string | Types.ObjectId;
    }): Promise<{
      board: ICanvasBoardDocument;
      revision: ICanvasBoardRevisionDocument;
    }> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardRevision = getCanvasBoardRevisionModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const boardObjectId =
        typeof boardId === 'string' ? new mongoose.Types.ObjectId(boardId) : boardId;
      const targetRevObjectId =
        typeof revisionId === 'string' ? new mongoose.Types.ObjectId(revisionId) : revisionId;

      const board = await CanvasBoard.findOne({
        _id: boardObjectId,
        userId: userObjectId,
      });

      if (!board) {
        throw new CanvasBoardNotFoundError();
      }

      const targetRevision = await CanvasBoardRevision.findOne({
        _id: targetRevObjectId,
        boardId: boardObjectId,
        userId: userObjectId,
      });

      if (!targetRevision) {
        throw new CanvasBoardNotFoundError('Target revision not found');
      }

      const restoredRevision = new CanvasBoardRevision({
        boardId: board._id,
        userId: userObjectId,
        parentRevisionId: board.currentRevisionId,
        nodes: targetRevision.nodes,
        edges: targetRevision.edges,
        contentHash: targetRevision.contentHash,
        provenance: 'restore',
        patchSummary: `Restored to revision from ${targetRevision.createdAt?.toISOString() ?? 'earlier'}`,
      });

      await restoredRevision.save();

      board.currentRevisionId = restoredRevision._id as Types.ObjectId;
      board.updatedAt = new Date();
      await board.save();

      return { board, revision: restoredRevision };
    },

    async createCanvasBoardCandidate({
      userId,
      boardId,
      proposedNodes,
      proposedEdges,
      patchSummary,
      conversationId,
    }: CreateCanvasBoardCandidateInput): Promise<ICanvasBoardCandidateDocument> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardCandidate = getCanvasBoardCandidateModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const boardObjectId =
        typeof boardId === 'string' ? new mongoose.Types.ObjectId(boardId) : boardId;

      const board = await CanvasBoard.findOne({
        _id: boardObjectId,
        userId: userObjectId,
      });

      if (!board) {
        throw new CanvasBoardNotFoundError();
      }

      if (!board.currentRevisionId) {
        throw new CanvasBoardNotFoundError('Board has no valid base revision');
      }

      const candidate = new CanvasBoardCandidate({
        boardId: board._id,
        userId: userObjectId,
        conversationId: conversationId || board.conversationId,
        baseRevisionId: board.currentRevisionId,
        proposedNodes,
        proposedEdges,
        patchSummary,
        status: 'pending',
      });

      await candidate.save();
      return candidate;
    },

    async resolveCanvasBoardCandidate({
      userId,
      candidateId,
      action,
    }: {
      userId: string | Types.ObjectId;
      candidateId: string | Types.ObjectId;
      action: 'accept' | 'reject';
    }): Promise<{
      success: boolean;
      status: BoardCandidateStatus;
      revision?: ICanvasBoardRevisionDocument;
    }> {
      const CanvasBoard = getCanvasBoardModel();
      const CanvasBoardRevision = getCanvasBoardRevisionModel();
      const CanvasBoardCandidate = getCanvasBoardCandidateModel();

      const userObjectId =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const candidateObjectId =
        typeof candidateId === 'string' ? new mongoose.Types.ObjectId(candidateId) : candidateId;

      const candidate = await CanvasBoardCandidate.findOne({
        _id: candidateObjectId,
        userId: userObjectId,
        status: 'pending',
      });

      if (!candidate) {
        throw new CanvasBoardCandidateNotFoundError();
      }

      if (action === 'reject') {
        candidate.status = 'rejected';
        candidate.resolvedAt = new Date();
        await candidate.save();
        return { success: true, status: 'rejected' };
      }

      const board = await CanvasBoard.findOne({
        _id: candidate.boardId,
        userId: userObjectId,
      });

      if (!board) {
        throw new CanvasBoardNotFoundError();
      }

      const newRevision = new CanvasBoardRevision({
        boardId: board._id,
        userId: userObjectId,
        parentRevisionId: board.currentRevisionId,
        nodes: candidate.proposedNodes,
        edges: candidate.proposedEdges,
        contentHash: computeBoardHash(candidate.proposedNodes, candidate.proposedEdges),
        provenance: 'ai_accept',
        patchSummary: candidate.patchSummary,
      });

      await newRevision.save();

      board.currentRevisionId = newRevision._id as Types.ObjectId;
      board.updatedAt = new Date();
      await board.save();

      candidate.status = 'accepted';
      candidate.resolvedAt = new Date();
      await candidate.save();

      return { success: true, status: 'accepted', revision: newRevision };
    },
  };
}

export type CanvasBoardMethods = ReturnType<typeof createCanvasBoardMethods>;
