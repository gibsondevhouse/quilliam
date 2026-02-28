import type { ContinuityIssue, EntryPatch } from "@/lib/types";

export type ResolvedPatch = EntryPatch & { resolvedAs: "accepted" | "rejected" };

export function groupBySource(patches: EntryPatch[]): Map<string, EntryPatch[]> {
  const groups = new Map<string, EntryPatch[]>();
  for (const patch of patches) {
    const key = `${patch.sourceRef.kind}:${patch.sourceRef.id}`;
    const list = groups.get(key) ?? [];
    list.push(patch);
    groups.set(key, list);
  }
  return groups;
}

export function sourceLabel(patch: EntryPatch): string {
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

export function confidenceBadgeProps(score: number): { label: string; cls: string } {
  const pct = Math.round(score * 100);
  if (score >= 0.85) return { label: `${pct}%`, cls: "build-feed-confidence--high" };
  if (score >= 0.6) return { label: `${pct}%`, cls: "build-feed-confidence--medium" };
  return { label: `${pct}%`, cls: "build-feed-confidence--low" };
}

export function issueSort(a: ContinuityIssue, b: ContinuityIssue): number {
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

export function compactStatus(status: ContinuityIssue["status"]): string {
  return status.replace(/_/g, " ");
}

export function evidenceLabel(issue: ContinuityIssue): string {
  if (issue.evidence.length === 0) return "No linked evidence";
  return `${issue.evidence.length} evidence link${issue.evidence.length === 1 ? "" : "s"}`;
}
