/**
 * Mind Map and Visual Board Graph Layout Engine.
 *
 * Provides deterministic, collision-free layout for mind maps and concept trees.
 * Default orientation is horizontal tree (left-to-right from root), with support for
 * vertical hierarchy and auto-tidying existing boards.
 */

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 80;
export const DEFAULT_LEVEL_GAP = 90;
export const DEFAULT_NODE_GAP = 28;

export const MINDMAP_COLORS = [
  '#007AFF', // System Blue (Root)
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#5856D6', // Indigo
  '#00C7BE', // Teal
  '#FFCC00', // Yellow
];

export interface VisualBoardNode {
  id: string;
  label: string;
  content?: string;
  color?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface VisualBoardEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface VisualBoardSchema {
  nodes: VisualBoardNode[];
  edges: VisualBoardEdge[];
}

export interface MindMapHierarchyInput {
  id?: string;
  label: string;
  content?: string;
  parentId?: string;
  color?: string;
}

export interface MindMapLayoutOptions {
  orientation?: 'horizontal' | 'vertical';
  startX?: number;
  startY?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  levelGap?: number;
  nodeGap?: number;
}

interface TreeNode {
  id: string;
  label: string;
  content: string;
  color: string;
  children: TreeNode[];
  depth: number;
  subtreeHeight: number;
  subtreeWidth: number;
  x: number;
  y: number;
}

function propagateColor(node: TreeNode, color: string) {
  for (const child of node.children) {
    if (!child.color) {
      child.color = color;
    }
    propagateColor(child, child.color);
  }
}

function computeSubtreeSizes(
  node: TreeNode,
  orientation: 'horizontal' | 'vertical',
  nodeWidth: number,
  nodeHeight: number,
  nodeGap: number,
): void {
  for (const child of node.children) {
    computeSubtreeSizes(child, orientation, nodeWidth, nodeHeight, nodeGap);
  }

  if (node.children.length === 0) {
    node.subtreeHeight = nodeHeight;
    node.subtreeWidth = nodeWidth;
    return;
  }

  if (orientation === 'horizontal') {
    const totalChildHeight = node.children.reduce(
      (sum, c) => sum + c.subtreeHeight + nodeGap,
      -nodeGap,
    );
    const maxChildWidth = Math.max(...node.children.map((c) => c.subtreeWidth));
    node.subtreeHeight = Math.max(nodeHeight, totalChildHeight);
    node.subtreeWidth = nodeWidth + maxChildWidth;
  } else {
    const totalChildWidth = node.children.reduce(
      (sum, c) => sum + c.subtreeWidth + nodeGap,
      -nodeGap,
    );
    const maxChildHeight = Math.max(...node.children.map((c) => c.subtreeHeight));
    node.subtreeWidth = Math.max(nodeWidth, totalChildWidth);
    node.subtreeHeight = nodeHeight + maxChildHeight;
  }
}

function assignHorizontalCoordinates(
  node: TreeNode,
  x: number,
  centerY: number,
  depth: number,
  nodeWidth: number,
  nodeHeight: number,
  levelGap: number,
  nodeGap: number,
): void {
  node.depth = depth;
  node.x = x;
  node.y = centerY - nodeHeight / 2;

  if (node.children.length === 0) return;

  const childX = x + nodeWidth + levelGap;
  const totalHeight = node.subtreeHeight;
  let currentY = centerY - totalHeight / 2;

  for (const child of node.children) {
    const childCenterY = currentY + child.subtreeHeight / 2;
    assignHorizontalCoordinates(
      child,
      childX,
      childCenterY,
      depth + 1,
      nodeWidth,
      nodeHeight,
      levelGap,
      nodeGap,
    );
    currentY += child.subtreeHeight + nodeGap;
  }
}

function assignVerticalCoordinates(
  node: TreeNode,
  centerX: number,
  y: number,
  depth: number,
  nodeWidth: number,
  nodeHeight: number,
  levelGap: number,
  nodeGap: number,
): void {
  node.depth = depth;
  node.x = centerX - nodeWidth / 2;
  node.y = y;

  if (node.children.length === 0) return;

  const childY = y + nodeHeight + levelGap;
  const totalWidth = node.subtreeWidth;
  let currentX = centerX - totalWidth / 2;

  for (const child of node.children) {
    const childCenterX = currentX + child.subtreeWidth / 2;
    assignVerticalCoordinates(
      child,
      childCenterX,
      childY,
      depth + 1,
      nodeWidth,
      nodeHeight,
      levelGap,
      nodeGap,
    );
    currentX += child.subtreeWidth + nodeGap;
  }
}

/**
 * Lays out a hierarchical mind map into a VisualBoardSchema.
 */
export function layoutMindMapTree(
  root: { id?: string; label: string; content?: string; color?: string },
  branches: MindMapHierarchyInput[],
  options: MindMapLayoutOptions = {},
): VisualBoardSchema {
  const orientation = options.orientation || 'horizontal';
  const startX = options.startX ?? 40;
  const startY = options.startY ?? 40;
  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight ?? DEFAULT_NODE_HEIGHT;
  const levelGap = options.levelGap ?? DEFAULT_LEVEL_GAP;
  const nodeGap = options.nodeGap ?? DEFAULT_NODE_GAP;

  const rootId = root.id || `node_root_${Date.now().toString(36)}`;
  const rootColor = root.color || MINDMAP_COLORS[0];

  const resolvedBranches = branches.map((b, i) => ({
    ...b,
    id: b.id || `node_${i + 1}_${Date.now().toString(36)}`,
  }));

  const nodeMap = new Map<string, TreeNode>();

  const rootTreeNode: TreeNode = {
    id: rootId,
    label: root.label || 'Central Idea',
    content: root.content || '',
    color: rootColor,
    children: [],
    depth: 0,
    subtreeHeight: nodeHeight,
    subtreeWidth: nodeWidth,
    x: 0,
    y: 0,
  };
  nodeMap.set(rootId, rootTreeNode);

  let branchColorIdx = 1;

  for (let i = 0; i < resolvedBranches.length; i++) {
    const b = resolvedBranches[i];
    const treeNode: TreeNode = {
      id: b.id,
      label: b.label || `Branch ${i + 1}`,
      content: b.content || '',
      color: b.color || '',
      children: [],
      depth: 0,
      subtreeHeight: nodeHeight,
      subtreeWidth: nodeWidth,
      x: 0,
      y: 0,
    };
    nodeMap.set(b.id, treeNode);
  }

  for (const b of resolvedBranches) {
    const node = nodeMap.get(b.id);
    if (!node) continue;
    const parentId = b.parentId && nodeMap.has(b.parentId) ? b.parentId : rootId;
    const parent = nodeMap.get(parentId);
    if (parent) {
      parent.children.push(node);
    }
  }

  for (const child of rootTreeNode.children) {
    if (!child.color) {
      child.color = MINDMAP_COLORS[branchColorIdx % MINDMAP_COLORS.length];
      branchColorIdx++;
    }
    propagateColor(child, child.color);
  }

  computeSubtreeSizes(rootTreeNode, orientation, nodeWidth, nodeHeight, nodeGap);

  if (orientation === 'horizontal') {
    assignHorizontalCoordinates(
      rootTreeNode,
      startX,
      startY,
      0,
      nodeWidth,
      nodeHeight,
      levelGap,
      nodeGap,
    );
  } else {
    assignVerticalCoordinates(
      rootTreeNode,
      startX,
      startY,
      0,
      nodeWidth,
      nodeHeight,
      levelGap,
      nodeGap,
    );
  }

  const nodes: VisualBoardNode[] = [];
  const edges: VisualBoardEdge[] = [];

  function collect(current: TreeNode) {
    nodes.push({
      id: current.id,
      label: current.label,
      content: current.content,
      x: Math.round(current.x),
      y: Math.round(current.y),
      width: nodeWidth,
      height: nodeHeight,
      color: current.color,
    });

    for (const child of current.children) {
      edges.push({
        id: `edge_${current.id}_${child.id}`,
        source: current.id,
        target: child.id,
      });
      collect(child);
    }
  }

  collect(rootTreeNode);

  return { nodes, edges };
}
