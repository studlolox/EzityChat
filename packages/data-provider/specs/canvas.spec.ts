/**
 * @jest-environment jsdom
 */
import {
  canvas,
  canvasDocument,
  canvasRevisions,
  canvasRestore,
  canvasCandidates,
  canvasCandidateAccept,
  canvasCandidateReject,
  canvasBoards,
  canvasBoard,
  canvasBoardRevisions,
  canvasBoardRestore,
  canvasBoardCandidates,
  canvasBoardCandidateResolve,
} from '../src/api-endpoints';
import * as dataService from '../src/data-service';
import request from '../src/request';

describe('Canvas API Endpoints and dataService', () => {
  it('constructs correct endpoint URLs for canvas documents', () => {
    expect(canvas()).toBe('/api/canvas');
    expect(canvasDocument('doc-123')).toBe('/api/canvas/doc-123');
    expect(canvasRevisions('doc-123')).toBe('/api/canvas/doc-123/revisions');
    expect(canvasRestore('doc-123')).toBe('/api/canvas/doc-123/restore');
    expect(canvasCandidates('doc-123')).toBe('/api/canvas/doc-123/candidates');
    expect(canvasCandidateAccept('doc-123', 'cand-456')).toBe(
      '/api/canvas/doc-123/candidates/cand-456/accept',
    );
    expect(canvasCandidateReject('doc-123', 'cand-456')).toBe(
      '/api/canvas/doc-123/candidates/cand-456/reject',
    );
  });

  it('constructs correct endpoint URLs for canvas boards', () => {
    expect(canvasBoards()).toBe('/api/canvas-boards');
    expect(canvasBoard('board-123')).toBe('/api/canvas-boards/board-123');
    expect(canvasBoardRevisions('board-123')).toBe('/api/canvas-boards/board-123/revisions');
    expect(canvasBoardRestore('board-123')).toBe('/api/canvas-boards/board-123/restore');
    expect(canvasBoardCandidates('board-123')).toBe('/api/canvas-boards/board-123/candidates');
    expect(canvasBoardCandidateResolve('board-123', 'cand-456', 'accept')).toBe(
      '/api/canvas-boards/board-123/candidates/cand-456/accept',
    );
    expect(canvasBoardCandidateResolve('board-123', 'cand-456', 'reject')).toBe(
      '/api/canvas-boards/board-123/candidates/cand-456/reject',
    );
  });

  it('calls request.get with convoId query in listCanvasDocuments', async () => {
    const getSpy = jest.spyOn(request, 'get').mockResolvedValueOnce({ documents: [] });
    await dataService.listCanvasDocuments({ convoId: 'convo-abc' });
    expect(getSpy).toHaveBeenCalledWith('/api/canvas?convoId=convo-abc');
    getSpy.mockRestore();
  });

  it('calls request.get with convoId query in listCanvasBoards', async () => {
    const getSpy = jest.spyOn(request, 'get').mockResolvedValueOnce({ boards: [] });
    await dataService.listCanvasBoards({ convoId: 'convo-xyz' });
    expect(getSpy).toHaveBeenCalledWith('/api/canvas-boards?convoId=convo-xyz');
    getSpy.mockRestore();
  });

  it('calls request.patch for updateCanvasDocument', async () => {
    const patchSpy = jest
      .spyOn(request, 'patch')
      .mockResolvedValueOnce({ document: {}, revision: {} });
    await dataService.updateCanvasDocument('doc-123', {
      content: 'updated',
      baseRevisionId: 'rev-1',
    });
    expect(patchSpy).toHaveBeenCalledWith('/api/canvas/doc-123', {
      content: 'updated',
      baseRevisionId: 'rev-1',
    });
    patchSpy.mockRestore();
  });
});
