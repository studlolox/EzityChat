import { z } from 'zod';
import { tool } from '@librechat/agents/langchain/tools';
import type { DynamicStructuredTool } from '@librechat/agents/langchain/tools';
import type { CanvasMethods } from '@librechat/data-schemas';

export const CANVAS_TOOL_NAMES = {
  CREATE_CANVAS_DOCUMENT: 'create_canvas_document',
  READ_CANVAS_DOCUMENT: 'read_canvas_document',
  PROPOSE_CANVAS_EDIT: 'propose_canvas_edit',
} as const;

export type CanvasToolName = (typeof CANVAS_TOOL_NAMES)[keyof typeof CANVAS_TOOL_NAMES];

export interface CanvasToolDatabaseMethods {
  createCanvasDocument: CanvasMethods['createCanvasDocument'];
  getCanvasDocument: CanvasMethods['getCanvasDocument'];
  createCanvasCandidate: CanvasMethods['createCanvasCandidate'];
}

export interface CanvasToolOptions {
  userId: string;
  conversationId?: string;
  db: CanvasToolDatabaseMethods;
}

const createDocumentSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(256)
    .describe("Document title (e.g. 'Project Roadmap.md', 'scraper.py')"),
  content: z.string().describe('Full initial content of the document'),
  docType: z
    .enum(['markdown', 'code'])
    .default('markdown')
    .describe("Document type: 'markdown' or 'code'"),
  language: z
    .string()
    .max(64)
    .optional()
    .describe("Programming language if docType is code (e.g. 'python', 'typescript')"),
});

const readDocumentSchema = z.object({
  documentId: z.string().min(1).describe('ID of the target Canvas document to read'),
});

const proposeEditSchema = z.object({
  documentId: z.string().min(1).describe('ID of the target Canvas document to edit'),
  patchSummary: z
    .string()
    .min(1)
    .max(500)
    .describe("Brief description of changes (e.g. 'Add error handling to fetch loop')"),
  proposedContent: z
    .string()
    .describe('The complete updated content of the document with changes applied'),
});

/**
 * Creates the `create_canvas_document` tool.
 */
export function createCreateCanvasDocumentTool({
  userId,
  conversationId = '',
  db,
}: CanvasToolOptions): DynamicStructuredTool {
  return tool(
    async ({ title, content, docType, language }) => {
      try {
        const result = await db.createCanvasDocument({
          userId,
          conversationId,
          title,
          docType: docType ?? 'markdown',
          language,
          initialContent: content,
        });

        return JSON.stringify({
          success: true,
          documentId: String(result.document._id),
          title: result.document.title,
          docType: result.document.docType,
          language: result.document.language,
          message: `Canvas document "${result.document.title}" created successfully. It is now open in the Canvas panel for the user.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: `Failed to create Canvas document: ${message}`,
        });
      }
    },
    {
      name: CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT,
      description:
        'Creates a new editable document or code file in the Canvas workspace. Proactively use this when drafting or revising substantial content (>20 lines).',
      schema: createDocumentSchema,
    },
  );
}

/**
 * Creates the `read_canvas_document` tool.
 */
export function createReadCanvasDocumentTool({
  userId,
  db,
}: Pick<CanvasToolOptions, 'userId' | 'db'>): DynamicStructuredTool {
  return tool(
    async ({ documentId }) => {
      try {
        const result = await db.getCanvasDocument(userId, documentId);
        if (!result) {
          throw new Error(`Document not found: ${documentId}`);
        }

        return JSON.stringify({
          success: true,
          documentId: String(result.document._id),
          title: result.document.title,
          docType: result.document.docType,
          language: result.document.language,
          content: result.currentRevision?.content ?? '',
          activeCandidate: result.activeCandidate
            ? {
                candidateId: String(result.activeCandidate._id),
                patchSummary: result.activeCandidate.patchSummary,
                status: result.activeCandidate.status,
              }
            : null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: `Failed to read Canvas document: ${message}`,
        });
      }
    },
    {
      name: CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT,
      description: 'Reads the current revision content of a Canvas document.',
      schema: readDocumentSchema,
    },
  );
}

/**
 * Creates the `propose_canvas_edit` tool.
 */
export function createProposeCanvasEditTool({
  userId,
  conversationId = '',
  db,
}: CanvasToolOptions): DynamicStructuredTool {
  return tool(
    async ({ documentId, patchSummary, proposedContent }) => {
      try {
        const candidate = await db.createCanvasCandidate({
          userId,
          conversationId,
          documentId,
          prompt: patchSummary,
          proposedContent,
          patchSummary,
        });

        return JSON.stringify({
          success: true,
          candidateId: String(candidate._id),
          documentId: String(candidate.documentId),
          patchSummary: candidate.patchSummary,
          message: `Edit proposal created successfully. The user is now presented with a side-by-side diff review in the Canvas panel to accept or reject the proposal.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: `Failed to propose Canvas edit: ${message}`,
        });
      }
    },
    {
      name: CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT,
      description:
        'Proposes a non-destructive edit to an existing Canvas document. The user will review the side-by-side diff and accept or reject the proposal.',
      schema: proposeEditSchema,
    },
  );
}

/**
 * Factory for creating all Canvas tools or an individual tool by name.
 */
export function createCanvasTool(
  toolName: string,
  options: CanvasToolOptions,
): DynamicStructuredTool | null {
  if (toolName === CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT) {
    return createCreateCanvasDocumentTool(options);
  }
  if (toolName === CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT) {
    return createReadCanvasDocumentTool(options);
  }
  if (toolName === CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT) {
    return createProposeCanvasEditTool(options);
  }
  return null;
}

/**
 * Creates an array containing all three Canvas tools.
 */
export function createCanvasTools(options: CanvasToolOptions): DynamicStructuredTool[] {
  return [
    createCreateCanvasDocumentTool(options),
    createReadCanvasDocumentTool(options),
    createProposeCanvasEditTool(options),
  ];
}
