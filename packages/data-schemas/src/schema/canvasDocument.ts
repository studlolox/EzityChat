import { Schema } from 'mongoose';
import type { ICanvasDocumentDocument } from '~/types/canvas';

const canvasDocumentSchema: Schema<ICanvasDocumentDocument> = new Schema<ICanvasDocumentDocument>(
  {
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    docType: {
      type: String,
      enum: ['markdown', 'code'],
      default: 'markdown',
      required: true,
    },
    language: {
      type: String,
      default: 'markdown',
    },
    currentRevisionId: {
      type: Schema.Types.ObjectId,
      ref: 'CanvasRevision',
    },
  },
  {
    timestamps: true,
  },
);

canvasDocumentSchema.index({ userId: 1, conversationId: 1, updatedAt: -1 });

export default canvasDocumentSchema;
