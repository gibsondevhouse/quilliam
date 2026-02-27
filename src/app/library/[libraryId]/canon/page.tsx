"use client";

/**
 * Canon — global view of all canonical docs across every type.
 * Route: /library/[libraryId]/canon
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useRAGContext } from "@/lib/context/RAGContext";
import type { CanonicalDoc, CanonicalType } from "@/lib/types";

const ALL_TYPES: CanonicalType[] = [
  "character",
  "location",
  "faction",
  "magic_system",
  "item",
  "lore_entry",
  "rule",
  "scene",
  "timeline_event",
];

const TYPE_LABELS: Record<CanonicalType, string> = {
  character:      "Character",
  location:       "Location",
  faction:        "Faction",
  magic_system:   "Magic System",
  item:           "Item",
  lore_entry:     "Lore Entry",
  rule:           "Rule",
  scene:          "Scene",
  timeline_event: "Timeline Event",
};

export default function CanonPage() {
  const { storeRef, storeReady } = useRAGContext();
  const [docs, setDocs] = useState<CanonicalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<CanonicalType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "canon">("all");
  const [sortOrder, setSortOrder] = useState<"name" | "type" | "updated">("type");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    const store = storeRef.current;
    if (!store) return;
    loadedRef.current = true;
    void (async () => {
      const allDocs = (
        await Promise.all(ALL_TYPES.map((t) => store.queryDocsByType(t)))
      ).flat();
      setDocs(allDocs);
      setLoading(false);
    })();
  }, [storeReady, storeRef]);

  const displayedDocs = useMemo(() => {
    let result = docs;
    if (typeFilter !== "all") result = result.filter((d) => d.type === typeFilter);
    if (statusFilter !== "all") result = result.filter((d) => d.status === statusFilter);
    return [...result].sort((a, b) => {
      if (sortOrder === "name")    return a.name.localeCompare(b.name);
      if (sortOrder === "type")    return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      /* updated */                return b.updatedAt - a.updatedAt;
    });
  }, [docs, typeFilter, statusFilter, sortOrder]);

  return (
    <div className="library-page canon-page">
      <div className="library-page-header">
        <h2>All Canonical Docs</h2>
        <span className="canon-page-count">{docs.length} total</span>
      </div>

      <div className="canonical-dashboard-controls">
        <div className="canonical-dashboard-filter">
          <label htmlFor="type-filter">Type:</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CanonicalType | "all")}
          >
            <option value="all">All types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="canonical-dashboard-filter">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "draft" | "canon")}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="canon">Canon</option>
          </select>
        </div>
        <div className="canonical-dashboard-sort">
          <label htmlFor="sort-order">Sort:</label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "name" | "type" | "updated")}
          >
            <option value="type">Type then name</option>
            <option value="name">Name</option>
            <option value="updated">Last updated</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="library-page-empty"><p>Loading…</p></div>
      ) : displayedDocs.length === 0 ? (
        <div className="library-page-empty">
          <p>No canonical docs match those filters.</p>
        </div>
      ) : (
        <table className="canon-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Summary</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {displayedDocs.map((doc) => (
              <tr key={doc.id}>
                <td><strong>{doc.name || "Unnamed"}</strong></td>
                <td><span className="canonical-type-badge">{TYPE_LABELS[doc.type]}</span></td>
                <td>
                  <span className={`canonical-doc-status canonical-doc-status--${doc.status}`}>
                    {doc.status === "canon" ? "★ Canon" : "Draft"}
                  </span>
                </td>
                <td>{doc.summary ? doc.summary.slice(0, 80) : "—"}</td>
                <td><small>{new Date(doc.updatedAt).toLocaleDateString()}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
