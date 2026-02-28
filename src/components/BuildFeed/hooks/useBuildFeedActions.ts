"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyEntryPatch } from "@/lib/domain/patch";
import { makeId } from "@/lib/domain/idUtils";
import { syncContinuityIssues, type ContinuitySyncReport } from "@/lib/rag/continuity";
import type { ContinuityIssue, EntryPatch, Revision } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";
import { useStore } from "@/lib/context/useStore";
import { groupBySource, issueSort, type ResolvedPatch } from "../buildFeedUtils";

interface UseBuildFeedActionsParams {
  libraryId: string;
}

interface UseBuildFeedActionsReturn {
  patches: EntryPatch[];
  resolvedPatches: ResolvedPatch[];
  issues: ContinuityIssue[];
  scanReport: ContinuitySyncReport | null;
  scanPending: boolean;
  busyIssueId: string | null;
  issueError: string | null;
  loading: boolean;
  groups: Map<string, EntryPatch[]>;
  openIssues: ContinuityIssue[];
  handleAccept: (patchId: string) => void;
  handleReject: (patchId: string) => void;
  handleAcceptAll: (sourceKey: string) => void;
  handleRejectAll: (sourceKey: string) => void;
  handleRunChecks: () => void;
  handleSetIssueStatus: (issue: ContinuityIssue, status: ContinuityIssue["status"]) => void;
}

export function useBuildFeedActions({
  libraryId,
}: UseBuildFeedActionsParams): UseBuildFeedActionsReturn {
  const store = useStore();
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
    const [pending, continuity] = await Promise.all([
      store.getPendingPatches(),
      store.listContinuityIssuesByUniverse(libraryId),
    ]);
    setPatches(pending.sort((a, b) => b.createdAt - a.createdAt));
    setIssues(continuity.sort(issueSort));
  }, [libraryId, store]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      await loadFeedData();
      setLoading(false);
    })();
  }, [loadFeedData]);

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
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;
    await acceptPatch(store, patch);
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "accepted" }]);
  }, [acceptPatch, patches, store]);

  const handleReject = useCallback(async (patchId: string) => {
    const patch = patches.find((p) => p.id === patchId);
    if (!patch) return;
    await store.updatePatchStatus(patchId, "rejected");
    await recordRevision(
      store, "entry_patch", patch.id,
      { op: "reject-patch", source: patch.sourceRef, operations: patch.operations },
      "Rejected entry patch from build feed",
    );
    setPatches((prev) => prev.filter((p) => p.id !== patchId));
    setResolvedPatches((prev) => [...prev, { ...patch, resolvedAs: "rejected" }]);
  }, [patches, recordRevision, store]);

  const handleAcceptAll = useCallback(async (sourceKey: string) => {
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];
    for (const patch of group) {
      await acceptPatch(store, patch);
      newlyResolved.push({ ...patch, resolvedAs: "accepted" });
    }
    setPatches((prev) => prev.filter((p) => `${p.sourceRef.kind}:${p.sourceRef.id}` !== sourceKey));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [acceptPatch, groups, store]);

  const handleRejectAll = useCallback(async (sourceKey: string) => {
    const group = groups.get(sourceKey) ?? [];
    const newlyResolved: ResolvedPatch[] = [];
    for (const patch of group) {
      await store.updatePatchStatus(patch.id, "rejected");
      await recordRevision(
        store, "entry_patch", patch.id,
        { op: "reject-patch", source: patch.sourceRef, operations: patch.operations },
        "Rejected entry patch from build feed",
      );
      newlyResolved.push({ ...patch, resolvedAs: "rejected" });
    }
    setPatches((prev) => prev.filter((p) => `${p.sourceRef.kind}:${p.sourceRef.id}` !== sourceKey));
    setResolvedPatches((prev) => [...prev, ...newlyResolved]);
  }, [groups, recordRevision, store]);

  const handleRunChecks = useCallback(async () => {
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
  }, [libraryId, store]);

  const handleSetIssueStatus = useCallback(async (
    issue: ContinuityIssue,
    status: ContinuityIssue["status"],
  ) => {
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
        store, "continuity_issue", issue.id,
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
  }, [recordRevision, store]);

  return {
    patches,
    resolvedPatches,
    issues,
    scanReport,
    scanPending,
    busyIssueId,
    issueError,
    loading,
    groups,
    openIssues,
    handleAccept: (id) => { void handleAccept(id); },
    handleReject: (id) => { void handleReject(id); },
    handleAcceptAll: (key) => { void handleAcceptAll(key); },
    handleRejectAll: (key) => { void handleRejectAll(key); },
    handleRunChecks: () => { void handleRunChecks(); },
    handleSetIssueStatus: (issue, status) => { void handleSetIssueStatus(issue, status); },
  };
}
