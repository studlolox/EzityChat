import { Model } from 'mongoose';
import type { ICanvasRevisionDocument } from '~/types/canvas';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import canvasRevisionSchema from '~/schema/canvasRevision';

export function createCanvasRevisionModel(
  mongoose: typeof import('mongoose'),
): Model<ICanvasRevisionDocument> {
  applyTenantIsolation(canvasRevisionSchema);
  return (
    mongoose.models.CanvasRevision ||
    mongoose.model<ICanvasRevisionDocument>(
      'CanvasRevision',
      canvasRevisionSchema,
      'canvas_revisions',
    )
  );
}
