import { Schema } from 'mongoose';
import type { ICanvasBoardDocument } from '../types/canvasBoard';

const canvasBoardSchema: Schema<ICanvasBoardDocument> = new Schema<ICanvasBoardDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 256 },
    rootTopic: { type: String, required: true },
    orientation: { type: String, enum: ['horizontal', 'vertical'], default: 'horizontal' },
    currentRevisionId: { type: Schema.Types.ObjectId, ref: 'CanvasBoardRevision' },
  },
  {
    timestamps: true,
  },
);

canvasBoardSchema.index({ userId: 1, conversationId: 1, updatedAt: -1 });

export default canvasBoardSchema;
export { canvasBoardSchema };
