import { Model } from 'mongoose';
import type { ICanvasBoardRevisionDocument } from '~/types/canvasBoard';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import canvasBoardRevisionSchema from '~/schema/canvasBoardRevision';

export function createCanvasBoardRevisionModel(
  mongoose: typeof import('mongoose'),
): Model<ICanvasBoardRevisionDocument> {
  applyTenantIsolation(canvasBoardRevisionSchema);
  return (
    mongoose.models.CanvasBoardRevision ||
    mongoose.model<ICanvasBoardRevisionDocument>(
      'CanvasBoardRevision',
      canvasBoardRevisionSchema,
      'canvas_board_revisions',
    )
  );
}
