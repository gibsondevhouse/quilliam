import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";

export interface GraphNode {
  id: string;
  name: string;
  entryType: string;
  canonStatus: string;
  summary: string;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
}

export function useGraphData(libraryId: string) {
  const store = useStore();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      const entries = await store.listEntriesByUniverse(libraryId);

      const graphNodes: GraphNode[] = entries.map((e) => ({
        id: e.id,
        name: e.name,
        entryType: e.entryType,
        canonStatus: e.canonStatus,
        summary: e.summary ?? "",
      }));

      // De-dup edges by id across all entries
      const edgeMap = new Map<string, GraphEdge>();
      for (const entry of entries) {
        const rels = await store.getEntryRelationsForEntry(entry.id);
        for (const rel of rels) {
          if (!edgeMap.has(rel.id)) {
            const fromId = rel.fromEntryId ?? rel.from;
            const toId = rel.toEntryId ?? rel.to;
            if (fromId && toId) {
              edgeMap.set(rel.id, {
                id: rel.id,
                fromId,
                toId,
                type: rel.relationType ?? rel.type ?? "related_to",
              });
            }
          }
        }
      }

      setNodes(graphNodes);
      setEdges(Array.from(edgeMap.values()));
      setLoading(false);
    })();
  }, [store, libraryId]);

  return { nodes, edges, loading };
}
