import { Model } from 'mongoose';
import type { ICanvasCandidateDocument } from '~/types/canvas';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import canvasCandidateSchema from '~/schema/canvasCandidate';

export function createCanvasCandidateModel(
  mongoose: typeof import('mongoose'),
): Model<ICanvasCandidateDocument> {
  applyTenantIsolation(canvasCandidateSchema);
  return (
    mongoose.models.CanvasCandidate ||
    mongoose.model<ICanvasCandidateDocument>(
      'CanvasCandidate',
      canvasCandidateSchema,
      'canvas_candidates',
    )
  );
}
