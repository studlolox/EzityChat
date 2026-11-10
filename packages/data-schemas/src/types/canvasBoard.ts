import type { Document, Types } from 'mongoose';

export interface BoardNode {
  id: string;
  label: string;
  content?: string;
  color?: string; // hex color e.g. #007AFF
  x?: number;
  y?: number;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ICanvasBoard {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  title: string;
  rootTopic: string;
  orientation: 'horizontal' | 'vertical';
  currentRevisionId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ICanvasBoardDocument = ICanvasBoard & Document;

export type BoardProvenance = 'user_create' | 'user_edit' | 'ai_accept' | 'restore';

export interface ICanvasBoardRevision {
  _id?: Types.ObjectId;
  boardId: Types.ObjectId;
  userId: Types.ObjectId;
  parentRevisionId?: Types.ObjectId;
  nodes: BoardNode[];
  edges: BoardEdge[];
  contentHash: string;
  provenance: BoardProvenance;
  patchSummary?: string;
  createdAt?: Date;
}

export type ICanvasBoardRevisionDocument = ICanvasBoardRevision & Document;

export type BoardCandidateStatus = 'pending' | 'accepted' | 'rejected';

export interface ICanvasBoardCandidate {
  _id?: Types.ObjectId;
  boardId: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  baseRevisionId: Types.ObjectId;
  proposedNodes: BoardNode[];
  proposedEdges: BoardEdge[];
  patchSummary: string;
  status: BoardCandidateStatus;
  createdAt?: Date;
  resolvedAt?: Date;
}

export type ICanvasBoardCandidateDocument = ICanvasBoardCandidate & Document;
