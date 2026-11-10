import { Schema } from 'mongoose';
import type { ICanvasBoardCandidateDocument } from '../types/canvasBoard';

const canvasBoardCandidateSchema: Schema<ICanvasBoardCandidateDocument> =
  new Schema<ICanvasBoardCandidateDocument>(
    {
      boardId: {
        type: Schema.Types.ObjectId,
        ref: 'CanvasBoard',
        required: true,
        index: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
      conversationId: {
        type: String,
        required: true,
        index: true,
      },
      baseRevisionId: {
        type: Schema.Types.ObjectId,
        ref: 'CanvasBoardRevision',
        required: true,
      },
      proposedNodes: [{ type: Schema.Types.Mixed, required: true }],
      proposedEdges: [{ type: Schema.Types.Mixed, required: true }],
      patchSummary: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      resolvedAt: {
        type: Date,
      },
    },
    {
      timestamps: false,
    },
  );

canvasBoardCandidateSchema.index({ boardId: 1, status: 1 });
canvasBoardCandidateSchema.index({ userId: 1, conversationId: 1 });

export default canvasBoardCandidateSchema;
export { canvasBoardCandidateSchema };
