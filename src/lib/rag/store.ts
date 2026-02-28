/**
 * RAG storage contracts and persistable record shapes.
 * These types are shared by the IndexedDB layer and worker messages.
 */

import type { RAGNode } from "@/lib/rag/hierarchy";
import type {
  AiLibrarySettings,
  Book,
  Calendar,
  Chapter,
  CanonicalDoc,
  CanonicalPatch,
  CanonicalType,
  ContinuityIssue,
  CultureMembership,
  CultureVersion,
  Entry,
  EntryPatch,
  EntryType,
  Era,
  Event,
  ItemOwnership,
  Map as WorldMap,
  MapPin,
  Media,
  Mention,
  Membership,
  OrganizationVersion,
  ReligionVersion,
  Revision,
  Relationship,
  ResearchArtifact,
  ResearchRunRecord,
  Scene,
  Series,
  Suggestion,
  TimeAnchor,
  Timeline,
  Universe,
  UsageMeter,
} from "@/lib/types";

/**
 * Persisted RAG node representation suitable for IndexedDB storage.
 * Float32Array embeddings are flattened to number[] for structured cloning.
 */
export interface PersistedRAGNode extends Omit<RAGNode, "vectorEmbedding"> {
  vectorEmbedding?: number[];
}

/**
 * Stored embedding metadata keyed by fragment hash and model.
 */
export interface StoredEmbedding {
  fragmentId: string;
  hash: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt: number;
}

/**
 * Generic metadata entry for versioning or feature flags.
 */
export interface StoredMetadata {
  key: string;
  value: unknown;
  updatedAt: number;
}

/**
 * Persisted chat session header (no messages — stored separately for fast listing).
 * libraryId is required for all new sessions; legacy rows may have it undefined.
 */
export interface PersistedChatSession {
  id: string;
  libraryId?: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
}

/** Persisted character record, library-scoped. */
export interface PersistedCharacter {
  id: string;
  libraryId: string;
  name: string;
  role: string;
  notes: string;
  updatedAt: number;
  /** Set to true after the one-time canonical migration is confirmed. */
  migrated?: boolean;
}

/** Persisted location record, library-scoped. */
export interface PersistedLocation {
  id: string;
  libraryId: string;
  name: string;
  description: string;
  updatedAt: number;
  /** Set to true after the one-time canonical migration is confirmed. */
  migrated?: boolean;
}

/** Persisted world-entry record, library-scoped. */
export interface PersistedWorldEntry {
  id: string;
  libraryId: string;
  title: string;
  category: string;
  notes: string;
  updatedAt: number;
  /** Set to true after the one-time canonical migration is confirmed. */
  migrated?: boolean;
}

/** Persisted story (book/novel) record — library-scoped, contains chapters. */
export interface PersistedStory {
  id: string;
  libraryId: string;
  title: string;
  synopsis: string;
  genre: string;
  status: "drafting" | "editing" | "archived";
  createdAt: number;
  updatedAt: number;
}

/** Persisted library metadata separate from the core RAG node shape. */
export interface PersistedLibraryMeta {
  libraryId: string;
  title: string;
  description: string;
  status: "drafting" | "editing" | "archived";
  updatedAt: number;
}

/** Per-library AI execution and provider preferences. */
export type PersistedAiLibrarySettings = AiLibrarySettings;

/** Durable research run state used by the Deep Research monitor. */
export type PersistedResearchRun = ResearchRunRecord;

/** Persisted research artifact emitted by deep-research phases. */
export type PersistedResearchArtifact = ResearchArtifact;

