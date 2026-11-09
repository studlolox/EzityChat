import { Schema } from 'mongoose';
import type { ICanvasRevisionDocument } from '~/types/canvas';

const canvasRevisionSchema: Schema<ICanvasRevisionDocument> = new Schema<ICanvasRevisionDocument>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'CanvasDocument',
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
      ref: 'CanvasRevision',
    },
    content: {
      type: String,
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
    },
    byteSize: {
      type: Number,
      required: true,
    },
    provenance: {
      type: String,
      enum: ['user_create', 'user_edit', 'ai_accept', 'restore'],
      required: true,
    },
    patchSummary: {
      type: String,
      maxlength: 1024,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

canvasRevisionSchema.index({ documentId: 1, createdAt: -1 });
canvasRevisionSchema.index({ userId: 1, documentId: 1 });

export default canvasRevisionSchema;
