import type { EntryType } from "@/lib/types";
import type {
  PersistedCanonicalDoc,
  PersistedEntry,
} from "@/lib/rag/store";
import type { EntryStore } from "@/lib/rag/store/EntryStore";
import type { QuillDB } from "./schema";

export function createEntryStore(db: QuillDB): EntryStore {
  return {
    async addEntry(entry: PersistedEntry): Promise<void> {
      await db.put("entries", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },

    async updateEntry(id: string, patch: Partial<PersistedEntry>): Promise<void> {
      const existing = await db.get("entries", id);
      if (!existing) return;
      await db.put("entries", { ...existing, ...patch, id, updatedAt: Date.now() });
    },

    async getEntryById(id: string): Promise<PersistedEntry | undefined> {
      return db.get("entries", id);
    },

    async listEntriesByUniverse(universeId: string): Promise<PersistedEntry[]> {
      return db.getAllFromIndex("entries", "by_universe", universeId);
    },

    async queryEntriesByType(type: EntryType): Promise<PersistedEntry[]> {
      return db.getAllFromIndex("entries", "by_entry_type", type);
    },

    async deleteEntry(id: string): Promise<void> {
      await db.delete("entries", id);
    },

    // -----------------------------------------------------------------------
    // Canonical documents (Plan 001 bridge — writes through to entries)
    // -----------------------------------------------------------------------

    async addDoc(doc: PersistedCanonicalDoc): Promise<void> {
      const normalized = { ...doc, updatedAt: doc.updatedAt ?? Date.now() };
      await db.put("canonicalDocs", normalized);
      // Bridge write to the Plan-002 entries store.
      await db.put("entries", normalized);
    },

    async updateDoc(id: string, patch: Partial<PersistedCanonicalDoc>): Promise<void> {
      const existing = await db.get("canonicalDocs", id);
      if (!existing) return;
      const next = { ...existing, ...patch, id, updatedAt: Date.now() };
      await db.put("canonicalDocs", next);
      await db.put("entries", next);
    },

    async getDocById(id: string): Promise<PersistedCanonicalDoc | undefined> {
      const entry = await db.get("entries", id);
      if (entry) return entry;
      return db.get("canonicalDocs", id);
    },

    async queryDocsByType(type: EntryType): Promise<PersistedCanonicalDoc[]> {
      const entries = await db.getAllFromIndex("entries", "by_entry_type", type);
      if (entries.length > 0) return entries;
      return db.getAllFromIndex("canonicalDocs", "by_type", type);
    },

    async deleteDoc(id: string): Promise<void> {
      await db.delete("canonicalDocs", id);
      await db.delete("entries", id);
    },
  };
}
