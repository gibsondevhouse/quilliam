"use client";

import { useMemo, useState } from "react";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useGraphData } from "./useGraphData";
import { useForceLayout } from "./useForceLayout";
import { GraphCanvas } from "./GraphCanvas";
import { NodeDetail } from "./NodeDetail";

const CORE_TYPES = [
  "character", "location", "culture", "organization",
  "system", "item", "language", "religion", "lineage", "economy", "rule",
] as const;

const TYPE_LABEL: Record<string, string> = {
  character: "Characters", location: "Locations", culture: "Cultures",
  organization: "Orgs", system: "Systems", item: "Items",
  language: "Languages", religion: "Religions", lineage: "Lineages",
  economy: "Economics", rule: "Rules",
};

const TYPE_COLOR: Record<string, string> = {
  character: "#9d8fff", location: "#4ade80", culture: "#fbbf24",
  organization: "#60a5fa", system: "#f472b6", item: "#fb923c",
  language: "#2dd4bf", religion: "#c084fc", lineage: "#818cf8",
  economy: "#a3e635", rule: "#f87171",
};

export function RelationshipWeb() {
  const { libraryId } = useLibraryContext();
  const { nodes, edges, loading } = useGraphData(libraryId);
  const { simNodes, handleDragStart, handleDragMove, handleDragEnd, isDragging } = useForceLayout(nodes, edges);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(CORE_TYPES));
  const [search, setSearch] = useState("");

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) { next.delete(type); } else { next.add(type); }
      return next;
    });
  };

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return new Set(
      nodes
        .filter((n) => activeTypes.has(n.entryType))
        .filter((n) => !q || n.name.toLowerCase().includes(q))
        .map((n) => n.id),
    );
  }, [nodes, activeTypes, search]);

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) { counts[n.entryType] = (counts[n.entryType] ?? 0) + 1; }
    return counts;
  }, [nodes]);

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-page-header">
          <h1 className="library-page-title">Relationship Web</h1>
        </div>
        <p className="library-page-empty">Loading graph data…</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="library-page">
        <div className="library-page-header">
          <h1 className="library-page-title">Relationship Web</h1>
        </div>
        <p className="library-page-empty">
          No entries yet. Add characters, locations, cultures, and other entities to see the relationship web.
        </p>
      </div>
    );
  }

  return (
    <div className="rel-web-page">
      {/* Header */}
      <div className="rel-web-header">
        <h1 className="rel-web-title">Relationship Web</h1>
        <div className="rel-web-meta">
          {nodes.length} entities · {edges.length} connections
        </div>
        <input
          className="rel-web-search"
          type="search"
          placeholder="Filter by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Type filters */}
      <div className="rel-web-filters">
        {CORE_TYPES.map((type) => {
          const active = activeTypes.has(type);
          const count = typeCounts[type] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              className={`rel-web-filter-chip${active ? " active" : ""}`}
              style={active ? { borderColor: TYPE_COLOR[type], color: TYPE_COLOR[type] } : undefined}
              onClick={() => toggleType(type)}
            >
              {TYPE_LABEL[type]}
              <span className="rel-web-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Canvas + detail */}
      <div className="rel-web-body">
        <GraphCanvas
          simNodes={simNodes}
          graphNodes={nodes}
          edges={edges}
          visibleIds={visibleIds}
          selectedId={selectedId}
          onSelectNode={setSelectedId}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          isDragging={isDragging}
        />
        {selectedNode && (
          <NodeDetail
            node={selectedNode}
            edges={edges}
            allNodes={nodes}
            onClose={() => setSelectedId(null)}
            onSelectNode={setSelectedId}
          />
        )}
      </div>
    </div>
  );
}
