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
// Plan 002 domain model (Entry-centric universe engine)
// ---------------------------------------------------------------------------

export type CoreEntryType =
  | "character"
  | "location"
  | "culture"
  | "organization"
  | "system"
  | "item"
  | "language"
  | "religion"
  | "lineage"
  | "economy"
  | "rule";

/**
 * Transitional values retained so existing Plan-001 records/routes keep working
 * while the staged migration is in progress.
 */
export type LegacyEntryType =
  | "faction"
  | "magic_system"
  | "lore_entry"
  | "scene"
  | "timeline_event";

export type EntryType = CoreEntryType | LegacyEntryType;

export type CanonStatus =
  | "draft"
  | "proposed"
  | "canon"
  | "deprecated"
  | "retconned"
  | "alternate-branch";

export type VisibilityScope = "private" | "team" | "public";

/**
 * A traceable citation pointing back to the prose or research that originated a fact.
 */
export interface SourceRef {
  kind: "chat_message" | "research_artifact" | "scene_node" | "manual";
  /** ID of the originating node, artifact, message, or run. */
  id: string;
  /** Optional short quote for evidence display in the Sources tab. */
  excerpt?: string;
}

/** Denormalised outgoing edge on an Entry for fast single-entry reads. */
export interface RelationshipRef {
  /** ID of the relationship record in the relation store. */
  relationshipId: string;
  /** Target entry ID. */
  toId: string;
  /** Edge label (e.g., "member_of", "located_at"). */
  type: string;
}

/** Entry supertype for all universe encyclopedia entities. */
export interface Entry {
  id: string;
  universeId: string;
  entryType: EntryType;
  name: string;
  slug: string;
  summary: string;
  bodyMd?: string;
  canonStatus: CanonStatus;
  visibility: VisibilityScope;
  tags?: string[];
  aliases?: string[];
  coverMediaId?: string;

  // Compatibility bridge fields while old call-sites are migrated.
  type: EntryType;
  details: Record<string, unknown>;
  status: "draft" | "canon";
  sources: SourceRef[];
  relationships: RelationshipRef[];
  lastVerified: number;

  createdAt: number;
  updatedAt: number;
}

export type SeriesStatus = "planning" | "drafting" | "editing" | "published" | "archived";
export type BookStatus = "idea" | "planning" | "drafting" | "editing" | "published" | "archived";
export type TimelineType = "master" | "book";
export type TimePrecision = "year" | "month" | "day" | "approximate";
export type MentionType = "explicit" | "implicit" | "alias" | "title";
export type MediaType = "image" | "audio" | "video" | "document" | "other";

/**
 * In-universe validity interval used by era-aware entity snapshots.
 * `validToEventId` omitted means the record is still valid/open-ended.
 */
export interface ValidTimeWindow {
  validFromEventId: string;
  validToEventId?: string;
}

/**
 * System-time bounds for append-only history rows.
 * `supersededAt` omitted means this row is the current system-time version.
 */
export interface SystemTimeWindow {
  recordedAt?: number;
  supersededAt?: number;
}

export interface Character {
  entryId: string;
  pronouns?: string;
  species?: string;
  birthEventId?: string;
  deathEventId?: string;
}

export interface Location {
  entryId: string;
  parentLocationEntryId?: string;
  locationType: string;
  geo?: Record<string, unknown>;
}

export interface Culture {
  entryId: string;
  parentCultureEntryId?: string;
  homelandLocationEntryId?: string;
}

export interface Language {
  entryId: string;
  script?: string;
  phonologyNotes?: string;
}

export interface Religion {
  entryId: string;
  religionType: string;
}

export interface Organization {
  entryId: string;
  orgType: string;
  headquartersLocationEntryId?: string;
}

export interface Lineage {
  entryId: string;
  seatLocationEntryId?: string;
  lineageType: string;
}

export interface Item {
  entryId: string;
  itemType: string;
  rarity?: string;
}

export interface System {
  entryId: string;
  systemType: string;
}

