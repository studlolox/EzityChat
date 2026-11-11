import { z } from 'zod';
import { tool } from '@librechat/agents/langchain/tools';
import type { CanvasBoardMethods, BoardNode, BoardEdge } from '@librechat/data-schemas';
import type { DynamicStructuredTool } from '@librechat/agents/langchain/tools';

export const CANVAS_BOARD_TOOL_NAMES = {
  CREATE_MINDMAP_BOARD: 'create_mindmap_board',
  READ_MINDMAP_BOARD: 'read_mindmap_board',
  PROPOSE_BOARD_EDIT: 'propose_board_edit',
} as const;

export interface CanvasBoardToolDatabaseMethods {
  createCanvasBoard: CanvasBoardMethods['createCanvasBoard'];
  getCanvasBoard: CanvasBoardMethods['getCanvasBoard'];
  createCanvasBoardCandidate: CanvasBoardMethods['createCanvasBoardCandidate'];
}

export interface CanvasBoardToolOptions {
  userId: string;
  conversationId?: string;
  db: CanvasBoardToolDatabaseMethods;
}

const branchSchema = z.object({
  id: z.string().optional().describe('Unique node ID (optional, auto-generated if omitted)'),
  label: z.string().min(1).describe('Node title/topic'),
  content: z.string().optional().describe('Optional notes or details for the branch node'),
  parentId: z
    .string()
    .optional()
    .describe('Parent node ID to attach to. Omit to attach directly to the rootTopic.'),
  color: z
    .string()
    .optional()
    .describe('Optional hex color theme for the node (e.g. #007AFF, #34C759, #FF9500)'),
});

export const createMindmapBoardSchema = z.object({
  rootTopic: z.string().min(1).describe('Central topic of the mindmap'),
  branches: z
    .array(branchSchema)
    .min(1)
    .describe('List of hierarchical branches radiating from root or sub-branches'),
  orientation: z
    .enum(['horizontal', 'vertical'])
    .default('horizontal')
    .describe("Layout orientation: 'horizontal' (left-to-right) or 'vertical' (top-to-bottom)"),
});

export const readMindmapBoardSchema = z.object({
  boardId: z.string().min(1).describe('ID of the target Canvas Board to read'),
});

export const proposeBoardEditSchema = z.object({
  boardId: z.string().min(1).describe('ID of the target Canvas Board to edit'),
  patchSummary: z
    .string()
    .min(1)
    .max(500)
    .describe("Brief description of changes (e.g. 'Add 3 sub-branches under Backend')"),
  branches: z
    .array(branchSchema)
    .min(1)
    .describe('Complete updated list of branches with proposed modifications applied'),
});

const COLOR_PALETTE = [
  '#007AFF', // Blue (Root)
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#5856D6', // Indigo
  '#00C7BE', // Teal
  '#FFCC00', // Yellow
];

function buildGraphFromBranches(
  rootTopic: string,
  branches: Array<{
    id?: string;
    label: string;
    content?: string;
    parentId?: string;
    color?: string;
  }>,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const rootNode: BoardNode = {
    id: 'root',
    label: rootTopic,
    content: '',
    color: '#007AFF',
    x: 0,
    y: 0,
  };

  const nodes: BoardNode[] = [rootNode];
  const edges: BoardEdge[] = [];

  const levelGap = orientation === 'horizontal' ? 240 : 160;
  const nodeGap = orientation === 'horizontal' ? 90 : 180;

  // Track parent -> children map
  const childrenByParent = new Map<string, number>();

  branches.forEach((b, index) => {
    const parentId = b.parentId || 'root';
    const childIndex = childrenByParent.get(parentId) ?? 0;
    childrenByParent.set(parentId, childIndex + 1);

    const nodeId = b.id || `node-${index + 1}`;
    const color = b.color || COLOR_PALETTE[(index % (COLOR_PALETTE.length - 1)) + 1];

    let x = 0;
    let y = 0;

    if (parentId === 'root') {
      const offset =
        (childIndex -
          (branches.filter((x) => !x.parentId || x.parentId === 'root').length - 1) / 2) *
        nodeGap;
      if (orientation === 'horizontal') {
        x = levelGap;
        y = offset;
      } else {
        x = offset;
        y = levelGap;
      }
    } else {
      if (orientation === 'horizontal') {
        x = levelGap * 2;
        y = childIndex * nodeGap;
      } else {
        x = childIndex * nodeGap;
        y = levelGap * 2;
      }
    }

    nodes.push({
      id: nodeId,
      label: b.label,
      content: b.content,
      color,
      x,
      y,
    });

    edges.push({
      id: `edge-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
    });
  });

  return { nodes, edges };
}

/**
 * Creates the `create_mindmap_board` tool.
 */
export function createCreateMindmapBoardTool({
  userId,
  conversationId,
  db,
}: CanvasBoardToolOptions): DynamicStructuredTool {
  return tool(
    async ({ rootTopic, branches, orientation }) => {
      try {
        const { nodes, edges } = buildGraphFromBranches(rootTopic, branches, orientation);

        const result = await db.createCanvasBoard({
          userId,
          conversationId: conversationId || 'default',
          title: rootTopic,
          rootTopic,
          orientation: orientation ?? 'horizontal',
          nodes,
          edges,
        });

        return JSON.stringify({
          success: true,
          boardId: String(result.board._id),
          title: result.board.title,
          rootTopic: result.board.rootTopic,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          message: `Mindmap board "${result.board.title}" created successfully with ${nodes.length} nodes. It is now open in the Canvas workspace.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: `Failed to create mindmap board: ${message}`,
        });
      }
    },
    {
      name: CANVAS_BOARD_TOOL_NAMES.CREATE_MINDMAP_BOARD,
      description:
        'Creates an interactive hierarchical mindmap board in the Canvas workspace. Use this when the user requests a mindmap, concept tree, brainstorming map, or structural diagram.',
      schema: createMindmapBoardSchema,
    },
  );
}

