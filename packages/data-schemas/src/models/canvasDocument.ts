import { Model } from 'mongoose';
import type { ICanvasDocumentDocument } from '~/types/canvas';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import canvasDocumentSchema from '~/schema/canvasDocument';

export function createCanvasDocumentModel(
  mongoose: typeof import('mongoose'),
): Model<ICanvasDocumentDocument> {
  applyTenantIsolation(canvasDocumentSchema);
  return (
    mongoose.models.CanvasDocument ||
    mongoose.model<ICanvasDocumentDocument>(
      'CanvasDocument',
      canvasDocumentSchema,
      'canvas_documents',
    )
  );
}
