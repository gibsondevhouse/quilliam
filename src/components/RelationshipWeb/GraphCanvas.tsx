"use client";

import { useCallback, useRef } from "react";
import type { GraphEdge, GraphNode } from "./useGraphData";
import { CANVAS_W, CANVAS_H, type SimNode } from "./useForceLayout";

const TYPE_COLOR: Record<string, string> = {
  character: "#9d8fff",
  location: "#4ade80",
  culture: "#fbbf24",
  organization: "#60a5fa",
  system: "#f472b6",
  item: "#fb923c",
  language: "#2dd4bf",
  religion: "#c084fc",
  lineage: "#818cf8",
  economy: "#a3e635",
  rule: "#f87171",
};
const DEFAULT_COLOR = "#6b7280";

function nodeColor(type: string) {
  return TYPE_COLOR[type] ?? DEFAULT_COLOR;
}

function nodeOpacity(canonStatus: string) {
  if (canonStatus === "canon") return 1;
  if (canonStatus === "proposed") return 0.8;
  return 0.6;
}

interface Props {
  simNodes: SimNode[];
  graphNodes: GraphNode[];
  edges: GraphEdge[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  onDragStart: (id: string, svgX: number, svgY: number) => void;
  onDragMove: (svgX: number, svgY: number) => void;
  onDragEnd: () => void;
  isDragging: () => boolean;
}

export function GraphCanvas({
  simNodes, graphNodes, edges, visibleIds, selectedId,
  onSelectNode, onDragStart, onDragMove, onDragEnd, isDragging,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeMap = new Map<string, SimNode>(simNodes.map((n) => [n.id, n]));
  const metaMap = new Map<string, GraphNode>(graphNodes.map((n) => [n.id, n]));

  const toSVG = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging()) {
      e.preventDefault();
      const { x, y } = toSVG(e);
      onDragMove(x, y);
    }
  }, [isDragging, onDragMove, toSVG]);

  const handleMouseUp = useCallback(() => onDragEnd(), [onDragEnd]);

  const handleSVGClick = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current) onSelectNode(null);
  }, [onSelectNode]);

  const visibleEdges = edges.filter(
    (e) => visibleIds.has(e.fromId) && visibleIds.has(e.toId),
  );

  const selectedEdgeIds = selectedId
    ? new Set(visibleEdges.filter((e) => e.fromId === selectedId || e.toId === selectedId).map((e) => e.id))
    : new Set<string>();

  return (
    <svg
      ref={svgRef}
      className="rel-web-canvas"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid meet"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleSVGClick}
    >
      {/* Edge layer */}
      <g className="rel-web-edges">
        {visibleEdges.map((edge) => {
          const a = nodeMap.get(edge.fromId);
          const b = nodeMap.get(edge.toId);
          if (!a || !b) return null;
          const isHighlighted = selectedEdgeIds.has(edge.id);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={edge.id}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHighlighted ? "#7c6fef" : "#2a2a40"}
                strokeWidth={isHighlighted ? 1.5 : 1}
                opacity={isHighlighted ? 1 : 0.5}
              />
              {isHighlighted && (
                <text
                  x={mx} y={my - 4}
                  fontSize="9"
                  fill="#8888a0"
                  textAnchor="middle"
                  dominantBaseline="auto"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {edge.type.replace(/_/g, " ")}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Node layer */}
      <g className="rel-web-nodes">
        {simNodes.filter((n) => visibleIds.has(n.id)).map((simNode) => {
          const meta = metaMap.get(simNode.id);
          if (!meta) return null;
          const color = nodeColor(meta.entryType);
          const opacity = nodeOpacity(meta.canonStatus);
          const isSelected = selectedId === simNode.id;
          const r = 10;
          return (
            <g
              key={simNode.id}
              transform={`translate(${simNode.x},${simNode.y})`}
              style={{ cursor: "grab" }}
              opacity={opacity}
              onMouseDown={(e) => {
                e.stopPropagation();
                const { x, y } = toSVG(e);
                onDragStart(simNode.id, x, y);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(isSelected ? null : simNode.id);
              }}
            >
              {isSelected && (
                <circle r={r + 5} fill="none" stroke="#7c6fef" strokeWidth={2} opacity={0.7} />
              )}
              <circle r={r} fill={color} />
              <text
                y={r + 11}
                fontSize="10"
                fill="#d4d4d8"
                textAnchor="middle"
                dominantBaseline="auto"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {meta.name.length > 18 ? meta.name.slice(0, 16) + "…" : meta.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