/** Persisted usage meter snapshots keyed by run id. */
export interface PersistedUsageLedger {
  runId: string;
  usage: UsageMeter;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Canonical document persistence types (Plan 001 — Phase 3)
// ---------------------------------------------------------------------------

/** Canonical document stored directly as-is — shape matches CanonicalDoc. */
export type PersistedCanonicalDoc = CanonicalDoc;

/** Relationship edge stored directly as-is — shape matches Relationship. */
export type PersistedRelationship = Relationship;

/** Canonical patch stored directly as-is — shape matches CanonicalPatch. */
export type PersistedCanonicalPatch = CanonicalPatch;

/** Plan-002 universe-level records */
export type PersistedUniverse = Universe;
export type PersistedEntry = Entry;
export type PersistedEntryPatch = EntryPatch;
export type PersistedSeries = Series;
export type PersistedBook = Book;
export type PersistedChapter = Chapter;
export type PersistedScene = Scene;
export type PersistedTimeline = Timeline;
export type PersistedEra = Era;
export type PersistedEvent = Event;
export type PersistedCalendar = Calendar;
export type PersistedTimeAnchor = TimeAnchor;
export type PersistedMembership = Membership;
export type PersistedCultureMembership = CultureMembership;
export type PersistedItemOwnership = ItemOwnership;
export type PersistedCultureVersion = CultureVersion;
export type PersistedOrganizationVersion = OrganizationVersion;
export type PersistedReligionVersion = ReligionVersion;
export type PersistedContinuityIssue = ContinuityIssue;
export type PersistedSuggestion = Suggestion;
export type PersistedRevision = Revision;
export type PersistedMention = Mention;
export type PersistedMedia = Media;
export type PersistedMap = WorldMap;
export type PersistedMapPin = MapPin;

/**
 * Denormalised lookup entry: one row per (docId, relationshipId) pair.
 * Stored in the `relationIndexByDoc` object store.
 * keyPath: ["docId", "relationshipId"]  ← compound, NOT scalar
 */
export interface PersistedRelationIndexEntry {
  /** The canonical doc ID (part of compound key). */
  docId: string;
  /** The relationship ID that involves this doc (as `from` or `to`). */
  relationshipId: string;
}

/**
 * Lookup entry: one row per (docId, patchId) pair.
 * Stored in the `patchByDoc` object store for fast patch lookups by doc.
 * keyPath: ["docId", "patchId"]  ← compound, NOT scalar
 */
export interface PersistedPatchByDocEntry {
  /** The canonical doc ID (part of compound key). */
  docId: string;
  /** The patch ID that touches this doc in one of its operations. */
  patchId: string;
  /** Denormalised status for index-based filtering. */
  status: CanonicalPatch["status"];
}

/**
 * Individual chat message keyed by session.
 */
export interface PersistedChatMessage {
  /** Composite key: `${sessionId}::${index}` */
  key: string;
  sessionId: string;
  index: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

/**
 * High-level storage interface to keep persistence concerns isolated.
 */
export interface RAGStore {
  putNode(node: RAGNode): Promise<void>;
  getNode(id: string): Promise<RAGNode | null>;
  deleteNode(id: string): Promise<void>;
  listChildren(parentId: string | null): Promise<RAGNode[]>;
  listAllNodes(): Promise<RAGNode[]>;
  putEmbedding(record: StoredEmbedding): Promise<void>;
  getEmbeddingByFragment(fragmentId: string): Promise<StoredEmbedding | null>;
  getEmbeddingByHash(hash: string, model: string): Promise<StoredEmbedding | null>;
  setMetadata(entry: StoredMetadata): Promise<void>;
  getMetadata<T = unknown>(key: string): Promise<T | null>;
  // Chat persistence
  putChatSession(session: PersistedChatSession): Promise<void>;
  listChatSessions(): Promise<PersistedChatSession[]>;
  listChatSessionsByLibrary(libraryId: string): Promise<PersistedChatSession[]>;
  deleteChatSession(id: string): Promise<void>;
  putChatMessages(sessionId: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<void>;
  listChatMessages(sessionId: string): Promise<PersistedChatMessage[]>;
  // Characters
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("character")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  putCharacter(entry: PersistedCharacter): Promise<void>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("character")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  getCharactersByLibrary(libraryId: string): Promise<PersistedCharacter[]>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("character")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  deleteCharacter(id: string): Promise<void>;
  // Locations
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("location")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  putLocation(entry: PersistedLocation): Promise<void>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("location")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  getLocationsByLibrary(libraryId: string): Promise<PersistedLocation[]>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("location")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  deleteLocation(id: string): Promise<void>;
  // World entries
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("lore_entry")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  putWorldEntry(entry: PersistedWorldEntry): Promise<void>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("lore_entry")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  getWorldEntriesByLibrary(libraryId: string): Promise<PersistedWorldEntry[]>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("lore_entry")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  deleteWorldEntry(id: string): Promise<void>;
  // Stories
  putStory(entry: PersistedStory): Promise<void>;
  getStoriesByLibrary(libraryId: string): Promise<PersistedStory[]>;
  getStory(id: string): Promise<PersistedStory | null>;
  deleteStory(id: string): Promise<void>;
  deleteStoryCascade(storyId: string): Promise<void>;
  deleteLibraryCascade(libraryId: string): Promise<void>;
  // Library metadata
  putLibraryMeta(entry: PersistedLibraryMeta): Promise<void>;
  getLibraryMeta(libraryId: string): Promise<PersistedLibraryMeta | null>;
  deleteLibraryMeta(libraryId: string): Promise<void>;
  // AI settings
  putAiLibrarySettings(entry: PersistedAiLibrarySettings): Promise<void>;
  getAiLibrarySettings(libraryId: string): Promise<PersistedAiLibrarySettings | null>;
  deleteAiLibrarySettings(libraryId: string): Promise<void>;
  // Deep research runs / artifacts / usage
  putResearchRun(entry: PersistedResearchRun): Promise<void>;
  getResearchRun(id: string): Promise<PersistedResearchRun | null>;
  listResearchRunsByLibrary(libraryId: string): Promise<PersistedResearchRun[]>;
  putResearchArtifact(entry: PersistedResearchArtifact): Promise<void>;
  listResearchArtifacts(runId: string): Promise<PersistedResearchArtifact[]>;
  putUsageLedger(entry: PersistedUsageLedger): Promise<void>;
  getUsageLedger(runId: string): Promise<PersistedUsageLedger | null>;
  // Plan-002 universe engine stores
  putUniverse(universe: PersistedUniverse): Promise<void>;
  getUniverse(id: string): Promise<PersistedUniverse | null>;
  listUniverses(): Promise<PersistedUniverse[]>;
  addEntry(entry: PersistedEntry): Promise<void>;
  updateEntry(id: string, patch: Partial<PersistedEntry>): Promise<void>;
  getEntryById(id: string): Promise<PersistedEntry | undefined>;
  listEntriesByUniverse(universeId: string): Promise<PersistedEntry[]>;
  queryEntriesByType(type: EntryType): Promise<PersistedEntry[]>;
  deleteEntry(id: string): Promise<void>;
  putSeries(entry: PersistedSeries): Promise<void>;
  listSeriesByUniverse(universeId: string): Promise<PersistedSeries[]>;
  putBook(entry: PersistedBook): Promise<void>;
  listBooksBySeries(seriesId: string): Promise<PersistedBook[]>;
  listBooksByUniverse(universeId: string): Promise<PersistedBook[]>;
  putChapter(entry: PersistedChapter): Promise<void>;
  listChaptersByBook(bookId: string): Promise<PersistedChapter[]>;
  putScene(entry: PersistedScene): Promise<void>;
  listScenesByChapter(chapterId: string): Promise<PersistedScene[]>;
  getSceneById(id: string): Promise<PersistedScene | undefined>;
  addEntryRelation(rel: PersistedRelationship): Promise<void>;
  removeEntryRelation(id: string): Promise<void>;
  getEntryRelationsForEntry(entryId: string): Promise<PersistedRelationship[]>;
  putTimeline(entry: PersistedTimeline): Promise<void>;
  listTimelinesByUniverse(universeId: string): Promise<PersistedTimeline[]>;
  listTimelinesByBook(bookId: string): Promise<PersistedTimeline[]>;
  putEra(entry: PersistedEra): Promise<void>;
  listErasByTimeline(timelineId: string): Promise<PersistedEra[]>;
  putEvent(entry: PersistedEvent): Promise<void>;
  listEventsByUniverse(universeId: string): Promise<PersistedEvent[]>;
  listEventsByEra(eraId: string): Promise<PersistedEvent[]>;
  putCalendar(entry: PersistedCalendar): Promise<void>;
  listCalendarsByUniverse(universeId: string): Promise<PersistedCalendar[]>;
  putTimeAnchor(entry: PersistedTimeAnchor): Promise<void>;
  getTimeAnchor(id: string): Promise<PersistedTimeAnchor | null>;
  listTimeAnchorsByCalendar(calendarId: string): Promise<PersistedTimeAnchor[]>;
  putMembership(entry: PersistedMembership): Promise<void>;
  listMembershipsByCharacter(characterEntryId: string): Promise<PersistedMembership[]>;
  listMembershipsByOrganization(organizationEntryId: string): Promise<PersistedMembership[]>;
  putCultureMembership(entry: PersistedCultureMembership): Promise<void>;
  listCultureMembershipsByCharacter(characterEntryId: string): Promise<PersistedCultureMembership[]>;
  listCultureMembershipsByCulture(cultureEntryId: string): Promise<PersistedCultureMembership[]>;
  putItemOwnership(entry: PersistedItemOwnership): Promise<void>;
  listItemOwnershipByItem(itemEntryId: string): Promise<PersistedItemOwnership[]>;
  listItemOwnershipByOwner(ownerEntryId: string): Promise<PersistedItemOwnership[]>;
  putMention(entry: PersistedMention): Promise<void>;
  listMentionsByScene(sceneId: string): Promise<PersistedMention[]>;
  listMentionsByEntry(entryId: string): Promise<PersistedMention[]>;
  putMedia(entry: PersistedMedia): Promise<void>;
  listMediaByUniverse(universeId: string): Promise<PersistedMedia[]>;
  putMap(entry: PersistedMap): Promise<void>;
  listMapsByUniverse(universeId: string): Promise<PersistedMap[]>;
  putMapPin(entry: PersistedMapPin): Promise<void>;
  listMapPinsByMap(mapId: string): Promise<PersistedMapPin[]>;
  listMapPinsByEntry(entryId: string): Promise<PersistedMapPin[]>;
  addCultureVersion(entry: PersistedCultureVersion): Promise<void>;
  listCultureVersionsByCulture(cultureEntryId: string): Promise<PersistedCultureVersion[]>;
  addOrganizationVersion(entry: PersistedOrganizationVersion): Promise<void>;
  listOrganizationVersionsByOrganization(organizationEntryId: string): Promise<PersistedOrganizationVersion[]>;
  addReligionVersion(entry: PersistedReligionVersion): Promise<void>;
  listReligionVersionsByReligion(religionEntryId: string): Promise<PersistedReligionVersion[]>;
  addContinuityIssue(entry: PersistedContinuityIssue): Promise<void>;
  listContinuityIssuesByUniverse(universeId: string): Promise<PersistedContinuityIssue[]>;
  updateContinuityIssueStatus(id: string, status: PersistedContinuityIssue["status"], resolution?: string): Promise<void>;
  addSuggestion(entry: PersistedSuggestion): Promise<void>;
  listSuggestionsByUniverse(universeId: string): Promise<PersistedSuggestion[]>;
  updateSuggestionStatus(id: string, status: PersistedSuggestion["status"]): Promise<void>;
  addRevision(entry: PersistedRevision): Promise<void>;
  listRevisionsForTarget(targetType: string, targetId: string): Promise<PersistedRevision[]>;
  addEntryPatch(patch: PersistedEntryPatch): Promise<void>;
  getPendingEntryPatches(): Promise<PersistedEntryPatch[]>;
  listAllEntryPatches(): Promise<PersistedEntryPatch[]>;
  getEntryPatchesForEntry(entryId: string): Promise<PersistedEntryPatch[]>;
  // Canonical documents (Plan 001 — Phase 3)
  addDoc(doc: PersistedCanonicalDoc): Promise<void>;
  updateDoc(id: string, patch: Partial<PersistedCanonicalDoc>): Promise<void>;
  getDocById(id: string): Promise<PersistedCanonicalDoc | undefined>;
  queryDocsByType(type: CanonicalType): Promise<PersistedCanonicalDoc[]>;
  deleteDoc(id: string): Promise<void>;
  // Relationships
  addRelationship(rel: PersistedRelationship): Promise<void>;
  removeRelationship(id: string): Promise<void>;
  getRelationsForDoc(docId: string): Promise<PersistedRelationship[]>;
  // Patches
  addPatch(patch: PersistedCanonicalPatch): Promise<void>;
  updatePatchStatus(id: string, status: PersistedCanonicalPatch["status"]): Promise<void>;
  getPendingPatches(): Promise<PersistedCanonicalPatch[]>;
  getPatchesForDoc(docId: string): Promise<PersistedCanonicalPatch[]>;
  // Schema version utilities
  checkSchemaVersion(): Promise<{ needsMigration: boolean; storedVersion: number | null }>;
}

/**
 * Helper to normalize a persisted node back to a runtime RAGNode.
 */
export function materializeNode(record: PersistedRAGNode): RAGNode {
  const { vectorEmbedding, ...rest } = record;
  return {
    ...rest,
    vectorEmbedding: vectorEmbedding ? new Float32Array(vectorEmbedding) : undefined,
  };
}

/**
 * Helper to flatten a runtime node for IndexedDB storage.
 */
export function serializeNode(node: RAGNode): PersistedRAGNode {
  const { vectorEmbedding, ...rest } = node;
  return {
    ...rest,
    vectorEmbedding: vectorEmbedding ? Array.from(vectorEmbedding) : undefined,
  };
}

/**
 * Helper to strip indexing helper field when reading embedding records.
 */
export function materializeEmbedding(record: StoredEmbedding): StoredEmbedding {
  return { ...record };
}
