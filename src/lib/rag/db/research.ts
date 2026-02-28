import type {
  PersistedAiLibrarySettings,
  PersistedResearchArtifact,
  PersistedResearchRun,
  PersistedUsageLedger,
} from "@/lib/rag/store";
import type { ResearchStore } from "@/lib/rag/store/ResearchStore";
import type { QuillDB } from "./schema";

export function createResearchStore(db: QuillDB): ResearchStore {
  return {
    // ------------------------------------------------------------------
    // AI library settings
    // ------------------------------------------------------------------
    async putAiLibrarySettings(entry: PersistedAiLibrarySettings): Promise<void> {
      await db.put("aiSettings", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async getAiLibrarySettings(libraryId: string): Promise<PersistedAiLibrarySettings | null> {
      const record = await db.get("aiSettings", libraryId);
      return record ?? null;
    },
    async deleteAiLibrarySettings(libraryId: string): Promise<void> {
      await db.delete("aiSettings", libraryId);
    },

    // ------------------------------------------------------------------
    // Research runs
    // ------------------------------------------------------------------
    async putResearchRun(entry: PersistedResearchRun): Promise<void> {
      await db.put("researchRuns", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async getResearchRun(id: string): Promise<PersistedResearchRun | null> {
      const record = await db.get("researchRuns", id);
      return record ?? null;
    },
    async listResearchRunsByLibrary(libraryId: string): Promise<PersistedResearchRun[]> {
      const all = await db.getAllFromIndex("researchRuns", "by_library", libraryId);
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    // ------------------------------------------------------------------
    // Research artifacts
    // ------------------------------------------------------------------
    async putResearchArtifact(entry: PersistedResearchArtifact): Promise<void> {
      await db.put("researchArtifacts", entry);
    },
    async listResearchArtifacts(runId: string): Promise<PersistedResearchArtifact[]> {
      const all = await db.getAllFromIndex("researchArtifacts", "by_run", runId);
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },

    // ------------------------------------------------------------------
    // Usage ledger
    // ------------------------------------------------------------------
    async putUsageLedger(entry: PersistedUsageLedger): Promise<void> {
      await db.put("usageLedgers", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async getUsageLedger(runId: string): Promise<PersistedUsageLedger | null> {
      const record = await db.get("usageLedgers", runId);
      return record ?? null;
    },
  };
}
