import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dataService } from 'librechat-data-provider';
import { ZoomIn, ZoomOut, Maximize2, Plus, Trash2, Check, X } from 'lucide-react';
import type { VisualBoardNode, VisualBoardEdge } from './mindmap-layout';
import { MINDMAP_COLORS } from './mindmap-layout';
import { useLocalize } from '~/hooks';

export interface VisualBoardData {
  _id?: string;
  title: string;
  rootTopic: string;
  orientation?: 'horizontal' | 'vertical';
  currentRevisionId?: string;
}

export interface VisualBoardEditorProps {
  boardId: string;
  onClose?: () => void;
}

interface ActiveBoardCandidate {
  _id: string;
  patchSummary?: string;
  status: string;
  proposedNodes?: VisualBoardNode[];
  proposedEdges?: VisualBoardEdge[];
}

export function VisualBoardEditor({ boardId, onClose: _onClose }: VisualBoardEditorProps) {
  const localize = useLocalize();
  const [board, setBoard] = useState<VisualBoardData | null>(null);
  const [nodes, setNodes] = useState<VisualBoardNode[]>([]);
  const [edges, setEdges] = useState<VisualBoardEdge[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<ActiveBoardCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  // Canvas pan & zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 120 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Selected node for inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Dragging node state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch board data
  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dataService.getCanvasBoard(boardId);
      setBoard(data.board);
      setNodes(
        (data.currentRevision?.nodes ?? []).map((node) => ({
          ...node,
          x: node.x ?? 0,
          y: node.y ?? 0,
        })),
      );
      setEdges(data.currentRevision?.edges ?? []);
      setActiveCandidate(
        data.activeCandidate
          ? {
              ...data.activeCandidate,
              proposedNodes: data.activeCandidate.proposedNodes?.map((node) => ({
                ...node,
                x: node.x ?? 0,
                y: node.y ?? 0,
              })),
            }
          : null,
      );
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Debounced auto-save on node change
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveBoard = useCallback(
    async (updatedNodes: VisualBoardNode[], updatedEdges: VisualBoardEdge[]) => {
      if (!board) return;
      try {
        setSaveStatus('saving');
        const data = await dataService.updateCanvasBoard(boardId, {
          nodes: updatedNodes,
          edges: updatedEdges,
          baseRevisionId: board.currentRevisionId,
        });
        setBoard(data.board);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [board, boardId],
  );

  const queueSave = (newNodes: VisualBoardNode[], newEdges: VisualBoardEdge[]) => {
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveBoard(newNodes, newEdges);
    }, 1200);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
  const handleFitScreen = () => {
    setZoom(1);
    setPan({ x: 80, y: 120 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-node')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    } else if (draggedNodeId) {
      const newX = (e.clientX - pan.x) / zoom - dragOffsetRef.current.x;
      const newY = (e.clientY - pan.y) / zoom - dragOffsetRef.current.y;
      setNodes((prev) => {
        const next = prev.map((n) =>
          n.id === draggedNodeId ? { ...n, x: Math.round(newX), y: Math.round(newY) } : n,
        );
        queueSave(next, edges);
        return next;
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Drag node start
  const handleNodeDragStart = (e: React.MouseEvent, node: VisualBoardNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggedNodeId(node.id);
    dragOffsetRef.current = {
      x: (e.clientX - pan.x) / zoom - node.x,
      y: (e.clientY - pan.y) / zoom - node.y,
    };
  };

  // Add child node
  const handleAddChild = () => {
    if (!selectedNodeId) return;
    const parent = nodes.find((n) => n.id === selectedNodeId);
    if (!parent) return;

    const newId = `node_${Date.now().toString(36)}`;
    const newNode: VisualBoardNode = {
      id: newId,
      label: 'New Topic',
      content: '',
      color: parent.color || MINDMAP_COLORS[1],
      x: parent.x + 220,
      y: parent.y + 40,
      width: 180,
      height: 80,
    };
    const newEdge: VisualBoardEdge = {
      id: `edge_${parent.id}_${newId}`,
      source: parent.id,
      target: newId,
    };

    const nextNodes = [...nodes, newNode];
    const nextEdges = [...edges, newEdge];
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(newId);
    queueSave(nextNodes, nextEdges);
  };

  // Delete selected node
  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const nextEdges = edges.filter(
      (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(null);
    queueSave(nextNodes, nextEdges);
  };

  // Candidate proposal resolution
  const handleResolveCandidate = async (action: 'accept' | 'reject') => {
    if (!activeCandidate) return;
    try {
      await dataService.resolveCanvasBoardCandidate(boardId, activeCandidate._id, action);
      fetchBoard();
    } catch {
      // ignore
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (loading) {
    return (
      <div className="text-text-secondary flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{localize('com_ui_loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-surface-primary relative flex h-full flex-col overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Board Controls Bar */}
      <div className="border-border-light bg-surface-secondary/70 absolute top-3 left-3 z-20 flex items-center gap-1 rounded-xl border p-1 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={handleZoomIn}
          className="text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleFitScreen}
          className="text-text-secondary hover:text-text-primary rounded-lg p-1.5 transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="size-4" />
        </button>
        <div className="bg-border-light mx-1 h-4 w-px" />
        <span className="text-text-secondary px-1 font-mono text-xs">
          {Math.round(zoom * 100)}%
        </span>
        <div className="bg-border-light mx-1 h-4 w-px" />
        <span className="text-text-secondary text-2xs px-1">
          {(() => {
            if (saveStatus === 'saving') return localize('com_ui_saving');
            if (saveStatus === 'unsaved') return localize('com_ui_unsaved');
            if (saveStatus === 'error') return localize('com_ui_error');
            return localize('com_ui_saved');
          })()}
        </span>
      </div>

      {/* Active AI Candidate Proposal Banner */}
      {activeCandidate && (
        <div className="border-border-light bg-surface-secondary absolute top-3 right-3 z-20 flex items-center gap-3 rounded-xl border p-2.5 shadow-md">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-text-primary font-semibold">
              {localize('com_ui_ai_proposal')}
            </span>
            <span className="text-text-secondary max-w-[200px] truncate">
              {activeCandidate.patchSummary}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleResolveCandidate('accept')}
              className="bg-surface-primary hover:bg-surface-tertiary border-border-light text-text-primary flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors"
            >
              <Check className="text-status-success size-3" />
              <span>{localize('com_ui_canvas_accept')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleResolveCandidate('reject')}
              className="bg-surface-primary hover:bg-surface-tertiary border-border-light text-text-secondary flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors"
            >
              <X className="text-status-error size-3" />
              <span>{localize('com_ui_canvas_reject')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive SVG Canvas */}
      <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing">
        <defs>
          <pattern id="mindmap-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-border-medium/60" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mindmap-grid)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Connector Edges */}
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.source);
            const target = nodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;

            const x1 = source.x + (source.width ?? 180);
            const y1 = source.y + (source.height ?? 80) / 2;
            const x2 = target.x;
            const y2 = target.y + (target.height ?? 80) / 2;
            const mx = (x1 + x2) / 2;

            const pathData = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

            return (
              <path
                key={edge.id}
                d={pathData}
                fill="none"
                stroke={target.color || '#007AFF'}
                strokeWidth="2.5"
                strokeOpacity="0.6"
              />
            );
          })}

          {/* Graph Nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const w = node.width ?? 180;
            const h = node.height ?? 80;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer"
                onMouseDown={(e) => handleNodeDragStart(e, node)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
              >
                {/* Node Box */}
                <rect
                  width={w}
                  height={h}
                  rx="14"
                  className={`border transition-all ${
                    isSelected
                      ? 'stroke-text-primary fill-surface-primary stroke-2 shadow-lg'
                      : 'stroke-border-light fill-surface-secondary/95 hover:stroke-border-medium shadow-sm'
                  }`}
                />

                {/* Left Color Accent Bar */}
                <rect width="6" height={h} rx="3" fill={node.color || '#007AFF'} />

                {/* Node Title Text */}
                <text
                  x="18"
                  y="32"
                  className="fill-text-primary text-xs font-semibold select-none"
                  clipPath={`url(#clip-${node.id})`}
                >
                  {node.label}
                </text>

                {/* Node Content Preview */}
                {node.content && (
                  <text x="18" y="54" className="fill-text-secondary text-2xs italic select-none">
                    {node.content.length > 20 ? `${node.content.slice(0, 20)}...` : node.content}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Selected Node Inspector Flyout */}
      {selectedNode && (
        <div className="border-border-light bg-surface-secondary/95 absolute right-4 bottom-4 z-20 w-72 rounded-2xl border p-4 shadow-xl backdrop-blur-md">
          <div className="border-border-light mb-3 flex items-center justify-between border-b pb-2">
            <span className="text-text-primary text-xs font-semibold">
              {localize('com_ui_inspect_node')}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAddChild}
                className="text-text-secondary hover:text-text-primary rounded-lg p-1 transition-colors"
                title="Add Sub-Branch"
              >
                <Plus className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteNode}
                className="text-text-secondary hover:text-status-error rounded-lg p-1 transition-colors"
                title="Delete Node"
              >
                <Trash2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-text-secondary hover:text-text-primary rounded-lg p-1 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Title Editor */}
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="text-text-secondary text-3xs mb-1 block font-semibold tracking-wider uppercase">
                {localize('com_ui_title')}
              </label>
              <input
                type="text"
                value={selectedNode.label}
                onChange={(e) => {
                  const val = e.target.value;
                  setNodes((prev) => {
                    const next = prev.map((n) =>
                      n.id === selectedNode.id ? { ...n, label: val } : n,
                    );
                    queueSave(next, edges);
                    return next;
                  });
                }}
                className="border-border-light bg-surface-primary text-text-primary focus:border-border-medium w-full rounded-lg border px-2.5 py-1.5 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-text-secondary text-3xs mb-1 block font-semibold tracking-wider uppercase">
                {localize('com_ui_notes')}
              </label>
              <textarea
                value={selectedNode.content || ''}
                rows={2}
                onChange={(e) => {
                  const val = e.target.value;
                  setNodes((prev) => {
                    const next = prev.map((n) =>
                      n.id === selectedNode.id ? { ...n, content: val } : n,
                    );
                    queueSave(next, edges);
                    return next;
                  });
                }}
                className="border-border-light bg-surface-primary text-text-primary focus:border-border-medium w-full rounded-lg border px-2.5 py-1.5 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-text-secondary text-3xs mb-1 block font-semibold tracking-wider uppercase">
                {localize('com_ui_color')}
              </label>
              <div className="flex items-center gap-1.5">
                {MINDMAP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setNodes((prev) => {
                        const next = prev.map((n) =>
                          n.id === selectedNode.id ? { ...n, color } : n,
                        );
                        queueSave(next, edges);
                        return next;
                      });
                    }}
                    className={`size-5 rounded-full transition-transform ${
                      selectedNode.color === color
                        ? 'ring-text-primary scale-110 ring-2 ring-offset-1'
                        : 'opacity-85 hover:scale-105 hover:opacity-100'
                    }`}
                  >
                    <svg className="size-full" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="9" fill={color} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualBoardEditor;
