"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useRAGContext } from "@/lib/context/RAGContext";
import { applyEntryPatch } from "@/lib/domain/patch";
import { syncContinuityIssues, type ContinuitySyncReport } from "@/lib/rag/continuity";
import type { ContinuityIssue, EntryPatch, EntryPatchOperation, Revision } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";

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

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function issueSort(a: ContinuityIssue, b: ContinuityIssue): number {
  const severityRank: Record<ContinuityIssue["severity"], number> = {
    blocker: 0,
    warning: 1,
    note: 2,
  };
  const statusRank: Record<ContinuityIssue["status"], number> = {
    open: 0,
    in_review: 1,
    wont_fix: 2,
    resolved: 3,
  };
  if (statusRank[a.status] !== statusRank[b.status]) {
    return statusRank[a.status] - statusRank[b.status];
  }
  if (severityRank[a.severity] !== severityRank[b.severity]) {
    return severityRank[a.severity] - severityRank[b.severity];
  }
  return b.updatedAt - a.updatedAt;
}

function compactStatus(status: ContinuityIssue["status"]): string {
  return status.replace(/_/g, " ");
}

function evidenceLabel(issue: ContinuityIssue): string {
  if (issue.evidence.length === 0) return "No linked evidence";
  return `${issue.evidence.length} evidence link${issue.evidence.length === 1 ? "" : "s"}`;
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

interface ContinuityIssueCardProps {
  issue: ContinuityIssue;
  busy?: boolean;
  onSetStatus: (issue: ContinuityIssue, status: ContinuityIssue["status"]) => void;
}

function ContinuityIssueCard({ issue, busy, onSetStatus }: ContinuityIssueCardProps) {
  const canMarkOpen = issue.status !== "open";
  const canMarkInReview = issue.status !== "in_review";
  const canResolve = issue.status !== "resolved";
  const canWontFix = issue.status !== "wont_fix";

  return (
    <div className="build-feed-card build-feed-card--issue">
      <div className="build-feed-card-header">
        <div className="build-feed-card-meta">
          <span className={`build-feed-severity build-feed-severity--${issue.severity}`}>
            {issue.severity}
          </span>
          <span className={`build-feed-issue-status build-feed-issue-status--${issue.status}`}>
            {compactStatus(issue.status)}
          </span>
          <span className="build-feed-card-source">{issue.checkType}</span>
          <span className="build-feed-card-count">{evidenceLabel(issue)}</span>
        </div>
        <div className="build-feed-card-actions">
          <button
            className="build-feed-btn"
            disabled={!canMarkOpen || busy}
            onClick={() => onSetStatus(issue, "open")}
            title="Move issue back to open"
          >
            Open
          </button>
          <button
            className="build-feed-btn"
            disabled={!canMarkInReview || busy}
            onClick={() => onSetStatus(issue, "in_review")}
            title="Mark issue as in review"
          >
            Review
          </button>
          <button
            className="build-feed-btn build-feed-btn--accept"
            disabled={!canResolve || busy}
            onClick={() => onSetStatus(issue, "resolved")}
            title="Resolve issue"
          >
            Resolve
          </button>
          <button
            className="build-feed-btn build-feed-btn--reject"
            disabled={!canWontFix || busy}
            onClick={() => onSetStatus(issue, "wont_fix")}
            title="Mark issue as won't-fix"
          >
            Won&apos;t Fix
          </button>
        </div>
      </div>
      <div className="build-feed-issue-description">{issue.description}</div>
      {issue.evidence.length > 0 && (
        <ul className="build-feed-issue-evidence">
          {issue.evidence.slice(0, 4).map((row) => (
            <li key={`${issue.id}:${row.type}:${row.id}`} className="build-feed-issue-evidence-item">
              <code>{row.type}</code>
              <span>{row.excerpt ?? row.id}</span>
            </li>
          ))}
        </ul>
      )}
      {issue.resolution && (
        <div className="build-feed-issue-resolution">
          Resolution: {issue.resolution}
        </div>
      )}
    </div>
  );
}

type ResolvedPatch = EntryPatch & { resolvedAs: "accepted" | "rejected" };

export function BuildFeed() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const { storeRef, storeReady } = useRAGContext();
  const [patches, setPatches] = useState<EntryPatch[]>([]);
  const [resolvedPatches, setResolvedPatches] = useState<ResolvedPatch[]>([]);
  const [issues, setIssues] = useState<ContinuityIssue[]>([]);
  const [scanReport, setScanReport] = useState<ContinuitySyncReport | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const recordRevision = useCallback(
    async (
      store: RAGStore,
      targetType: string,
      targetId: string,
      patch: Record<string, unknown>,
      message: string,
    ) => {
      const now = Date.now();
      const revision: Revision = {
        id: makeId("rev"),
        universeId: libraryId,
        targetType,
        targetId,
        authorId: undefined,
        createdAt: now,
        recordedAt: now,
        patch,
        message,
      };
      await store.addRevision(revision);
    },
    [libraryId],
  );

  const loadFeedData = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const [pending, continuity] = await Promise.all([
      store.getPendingPatches(),
      store.listContinuityIssuesByUniverse(libraryId),
    ]);
    setPatches(pending.sort((a, b) => b.createdAt - a.createdAt));
    setIssues(continuity.sort(issueSort));
  }, [libraryId, storeRef]);

  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    loadedRef.current = true;

    void (async () => {
      await loadFeedData();
      setLoading(false);
    })();
  }, [loadFeedData, storeReady]);

  const groups = useMemo(() => groupBySource(patches), [patches]);
  const openIssues = useMemo(
    () => issues.filter((issue) => issue.status === "open" || issue.status === "in_review"),
    [issues],
  );

  const acceptPatch = useCallback(async (store: RAGStore, patch: EntryPatch) => {
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
    await recordRevision(
      store,
      "entry_patch",
      patch.id,
      { op: "accept-patch", source: patch.sourceRef, operations: patch.operations },
      "Accepted entry patch from build feed",
    );
  }, [recordRevision]);

  const handleAccept = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;

    await acceptPatch(store, patch);

    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "accepted" }]);
  }, [acceptPatch, patches, storeRef]);

  const handleReject = useCallback(async (patchId: string) => {
    const store = storeRef.current;
    if (!store) return;
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;

    await store.updatePatchStatus(patchId, "rejected");
    await recordRevision(
      store,
      "entry_patch",
      patch.id,
      { op: "reject-patch", source: patch.sourceRef, operations: patch.operations },
      "Rejected entry patch from build feed",
    );
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "rejected" }]);
  }, [patches, recordRevision, storeRef]);

  const handleAcceptAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];

    for (const patch of group) {
      await acceptPatch(store, patch);
      newlyResolved.push({ ...patch, resolvedAs: "accepted" });
    }

    setPatches((prev) => prev.filter((p) => `${p.sourceRef.kind}:${p.sourceRef.id}` !== sourceKey));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [acceptPatch, groups, storeRef]);

  const handleRejectAll = useCallback(async (sourceKey: string) => {
    const store = storeRef.current;
    if (!store) return;
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];

    for (const patch of group) {
      await store.updatePatchStatus(patch.id, "rejected");
      await recordRevision(
        store,
        "entry_patch",
        patch.id,
        { op: "reject-patch", source: patch.sourceRef, operations: patch.operations },
        "Rejected entry patch from build feed",
      );
      newlyResolved.push({ ...patch, resolvedAs: "rejected" });
    }

    setPatches((prev) => prev.filter((p) => `${p.sourceRef.kind}:${p.sourceRef.id}` !== sourceKey));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [groups, recordRevision, storeRef]);

  const handleRunChecks = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    setScanPending(true);
    setIssueError(null);
    try {
      const report = await syncContinuityIssues(store, libraryId);
      const latest = await store.listContinuityIssuesByUniverse(libraryId);
      setScanReport(report);
      setIssues(latest.sort(issueSort));
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Failed to run continuity checks.");
    } finally {
      setScanPending(false);
    }
  }, [libraryId, storeRef]);

  const handleSetIssueStatus = useCallback(async (
    issue: ContinuityIssue,
    status: ContinuityIssue["status"],
  ) => {
    const store = storeRef.current;
    if (!store) return;
    setBusyIssueId(issue.id);
    setIssueError(null);
    try {
      const resolution = status === "resolved"
        ? `Resolved in build feed at ${new Date().toISOString()}`
        : status === "wont_fix"
          ? `Marked won't-fix in build feed at ${new Date().toISOString()}`
          : undefined;
      await store.updateContinuityIssueStatus(issue.id, status, resolution);
      await recordRevision(
        store,
        "continuity_issue",
        issue.id,
        { op: "set-status", from: issue.status, to: status, resolution },
        `Continuity issue ${status}: ${issue.checkType}`,
      );
      setIssues((prev) => prev
        .map((row) => (row.id === issue.id
          ? { ...row, status, resolution: resolution ?? row.resolution, updatedAt: Date.now() }
          : row))
        .sort(issueSort));
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "Failed to update issue status.");
    } finally {
      setBusyIssueId(null);
    }
  }, [recordRevision, storeRef]);

  if (loading) {
    return (
      <div className="build-feed">
        <div className="build-feed-header"><h2>Continuity + Suggestions</h2></div>
        <div className="build-feed-empty">Loading build feed…</div>
      </div>
    );
  }

  return (
    <div className="build-feed">
      <div className="build-feed-header">
        <h2>Continuity + Suggestions</h2>
        <span className="build-feed-count">
          {openIssues.length} open issue(s) · {patches.length} pending patch(es)
        </span>
      </div>
      <section className="build-feed-group">
        <div className="build-feed-group-header">
          <div className="build-feed-group-title">Continuity Issues</div>
          <div className="build-feed-group-actions">
            <button
              className="build-feed-btn"
              disabled={scanPending}
              onClick={() => void handleRunChecks()}
            >
              {scanPending ? "Running…" : "Run Checks"}
            </button>
          </div>
        </div>

        {issueError && (
          <div className="build-feed-error">{issueError}</div>
        )}

        {scanReport && (
          <div className="build-feed-continuity-report">
            Detected: {scanReport.detected} · New: {scanReport.created} · Reopened: {scanReport.reopened} · Auto-resolved: {scanReport.autoResolved}
          </div>
        )}

        <div className="build-feed-group-list">
          {openIssues.length === 0 ? (
            <div className="build-feed-empty">No open continuity issues.</div>
          ) : (
            openIssues.map((issue) => (
              <ContinuityIssueCard
                key={issue.id}
                issue={issue}
                busy={busyIssueId === issue.id}
                onSetStatus={(row, status) => void handleSetIssueStatus(row, status)}
              />
            ))
          )}
        </div>
      </section>

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
