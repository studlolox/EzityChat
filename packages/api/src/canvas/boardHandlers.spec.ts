import { CanvasBoardConflictError } from '@librechat/data-schemas';
import type { Response } from 'express';
import { createCanvasBoardHandlers } from './boardHandlers';

function mockRequest(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-123' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Parameters<ReturnType<typeof createCanvasBoardHandlers>['listBoards']>[0];
}

function mockResponse() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
}

describe('Canvas Board REST API Handlers', () => {
  let mockDb: Record<string, jest.Mock>;
  let handlers: ReturnType<typeof createCanvasBoardHandlers>;

  beforeEach(() => {
    mockDb = {
      listCanvasBoards: jest.fn().mockResolvedValue([{ _id: 'b1', title: 'Roadmap' }]),
      createCanvasBoard: jest
        .fn()
        .mockResolvedValue({ board: { _id: 'b1' }, revision: { _id: 'r1' } }),
      getCanvasBoard: jest.fn().mockResolvedValue({
        board: { _id: 'b1', title: 'Roadmap' },
        currentRevision: { nodes: [], edges: [] },
      }),
      updateCanvasBoard: jest
        .fn()
        .mockResolvedValue({ board: { _id: 'b1' }, revision: { _id: 'r2' } }),
      listCanvasBoardRevisions: jest.fn().mockResolvedValue([{ _id: 'r1' }]),
      restoreCanvasBoardRevision: jest
        .fn()
        .mockResolvedValue({ board: { _id: 'b1' }, revision: { _id: 'r3' } }),
      createCanvasBoardCandidate: jest.fn().mockResolvedValue({ _id: 'cand1' }),
      resolveCanvasBoardCandidate: jest
        .fn()
        .mockResolvedValue({ success: true, status: 'accepted' }),
    };

    handlers = createCanvasBoardHandlers(
      mockDb as unknown as Parameters<typeof createCanvasBoardHandlers>[0],
    );
  });

  it('lists boards with user isolation', async () => {
    const req = mockRequest({ query: { convoId: 'convo-1' } });
    const res = mockResponse();

    await handlers.listBoards(req, res);

    expect(mockDb.listCanvasBoards).toHaveBeenCalledWith({
      userId: 'user-123',
      conversationId: 'convo-1',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      boards: [{ _id: 'b1', title: 'Roadmap' }],
    });
  });

  it('creates board and returns 201', async () => {
    const req = mockRequest({
      body: {
        conversationId: 'convo-1',
        title: 'Roadmap',
        rootTopic: 'Platform 2026',
      },
    });
    const res = mockResponse();

    await handlers.createBoard(req, res);

    expect(mockDb.createCanvasBoard).toHaveBeenCalledWith({
      userId: 'user-123',
      conversationId: 'convo-1',
      title: 'Roadmap',
      rootTopic: 'Platform 2026',
      orientation: undefined,
      nodes: undefined,
      edges: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('handles 409 conflict when base revision does not match', async () => {
    mockDb.updateCanvasBoard.mockRejectedValue(new CanvasBoardConflictError());

    const req = mockRequest({
      params: { boardId: 'b1' },
      body: {
        nodes: [],
        edges: [],
        baseRevisionId: 'stale-rev',
      },
    });
    const res = mockResponse();

    await handlers.updateBoard(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