export interface Economy {
  entryId: string;
  economyScope: string;
}

export interface Rule {
  entryId: string;
  ruleScope: string;
  enforcementLevel: string;
}

export interface Universe {
  id: string;
  name: string;
  tagline?: string;
  overviewMd?: string;
  defaultCalendarId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Series {
  id: string;
  universeId: string;
  name: string;
  status: SeriesStatus;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface Book {
  id: string;
  universeId: string;
  seriesId?: string;
  title: string;
  status: BookStatus;
  orderIndex: number;
  bookTimelineId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  number: number;
  title: string;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Scene {
  id: string;
  chapterId: string;
  number: number;
  povCharacterEntryId?: string;
  locationEntryId?: string;
  timeAnchorId?: string;
  /** Optional alignment to a canonical Event on a timeline. */
  alignedEventId?: string;
  sceneMd: string;
  createdAt: number;
  updatedAt: number;
}

export interface Timeline {
  id: string;
  universeId: string;
  bookId?: string;
  timelineType: TimelineType;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Era {
  id: string;
  timelineId: string;
  name: string;
  /**
   * Preferred era boundaries: link to canonical events. Time-anchor fields are
   * retained for compatibility with existing records.
   */
  startEventId?: string;
  endEventId?: string;
  startTimeAnchorId?: string;
  endTimeAnchorId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Event {
  id: string;
  universeId: string;
  timeAnchorId: string;
  eraId?: string;
  name: string;
  eventType: string;
  descriptionMd?: string;
  participants?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Calendar {
  id: string;
  universeId: string;
  name: string;
  rules: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TimeAnchor {
  id: string;
  calendarId: string;
  precision: TimePrecision;
  dateParts: Record<string, unknown>;
  relativeDay: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Transitional relation shape; keeps legacy fields while introducing Plan-002
 * semantics (`fromEntryId`, `toEntryId`, `relationType`, validity interval).
 */
export interface Relationship {
  id: string;
  from: string;
  type: string;
  to: string;
  metadata: Record<string, unknown>;
  sources: SourceRef[];
  createdAt: number;

  fromEntryId?: string;
  toEntryId?: string;
  relationType?: string;
  validFromEventId?: string;
  validToEventId?: string;
  meta?: Record<string, unknown>;
}

export type Relation = Relationship;

export interface Membership {
  id: string;
  characterEntryId: string;
  organizationEntryId: string;
  role: string;
  validFromEventId?: string;
  validToEventId?: string;
  createdAt: number;
  updatedAt: number;
}

export type CultureMembershipKind =
  | "primary"
  | "secondary"
  | "diaspora"
  | "adopted"
  | "assimilated"
  | "ancestral";

export interface CultureMembership {
  id: string;
  characterEntryId: string;
  cultureEntryId: string;
  membershipKind: CultureMembershipKind;
  validFromEventId?: string;
  validToEventId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ItemOwnership {
  id: string;
  itemEntryId: string;
  ownerEntryId: string;
  ownerKind: "character" | "organization" | "lineage" | "location" | "unknown";
  acquiredEventId?: string;
  lostEventId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Mention {
  id: string;
  sceneId: string;
  entryId: string;
  mentionType: MentionType;
  startOffset?: number;
  endOffset?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Media {
  id: string;
  universeId: string;
  mediaType: MediaType;
  storageUri: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Map {
  id: string;
  universeId: string;
  mediaId: string;
  projection?: string;
  bounds?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface MapPin {
  id: string;
  mapId: string;
  entryId: string;
  x: number;
  y: number;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Revision {
  id: string;
  universeId: string;
  targetType: "entry" | "event" | "culture_version" | "timeline" | "scene" | string;
  targetId: string;
  /** Optional validity interval the revision describes in in-universe time. */
  validFromEventId?: string;
  validToEventId?: string;
  authorId?: string;
  createdAt: number;
  /**
   * Explicit system-time timestamp for temporal queries.
   * Defaults to `createdAt` when omitted.
   */
  recordedAt?: number;
  supersedesRevisionId?: string;
  patch: Record<string, unknown>;
  message?: string;
}

export interface ContinuityIssue {
  id: string;
  universeId: string;
  severity: "blocker" | "warning" | "note";
  status: "open" | "in_review" | "resolved" | "wont_fix";
  checkType: string;
  description: string;
  evidence: Array<{ type: string; id: string; excerpt?: string }>;
  resolution?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Suggestion {
  id: string;
  universeId: string;
  targetType: string;
  targetId: string;
  proposedChange: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
  origin: "ai" | "human";
  confidence?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CultureVersion {
  id: string;
  cultureEntryId: string;
  eraId?: string;
  validFromEventId: string;
  validToEventId?: string;
  traits: Record<string, unknown>;
  changeTrigger?: string;
  sourceSceneId?: string;
  recordedAt?: number;
  supersededAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationVersion extends ValidTimeWindow, SystemTimeWindow {
  id: string;
  organizationEntryId: string;
  eraId?: string;
  traits: Record<string, unknown>;
  changeTrigger?: string;
  sourceSceneId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReligionVersion extends ValidTimeWindow, SystemTimeWindow {
  id: string;
  religionEntryId: string;
  eraId?: string;
  traits: Record<string, unknown>;
  changeTrigger?: string;
  sourceSceneId?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Entry patch model (Plan 002)
// ---------------------------------------------------------------------------

export type EntryPatchOperation =
  | { op: "create-entry"; entryType: EntryType; entry: Partial<Entry> }
  | { op: "update-entry"; entryId: string; field: string; oldValue: unknown; newValue: unknown }
  | { op: "add-relation"; relation: Omit<Relationship, "id" | "createdAt"> }
  | { op: "remove-relation"; relationId: string }
  | { op: "create-issue"; issue: Partial<ContinuityIssue> }
  | { op: "resolve-issue"; issueId: string; resolution: string }
  | { op: "create-version"; version: Partial<CultureVersion> }
  | { op: "update-scene-links"; sceneId: string; entryIds: string[] }
  | { op: "mark-retcon"; entryId: string; note?: string }
  // Transitional Plan-001 ops preserved for adapter-first migration
  | { op: "create"; docType: EntryType; fields: Partial<Entry> }
  | { op: "update"; docId: string; field: string; oldValue: unknown; newValue: unknown }
  | { op: "add-relationship"; relationship: Omit<Relationship, "id" | "createdAt"> }
  | { op: "remove-relationship"; relationshipId: string }
  | { op: "mark-contradiction"; docId: string; note: string }
  | { op: "delete"; docId: string };

export interface EntryPatch {
  id: string;
  /** "pending" = awaiting review; "accepted" = applied; "rejected" = archived. */
  status: "pending" | "accepted" | "rejected";
  operations: EntryPatchOperation[];
  /** Where the patch originated. */
  sourceRef: SourceRef;
  /** Extraction confidence in [0, 1]. */
  confidence: number;
  /** When true the patch was (or should be) committed without user review. */
  autoCommit: boolean;
  createdAt: number;
  resolvedAt?: number;
}

// ---------------------------------------------------------------------------
// Compatibility aliases (one release cycle)
// ---------------------------------------------------------------------------

/** @deprecated Use EntryType. */
export type CanonicalType = EntryType;
/** @deprecated Use Entry. */
export type CanonicalDoc = Entry;
/** @deprecated Use Relationship (same runtime shape). */
export type CanonicalRelationship = Relationship;
/** @deprecated Use EntryPatchOperation. */
export type PatchOperation = EntryPatchOperation;
/** @deprecated Use EntryPatchOperation. */
export type PatchOp = EntryPatchOperation;
/** @deprecated Use EntryPatch. */
export type CanonicalPatch = EntryPatch;
/** @deprecated Use EntryPatch. */
export type Patch = EntryPatch;
