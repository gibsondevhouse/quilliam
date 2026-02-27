"use client";

/**
 * BuildFeed — patch review queue (Plan 001 — Phase 5).
 *
 * Shows all pending `CanonicalPatch` records grouped by source (chat, research, manual).
 * Users can accept or reject individual operations or entire patches.
 *
 * Accepted patches are applied to canonicalDocs and relationships stores.
 * Rejected patches are archived (status "rejected") — never deleted.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRAGContext } from "@/lib/context/RAGContext";
import type {
  CanonicalDoc,
  CanonicalPatch,
  PatchOperation,
  Relationship,
} from "@/lib/types";

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

function groupBySource(patches: CanonicalPatch[]): Map<string, CanonicalPatch[]> {
  const groups = new Map<string, CanonicalPatch[]>();
  for (const patch of patches) {
    const key = `${patch.sourceType}:${patch.sourceId}`;
    const list = groups.get(key) ?? [];
    list.push(patch);
    groups.set(key, list);
  }
  return groups;
}

function sourceLabel(patch: CanonicalPatch): string {
  switch (patch.sourceType) {
    case "chat":     return `Chat — ${patch.sourceId.slice(0, 8)}`;
    case "research": return `Research run — ${patch.sourceId.slice(0, 8)}`;
    case "manual":   return "Manual";
    default:         return patch.sourceId.slice(0, 12);
  }
}

function opSummary(op: PatchOperation): string {
  switch (op.op) {
    case "create":
      return `Create ${op.docType}: "${(op.fields.name as string) ?? "?"}"`;
    case "update":
      return `Update ${op.docId} — ${op.field}: "${op.oldValue}" → "${op.newValue}"`;
    case "add-relationship":
      return `Link: ${op.relationship.from} —[${op.relationship.type}]→ ${op.relationship.to}`;
    case "remove-relationship":
      return `Remove relationship: ${op.relationshipId}`;
    case "mark-contradiction":
      return `Contradiction on ${op.docId}: ${op.description}`;
  }
}

/* ----------------------------------------------------------------
   Patch application logic
   ---------------------------------------------------------------- */

