"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRAGContext } from "@/lib/context/RAGContext";
import { applyEntryPatch } from "@/lib/domain/patch";
import type { EntryPatch, EntryPatchOperation } from "@/lib/types";

function groupBySource(patches: EntryPatch[]): Map<string, EntryPatch[]> {
  const groups = new Map<string, EntryPatch[]>();
  for (const patch of patches) {
    const key = `${patch.sourceRef.kind}:${patch.sourceRef.id}`;
    const list = groups.get(key) ?? [];
    list.push(patch);
    groups.set(key, list);
  }
  return groups;
}

function sourceLabel(patch: EntryPatch): string {
  switch (patch.sourceRef.kind) {
    case "chat_message":
      return `Chat — ${patch.sourceRef.id.slice(0, 8)}`;
    case "research_artifact":
      return `Research run — ${patch.sourceRef.id.slice(0, 8)}`;
    case "scene_node":
      return `Scene — ${patch.sourceRef.id.slice(0, 8)}`;
    case "manual":
      return "Manual";
    default:
      return patch.sourceRef.id.slice(0, 12);
  }
}

function opSummary(op: EntryPatchOperation): string {
  switch (op.op) {
    case "create-entry":
      return `Create ${op.entryType}: "${op.entry.name ?? "?"}"`;
    case "update-entry":
      return `Update ${op.entryId} — ${op.field}`;
    case "add-relation":
      return `Link: ${op.relation.from} —[${op.relation.type}]→ ${op.relation.to}`;
    case "remove-relation":
      return `Remove relation: ${op.relationId}`;
    case "create-issue":
      return `Continuity issue: ${op.issue.checkType ?? "manual"}`;
    case "resolve-issue":
      return `Resolve issue: ${op.issueId}`;
    case "create-version":
      return `Create culture version for ${op.version.cultureEntryId ?? "unknown"}`;
    case "update-scene-links":
      return `Update scene links for ${op.sceneId}`;
    case "mark-retcon":
      return `Mark retcon on ${op.entryId}`;
    case "create":
      return `Create ${op.docType}: "${String(op.fields.name ?? "?")}"`;
    case "update":
      return `Update ${op.docId} — ${op.field}`;
    case "add-relationship":
      return `Link: ${op.relationship.from} —[${op.relationship.type}]→ ${op.relationship.to}`;
    case "remove-relationship":
      return `Remove relationship: ${op.relationshipId}`;
    case "mark-contradiction":
      return `Contradiction on ${op.docId}`;
    case "delete":
      return `Delete entry: ${op.docId}`;
  }
}

function confidenceBadgeProps(score: number): { label: string; cls: string } {
  const pct = Math.round(score * 100);
  if (score >= 0.85) return { label: `${pct}%`, cls: "build-feed-confidence--high" };
  if (score >= 0.6) return { label: `${pct}%`, cls: "build-feed-confidence--medium" };
  return { label: `${pct}%`, cls: "build-feed-confidence--low" };
}

interface PatchCardProps {
  patch: EntryPatch;
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

type ResolvedPatch = EntryPatch & { resolvedAs: "accepted" | "rejected" };

export function BuildFeed() {
  const { storeRef, storeReady } = useRAGContext();
  const [patches, setPatches] = useState<EntryPatch[]>([]);
  const [resolvedPatches, setResolvedPatches] = useState<ResolvedPatch[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    const store = storeRef.current;
    if (!store) return;
    loadedRef.current = true;

    void (async () => {
      const pending = await store.getPendingPatches();
      setPatches(pending.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    })();
  }, [storeReady, storeRef]);

  const groups = useMemo(() => groupBySource(patches), [patches]);

  const handleAccept = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;

    await applyEntryPatch(patch, {
      addEntry: store.addEntry,
      updateEntry: store.updateEntry,
      deleteEntry: store.deleteEntry,
      addEntryRelation: store.addEntryRelation,
      removeEntryRelation: store.removeEntryRelation,
      addContinuityIssue: store.addContinuityIssue,
      updateContinuityIssueStatus: store.updateContinuityIssueStatus,
      addCultureVersion: store.addCultureVersion,
      updatePatchStatus: store.updatePatchStatus,
      getEntryById: store.getEntryById,
    });

    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "accepted" }]);
  }, [patches, storeRef]);

  const handleReject = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;

    await store.updatePatchStatus(patchId, "rejected");
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "rejected" }]);
  }, [patches, storeRef]);

  const handleAcceptAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];

    for (const patch of group) {
      await applyEntryPatch(patch, {
        addEntry: store.addEntry,
        updateEntry: store.updateEntry,
        deleteEntry: store.deleteEntry,
        addEntryRelation: store.addEntryRelation,
        removeEntryRelation: store.removeEntryRelation,
        addContinuityIssue: store.addContinuityIssue,
        updateContinuityIssueStatus: store.updateContinuityIssueStatus,
        addCultureVersion: store.addCultureVersion,
        updatePatchStatus: store.updatePatchStatus,
        getEntryById: store.getEntryById,
      });
      newlyResolved.push({ ...patch, resolvedAs: "accepted" });
    }

    setPatches((prev) => prev.filter((p) => `${p.sourceRef.kind}:${p.sourceRef.id}` !== sourceKey));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [groups, storeRef]);

  const handleRejectAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];

    for (const patch of group) {
      await store.updatePatchStatus(patch.id, "rejected");
      newlyResolved.push({ ...patch, resolvedAs: "rejected" });
    }

    setPatches((prev) => prev.filter((p) => `${p.sourceRef.kind}:${p.sourceRef.id}` !== sourceKey));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [groups, storeRef]);

  if (loading) {
    return (
      <div className="build-feed">
        <div className="build-feed-header"><h2>Suggestions</h2></div>
        <div className="build-feed-empty">Loading suggestions…</div>
      </div>
    );
  }

  return (
    <div className="build-feed">
      <div className="build-feed-header">
        <h2>Suggestions</h2>
        <span className="build-feed-count">{patches.length} pending</span>
      </div>

      {patches.length === 0 && resolvedPatches.length === 0 ? (
        <div className="build-feed-empty">No pending suggestions.</div>
      ) : (
        <>
          {Array.from(groups.entries()).map(([sourceKey, group]) => (
            <section key={sourceKey} className="build-feed-group">
              <div className="build-feed-group-header">
                <div className="build-feed-group-title">{sourceLabel(group[0])}</div>
                <div className="build-feed-group-actions">
                  <button className="build-feed-btn" onClick={() => void handleAcceptAll(sourceKey)}>
                    Accept All
                  </button>
                  <button className="build-feed-btn" onClick={() => void handleRejectAll(sourceKey)}>
                    Reject All
                  </button>
                </div>
              </div>

              <div className="build-feed-group-list">
                {group.map((patch) => (
                  <PatchCard
                    key={patch.id}
                    patch={patch}
                    onAccept={(id) => void handleAccept(id)}
                    onReject={(id) => void handleReject(id)}
                  />
                ))}
              </div>
            </section>
          ))}

          {resolvedPatches.length > 0 && (
            <section className="build-feed-resolved">
              <h3>Resolved</h3>
              <div className="build-feed-group-list">
                {resolvedPatches
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .slice(0, 20)
                  .map((patch) => (
                    <PatchCard
                      key={`resolved-${patch.id}`}
                      patch={patch}
                      resolved
                      resolvedAs={patch.resolvedAs}
                      onAccept={() => undefined}
                      onReject={() => undefined}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
