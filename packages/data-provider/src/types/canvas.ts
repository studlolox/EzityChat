export type CanvasDocType = 'markdown' | 'code';
export type CanvasRevisionProvenance = 'user_create' | 'user_edit' | 'ai_accept' | 'restore';
export type CanvasCandidateStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface CanvasDocument {
  _id: string;
  userId?: string;
  conversationId: string;
  title: string;
  docType: CanvasDocType;
  language?: string;
  currentRevisionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasRevision {
  _id: string;
  documentId: string;
  userId?: string;
  parentRevisionId?: string;
  content: string;
  contentHash?: string;
  byteSize?: number;
  provenance?: CanvasRevisionProvenance;
  patchSummary?: string;
  createdAt?: string;
}

export interface CanvasCandidate {
  _id: string;
  documentId: string;
  userId?: string;
  conversationId: string;
  messageId?: string;
  baseRevisionId: string;
  status: CanvasCandidateStatus;
  prompt?: string;
  proposedContent: string;
  patchSummary?: string;
  createdAt?: string;
  resolvedAt?: string;
}

export interface CanvasDocumentDetailResponse {
  document: CanvasDocument;
  currentRevision: CanvasRevision | null;
  activeCandidate: CanvasCandidate | null;
}

export interface CanvasDocumentListResponse {
  documents: CanvasDocument[];
}

export interface CanvasDocumentRevisionsResponse {
  revisions: CanvasRevision[];
}

export interface CreateCanvasDocumentInput {
  conversationId: string;
  title: string;
  docType?: CanvasDocType;
  language?: string;
  initialContent: string;
  patchSummary?: string;
}

export interface UpdateCanvasDocumentInput {
  content: string;
  baseRevisionId?: string;
}

export interface VisualBoardNode {
  id: string;
  label: string;
  content?: string;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface VisualBoardEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CanvasBoard {
  _id: string;
  userId?: string;
  conversationId: string;
  title: string;
  rootTopic: string;
  orientation?: 'horizontal' | 'vertical';
  currentRevisionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasBoardRevision {
  _id: string;
  boardId: string;
  userId?: string;
  parentRevisionId?: string;
  nodes: VisualBoardNode[];
  edges: VisualBoardEdge[];
  createdAt?: string;
}

export interface CanvasBoardCandidate {
  _id: string;
  boardId: string;
  userId?: string;
  conversationId: string;
  status: string;
  patchSummary?: string;
  proposedNodes?: VisualBoardNode[];
  proposedEdges?: VisualBoardEdge[];
  createdAt?: string;
  resolvedAt?: string;
}

export interface CanvasBoardDetailResponse {
  board: CanvasBoard;
  currentRevision: CanvasBoardRevision | null;
  activeCandidate: CanvasBoardCandidate | null;
}

export interface CanvasBoardListResponse {
  boards: CanvasBoard[];
}

export interface CreateCanvasBoardInput {
  conversationId: string;
  title: string;
  rootTopic?: string;
  orientation?: 'horizontal' | 'vertical';
}

export interface UpdateCanvasBoardInput {
  nodes: VisualBoardNode[];
  edges: VisualBoardEdge[];
  baseRevisionId?: string;
}
