import crypto from 'node:crypto';
import type { Model } from 'mongoose';
import type {
  ICanvasDocument,
  ICanvasDocumentDocument,
  ICanvasRevision,
  ICanvasRevisionDocument,
  ICanvasCandidate,
  ICanvasCandidateDocument,
  CanvasDocType,
  CanvasRevisionProvenance,
} from '~/types/canvas';
import { isValidObjectIdString } from '~/utils/objectId';

export class CanvasNotFoundError extends Error {
  constructor(message = 'Canvas document not found') {
    super(message);
    this.name = 'CanvasNotFoundError';
  }
}

export class CanvasCandidateNotFoundError extends Error {
  constructor(message = 'Canvas candidate proposal not found or already resolved') {
    super(message);
    this.name = 'CanvasCandidateNotFoundError';
  }
}

export class CanvasConflictError extends Error {
  public readonly currentRevisionId: string;
  public readonly currentContent: string;

  constructor(message: string, currentRevisionId: string, currentContent: string) {
    super(message);
    this.name = 'CanvasConflictError';
    this.currentRevisionId = currentRevisionId;
    this.currentContent = currentContent;
  }
}

export type CreateCanvasDocumentInput = {
  userId: string;
  conversationId: string;
  title: string;
  docType?: CanvasDocType;
  language?: string;
  initialContent: string;
  provenance?: CanvasRevisionProvenance;
  patchSummary?: string;
};

export type UpdateCanvasDocumentInput = {
  userId: string;
  documentId: string;
  content: string;
  baseRevisionId?: string;
  provenance?: CanvasRevisionProvenance;
  patchSummary?: string;
};

export type CreateCanvasCandidateInput = {
  userId: string;
  conversationId: string;
  documentId: string;
  messageId?: string;
  prompt: string;
  proposedContent: string;
  patchSummary?: string;
};

export type CanvasMethods = {
  createCanvasDocument: (
    input: CreateCanvasDocumentInput,
  ) => Promise<{ document: ICanvasDocument; revision: ICanvasRevision }>;
  getCanvasDocument: (
    userId: string,
    documentId: string,
  ) => Promise<{
    document: ICanvasDocument;
    currentRevision: ICanvasRevision | null;
    activeCandidate: ICanvasCandidate | null;
  } | null>;
  listCanvasDocuments: (userId: string, conversationId?: string) => Promise<ICanvasDocument[]>;
  updateCanvasDocument: (
    input: UpdateCanvasDocumentInput,
  ) => Promise<{ document: ICanvasDocument; revision: ICanvasRevision }>;
  listCanvasRevisions: (userId: string, documentId: string) => Promise<ICanvasRevision[]>;
  restoreCanvasRevision: (
    userId: string,
    documentId: string,
    revisionId: string,
  ) => Promise<{ document: ICanvasDocument; revision: ICanvasRevision }>;
  createCanvasCandidate: (input: CreateCanvasCandidateInput) => Promise<ICanvasCandidate>;
  getCanvasCandidate: (userId: string, candidateId: string) => Promise<ICanvasCandidate | null>;
  resolveCanvasCandidate: (
    userId: string,
    candidateId: string,
    decision: 'accept' | 'reject',
  ) => Promise<{
    candidate: ICanvasCandidate;
    revision?: ICanvasRevision;
    document?: ICanvasDocument;
  }>;
};

