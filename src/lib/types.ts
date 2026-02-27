import type { LineEdit } from "@/lib/changeSets";

/**
 * Shared entity types for Quilliam.
 * All user-created entities are scoped to a Library via libraryId.
 */

export interface CharacterEntry {
  id: string;
  libraryId: string;
  name: string;
  role: string;
  notes: string;
}

export interface LocationEntry {
  id: string;
  libraryId: string;
  name: string;
  description: string;
}

export interface WorldEntry {
  id: string;
  libraryId: string;
  title: string;
  category: string;
  notes: string;
}

export interface ChatSession {
  id: string;
  /** libraryId is required for new sessions; legacy sessions may have it undefined */
  libraryId: string;
  title: string;
  createdAt: number;
  preview: string;
}

export interface ChatMessageEntry {
  role: "user" | "assistant";
  content: string;
}

/** Story (Book/Novel/Project) — belongs to one Library, contains Chapters */
export interface Story {
  id: string;
  libraryId: string;
  title: string;
  synopsis: string;
  genre: string;
  status: "drafting" | "editing" | "archived";
  createdAt: number;
}

/** Library-level metadata stored alongside the RAGNode of type "library" */
export interface LibraryMeta {
  description?: string;
  logline?: string;
  status?: "drafting" | "editing" | "archived";
}

// ---------------------------------------------------------------------------
// AI execution / cloud / research shared types
// ---------------------------------------------------------------------------

export type AiExecutionMode = "local" | "assisted_cloud" | "deep_research";

export interface CloudProviderConfig {
  anthropicModel: string;
  tavilyEnabled: boolean;
}

export interface RunBudget {
  maxUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxMinutes: number;
  maxSources: number;
}

export interface UsageMeter {
  spentUsd: number;
  inputTokens: number;
  outputTokens: number;
  sourcesFetched: number;
  elapsedMs: number;
}

export interface Citation {
  url: string;
  title: string;
  publishedAt?: string;
  quote: string;
  claimRef: string;
}

export type PatchTargetKind = "active" | "chapter" | "character" | "location" | "world";

export interface ProposedPatchBatch {
  id: string;
  targetId: string;
  targetKind: PatchTargetKind;
  /**
   * Optional human-target key (e.g. "character:Elena") used by editors that
   * route edits by semantic target names rather than UUIDs.
   */
  targetKey?: string;
  edits: LineEdit[];
  rationale: string;
  citations?: Citation[];
}

export type ResearchRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "cancelled"
  | "failed"
  | "budget_exceeded";

export type ResearchRunPhase =
  | "plan"
  | "query"
  | "fetch"
  | "extract"
  | "synthesize"
  | "propose";

export interface ResearchArtifact {
  id: string;
  runId: string;
  kind: "notes" | "outline" | "claims" | "patches";
  content: string;
  citations?: Citation[];
  createdAt: number;
}

export interface ResearchRunRecord {
  id: string;
  libraryId: string;
  query: string;
  status: ResearchRunStatus;
  phase: ResearchRunPhase;
  checkpoint: Record<string, unknown>;
  budget: RunBudget;
  usage: UsageMeter;
  artifacts: ResearchArtifact[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AiLibrarySettings {
  libraryId: string;
  executionMode: AiExecutionMode;
  providerConfig: CloudProviderConfig;
  defaultBudget: RunBudget;
  updatedAt: number;
}

export const DEFAULT_PROVIDER_CONFIG: CloudProviderConfig = {
  anthropicModel: "claude-3-5-sonnet-latest",
  tavilyEnabled: true,
};

export const DEFAULT_RUN_BUDGET: RunBudget = {
  maxUsd: 5,
  maxInputTokens: 200_000,
  maxOutputTokens: 40_000,
  maxMinutes: 45,
  maxSources: 12,
};
