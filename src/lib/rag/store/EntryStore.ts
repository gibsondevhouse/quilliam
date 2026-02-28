import type { EntryType } from "@/lib/types";
import type {
  PersistedCanonicalDoc,
  PersistedEntry,
} from "@/lib/rag/store";

export interface EntryStore {
  // Plan-002 entry CRUD
  addEntry(entry: PersistedEntry): Promise<void>;
  updateEntry(id: string, patch: Partial<PersistedEntry>): Promise<void>;
  getEntryById(id: string): Promise<PersistedEntry | undefined>;
  listEntriesByUniverse(universeId: string): Promise<PersistedEntry[]>;
  queryEntriesByType(type: EntryType): Promise<PersistedEntry[]>;
  deleteEntry(id: string): Promise<void>;
  // Canonical documents (Plan 001 bridge — writes through to entries)
  addDoc(doc: PersistedCanonicalDoc): Promise<void>;
  updateDoc(id: string, patch: Partial<PersistedCanonicalDoc>): Promise<void>;
  getDocById(id: string): Promise<PersistedCanonicalDoc | undefined>;
  queryDocsByType(type: EntryType): Promise<PersistedCanonicalDoc[]>;
  deleteDoc(id: string): Promise<void>;
}
