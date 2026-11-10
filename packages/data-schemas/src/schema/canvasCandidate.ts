import { Schema } from 'mongoose';
import type { ICanvasCandidateDocument } from '~/types/canvas';

const canvasCandidateSchema: Schema<ICanvasCandidateDocument> =
  new Schema<ICanvasCandidateDocument>(
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
      conversationId: {
        type: String,
        required: true,
        index: true,
      },
      messageId: {
        type: String,
        index: true,
      },
      baseRevisionId: {
        type: Schema.Types.ObjectId,
        ref: 'CanvasRevision',
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired'],
        default: 'pending',
        index: true,
      },
      prompt: {
        type: String,
        required: true,
      },
      proposedContent: {
        type: String,
        required: true,
      },
      patchSummary: {
        type: String,
        maxlength: 1024,
      },
      resolvedAt: {
        type: Date,
      },
    },
    {
      timestamps: { createdAt: true, updatedAt: false },
    },
  );

canvasCandidateSchema.index({ documentId: 1, status: 1 });
canvasCandidateSchema.index({ userId: 1, conversationId: 1 });

export default canvasCandidateSchema;
