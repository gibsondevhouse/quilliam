import { runDeterministicContinuityChecks } from "@/lib/domain/continuity/checks";
import type { ContinuityIssue, CultureMembership, Entry, Mention, Revision } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";

interface ContinuityRuntimeContext {
  mentions: Mention[];
  cultureMemberships: CultureMembership[];
}

export interface ContinuitySyncReport {
  detected: number;
  created: number;
  reopened: number;
  autoResolved: number;
  openCount: number;
  updatedAt: number;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function issueFingerprint(issue: ContinuityIssue): string {
  const evidenceKey = [...issue.evidence]
    .map((row) => `${row.type}:${row.id}`)
    .sort()
    .join("|");
  return `${issue.checkType}::${issue.description}::${evidenceKey}`;
}

function toMapByFingerprint(issues: ContinuityIssue[]): Map<string, ContinuityIssue[]> {
  const out = new Map<string, ContinuityIssue[]>();
  for (const issue of issues) {
    const key = issueFingerprint(issue);
    const list = out.get(key) ?? [];
    list.push(issue);
    out.set(key, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return out;
}

async function loadRuntimeContext(store: RAGStore, entries: Entry[]): Promise<ContinuityRuntimeContext> {
  const sceneIds = entries
    .filter((entry) => entry.entryType === "scene")
    .map((entry) => entry.id);
  const characterIds = entries
    .filter((entry) => entry.entryType === "character")
    .map((entry) => entry.id);

  const mentionRows = await Promise.all(sceneIds.map((sceneId) => store.listMentionsByScene(sceneId)));
  const membershipRows = await Promise.all(
    characterIds.map((characterEntryId) => store.listCultureMembershipsByCharacter(characterEntryId)),
  );

  const mentionById = new Map<string, Mention>();
  for (const mention of mentionRows.flat()) {
    mentionById.set(mention.id, mention);
  }

  const membershipById = new Map<string, CultureMembership>();
  for (const membership of membershipRows.flat()) {
    membershipById.set(membership.id, membership);
  }

  return {
    mentions: [...mentionById.values()],
    cultureMemberships: [...membershipById.values()],
  };
}

function makeIssueRevision(
  universeId: string,
  issueId: string,
  patch: Record<string, unknown>,
  message: string,
): Revision {
  const now = Date.now();
  return {
    id: makeId("rev"),
    universeId,
    targetType: "continuity_issue",
    targetId: issueId,
    authorId: undefined,
    createdAt: now,
    recordedAt: now,
    patch,
    message,
  };
}

export async function detectContinuityIssues(store: RAGStore, universeId: string): Promise<ContinuityIssue[]> {
  const entries = await store.listEntriesByUniverse(universeId);
  const runtime = await loadRuntimeContext(store, entries);
  return runDeterministicContinuityChecks({
    universeId,
    entries,
    mentions: runtime.mentions,
    cultureMemberships: runtime.cultureMemberships,
  });
}

export async function syncContinuityIssues(
  store: RAGStore,
  universeId: string,
): Promise<ContinuitySyncReport> {
  const [detected, existing] = await Promise.all([
    detectContinuityIssues(store, universeId),
    store.listContinuityIssuesByUniverse(universeId),
  ]);

  const existingByFingerprint = toMapByFingerprint(existing);
  const touched = new Set<string>();
  let created = 0;
  let reopened = 0;
  let autoResolved = 0;

  for (const issue of detected) {
    const candidates = existingByFingerprint.get(issueFingerprint(issue)) ?? [];
    const current = candidates[0];
    if (!current) {
      await store.addContinuityIssue(issue);
      await store.addRevision(
        makeIssueRevision(
          universeId,
          issue.id,
          { op: "detect", checkType: issue.checkType, severity: issue.severity },
          `Continuity issue detected: ${issue.checkType}`,
        ),
      );
      created += 1;
      continue;
    }

    touched.add(current.id);
    if (current.status === "resolved" || current.status === "wont_fix") {
      await store.updateContinuityIssueStatus(current.id, "open");
      await store.addRevision(
        makeIssueRevision(
          universeId,
          current.id,
          { op: "reopen", fromStatus: current.status },
          `Continuity issue reopened: ${current.checkType}`,
        ),
      );
      reopened += 1;
    }
  }

  for (const issue of existing) {
    if ((issue.status === "resolved" || issue.status === "wont_fix") || touched.has(issue.id)) continue;
    const present = detected.some((candidate) => issueFingerprint(candidate) === issueFingerprint(issue));
    if (present) continue;

    await store.updateContinuityIssueStatus(
      issue.id,
      "resolved",
      `Auto-resolved by deterministic scan at ${new Date().toISOString()}`,
    );
    await store.addRevision(
      makeIssueRevision(
        universeId,
        issue.id,
        { op: "auto-resolve", checkType: issue.checkType },
        `Continuity issue auto-resolved: ${issue.checkType}`,
      ),
    );
    autoResolved += 1;
  }

  const latest = await store.listContinuityIssuesByUniverse(universeId);
  const openCount = latest.filter((issue) => issue.status === "open" || issue.status === "in_review").length;
  return {
    detected: detected.length,
    created,
    reopened,
    autoResolved,
    openCount,
    updatedAt: Date.now(),
  };
}
