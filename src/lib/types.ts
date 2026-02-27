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

// ---------------------------------------------------------------------------
// Canonical document model (Plan 001 — Phase 1)
// ---------------------------------------------------------------------------

/**
 * All first-class narrative entity kinds.
 * ID prefix conventions:
 *   character: char_   location: loc_   faction: fac_
 *   magic_system: mgc_ item: itm_       lore_entry: lre_
 *   rule: rul_         scene: scn_      timeline_event: evt_
 */
export type CanonicalType =
  | "character"
  | "location"
  | "faction"
  | "magic_system"
  | "item"
  | "lore_entry"
  | "rule"
  | "scene"
  | "timeline_event";

/**
 * A traceable citation pointing back to the prose or research that originated a fact.
 *
 * `kind` values:
 *   "chat_message"      — from a local or cloud chat turn
 *   "research_artifact" — from a research run artifact
 *   "scene_node"        — from a RAG scene node
 *   "manual"            — entered directly by the user
 */
export interface SourceRef {
  kind: "chat_message" | "research_artifact" | "scene_node" | "manual";
  /** ID of the originating node, artifact, message, or run. */
  id: string;
  /** Optional short quote for evidence display in the Sources tab. */
  excerpt?: string;
}

/** Denormalised outgoing edge on a `CanonicalDoc` for fast single-doc reads. */
export interface RelationshipRef {
  /** ID of the `Relationship` record in the relationships store. */
  relationshipId: string;
  /** Target doc ID. */
  toId: string;
  /** Edge label (e.g., "member_of", "located_at"). */
  type: string;
}

/** Base record for all canonical narrative entities. */
export interface CanonicalDoc {
  /** Prefix-encoded unique ID (e.g., `char_123`). */
  id: string;
  type: CanonicalType;
  /** Primary display name or title. */
  name: string;
  /** Short human-readable summary. */
  summary: string;
  /**
   * Type-specific structured fields.
   * character:      appearance, personality, goals, backstory, age, affiliations
   * location:       geography, climate, culture, pointsOfInterest
   * faction:        ideology, leadership, territory, memberIds
   * magic_system:   principles, limitations, costs, practitioners
   * item:           description, owner, powers, origin
   * lore_entry:     topic, content, relatedDocs
   * rule:           statement, exceptions, scope
   * scene:          chapterRef, presentCharacters, presentLocations, summary, rawContent
   * timeline_event: date, participants, location, consequences
   */
  details: Record<string, unknown>;
  /** "draft" = unreviewed; "canon" = user-accepted. */
  status: "draft" | "canon";
  /** Citations to originating prose, research artifacts, or chat messages. */
  sources: SourceRef[];
  /** Denormalised outgoing edges — canonical store remains the `relationships` table. */
  relationships: RelationshipRef[];
  /** Updated each time a continuity check confirms no contradiction (epoch ms). */
  lastVerified: number;
  createdAt: number;
  updatedAt: number;
}

/** Typed edge between two canonical documents. */
export interface Relationship {
  id: string;
  from: string;
  /** Edge label: "member_of", "located_at", "appears_in", "owns", "rivals", "parent_of", "precedes", etc. */
  type: string;
  to: string;
  /** Optional extra data: timeframe, strength, confidence score. */
  metadata: Record<string, unknown>;
  sources: SourceRef[];
  createdAt: number;
}

/**
 * Atomic operation inside a `Patch` / `CanonicalPatch`.
 *
 * Op naming uses kebab-case to match the Swift EditParser conventions.
 */
export type PatchOperation =
  | { op: "create"; docType: CanonicalType; fields: Partial<CanonicalDoc> }
  | { op: "update"; docId: string; field: string; oldValue: unknown; newValue: unknown }
  | { op: "add-relationship"; relationship: Omit<Relationship, "id" | "createdAt"> }
  | { op: "remove-relationship"; relationshipId: string }
  | { op: "mark-contradiction"; docId: string; note: string }
  | { op: "delete"; docId: string };

/** Alias matching the plan's naming convention. */
export type PatchOp = PatchOperation;

/**
 * A proposed changeset awaiting user review in the Build Feed.
 * Mirrors the Swift change-set concept but operates on canonical docs rather than line-edits.
 */
export interface CanonicalPatch {
  id: string;
  /** "pending" = awaiting review; "accepted" = applied; "rejected" = archived. */
  status: "pending" | "accepted" | "rejected";
  operations: PatchOperation[];
  /** Where the patch originated. */
  sourceRef: SourceRef;
  /**
   * Extraction confidence in [0, 1].
   * >= 0.85 → eligible for auto-commit (autoCommit: true).
   * < 0.85  → must be reviewed in the Build Feed.
   */
  confidence: number;
  /** When true the patch was (or should be) committed without user review. */
  autoCommit: boolean;
  createdAt: number;
  resolvedAt?: number;
}

/** Alias matching the plan's naming convention. */
export type Patch = CanonicalPatch;
