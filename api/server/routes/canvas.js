const express = require('express');
const { createCanvasHandlers } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const handlers = createCanvasHandlers({
  createCanvasDocument: db.createCanvasDocument,
  getCanvasDocument: db.getCanvasDocument,
  listCanvasDocuments: db.listCanvasDocuments,
  updateCanvasDocument: db.updateCanvasDocument,
  listCanvasRevisions: db.listCanvasRevisions,
  restoreCanvasRevision: db.restoreCanvasRevision,
  createCanvasCandidate: db.createCanvasCandidate,
  getCanvasCandidate: db.getCanvasCandidate,
  resolveCanvasCandidate: db.resolveCanvasCandidate,
});

router.use(requireJwtAuth);

router.get('/', handlers.listDocuments);
router.post('/', handlers.createDocument);
router.get('/:docId', handlers.getDocument);
router.patch('/:docId', handlers.updateDocument);
router.get('/:docId/revisions', handlers.listRevisions);
router.post('/:docId/restore', handlers.restoreRevision);
router.post('/:docId/candidates', handlers.createCandidate);
router.post('/:docId/candidates/:candId/accept', handlers.acceptCandidate);
router.post('/:docId/candidates/:candId/reject', handlers.rejectCandidate);

module.exports = router;
