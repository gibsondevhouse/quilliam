import type {
  ContinuityIssue,
  CultureVersion,
  Entry,
  EntryPatch,
  EntryPatchOperation,
  EntryType,
  Relationship,
  SourceRef,
} from "@/lib/types";

export function makeEntryPatchId(prefix = "epatch"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeRelationId(prefix = "rel"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEntryPatch(params: {
  sourceRef: SourceRef;
  operations: EntryPatchOperation[];
  confidence?: number;
  autoCommit?: boolean;
}): EntryPatch {
  return {
    id: makeEntryPatchId(),
    status: "pending",
    operations: params.operations,
    sourceRef: params.sourceRef,
    confidence: params.confidence ?? (params.operations.length > 0 ? 0.65 : 0),
    autoCommit: params.autoCommit ?? false,
    createdAt: Date.now(),
  };
}

export interface EntryPatchStore {
  addEntry(entry: Entry): Promise<void>;
  updateEntry(id: string, patch: Partial<Entry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  addEntryRelation(rel: Relationship): Promise<void>;
  removeEntryRelation(id: string): Promise<void>;
  addContinuityIssue(issue: ContinuityIssue): Promise<void>;
  updateContinuityIssueStatus(id: string, status: ContinuityIssue["status"], resolution?: string): Promise<void>;
  addCultureVersion(version: CultureVersion): Promise<void>;
  updatePatchStatus(id: string, status: EntryPatch["status"]): Promise<void>;
  getEntryById(id: string): Promise<Entry | undefined>;
}

function resolveCreateEntry(payload: {
  entryType?: EntryType;
  entry?: Partial<Entry>;
  docType?: EntryType;
  fields?: Partial<Entry>;
}): { entryType: EntryType; entry: Partial<Entry> } | null {
  if (payload.entryType && payload.entry) return { entryType: payload.entryType, entry: payload.entry };
  if (payload.docType && payload.fields) return { entryType: payload.docType, entry: payload.fields };
  return null;
}

export async function applyEntryPatch(patch: EntryPatch, store: EntryPatchStore): Promise<void> {
  const now = Date.now();

  for (const op of patch.operations) {
    switch (op.op) {
      case "create-entry":
      case "create": {
        const resolved = resolveCreateEntry(op);
        if (!resolved) break;
        const entry: Entry = {
          id: resolved.entry.id ?? `ent_${now}`,
          universeId: resolved.entry.universeId ?? "",
          entryType: resolved.entryType,
          name: resolved.entry.name ?? "",
          slug: resolved.entry.slug ?? "",
          summary: resolved.entry.summary ?? "",
          bodyMd: resolved.entry.bodyMd ?? "",
          canonStatus: resolved.entry.canonStatus ?? "draft",
          visibility: resolved.entry.visibility ?? "private",
          tags: resolved.entry.tags ?? [],
          aliases: resolved.entry.aliases ?? [],
          coverMediaId: resolved.entry.coverMediaId,
          type: resolved.entry.type ?? resolved.entryType,
          details: resolved.entry.details ?? {},
          status: resolved.entry.status ?? "draft",
          sources: resolved.entry.sources ?? [],
          relationships: resolved.entry.relationships ?? [],
          lastVerified: resolved.entry.lastVerified ?? 0,
          createdAt: resolved.entry.createdAt ?? now,
          updatedAt: now,
        };
        await store.addEntry(entry);
        break;
      }

      case "update-entry":
        await store.updateEntry(op.entryId, { [op.field]: op.newValue, updatedAt: now } as Partial<Entry>);
        break;

      case "update":
        await store.updateEntry(op.docId, { [op.field]: op.newValue, updatedAt: now } as Partial<Entry>);
        break;

      case "add-relation":
      case "add-relationship": {
        const relation = "relation" in op ? op.relation : op.relationship;
        await store.addEntryRelation({ id: makeRelationId(), createdAt: now, ...relation });
        break;
      }

      case "remove-relation":
        await store.removeEntryRelation(op.relationId);
        break;

      case "remove-relationship":
        await store.removeEntryRelation(op.relationshipId);
        break;

      case "create-issue": {
        const issue: ContinuityIssue = {
          id: op.issue.id ?? `issue_${now}`,
          universeId: op.issue.universeId ?? "",
          severity: op.issue.severity ?? "warning",
          status: op.issue.status ?? "open",
          checkType: op.issue.checkType ?? "manual",
          description: op.issue.description ?? "",
          evidence: op.issue.evidence ?? [],
          resolution: op.issue.resolution,
          createdAt: op.issue.createdAt ?? now,
          updatedAt: now,
        };
        await store.addContinuityIssue(issue);
        break;
      }

      case "resolve-issue":
        await store.updateContinuityIssueStatus(op.issueId, "resolved", op.resolution);
        break;

      case "create-version": {
        const version: CultureVersion = {
          id: op.version.id ?? `cv_${now}`,
          cultureEntryId: op.version.cultureEntryId ?? "",
          eraId: op.version.eraId,
          validFromEventId: op.version.validFromEventId ?? "",
          validToEventId: op.version.validToEventId,
          traits: op.version.traits ?? {},
          changeTrigger: op.version.changeTrigger,
          sourceSceneId: op.version.sourceSceneId,
          createdAt: op.version.createdAt ?? now,
          updatedAt: now,
        };
        await store.addCultureVersion(version);
        break;
      }

      case "mark-retcon":
        await store.updateEntry(op.entryId, {
          canonStatus: "retconned",
          status: "draft",
          updatedAt: now,
          details: { note: op.note ?? "retconned" },
        });
        break;

      case "mark-contradiction": {
        const existing = await store.getEntryById(op.docId);
        if (!existing) break;
        const contradictions = [
          ...((existing.details.contradictions as unknown[]) ?? []),
          { note: op.note, at: now },
        ];
        await store.updateEntry(op.docId, { details: { ...existing.details, contradictions }, updatedAt: now });
        break;
      }

      case "update-scene-links":
        await store.updateEntry(op.sceneId, {
          details: { linkedEntryIds: op.entryIds },
          updatedAt: now,
        });
        break;

      case "delete":
        await store.deleteEntry(op.docId);
        break;
    }
  }

  await store.updatePatchStatus(patch.id, "accepted");
}
