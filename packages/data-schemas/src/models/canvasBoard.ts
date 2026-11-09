import { Model } from 'mongoose';
import type { ICanvasBoardDocument } from '~/types/canvasBoard';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import canvasBoardSchema from '~/schema/canvasBoard';

export function createCanvasBoardModel(
  mongoose: typeof import('mongoose'),
): Model<ICanvasBoardDocument> {
  applyTenantIsolation(canvasBoardSchema);
  return (
    mongoose.models.CanvasBoard ||
    mongoose.model<ICanvasBoardDocument>('CanvasBoard', canvasBoardSchema, 'canvas_boards')
  );
}
