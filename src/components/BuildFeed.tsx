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
    const key = `${patch.sourceRef.kind}:${patch.sourceRef.id}`;
    const list = groups.get(key) ?? [];
    list.push(patch);
    groups.set(key, list);
  }
  return groups;
}

function sourceLabel(patch: CanonicalPatch): string {
  switch (patch.sourceRef.kind) {
    case "chat_message":      return `Chat — ${patch.sourceRef.id.slice(0, 8)}`;
    case "research_artifact": return `Research run — ${patch.sourceRef.id.slice(0, 8)}`;
    case "scene_node":        return `Scene — ${patch.sourceRef.id.slice(0, 8)}`;
    case "manual":            return "Manual";
    default:                  return patch.sourceRef.id.slice(0, 12);
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
      return `Contradiction on ${op.docId}: ${op.note}`;
    case "delete":
      return `Delete doc: ${op.docId}`;
  }
}

function confidenceBadgeProps(score: number): { label: string; cls: string } {
  const pct = Math.round(score * 100);
  if (score >= 0.85) return { label: `${pct}%`, cls: "build-feed-confidence--high" };
  if (score >= 0.60) return { label: `${pct}%`, cls: "build-feed-confidence--medium" };
  return { label: `${pct}%`, cls: "build-feed-confidence--low" };
}

/* ----------------------------------------------------------------
   Patch application logic
   ---------------------------------------------------------------- */

async function applyPatch(
  patch: CanonicalPatch,
  store: {
    addDoc(d: CanonicalDoc): Promise<void>;
    updateDoc(id: string, p: Partial<CanonicalDoc>): Promise<void>;
    deleteDoc(id: string): Promise<void>;
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
          createdAt:     Date.now(),
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
        await store.addRelationship({ ...op.relationship, id: relId, createdAt: Date.now() } as Relationship);
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
            { note: op.note, at: Date.now() },
          ];
          await store.updateDoc(op.docId, { details: { ...existing.details, contradictions } });
        }
        break;
      }
      case "delete": {
        await store.deleteDoc(op.docId);
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
  resolved?: boolean;
  resolvedAs?: "accepted" | "rejected";
}

