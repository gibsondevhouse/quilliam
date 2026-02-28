import type {
  PersistedCanonicalPatch,
  PersistedContinuityIssue,
  PersistedEntryPatch,
  PersistedRevision,
  PersistedSuggestion,
} from "@/lib/rag/store";

export interface PatchStore {
  // Entry patches (Plan-002 mutation lifecycle)
  addEntryPatch(patch: PersistedEntryPatch): Promise<void>;
  getPendingEntryPatches(): Promise<PersistedEntryPatch[]>;
  listAllEntryPatches(): Promise<PersistedEntryPatch[]>;
  getEntryPatchesForEntry(entryId: string): Promise<PersistedEntryPatch[]>;
  // Canonical patches (Plan 001 bridge)
  addPatch(patch: PersistedCanonicalPatch): Promise<void>;
  updatePatchStatus(id: string, status: PersistedCanonicalPatch["status"]): Promise<void>;
  getPendingPatches(): Promise<PersistedCanonicalPatch[]>;
  getPatchesForDoc(docId: string): Promise<PersistedCanonicalPatch[]>;
  // Continuity issues
  addContinuityIssue(entry: PersistedContinuityIssue): Promise<void>;
  listContinuityIssuesByUniverse(universeId: string): Promise<PersistedContinuityIssue[]>;
  updateContinuityIssueStatus(
    id: string,
    status: PersistedContinuityIssue["status"],
    resolution?: string,
  ): Promise<void>;
  // AI suggestions
  addSuggestion(entry: PersistedSuggestion): Promise<void>;
  listSuggestionsByUniverse(universeId: string): Promise<PersistedSuggestion[]>;
  updateSuggestionStatus(id: string, status: PersistedSuggestion["status"]): Promise<void>;
  // Revisions
  addRevision(entry: PersistedRevision): Promise<void>;
  listRevisionsForTarget(targetType: string, targetId: string): Promise<PersistedRevision[]>;
}
