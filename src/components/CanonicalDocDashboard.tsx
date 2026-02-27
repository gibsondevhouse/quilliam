"use client";

/**
 * CanonicalDocDashboard — reusable list + detail panel for any CanonicalType.
 *
 * Used by each canonical route page (Characters, Locations, Factions, etc.).
 * Reads and writes directly to the RAGStore canonicalDocs / patches stores.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useRAGContext } from "@/lib/context/RAGContext";
import type { CanonicalDoc, CanonicalType, PatchOperation, CanonicalPatch } from "@/lib/types";

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

const TYPE_PREFIX: Record<CanonicalType, string> = {
  character:      "char",
  location:       "loc",
  faction:        "fac",
  magic_system:   "mgc",
  item:           "itm",
  lore_entry:     "lre",
  rule:           "rul",
  scene:          "scn",
  timeline_event: "evt",
};

function makeDocId(type: CanonicalType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type]}_${slug}`;
}

function makePatchId(): string {
  return `patch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ----------------------------------------------------------------
   Detail form (right panel)
   ---------------------------------------------------------------- */

interface DocFormProps {
  doc: CanonicalDoc;
  onSave: (fields: { name: string; summary: string }) => void;
}

function DocForm({ doc, onSave }: DocFormProps) {
  // key={doc.id} on the parent remounts this component when the selected doc changes,
  // so local state always initialises from the current doc — no effect needed.
  const [name, setName] = useState(doc.name);
  const [summary, setSummary] = useState(doc.summary);

  const dirty = name !== doc.name || summary !== doc.summary;

  return (
    <div className="canonical-doc-form">
      <div className="canonical-doc-field">
        <label htmlFor="doc-name">Name</label>
        <input
          id="doc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="canonical-doc-input"
          placeholder="Display name"
        />
      </div>
      <div className="canonical-doc-field">
        <label htmlFor="doc-summary">Summary</label>
        <textarea
          id="doc-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="canonical-doc-textarea"
          rows={4}
          placeholder="Short description"
        />
      </div>
      <div className="canonical-doc-meta">
        <span className={`canonical-doc-status canonical-doc-status--${doc.status}`}>
          {doc.status === "canon" ? "Canon" : "Draft"}
        </span>
        {doc.sources.length > 0 && (
          <span className="canonical-doc-sources">{doc.sources.length} source(s)</span>
        )}
      </div>
      {dirty && (
        <button
          className="library-page-action primary"
          onClick={() => onSave({ name, summary })}
        >
          Save (creates pending patch)
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Main component
   ---------------------------------------------------------------- */

interface CanonicalDocDashboardProps {
  type: CanonicalType;
  title: string;
}

export function CanonicalDocDashboard({ type, title }: CanonicalDocDashboardProps) {
  const { storeRef, storeReady } = useRAGContext();
  const searchParams = useSearchParams();
  const highlightId  = searchParams.get("highlight");
  const [docs, setDocs] = useState<CanonicalDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Start with loading=true so the first render shows the loading state without
  // needing a synchronous setState call inside the effect.
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "canon">("all");
  const [sortOrder, setSortOrder] = useState<"name" | "updated">("name");

  /* Load docs on mount / when store is ready */
  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    const store = storeRef.current;
    if (!store) return;
    loadedRef.current = true;
    void store.queryDocsByType(type).then((result) => {
      const sorted = result.sort((a, b) => a.name.localeCompare(b.name));
      setDocs(sorted);
      setLoading(false);
      if (highlightId && sorted.some((d) => d.id === highlightId)) {
        setActiveId(highlightId);
      }
    });
  }, [storeReady, storeRef, type, highlightId]);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeId) ?? null,
    [docs, activeId],
  );

  const displayedDocs = useMemo(() => {
    const filtered = statusFilter === "all" ? docs : docs.filter((d) => d.status === statusFilter);
    return [...filtered].sort((a, b) =>
      sortOrder === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt - a.updatedAt,
    );
  }, [docs, statusFilter, sortOrder]);

  /* Add a new draft doc locally */
  const handleAdd = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const name = `New ${title.replace(/s$/, "")}`;
    const doc: CanonicalDoc = {
      id:           makeDocId(type, `${name}-${Date.now()}`),
      type,
      name,
      summary:      "",
      details:      {},
      status:       "draft",
      sources:      [],
      relationships: [],
      lastVerified: 0,
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
    };
    await store.addDoc(doc);
    setDocs((prev) => [...prev, doc].sort((a, b) => a.name.localeCompare(b.name)));
    setActiveId(doc.id);
  }, [storeRef, type, title]);

  /* Save as a pending patch (review-first) */
  const handleSave = useCallback(async (fields: { name: string; summary: string }) => {
    if (!activeId) return;
    const store = storeRef.current;
    if (!store) return;

    const ops: PatchOperation[] = [];
    const prev = docs.find((d) => d.id === activeId);
    if (!prev) return;

    if (fields.name !== prev.name) {
      ops.push({ op: "update", docId: activeId, field: "name", oldValue: prev.name, newValue: fields.name });
    }
    if (fields.summary !== prev.summary) {
      ops.push({ op: "update", docId: activeId, field: "summary", oldValue: prev.summary, newValue: fields.summary });
    }
    if (ops.length === 0) return;

    const patch: CanonicalPatch = {
      id:         makePatchId(),
      status:     "pending",
      operations: ops,
      sourceRef:  { kind: "manual", id: activeId },
      confidence: 1,
      autoCommit: false,
      createdAt:  Date.now(),
    };
    await store.addPatch(patch);
    // Optimistically apply locally so the UI reflects the change
    setDocs((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, ...fields, updatedAt: Date.now() } : d,
      ),
    );
  }, [activeId, docs, storeRef]);

  /* Delete */
  const handleDelete = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await store.deleteDoc(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId, storeRef]);

  return (
    <div className="library-page split-page">
      {/* Left: list */}
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
                    {doc.status === "canon" ? "★" : (doc.name || "?")[0].toUpperCase()}
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
                  onClick={(e) => { e.stopPropagation(); void handleDelete(doc.id); }}
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: detail / form */}
      <div className="split-page-editor">
        {activeDoc ? (
          <DocForm
            key={activeDoc.id}
            doc={activeDoc}
            onSave={(fields) => void handleSave(fields)}
          />
        ) : (
          <div className="library-page-empty">
            <p>Select a {title.toLowerCase().replace(/s$/, "")} to edit, or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
