import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "./useGraphData";

export const CANVAS_W = 900;
export const CANVAS_H = 640;

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface DragState {
  id: string;
  startSvgX: number;
  startSvgY: number;
  nodeX: number;
  nodeY: number;
}

const REPULSION = 9000;
const SPRING_K = 0.025;
const SPRING_REST = 130;
const CENTER_K = 0.008;
const DAMPING = 0.82;
const ITERATIONS = 280;

function runSimulation(
  nodes: SimNode[],
  edges: GraphEdge[],
  steps: number,
): SimNode[] {
  const ns = nodes.map((n) => ({ ...n }));

  for (let iter = 0; iter < steps; iter++) {
    // Repulsion: all pairs
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const d = Math.sqrt(d2);
        const f = REPULSION / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        ns[i].vx -= fx;
        ns[i].vy -= fy;
        ns[j].vx += fx;
        ns[j].vy += fy;
      }
    }

    // Spring attraction along edges
    const nodeMap = new Map(ns.map((n) => [n.id, n]));
    for (const edge of edges) {
      const a = nodeMap.get(edge.fromId);
      const b = nodeMap.get(edge.toId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = SPRING_K * (d - SPRING_REST);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center pull + integrate + clamp
    for (const n of ns) {
      n.vx += (CANVAS_W / 2 - n.x) * CENTER_K;
      n.vy += (CANVAS_H / 2 - n.y) * CENTER_K;
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x = Math.max(30, Math.min(CANVAS_W - 30, n.x));
      n.y = Math.max(30, Math.min(CANVAS_H - 30, n.y));
    }
  }
  return ns;
}

export function useForceLayout(graphNodes: GraphNode[], graphEdges: GraphEdge[]) {
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const nodesKeyRef = useRef<string>("");

  useEffect(() => {
    if (graphNodes.length === 0) return;
    const key = graphNodes.map((n) => n.id).join(",");
    if (key === nodesKeyRef.current) return;
    nodesKeyRef.current = key;

    const angleStep = (2 * Math.PI) / graphNodes.length;
    const radius = Math.min(CANVAS_W, CANVAS_H) * 0.32;
    const initial: SimNode[] = graphNodes.map((n, i) => ({
      id: n.id,
      x: CANVAS_W / 2 + radius * Math.cos(angleStep * i),
      y: CANVAS_H / 2 + radius * Math.sin(angleStep * i),
      vx: 0,
      vy: 0,
    }));

    const settled = runSimulation(initial, graphEdges, ITERATIONS);
    // Use setTimeout to avoid synchronous setState-in-effect lint violation
    const id = setTimeout(() => setSimNodes(settled), 0);
    return () => clearTimeout(id);
  }, [graphNodes, graphEdges]);

  const handleDragStart = useCallback(
    (id: string, svgX: number, svgY: number) => {
      const node = simNodes.find((n) => n.id === id);
      if (!node) return;
      dragRef.current = { id, startSvgX: svgX, startSvgY: svgY, nodeX: node.x, nodeY: node.y };
    },
    [simNodes],
  );

  const handleDragMove = useCallback((svgX: number, svgY: number) => {
    if (!dragRef.current) return;
    const { id, startSvgX, startSvgY, nodeX, nodeY } = dragRef.current;
    const dx = svgX - startSvgX;
    const dy = svgY - startSvgY;
    setSimNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, x: Math.max(30, Math.min(CANVAS_W - 30, nodeX + dx)), y: Math.max(30, Math.min(CANVAS_H - 30, nodeY + dy)), vx: 0, vy: 0 }
          : n,
      ),
    );
  }, []);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const isDragging = useCallback(() => dragRef.current !== null, []);

  return { simNodes, handleDragStart, handleDragMove, handleDragEnd, isDragging };
}
