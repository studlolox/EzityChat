import { Schema } from 'mongoose';
import type { ICanvasBoardRevisionDocument } from '../types/canvasBoard';

const canvasBoardRevisionSchema: Schema<ICanvasBoardRevisionDocument> =
  new Schema<ICanvasBoardRevisionDocument>(
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
      parentRevisionId: {
        type: Schema.Types.ObjectId,
        ref: 'CanvasBoardRevision',
      },
      nodes: [{ type: Schema.Types.Mixed, required: true }],
      edges: [{ type: Schema.Types.Mixed, required: true }],
      contentHash: {
        type: String,
        required: true,
      },
      provenance: {
        type: String,
        enum: ['user_create', 'user_edit', 'ai_accept', 'restore'],
        required: true,
      },
      patchSummary: {
        type: String,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: false,
    },
  );

canvasBoardRevisionSchema.index({ boardId: 1, createdAt: -1 });
canvasBoardRevisionSchema.index({ userId: 1, boardId: 1 });

export default canvasBoardRevisionSchema;
export { canvasBoardRevisionSchema };
