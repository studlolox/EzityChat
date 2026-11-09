import { Model } from 'mongoose';
import type { ICanvasBoardCandidateDocument } from '~/types/canvasBoard';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import canvasBoardCandidateSchema from '~/schema/canvasBoardCandidate';

export function createCanvasBoardCandidateModel(
  mongoose: typeof import('mongoose'),
): Model<ICanvasBoardCandidateDocument> {
  applyTenantIsolation(canvasBoardCandidateSchema);
  return (
    mongoose.models.CanvasBoardCandidate ||
    mongoose.model<ICanvasBoardCandidateDocument>(
      'CanvasBoardCandidate',
      canvasBoardCandidateSchema,
      'canvas_board_candidates',
    )
  );
}
