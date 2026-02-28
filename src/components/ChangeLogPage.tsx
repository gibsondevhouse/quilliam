"use client";

/**
 * ChangeLogPage — Revision history for all entry patches.
 * Shows accepted/rejected/pending patches with their operations summary.
 */

import { useEffect, useRef, useState } from "react";
import { useRAGContext } from "@/lib/context/RAGContext";
import { opSummary } from "@/lib/domain/patch";
import type { EntryPatch } from "@/lib/types";


const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  accepted: "#22c55e",
  rejected: "#ef4444",
};

type StatusFilter = "all" | "pending" | "accepted" | "rejected";

export function ChangeLogPage() {
  const { storeRef, storeReady } = useRAGContext();
  const [patches, setPatches] = useState<EntryPatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const store = storeRef.current;
      if (!store) return;
      const all = await store.listAllEntryPatches();
      // Sort newest first
      setPatches(all.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    })();
  }, [storeReady, storeRef]);

  const displayedPatches =
    statusFilter === "all"
      ? patches
      : patches.filter((p) => p.status === statusFilter);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="library-page"><p className="library-loading">Loading change log…</p></div>;
  }

  return (
    <div className="library-page change-log-page">
      <div className="library-page-header">
        <h2>Change Log</h2>
        <div className="change-log-controls">
          <label htmlFor="cl-filter">Status:</label>
          <select
            id="cl-filter"
            className="canonical-doc-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {displayedPatches.length === 0 ? (
        <div className="library-page-empty">
          <p>No {statusFilter === "all" ? "" : statusFilter + " "}patches yet.</p>
          <p className="library-page-hint">
            Patches are created when you edit entries (via the form) or when AI suggestions are applied.
          </p>
        </div>
      ) : (
        <ul className="change-log-list">
          {displayedPatches.map((patch) => {
            const isExpanded = expanded.has(patch.id);
            return (
              <li key={patch.id} className="change-log-item">
                <div className="change-log-item-header">
                  <span
                    className="change-log-status"
                    style={{ color: STATUS_COLORS[patch.status] ?? "#999" }}
                  >
                    {patch.status}
                  </span>
                  <span className="change-log-source">
                    {patch.sourceRef.kind === "manual"
                      ? "Manual edit"
                      : `${patch.sourceRef.kind} — ${patch.sourceRef.id.slice(0, 12)}`}
                  </span>
                  <span className="change-log-time">
                    {new Date(patch.createdAt).toLocaleString()}
                  </span>
                  {patch.resolvedAt && (
                    <span className="change-log-resolved">
                      Resolved: {new Date(patch.resolvedAt).toLocaleString()}
                    </span>
                  )}
                  <button
                    className="change-log-expand"
                    onClick={() => toggleExpand(patch.id)}
                  >
                    {isExpanded ? "▲ Hide" : "▼ Details"}
                  </button>
                </div>
                <div className="change-log-ops-preview">
                  {patch.operations.slice(0, 2).map((op, i) => (
                    <span key={i} className="change-log-op-chip">
                      {opSummary(op)}
                    </span>
                  ))}
                  {patch.operations.length > 2 && (
                    <span className="change-log-op-chip change-log-op-more">
                      +{patch.operations.length - 2} more
                    </span>
                  )}
                </div>
                {isExpanded && (
                  <div className="change-log-details">
                    <div className="change-log-meta">
                      <span>Confidence: {(patch.confidence * 100).toFixed(0)}%</span>
                      {patch.autoCommit && <span className="entry-related-badge">auto-commit</span>}
                    </div>
                    <ol className="change-log-ops-list">
                      {patch.operations.map((op, i) => (
                        <li key={i} className="change-log-op">
                          {opSummary(op)}
                        </li>
                      ))}
                    </ol>
                    {patch.sourceRef.excerpt && (
                      <blockquote className="change-log-excerpt">
                        {patch.sourceRef.excerpt}
                      </blockquote>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
