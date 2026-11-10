import type { Document, Types } from 'mongoose';

export type CanvasDocType = 'markdown' | 'code';

export type CanvasRevisionProvenance = 'user_create' | 'user_edit' | 'ai_accept' | 'restore';

export type CanvasCandidateStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface ICanvasDocument {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  title: string;
  docType: CanvasDocType;
  language?: string;
  currentRevisionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ICanvasDocumentDocument = ICanvasDocument & Document<Types.ObjectId>;

export interface ICanvasRevision {
  _id?: Types.ObjectId;
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  parentRevisionId?: Types.ObjectId;
  content: string;
  contentHash: string;
  byteSize: number;
  provenance: CanvasRevisionProvenance;
  patchSummary?: string;
  createdAt: Date;
}

export type ICanvasRevisionDocument = ICanvasRevision & Document<Types.ObjectId>;

export interface ICanvasCandidate {
  _id?: Types.ObjectId;
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  messageId?: string;
  baseRevisionId: Types.ObjectId;
  status: CanvasCandidateStatus;
  prompt: string;
  proposedContent: string;
  patchSummary?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export type ICanvasCandidateDocument = ICanvasCandidate & Document<Types.ObjectId>;
