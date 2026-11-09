import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '../models';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  Object.assign(mongoose.models, createModels(mongoose));
  await mongoose.connect(server.getUri());
  await Promise.all(
    ['CanvasDocument', 'CanvasRevision', 'CanvasCandidate'].map((name) =>
      mongoose.models[name].createIndexes(),
    ),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

describe('Canvas Data Schemas and Multi-User Isolation', () => {
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();

  it('creates and retrieves a Canvas document isolated by userId', async () => {
    const CanvasDocument = mongoose.models.CanvasDocument;
    const CanvasRevision = mongoose.models.CanvasRevision;

    const docA = await CanvasDocument.create({
      userId: userA,
      conversationId: 'convo-123',
      title: 'Scraper Script',
      docType: 'code',
      language: 'python',
    });

    const revA = await CanvasRevision.create({
      documentId: docA._id,
      userId: userA,
      content: 'print("hello user A")',
      contentHash: 'hash-a',
      byteSize: 22,
      provenance: 'user_create',
      patchSummary: 'Initial script',
    });

    docA.currentRevisionId = revA._id;
    await docA.save();

    // Query as User A - should find docA
    const foundA = await CanvasDocument.findOne({
      _id: docA._id,
      userId: userA,
    });
    expect(foundA).not.toBeNull();
    expect(foundA?.title).toBe('Scraper Script');

    // Query as User B - should be null (isolation guarantee)
    const foundB = await CanvasDocument.findOne({
      _id: docA._id,
      userId: userB,
    });
    expect(foundB).toBeNull();
  });

  it('manages candidate proposals and transitions status', async () => {
    const CanvasDocument = mongoose.models.CanvasDocument;
    const CanvasRevision = mongoose.models.CanvasRevision;
    const CanvasCandidate = mongoose.models.CanvasCandidate;

    const doc = await CanvasDocument.create({
      userId: userA,
      conversationId: 'convo-456',
      title: 'Roadmap',
      docType: 'markdown',
    });

    const baseRev = await CanvasRevision.create({
      documentId: doc._id,
      userId: userA,
      content: '# Roadmap v1',
      contentHash: 'hash-v1',
      byteSize: 12,
      provenance: 'user_create',
    });

    const candidate = await CanvasCandidate.create({
      documentId: doc._id,
      userId: userA,
      conversationId: 'convo-456',
      baseRevisionId: baseRev._id,
      status: 'pending',
      prompt: 'Add Q2 goals',
      proposedContent: '# Roadmap v1\n- Q2 Goals',
      patchSummary: 'Added Q2 milestones',
    });

    expect(candidate.status).toBe('pending');

    // Accept candidate
    candidate.status = 'accepted';
    candidate.resolvedAt = new Date();
    await candidate.save();

    const updatedCandidate = await CanvasCandidate.findById(candidate._id);
    expect(updatedCandidate?.status).toBe('accepted');
    expect(updatedCandidate?.resolvedAt).toBeDefined();
  });
});