function PatchCard({ patch, onAccept, onReject, resolved, resolvedAs }: PatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = confidenceBadgeProps(patch.confidence);

  return (
    <div className={`build-feed-card${resolved ? " build-feed-card--resolved" : ""}`}>
      <div className="build-feed-card-header">
        <div className="build-feed-card-meta">
          <span className="build-feed-card-source">{sourceLabel(patch)}</span>
          <span className="build-feed-card-count">{patch.operations.length} op(s)</span>
          <span className={`build-feed-confidence ${badge.cls}`}>{badge.label}</span>
          {resolved && resolvedAs && (
            <span className={`build-feed-resolved-label build-feed-resolved-label--${resolvedAs}`}>
              {resolvedAs === "accepted" ? "✓ accepted" : "✕ rejected"}
            </span>
          )}
        </div>
        <div className="build-feed-card-actions">
          {!resolved && (
            <>
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
            </>
          )}
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

type ResolvedPatch = CanonicalPatch & { resolvedAs: "accepted" | "rejected" };

export function BuildFeed() {
  const { storeRef, storeReady } = useRAGContext();
  const [patches, setPatches] = useState<CanonicalPatch[]>([]);
  const [resolvedPatches, setResolvedPatches] = useState<ResolvedPatch[]>([]);
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
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "accepted" as const }]);
  }, [patches, storeRef]);

  const handleReject = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;
    await store.updatePatchStatus(patchId, "rejected");
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "rejected" as const }]);
  }, [patches, storeRef]);

  const handleAcceptAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];
    for (const patch of group) {
      await applyPatch(patch, store);
      newlyResolved.push({ ...patch, resolvedAs: "accepted" as const });
    }
    setPatches((prev) => prev.filter((p) => {
      const key = `${p.sourceRef.kind}:${p.sourceRef.id}`;
      return key !== sourceKey;
    }));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [groups, storeRef]);

  const handleRejectAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];
    for (const patch of group) {
      await store.updatePatchStatus(patch.id, "rejected");
      newlyResolved.push({ ...patch, resolvedAs: "rejected" as const });
    }
    setPatches((prev) => prev.filter((p) => {
      const key = `${p.sourceRef.kind}:${p.sourceRef.id}`;
      return key !== sourceKey;
    }));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [groups, storeRef]);

  const handleAcceptHighConfidence = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const highConf = patches.filter((p) => p.confidence >= 0.85);
    if (highConf.length === 0) return;
    const newlyResolved: ResolvedPatch[] = [];
    for (const patch of highConf) {
      await applyPatch(patch, store);
      newlyResolved.push({ ...patch, resolvedAs: "accepted" as const });
    }
    const highIds = new Set(highConf.map((p) => p.id));
    setPatches((prev) => prev.filter((p) => !highIds.has(p.id)));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [patches, storeRef]);

  if (loading) {
    return <div className="build-feed-empty"><p>Loading Build Feed…</p></div>;
  }

  if (patches.length === 0) {
    return (
      <div className="build-feed">
        <div className="build-feed-header">
          <h2>Build Feed</h2>
          {resolvedPatches.length > 0 && (
            <span className="build-feed-badge">{resolvedPatches.length} resolved</span>
          )}
        </div>
        {resolvedPatches.length === 0 && (
          <div className="build-feed-empty">
            <p>No pending patches. Write in chat or run research to propose canonical entities.</p>
          </div>
        )}
        {resolvedPatches.length > 0 && (
          <div className="build-feed-resolved">
            <div className="build-feed-resolved-header">
              <span>Resolved this session ({resolvedPatches.length})</span>
              <button
                className="build-feed-btn build-feed-btn--clear"
                onClick={() => setResolvedPatches([])}
              >
                Clear
              </button>
            </div>
            {resolvedPatches.map((patch) => (
              <PatchCard
                key={patch.id}
                patch={patch}
                onAccept={() => undefined}
                onReject={() => undefined}
                resolved
                resolvedAs={patch.resolvedAs}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const highConfCount = patches.filter((p) => p.confidence >= 0.85).length;

  return (
    <div className="build-feed">
      <div className="build-feed-header">
        <h2>Build Feed</h2>
        <span className="build-feed-badge">{patches.length} pending</span>
      </div>

      {/* Global batch controls */}
      {patches.length > 0 && (
        <div className="build-feed-batch-controls">
          <button
            className="build-feed-btn build-feed-btn--accept build-feed-btn--batch"
            onClick={() => void handleAcceptHighConfidence()}
            disabled={highConfCount === 0}
            title="Accept all patches with confidence ≥ 85%"
          >
            Accept high-confidence{highConfCount > 0 ? ` (${highConfCount})` : ""}
          </button>
          {resolvedPatches.length > 0 && (
            <button
              className="build-feed-btn build-feed-btn--clear"
              onClick={() => setResolvedPatches([])}
              title="Hide resolved patches from this session"
            >
              Clear resolved ({resolvedPatches.length})
            </button>
          )}
        </div>
      )}

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
                Reject all from source
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

      {/* Recently resolved (this session) */}
      {resolvedPatches.length > 0 && (
        <div className="build-feed-resolved">
          <div className="build-feed-resolved-header">
            <span>Resolved this session ({resolvedPatches.length})</span>
            <button
              className="build-feed-btn build-feed-btn--clear"
              onClick={() => setResolvedPatches([])}
            >
              Clear
            </button>
          </div>
          {resolvedPatches.map((patch) => (
            <PatchCard
              key={patch.id}
              patch={patch}
              onAccept={() => undefined}
              onReject={() => undefined}
              resolved
              resolvedAs={patch.resolvedAs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
