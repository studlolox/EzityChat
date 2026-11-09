const express = require('express');
const { createCanvasBoardHandlers } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const handlers = createCanvasBoardHandlers({
  createCanvasBoard: db.createCanvasBoard,
  getCanvasBoard: db.getCanvasBoard,
  listCanvasBoards: db.listCanvasBoards,
  updateCanvasBoard: db.updateCanvasBoard,
  listCanvasBoardRevisions: db.listCanvasBoardRevisions,
  restoreCanvasBoardRevision: db.restoreCanvasBoardRevision,
  createCanvasBoardCandidate: db.createCanvasBoardCandidate,
  resolveCanvasBoardCandidate: db.resolveCanvasBoardCandidate,
});

router.use(requireJwtAuth);

router.get('/', handlers.listBoards);
router.post('/', handlers.createBoard);
router.get('/:boardId', handlers.getBoard);
router.patch('/:boardId', handlers.updateBoard);
router.get('/:boardId/revisions', handlers.listBoardRevisions);
router.post('/:boardId/restore', handlers.restoreBoardRevision);
router.post('/:boardId/candidates', handlers.createBoardCandidate);
router.post('/:boardId/candidates/:candId/accept', handlers.acceptBoardCandidate);
router.post('/:boardId/candidates/:candId/reject', handlers.rejectBoardCandidate);

module.exports = router;
