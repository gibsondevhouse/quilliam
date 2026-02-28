import type {
  PersistedCanonicalPatch,
  PersistedContinuityIssue,
  PersistedEntryPatch,
  PersistedRevision,
  PersistedSuggestion,
} from "@/lib/rag/store";
import type { PatchStore } from "@/lib/rag/store/PatchStore";
import type { QuillDB } from "./schema";

export function createPatchStore(db: QuillDB): PatchStore {
  return {
    // ------------------------------------------------------------------
    // Entry patches (Plan-002 mutation lifecycle)
    // ------------------------------------------------------------------
    async addEntryPatch(patch: PersistedEntryPatch): Promise<void> {
      const tx = db.transaction(["entryPatches", "entryPatchByEntry"], "readwrite");
      await tx.objectStore("entryPatches").put(patch);
      const entryIds = new Set<string>();
      for (const op of patch.operations) {
        if ("entryId" in op) entryIds.add(op.entryId as string);
        if ("docId" in op) entryIds.add(op.docId as string);
        if ("entry" in op && op.entry?.id) entryIds.add(op.entry.id as string);
        if ("fields" in op && op.fields?.id) entryIds.add(op.fields.id as string);
        if ("relation" in op) {
          entryIds.add(op.relation.from);
          entryIds.add(op.relation.to);
        }
        if ("relationship" in op) {
          entryIds.add(op.relationship.from);
          entryIds.add(op.relationship.to);
        }
      }
      for (const entryId of entryIds) {
        await tx.objectStore("entryPatchByEntry").put({
          docId: entryId,
          patchId: patch.id,
          status: patch.status,
        });
      }
      await tx.done;
    },
    async getPendingEntryPatches(): Promise<PersistedEntryPatch[]> {
      return db.getAllFromIndex("entryPatches", "by_status", "pending");
    },
    async listAllEntryPatches(): Promise<PersistedEntryPatch[]> {
      return db.getAll("entryPatches");
    },
    async getEntryPatchesForEntry(entryId: string): Promise<PersistedEntryPatch[]> {
      const entries = await db.getAllFromIndex("entryPatchByEntry", "by_entry", entryId);
      if (entries.length === 0) return [];
      const tx = db.transaction("entryPatches", "readonly");
      const rows = await Promise.all(entries.map((entry) => tx.store.get(entry.patchId)));
      return rows.filter((row): row is PersistedEntryPatch => row !== undefined);
    },

    // ------------------------------------------------------------------
    // Canonical patches (Plan 001 bridge)
    // ------------------------------------------------------------------
    async addPatch(patch: PersistedCanonicalPatch): Promise<void> {
      const tx = db.transaction(["patches", "patchByDoc", "entryPatches", "entryPatchByEntry"], "readwrite");
      await tx.objectStore("patches").put(patch);
      await tx.objectStore("entryPatches").put(patch);
      const docIds = new Set<string>();
      for (const op of patch.operations) {
        if ("docId" in op) docIds.add(op.docId);
        if ("fields" in op && op.fields.id) docIds.add(op.fields.id as string);
        if ("entry" in op && op.entry?.id) docIds.add(op.entry.id as string);
        if ("entryId" in op) docIds.add(op.entryId as string);
        if ("relationship" in op) {
          docIds.add(op.relationship.from);
          docIds.add(op.relationship.to);
        }
        if ("relation" in op) {
          docIds.add(op.relation.from);
          docIds.add(op.relation.to);
        }
      }
      for (const docId of docIds) {
        await tx.objectStore("patchByDoc").put({ docId, patchId: patch.id, status: patch.status });
        await tx.objectStore("entryPatchByEntry").put({ docId, patchId: patch.id, status: patch.status });
      }
      await tx.done;
    },
    async updatePatchStatus(id: string, status: PersistedCanonicalPatch["status"]): Promise<void> {
      const tx = db.transaction(["patches", "patchByDoc", "entryPatches", "entryPatchByEntry"], "readwrite");
      const existing = await tx.objectStore("patches").get(id);
      if (!existing) { await tx.done; return; }
      await tx.objectStore("patches").put({ ...existing, status });
      await tx.objectStore("entryPatches").put({ ...existing, status });
      const indexRows = await tx.objectStore("patchByDoc").index("by_patchId").getAll(id);
      for (const row of indexRows) {
        await tx.objectStore("patchByDoc").put({ ...row, status });
      }
      const entryRows = await tx.objectStore("entryPatchByEntry").index("by_patchId").getAll(id);
      for (const row of entryRows) {
        await tx.objectStore("entryPatchByEntry").put({ ...row, status });
      }
      await tx.done;
    },
    async getPendingPatches(): Promise<PersistedCanonicalPatch[]> {
      const next = await db.getAllFromIndex("entryPatches", "by_status", "pending");
      if (next.length > 0) return next;
      return db.getAllFromIndex("patches", "by_status", "pending");
    },
    async getPatchesForDoc(docId: string): Promise<PersistedCanonicalPatch[]> {
      const entryIndex = await db.getAllFromIndex("entryPatchByEntry", "by_entry", docId);
      if (entryIndex.length > 0) {
        const tx = db.transaction("entryPatches", "readonly");
        const rows = await Promise.all(entryIndex.map((entry) => tx.store.get(entry.patchId)));
        return rows.filter((row): row is PersistedCanonicalPatch => row !== undefined);
      }
      const entries = await db.getAllFromIndex("patchByDoc", "by_doc", docId);
      if (entries.length === 0) return [];
      const tx = db.transaction("patches", "readonly");
      const results = await Promise.all(entries.map((e) => tx.store.get(e.patchId)));
      return results.filter((p): p is PersistedCanonicalPatch => p !== undefined);
    },

    // ------------------------------------------------------------------
    // Continuity issues
    // ------------------------------------------------------------------
    async addContinuityIssue(entry: PersistedContinuityIssue): Promise<void> {
      await db.put("continuityIssues", entry);
    },
    async listContinuityIssuesByUniverse(universeId: string): Promise<PersistedContinuityIssue[]> {
      return db.getAllFromIndex("continuityIssues", "by_universe", universeId);
    },
    async updateContinuityIssueStatus(
      id: string,
      status: PersistedContinuityIssue["status"],
      resolution?: string,
    ): Promise<void> {
      const existing = await db.get("continuityIssues", id);
      if (!existing) return;
      await db.put("continuityIssues", {
        ...existing,
        status,
        resolution: resolution ?? existing.resolution,
        updatedAt: Date.now(),
      });
    },

    // ------------------------------------------------------------------
    // AI suggestions
    // ------------------------------------------------------------------
    async addSuggestion(entry: PersistedSuggestion): Promise<void> {
      await db.put("suggestions", entry);
    },
    async listSuggestionsByUniverse(universeId: string): Promise<PersistedSuggestion[]> {
      return db.getAllFromIndex("suggestions", "by_universe", universeId);
    },
    async updateSuggestionStatus(id: string, status: PersistedSuggestion["status"]): Promise<void> {
      const existing = await db.get("suggestions", id);
      if (!existing) return;
      await db.put("suggestions", { ...existing, status, updatedAt: Date.now() });
    },

    // ------------------------------------------------------------------
    // Revisions
    // ------------------------------------------------------------------
    async addRevision(entry: PersistedRevision): Promise<void> {
      await db.put("revisions", entry);
    },
    async listRevisionsForTarget(targetType: string, targetId: string): Promise<PersistedRevision[]> {
      return db.getAllFromIndex("revisions", "by_target", [targetType, targetId]);
    },
  };
}
