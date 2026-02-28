import type {
  PersistedAiLibrarySettings,
  PersistedResearchArtifact,
  PersistedResearchRun,
  PersistedUsageLedger,
} from "@/lib/rag/store";

export interface ResearchStore {
  // AI library settings
  putAiLibrarySettings(entry: PersistedAiLibrarySettings): Promise<void>;
  getAiLibrarySettings(libraryId: string): Promise<PersistedAiLibrarySettings | null>;
  deleteAiLibrarySettings(libraryId: string): Promise<void>;
  // Deep research runs
  putResearchRun(entry: PersistedResearchRun): Promise<void>;
  getResearchRun(id: string): Promise<PersistedResearchRun | null>;
  listResearchRunsByLibrary(libraryId: string): Promise<PersistedResearchRun[]>;
  // Research artifacts
  putResearchArtifact(entry: PersistedResearchArtifact): Promise<void>;
  listResearchArtifacts(runId: string): Promise<PersistedResearchArtifact[]>;
  // Usage ledger
  putUsageLedger(entry: PersistedUsageLedger): Promise<void>;
  getUsageLedger(runId: string): Promise<PersistedUsageLedger | null>;
}
