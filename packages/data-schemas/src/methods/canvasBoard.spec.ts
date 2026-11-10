import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createCanvasBoardMethods,
  CanvasBoardConflictError,
  CanvasBoardNotFoundError,
} from './canvasBoard';
import { createModels } from '../models';

describe('CanvasBoard Database Methods', () => {
  let mongoServer: MongoMemoryServer;
  let methods: ReturnType<typeof createCanvasBoardMethods>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    createModels(mongoose);
    methods = createCanvasBoardMethods(mongoose);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await mongoose.connection.collection('canvas_boards').deleteMany({});
    await mongoose.connection.collection('canvas_board_revisions').deleteMany({});
    await mongoose.connection.collection('canvas_board_candidates').deleteMany({});
  });

  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();

  it('creates a new CanvasBoard and initial revision with root node', async () => {
    const { board, revision } = await methods.createCanvasBoard({
      userId: userA,
      conversationId: 'convo-1',
      title: 'Vacation Plan',
      rootTopic: 'Vacation 2026',
    });

    expect(board._id).toBeDefined();
    expect(board.title).toBe('Vacation Plan');
    expect(board.rootTopic).toBe('Vacation 2026');
    expect(board.currentRevisionId?.toString()).toBe(revision._id.toString());
    expect(revision.nodes).toHaveLength(1);
    expect(revision.nodes[0].label).toBe('Vacation 2026');
    expect(revision.provenance).toBe('user_create');
  });

  it('enforces multi-user isolation on getCanvasBoard', async () => {
    const { board } = await methods.createCanvasBoard({
      userId: userA,
      conversationId: 'convo-1',
      title: 'Private Board',
      rootTopic: 'Confidential',
    });

    // User A can access
    const resultA = await methods.getCanvasBoard({
      userId: userA,
      boardId: board._id.toString(),
    });
    expect(resultA.board.title).toBe('Private Board');

    // User B is rejected
    await expect(
      methods.getCanvasBoard({
        userId: userB,
        boardId: board._id.toString(),
      }),
    ).rejects.toThrow(CanvasBoardNotFoundError);
  });

  it('detects concurrency conflict when baseRevisionId does not match', async () => {
    const { board } = await methods.createCanvasBoard({
      userId: userA,
      conversationId: 'convo-1',
      title: 'Team Map',
      rootTopic: 'Sprint 1',
    });

    // Update 1 succeeds
    await methods.updateCanvasBoard({
      userId: userA,
      boardId: board._id.toString(),
      baseRevisionId: board.currentRevisionId?.toString(),
      nodes: [{ id: 'root', label: 'Updated Sprint', color: '#007AFF' }],
      edges: [],
    });

    // Stale Update 2 with old baseRevisionId should throw CanvasBoardConflictError
    await expect(
      methods.updateCanvasBoard({
        userId: userA,
        boardId: board._id.toString(),
        baseRevisionId: board.currentRevisionId?.toString(), // old base
        nodes: [{ id: 'root', label: 'Stale Edit', color: '#007AFF' }],
        edges: [],
      }),
    ).rejects.toThrow(CanvasBoardConflictError);
  });

  it('proposes and accepts board edit candidate', async () => {
    const { board } = await methods.createCanvasBoard({
      userId: userA,
      conversationId: 'convo-1',
      title: 'Project Tree',
      rootTopic: 'Root',
    });

    const candidate = await methods.createCanvasBoardCandidate({
      userId: userA,
      boardId: board._id.toString(),
      proposedNodes: [
        { id: 'root', label: 'Root', color: '#007AFF' },
        { id: 'child-1', label: 'Backend', color: '#34C759' },
      ],
      proposedEdges: [{ id: 'e1', source: 'root', target: 'child-1' }],
      patchSummary: 'Add Backend branch',
    });

    expect(candidate.status).toBe('pending');

    const accepted = await methods.resolveCanvasBoardCandidate({
      userId: userA,
      candidateId: candidate._id.toString(),
      action: 'accept',
    });

    expect(accepted.success).toBe(true);
    expect(accepted.status).toBe('accepted');
    expect(accepted.revision?.nodes).toHaveLength(2);
    expect(accepted.revision?.provenance).toBe('ai_accept');
  });
});
