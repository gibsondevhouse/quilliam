"use client";

import { useSearchParams, useParams } from "next/navigation";
import { useRAGContext } from "@/lib/context/RAGContext";
import type { CanonicalDocDashboardProps } from "./types";
import { DocForm } from "./DocForm";
import { EntryRelatedPanel } from "./EntryRelatedPanel";
import { useEntryDashboard } from "./hooks/useEntryDashboard";
import { useEntryRelatedData } from "./hooks/useEntryRelatedData";

export function CanonicalDocDashboard({ type, title }: CanonicalDocDashboardProps) {
  const { storeRef, storeReady } = useRAGContext();
  const searchParams = useSearchParams();
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const highlightId = searchParams.get("highlight");

  const {
    docs,
    activeId,
    setActiveId,
    loading,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    displayedDocs,
    activeDoc,
    handleAdd,
    handleSave,
    handleDelete,
  } = useEntryDashboard({ libraryId, type, title, storeRef, storeReady, highlightId });

  const { members, appearances, linkedCultures, handleAddMember, handleRemoveMember } =
    useEntryRelatedData({ activeId, storeRef, storeReady, type });

  return (
    <div className="library-page split-page">
      <div className="split-page-list">
        <div className="library-page-header">
          <h2>{title}</h2>
          <button className="library-page-action" onClick={handleAdd}>+ Add</button>
        </div>

        <div className="canonical-dashboard-controls">
          <div className="canonical-dashboard-filter">
            <label htmlFor="status-filter">Status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(
                e.target.value as
                  | "all"
                  | "draft"
                  | "proposed"
                  | "canon"
                  | "deprecated"
                  | "retconned"
                  | "alternate-branch",
              )}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="proposed">Proposed</option>
              <option value="canon">Canon</option>
              <option value="deprecated">Deprecated</option>
              <option value="retconned">Retconned</option>
              <option value="alternate-branch">Alternate Branch</option>
            </select>
          </div>
          <div className="canonical-dashboard-sort">
            <label htmlFor="sort-order">Sort:</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "name" | "updated")}
            >
              <option value="name">Name</option>
              <option value="updated">Last updated</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="library-page-empty"><p>Loading…</p></div>
        ) : docs.length === 0 ? (
          <div className="library-page-empty">
            <p>No {title.toLowerCase()} yet.</p>
            <button className="library-page-action primary" onClick={handleAdd}>
              Add your first {title.toLowerCase().replace(/s$/, "")}
            </button>
          </div>
        ) : displayedDocs.length === 0 ? (
          <div className="library-page-empty">
            <p>No {statusFilter} {title.toLowerCase()}.</p>
          </div>
        ) : (
          <ul className="library-item-list">
            {displayedDocs.map((doc) => (
              <li key={doc.id} className="library-item-row">
                <button
                  className={`library-item-btn ${activeId === doc.id ? "active" : ""}`}
                  onClick={() => setActiveId(doc.id)}
                >
                  <span className="library-item-avatar">
                    {doc.canonStatus === "canon" ? "★" : (doc.name || "?")[0].toUpperCase()}
                  </span>
                  <div className="library-item-info">
                    <span className="library-item-title">{doc.name || "Unnamed"}</span>
                    {doc.summary && (
                      <span className="library-item-preview">{doc.summary.slice(0, 60)}</span>
                    )}
                  </div>
                </button>
                <button
                  className="library-item-delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="split-page-editor">
        {activeDoc ? (
          <>
            <DocForm
              key={activeDoc.id}
              doc={activeDoc}
              entryType={type}
              onSave={handleSave}
            />
            {(type === "culture" || type === "character" || type === "location") && (
              <EntryRelatedPanel
                entryType={type}
                entryId={activeDoc.id}
                members={members}
                appearances={appearances}
                linkedCultures={linkedCultures}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
              />
            )}
          </>
        ) : (
          <div className="library-page-empty">
            <p>Select a {title.toLowerCase().replace(/s$/, "")} to edit, or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