function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createCanvasMethods(mongoose: typeof import('mongoose')): CanvasMethods {
  const getCanvasDocument = () => mongoose.models.CanvasDocument as Model<ICanvasDocumentDocument>;
  const getCanvasRevision = () => mongoose.models.CanvasRevision as Model<ICanvasRevisionDocument>;
  const getCanvasCandidate = () =>
    mongoose.models.CanvasCandidate as Model<ICanvasCandidateDocument>;

  return {
    async createCanvasDocument(input: CreateCanvasDocumentInput) {
      const CanvasDocument = getCanvasDocument();
      const CanvasRevision = getCanvasRevision();
      const {
        userId,
        conversationId,
        title,
        docType = 'markdown',
        language = 'markdown',
        initialContent,
        provenance = 'user_create',
        patchSummary,
      } = input;

      const userObjectId = new mongoose.Types.ObjectId(userId);
      const contentHash = computeSha256(initialContent);
      const byteSize = Buffer.byteLength(initialContent, 'utf8');

      const doc = new CanvasDocument({
        userId: userObjectId,
        conversationId,
        title: title.trim(),
        docType,
        language,
      });

      const revision = new CanvasRevision({
        documentId: doc._id,
        userId: userObjectId,
        content: initialContent,
        contentHash,
        byteSize,
        provenance,
        patchSummary,
      });

      await revision.save();
      doc.currentRevisionId = revision._id;
      await doc.save();

      return {
        document: doc.toObject() as ICanvasDocument,
        revision: revision.toObject() as ICanvasRevision,
      };
    },

    async getCanvasDocument(userId: string, documentId: string) {
      const CanvasDocument = getCanvasDocument();
      const CanvasRevision = getCanvasRevision();
      const CanvasCandidate = getCanvasCandidate();

      if (!isValidObjectIdString(documentId)) {
        return null;
      }

      const doc = await CanvasDocument.findOne({
        _id: new mongoose.Types.ObjectId(documentId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!doc) {
        return null;
      }

      let currentRevision: ICanvasRevision | null = null;
      if (doc.currentRevisionId) {
        const rev = await CanvasRevision.findOne({
          _id: doc.currentRevisionId,
          userId: new mongoose.Types.ObjectId(userId),
        });
        if (rev) {
          currentRevision = rev.toObject() as ICanvasRevision;
        }
      }

      const candidate = await CanvasCandidate.findOne({
        documentId: doc._id,
        userId: new mongoose.Types.ObjectId(userId),
        status: 'pending',
      }).sort({ createdAt: -1 });

      return {
        document: doc.toObject() as ICanvasDocument,
        currentRevision,
        activeCandidate: candidate ? (candidate.toObject() as ICanvasCandidate) : null,
      };
    },

    async listCanvasDocuments(userId: string, conversationId?: string) {
      const CanvasDocument = getCanvasDocument();
      const query: Record<string, unknown> = {
        userId: new mongoose.Types.ObjectId(userId),
      };

      if (conversationId) {
        query.conversationId = conversationId;
      }

      const docs = await CanvasDocument.find(query).sort({ updatedAt: -1 });
      return docs.map((d) => d.toObject() as ICanvasDocument);
    },

    async updateCanvasDocument(input: UpdateCanvasDocumentInput) {
      const CanvasDocument = getCanvasDocument();
      const CanvasRevision = getCanvasRevision();
      const {
        userId,
        documentId,
        content,
        baseRevisionId,
        provenance = 'user_edit',
        patchSummary,
      } = input;

      if (!isValidObjectIdString(documentId)) {
        throw new CanvasNotFoundError();
      }

      const doc = await CanvasDocument.findOne({
        _id: new mongoose.Types.ObjectId(documentId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!doc) {
        throw new CanvasNotFoundError();
      }

      // Concurrency check if baseRevisionId was specified
      if (
        baseRevisionId &&
        doc.currentRevisionId &&
        baseRevisionId !== doc.currentRevisionId.toString()
      ) {
        const currentRev = await CanvasRevision.findById(doc.currentRevisionId);
        throw new CanvasConflictError(
          'Document has been modified by another edit',
          doc.currentRevisionId.toString(),
          currentRev?.content || '',
        );
      }

      const contentHash = computeSha256(content);
      const byteSize = Buffer.byteLength(content, 'utf8');

      const newRevision = new CanvasRevision({
        documentId: doc._id,
        userId: new mongoose.Types.ObjectId(userId),
        parentRevisionId: doc.currentRevisionId,
        content,
        contentHash,
        byteSize,
        provenance,
        patchSummary,
      });

      await newRevision.save();

      doc.currentRevisionId = newRevision._id;
      doc.updatedAt = new Date();
      await doc.save();

      return {
        document: doc.toObject() as ICanvasDocument,
        revision: newRevision.toObject() as ICanvasRevision,
      };
    },

    async listCanvasRevisions(userId: string, documentId: string) {
      const CanvasRevision = getCanvasRevision();
      if (!isValidObjectIdString(documentId)) {
        return [];
      }

      const revisions = await CanvasRevision.find({
        documentId: new mongoose.Types.ObjectId(documentId),
        userId: new mongoose.Types.ObjectId(userId),
      }).sort({ createdAt: -1 });

      return revisions.map((r) => r.toObject() as ICanvasRevision);
    },

    async restoreCanvasRevision(userId: string, documentId: string, revisionId: string) {
      const CanvasDocument = getCanvasDocument();
      const CanvasRevision = getCanvasRevision();
      if (!isValidObjectIdString(documentId) || !isValidObjectIdString(revisionId)) {
        throw new CanvasNotFoundError();
      }

      const doc = await CanvasDocument.findOne({
        _id: new mongoose.Types.ObjectId(documentId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!doc) {
        throw new CanvasNotFoundError();
      }

      const targetRev = await CanvasRevision.findOne({
        _id: new mongoose.Types.ObjectId(revisionId),
        documentId: doc._id,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!targetRev) {
        throw new CanvasNotFoundError('Target revision not found');
      }

      const restoredRev = new CanvasRevision({
        documentId: doc._id,
        userId: new mongoose.Types.ObjectId(userId),
        parentRevisionId: doc.currentRevisionId,
        content: targetRev.content,
        contentHash: targetRev.contentHash,
        byteSize: targetRev.byteSize,
        provenance: 'restore',
        patchSummary: `Restored to revision from ${targetRev.createdAt.toISOString()}`,
      });

      await restoredRev.save();
      doc.currentRevisionId = restoredRev._id;
      doc.updatedAt = new Date();
      await doc.save();

      return {
        document: doc.toObject() as ICanvasDocument,
        revision: restoredRev.toObject() as ICanvasRevision,
      };
    },

    async createCanvasCandidate(input: CreateCanvasCandidateInput) {
      const CanvasDocument = getCanvasDocument();
      const CanvasCandidate = getCanvasCandidate();
      const {
        userId,
        conversationId,
        documentId,
        messageId,
        prompt,
        proposedContent,
        patchSummary,
      } = input;

      if (!isValidObjectIdString(documentId)) {
        throw new CanvasNotFoundError();
      }

      const doc = await CanvasDocument.findOne({
        _id: new mongoose.Types.ObjectId(documentId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!doc) {
        throw new CanvasNotFoundError();
      }

      if (!doc.currentRevisionId) {
        throw new CanvasNotFoundError('Document has no base revision');
      }

      const candidate = new CanvasCandidate({
        documentId: doc._id,
        userId: new mongoose.Types.ObjectId(userId),
        conversationId,
        messageId,
        baseRevisionId: doc.currentRevisionId,
        status: 'pending',
        prompt,
        proposedContent,
        patchSummary,
      });

      await candidate.save();
      return candidate.toObject() as ICanvasCandidate;
    },

    async getCanvasCandidate(userId: string, candidateId: string) {
      const CanvasCandidate = getCanvasCandidate();
      if (!isValidObjectIdString(candidateId)) {
        return null;
      }

      const candidate = await CanvasCandidate.findOne({
        _id: new mongoose.Types.ObjectId(candidateId),
        userId: new mongoose.Types.ObjectId(userId),
      });

      return candidate ? (candidate.toObject() as ICanvasCandidate) : null;
    },

    async resolveCanvasCandidate(
      userId: string,
      candidateId: string,
      decision: 'accept' | 'reject',
    ) {
      const CanvasDocument = getCanvasDocument();
      const CanvasRevision = getCanvasRevision();
      const CanvasCandidate = getCanvasCandidate();

      if (!isValidObjectIdString(candidateId)) {
        throw new CanvasCandidateNotFoundError();
      }

      const candidate = await CanvasCandidate.findOne({
        _id: new mongoose.Types.ObjectId(candidateId),
        userId: new mongoose.Types.ObjectId(userId),
        status: 'pending',
      });

      if (!candidate) {
        throw new CanvasCandidateNotFoundError();
      }

      candidate.status = decision === 'accept' ? 'accepted' : 'rejected';
      candidate.resolvedAt = new Date();
      await candidate.save();

      if (decision === 'reject') {
        return {
          candidate: candidate.toObject() as ICanvasCandidate,
        };
      }

      // If accepted, update target document with candidate content
      const doc = await CanvasDocument.findOne({
        _id: candidate.documentId,
        userId: new mongoose.Types.ObjectId(userId),
      });

      if (!doc) {
        throw new CanvasNotFoundError();
      }

      const contentHash = computeSha256(candidate.proposedContent);
      const byteSize = Buffer.byteLength(candidate.proposedContent, 'utf8');

      const newRevision = new CanvasRevision({
        documentId: doc._id,
        userId: new mongoose.Types.ObjectId(userId),
        parentRevisionId: doc.currentRevisionId,
        content: candidate.proposedContent,
        contentHash,
        byteSize,
        provenance: 'ai_accept',
        patchSummary: candidate.patchSummary || 'Accepted AI proposal',
      });

      await newRevision.save();
      doc.currentRevisionId = newRevision._id;
      doc.updatedAt = new Date();
      await doc.save();

      return {
        candidate: candidate.toObject() as ICanvasCandidate,
        revision: newRevision.toObject() as ICanvasRevision,
        document: doc.toObject() as ICanvasDocument,
      };
    },
  };
}
