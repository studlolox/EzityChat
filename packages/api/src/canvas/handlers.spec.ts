import { CanvasConflictError } from '@librechat/data-schemas';
import type { Response } from 'express';
import { createCanvasHandlers } from './handlers';

function mockRequest(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-123' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as never;
}

function mockResponse() {
  const result = { statusCode: 200, body: undefined as unknown };
  const res = {
    status: jest.fn((statusCode: number) => {
      result.statusCode = statusCode;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
  } as unknown as Response;
  return { res, result };
}

function setup(overrides: Partial<Parameters<typeof createCanvasHandlers>[0]> = {}) {
  const deps = {
    createCanvasDocument: jest.fn(),
    getCanvasDocument: jest.fn(),
    listCanvasDocuments: jest.fn(),
    updateCanvasDocument: jest.fn(),
    listCanvasRevisions: jest.fn(),
    restoreCanvasRevision: jest.fn(),
    createCanvasCandidate: jest.fn(),
    getCanvasCandidate: jest.fn(),
    resolveCanvasCandidate: jest.fn(),
    ...overrides,
  };
  return { handlers: createCanvasHandlers(deps), deps };
}

describe('Canvas REST Handlers', () => {
  it('lists documents for user and conversation', async () => {
    const { handlers, deps } = setup({
      listCanvasDocuments: jest.fn().mockResolvedValue([{ title: 'Doc 1' }]),
    });
    const req = mockRequest({ query: { convoId: 'convo-1' } });
    const { res, result } = mockResponse();

    await handlers.listDocuments(req, res);

    expect(deps.listCanvasDocuments).toHaveBeenCalledWith('user-123', 'convo-1');
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ documents: [{ title: 'Doc 1' }] });
  });

  it('creates a new canvas document', async () => {
    const { handlers, deps } = setup({
      createCanvasDocument: jest.fn().mockResolvedValue({
        document: { title: 'New Doc' },
        revision: { content: 'hello' },
      }),
    });
    const req = mockRequest({
      body: {
        conversationId: 'convo-1',
        title: 'New Doc',
        initialContent: 'hello',
      },
    });
    const { res, result } = mockResponse();

    await handlers.createDocument(req, res);

    expect(deps.createCanvasDocument).toHaveBeenCalledWith({
      userId: 'user-123',
      conversationId: 'convo-1',
      title: 'New Doc',
      docType: 'markdown',
      language: undefined,
      initialContent: 'hello',
      patchSummary: undefined,
    });
    expect(result.statusCode).toBe(201);
  });

  it('returns 409 on update conflict', async () => {
    const { handlers } = setup({
      updateCanvasDocument: jest
        .fn()
        .mockRejectedValue(new CanvasConflictError('Conflict', 'rev-2', 'modified content')),
    });
    const req = mockRequest({
      params: { docId: 'doc-1' },
      body: { content: 'my update', baseRevisionId: 'rev-1' },
    });
    const { res, result } = mockResponse();

    await handlers.updateDocument(req, res);

    expect(result.statusCode).toBe(409);
    expect((result.body as Record<string, unknown>).currentRevisionId).toBe('rev-2');
  });

  it('accepts candidate proposal and creates revision', async () => {
    const { handlers, deps } = setup({
      resolveCanvasCandidate: jest.fn().mockResolvedValue({
        candidate: { status: 'accepted' },
        revision: { content: 'AI content' },
      }),
    });
    const req = mockRequest({
      params: { docId: 'doc-1', candId: 'cand-1' },
    });
    const { res, result } = mockResponse();

    await handlers.acceptCandidate(req, res);

    expect(deps.resolveCanvasCandidate).toHaveBeenCalledWith('user-123', 'cand-1', 'accept');
    expect(result.statusCode).toBe(200);
    expect((result.body as Record<string, unknown>).success).toBe(true);
  });
});