/**
 * Creates the `read_mindmap_board` tool.
 */
export function createReadMindmapBoardTool({
  userId,
  db,
}: Pick<CanvasBoardToolOptions, 'userId' | 'db'>): DynamicStructuredTool {
  return tool(
    async ({ boardId }) => {
      try {
        const result = await db.getCanvasBoard({
          userId,
          boardId,
        });

        const currentRev = result.currentRevision;

        return JSON.stringify({
          success: true,
          boardId: String(result.board._id),
          title: result.board.title,
          rootTopic: result.board.rootTopic,
          orientation: result.board.orientation,
          nodes: currentRev?.nodes ?? [],
          edges: currentRev?.edges ?? [],
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
          error: `Failed to read mindmap board: ${message}`,
        });
      }
    },
    {
      name: CANVAS_BOARD_TOOL_NAMES.READ_MINDMAP_BOARD,
      description: 'Reads the nodes and edges of an interactive Canvas Mindmap Board.',
      schema: readMindmapBoardSchema,
    },
  );
}

/**
 * Creates the `propose_board_edit` tool.
 */
export function createProposeBoardEditTool({
  userId,
  db,
}: Pick<CanvasBoardToolOptions, 'userId' | 'db'>): DynamicStructuredTool {
  return tool(
    async ({ boardId, patchSummary, branches }) => {
      try {
        const current = await db.getCanvasBoard({ userId, boardId });
        const { nodes, edges } = buildGraphFromBranches(
          current.board.rootTopic,
          branches,
          current.board.orientation,
        );

        const candidate = await db.createCanvasBoardCandidate({
          userId,
          boardId,
          proposedNodes: nodes,
          proposedEdges: edges,
          patchSummary,
        });

        return JSON.stringify({
          success: true,
          candidateId: String(candidate._id),
          boardId: String(candidate.boardId),
          patchSummary: candidate.patchSummary,
          message: `Mindmap edit proposal created successfully. The user is now presented with a visual diff preview in the Canvas workspace to accept or reject.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          success: false,
          error: `Failed to propose board edit: ${message}`,
        });
      }
    },
    {
      name: CANVAS_BOARD_TOOL_NAMES.PROPOSE_BOARD_EDIT,
      description:
        'Proposes a non-destructive edit to an existing Canvas Mindmap Board. The user reviews the proposed visual diff and accepts or rejects.',
      schema: proposeBoardEditSchema,
    },
  );
}

/**
 * Factory for creating visual board tools.
 */
export function createCanvasBoardTool(
  toolName: string,
  options: CanvasBoardToolOptions,
): DynamicStructuredTool | null {
  if (toolName === CANVAS_BOARD_TOOL_NAMES.CREATE_MINDMAP_BOARD) {
    return createCreateMindmapBoardTool(options);
  }
  if (toolName === CANVAS_BOARD_TOOL_NAMES.READ_MINDMAP_BOARD) {
    return createReadMindmapBoardTool(options);
  }
  if (toolName === CANVAS_BOARD_TOOL_NAMES.PROPOSE_BOARD_EDIT) {
    return createProposeBoardEditTool(options);
  }
  return null;
}
