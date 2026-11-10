import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createCanvasMethods, CanvasConflictError } from './canvas';
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

describe('Canvas Methods Database Service', () => {
  const canvas = createCanvasMethods(mongoose);
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();

  it('creates and lists canvas documents isolated by user', async () => {
    const { document: docA, revision: revA } = await canvas.createCanvasDocument({
      userId: userA,
      conversationId: 'convo-abc',
      title: 'Report.md',
      docType: 'markdown',
      initialContent: '# Family Financial Report',
    });

    expect(docA.title).toBe('Report.md');
    expect(revA.content).toBe('# Family Financial Report');
    expect(revA.provenance).toBe('user_create');

    // List for userA
    const listA = await canvas.listCanvasDocuments(userA, 'convo-abc');
    expect(listA.length).toBe(1);
    expect(listA[0]._id?.toString()).toBe(docA._id?.toString());

    // List for userB - must be empty
    const listB = await canvas.listCanvasDocuments(userB, 'convo-abc');
    expect(listB.length).toBe(0);
  });

  it('updates document with revision history and detects conflicts', async () => {
    const { document: doc, revision: rev1 } = await canvas.createCanvasDocument({
      userId: userA,
      conversationId: 'convo-xyz',
      title: 'Shopping List',
      initialContent: '1. Apples',
    });

    // Update with correct baseRevisionId
    const { revision: rev2 } = await canvas.updateCanvasDocument({
      userId: userA,
      documentId: doc._id!.toString(),
      content: '1. Apples\n2. Bananas',
      baseRevisionId: rev1._id!.toString(),
      patchSummary: 'Added bananas',
    });

    expect(rev2.content).toBe('1. Apples\n2. Bananas');
    expect(rev2.provenance).toBe('user_edit');

    // Revisions list
    const revisions = await canvas.listCanvasRevisions(userA, doc._id!.toString());
    expect(revisions.length).toBe(2);

    // Stale baseRevisionId should throw CanvasConflictError
    await expect(
      canvas.updateCanvasDocument({
        userId: userA,
        documentId: doc._id!.toString(),
        content: '1. Apples\n2. Oranges',
        baseRevisionId: rev1._id!.toString(), // Stale!
      }),
    ).rejects.toThrow(CanvasConflictError);
  });

  it('restores previous revision', async () => {
    const { document: doc, revision: rev1 } = await canvas.createCanvasDocument({
      userId: userA,
      conversationId: 'convo-restore',
      title: 'Recipe',
      initialContent: 'Sugar and salt',
    });

    await canvas.updateCanvasDocument({
      userId: userA,
      documentId: doc._id!.toString(),
      content: 'Too much pepper',
      baseRevisionId: rev1._id!.toString(),
    });

    // Restore rev1
    const { revision: restoredRev, document: restoredDoc } = await canvas.restoreCanvasRevision(
      userA,
      doc._id!.toString(),
      rev1._id!.toString(),
    );

    expect(restoredRev.content).toBe('Sugar and salt');
    expect(restoredRev.provenance).toBe('restore');
    expect(restoredDoc.currentRevisionId?.toString()).toBe(restoredRev._id?.toString());
  });

  it('handles candidate proposal accept and reject flow', async () => {
    const { document: doc } = await canvas.createCanvasDocument({
      userId: userA,
      conversationId: 'convo-cand',
      title: 'AI Script',
      docType: 'code',
      language: 'python',
      initialContent: 'def main():\n    pass',
    });

    const candidate = await canvas.createCanvasCandidate({
      userId: userA,
      conversationId: 'convo-cand',
      documentId: doc._id!.toString(),
      prompt: 'Implement main function',
      proposedContent: 'def main():\n    print("Hello world")',
      patchSummary: 'Added print statement',
    });

    expect(candidate.status).toBe('pending');

    // Reject candidate test
    const rejected = await canvas.resolveCanvasCandidate(
      userA,
      candidate._id!.toString(),
      'reject',
    );
    expect(rejected.candidate.status).toBe('rejected');

    // Create another candidate and accept
    const candidate2 = await canvas.createCanvasCandidate({
      userId: userA,
      conversationId: 'convo-cand',
      documentId: doc._id!.toString(),
      prompt: 'Implement main function again',
      proposedContent: 'def main():\n    print("Accepted")',
    });

    const accepted = await canvas.resolveCanvasCandidate(
      userA,
      candidate2._id!.toString(),
      'accept',
    );
    expect(accepted.candidate.status).toBe('accepted');
    expect(accepted.revision?.content).toBe('def main():\n    print("Accepted")');
    expect(accepted.revision?.provenance).toBe('ai_accept');
    expect(accepted.document?.currentRevisionId?.toString()).toBe(
      accepted.revision?._id?.toString(),
    );
  });
});