async function applyPatch(
  patch: CanonicalPatch,
  store: {
    addDoc(d: CanonicalDoc): Promise<void>;
    updateDoc(id: string, p: Partial<CanonicalDoc>): Promise<void>;
    addRelationship(r: Relationship): Promise<void>;
    removeRelationship(id: string): Promise<void>;
    getDocById(id: string): Promise<CanonicalDoc | undefined>;
    updatePatchStatus(id: string, s: CanonicalPatch["status"]): Promise<void>;
  },
): Promise<void> {
  for (const op of patch.operations) {
    switch (op.op) {
      case "create": {
        const doc: CanonicalDoc = {
          id:            (op.fields.id as string) ?? `doc_${Date.now()}`,
          type:          op.docType,
          name:          (op.fields.name as string) ?? "",
          summary:       (op.fields.summary as string) ?? "",
          details:       (op.fields.details as Record<string, unknown>) ?? {},
          status:        "draft",
          sources:       (op.fields.sources as CanonicalDoc["sources"]) ?? [],
          relationships: [],
          lastVerified:  0,
          updatedAt:     Date.now(),
        };
        await store.addDoc(doc);
        break;
      }
      case "update": {
        await store.updateDoc(op.docId, { [op.field]: op.newValue } as Partial<CanonicalDoc>);
        break;
      }
      case "add-relationship": {
        const relId = `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        await store.addRelationship({ ...op.relationship, id: relId } as Relationship);
        break;
      }
      case "remove-relationship": {
        await store.removeRelationship(op.relationshipId);
        break;
      }
      case "mark-contradiction": {
        const existing = await store.getDocById(op.docId);
        if (existing) {
          const contradictions = [
            ...((existing.details.contradictions as unknown[]) ?? []),
            { description: op.description, sourceId: op.sourceId, at: Date.now() },
          ];
          await store.updateDoc(op.docId, { details: { ...existing.details, contradictions } });
        }
        break;
      }
    }
  }
  await store.updatePatchStatus(patch.id, "accepted");
}

/* ----------------------------------------------------------------
   PatchCard — single patch in the queue
   ---------------------------------------------------------------- */

interface PatchCardProps {
  patch: CanonicalPatch;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

function PatchCard({ patch, onAccept, onReject }: PatchCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="build-feed-card">
      <div className="build-feed-card-header">
        <div className="build-feed-card-meta">
          <span className="build-feed-card-source">{sourceLabel(patch)}</span>
          <span className="build-feed-card-count">{patch.operations.length} op(s)</span>
        </div>
        <div className="build-feed-card-actions">
          <button
            className="build-feed-btn build-feed-btn--accept"
            onClick={() => onAccept(patch.id)}
            title="Accept all operations in this patch"
          >
            Accept
          </button>
          <button
            className="build-feed-btn build-feed-btn--reject"
            onClick={() => onReject(patch.id)}
            title="Reject all operations — archived, not deleted"
          >
            Reject
          </button>
          <button
            className="build-feed-btn build-feed-btn--expand"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {expanded && (
        <ul className="build-feed-ops">
          {patch.operations.map((op, i) => (
            <li key={i} className="build-feed-op">
              <code className={`build-feed-op-badge build-feed-op-badge--${op.op}`}>{op.op}</code>
              <span className="build-feed-op-summary">{opSummary(op)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Main component
   ---------------------------------------------------------------- */

export function BuildFeed() {
  const { storeRef, storeReady } = useRAGContext();
  const [patches, setPatches] = useState<CanonicalPatch[]>([]);
  // Start with loading=true — avoids synchronous setState inside the effect.
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  /* Load pending patches */
  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    const store = storeRef.current;
    if (!store) return;
    loadedRef.current = true;
    void store.getPendingPatches().then((result) => {
      setPatches(result.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
  }, [storeReady, storeRef]);

  const groups = useMemo(() => groupBySource(patches), [patches]);

  const handleAccept = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;
    await applyPatch(patch, store);
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
  }, [patches, storeRef]);

  const handleReject = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    await store.updatePatchStatus(patchId, "rejected");
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
  }, [storeRef]);

  const handleAcceptAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    for (const patch of group) {
      await applyPatch(patch, store);
    }
    setPatches((prev) => prev.filter((p) => {
      const key = `${p.sourceType}:${p.sourceId}`;
      return key !== sourceKey;
    }));
  }, [groups, storeRef]);

  const handleRejectAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    for (const patch of group) {
      await store.updatePatchStatus(patch.id, "rejected");
    }
    setPatches((prev) => prev.filter((p) => {
      const key = `${p.sourceType}:${p.sourceId}`;
      return key !== sourceKey;
    }));
  }, [groups, storeRef]);

  if (loading) {
    return <div className="build-feed-empty"><p>Loading Build Feed…</p></div>;
  }

  if (patches.length === 0) {
    return (
      <div className="build-feed-empty">
        <h2>Build Feed</h2>
        <p>No pending patches. Write in chat or run research to propose canonical entities.</p>
      </div>
    );
  }

  return (
    <div className="build-feed">
      <div className="build-feed-header">
        <h2>Build Feed</h2>
        <span className="build-feed-badge">{patches.length} pending</span>
      </div>
      {Array.from(groups.entries()).map(([key, group]) => (
        <div key={key} className="build-feed-group">
          <div className="build-feed-group-header">
            <span className="build-feed-group-label">
              {group[0] ? sourceLabel(group[0]) : key}
              {" "}— {group.length} patch(es)
            </span>
            <div className="build-feed-group-actions">
              <button
                className="build-feed-btn build-feed-btn--accept"
                onClick={() => void handleAcceptAll(key)}
              >
                Accept all
              </button>
              <button
                className="build-feed-btn build-feed-btn--reject"
                onClick={() => void handleRejectAll(key)}
              >
                Reject all
              </button>
            </div>
          </div>
          {group.map((patch) => (
            <PatchCard
              key={patch.id}
              patch={patch}
              onAccept={(id) => void handleAccept(id)}
              onReject={(id) => void handleReject(id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
