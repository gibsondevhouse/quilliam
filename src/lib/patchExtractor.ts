/**
 * Canonical entity and relationship extraction (Plan 001 — Phase 3/4).
 *
 * `extractPatches` parses prose or research text through the local Ollama model,
 * matches against existing canonical docs, and returns `Patch[]` ready for the
 * Build Feed pipeline:
 *   - autoCommit patches (confidence ≥ 0.85) → apply immediately via `applyPatch`
 *   - review patches (confidence < 0.85) → persist with `store.addPatch`
 *
 * `applyPatch` iterates a patch's operations and dispatches each to the RAGStore,
 * then marks the patch as "accepted".
 *
 * `extractCanonical` (legacy single-patch form) is preserved for backward compat.
 *
 * Confidence tiers (plan 03 table):
 *   0.90 – add-relationship where both ends already exist  → autoCommit: true
 *   0.65 – create or update ops                            → autoCommit: false
 *
 * All extraction is 100 % local (Ollama).
 */

import { OLLAMA_BASE_URL } from "@/lib/ollama";
import { getSystemInfo } from "@/lib/system";
import type {
  CanonicalDoc,
  CanonicalPatch,
  CanonicalType,
  PatchOperation,
  Relationship,
  SourceRef,
} from "@/lib/types";

type SourceKind = SourceRef["kind"];

// ---------------------------------------------------------------------------
// ID generation helpers
// ---------------------------------------------------------------------------

const TYPE_PREFIX: Record<CanonicalType, string> = {
  character:      "char",
  location:       "loc",
  faction:        "fac",
  magic_system:   "mgc",
  item:           "itm",
  lore_entry:     "lre",
  rule:           "rul",
  scene:          "scn",
  timeline_event: "evt",
};

/** Generate a deterministic-ish ID from a canonical type and a name slug. */
function makeDocId(type: CanonicalType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type]}_${slug}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Ollama extraction prompt
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `You are a canonical entity extractor for a narrative writing tool.
Given a passage of prose or research notes, identify all narrative entities and relationships.
Respond ONLY with a valid JSON object — no markdown, no explanation.

JSON format:
{
  "entities": [
    { "type": "<CanonicalType>", "name": "<name>", "summary": "<one sentence>" }
  ],
  "relationships": [
    { "from": "<name>", "relType": "<edge label>", "to": "<name>" }
  ]
}

Valid CanonicalType values: character, location, faction, magic_system, item, lore_entry, rule, scene, timeline_event
Valid edge labels (use the most specific): member_of, located_at, appears_in, owns, rivals, parent_of, precedes, commands, rules, allies_with, opposes

Return empty arrays if nothing clearly matches. Never invent facts not present in the input.`;

// ---------------------------------------------------------------------------
// Raw extraction from Ollama
// ---------------------------------------------------------------------------

interface RawEntity {
  type: string;
  name: string;
  summary: string;
}

interface RawRelationship {
  from: string;
  relType: string;
  to: string;
}

interface ExtractionResult {
  entities: RawEntity[];
  relationships: RawRelationship[];
}

const VALID_TYPES = new Set<string>([
  "character", "location", "faction", "magic_system",
  "item", "lore_entry", "rule", "scene", "timeline_event",
]);

async function callOllamaExtraction(text: string): Promise<ExtractionResult> {
  const { model } = getSystemInfo();
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.1, num_batch: 128 },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user",   content: `Extract entities and relationships from:\n\n${text}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama extraction failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const raw = data.message?.content ?? "{}";

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<ExtractionResult>;
    return {
      entities:      Array.isArray(parsed.entities)      ? parsed.entities      : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    };
  } catch {
    // Extraction is best-effort — an unparseable response yields an empty patch.
    return { entities: [], relationships: [] };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract canonical entities and relationships from `text` using the local
 * Ollama model.  Returns a `CanonicalPatch` with `status: "pending"`.
 *
 * All operations in the returned patch must be reviewed by the user in the
 * Build Feed before they are written to the `canonicalDocs` store.
 *
 * @param text     The prose or research text to analyse.
 * @param kind     Origin kind of the text ("chat_message" | "research_artifact" | "manual").
 * @param sourceId ID of the originating message, run, or session.
 */
export async function extractCanonical(
  text: string,
  kind: SourceKind,
  sourceId: string,
): Promise<CanonicalPatch> {
  const extraction = await callOllamaExtraction(text);

  // Build a name → docId map for relationship resolution
  const nameToId = new Map<string, string>();
  const operations: PatchOperation[] = [];
  const source: SourceRef = { kind, id: sourceId };

  for (const entity of extraction.entities) {
    const rawType = entity.type?.toLowerCase().replace(/ /g, "_");
    if (!VALID_TYPES.has(rawType)) continue;

    const docType = rawType as CanonicalType;
    const docId = makeDocId(docType, entity.name ?? "");
    nameToId.set((entity.name ?? "").toLowerCase(), docId);

    const now = Date.now();
    const fields: Partial<CanonicalDoc> = {
      id: docId,
      type: docType,
      name: entity.name ?? "",
      summary: entity.summary ?? "",
      details: {},
      status: "draft",
      sources: [source],
      relationships: [],
      lastVerified: 0,
      createdAt: now,
      updatedAt: now,
    };

    operations.push({ op: "create", docType, fields });
  }

  for (const rel of extraction.relationships) {
    const fromId = nameToId.get((rel.from ?? "").toLowerCase());
    const toId   = nameToId.get((rel.to   ?? "").toLowerCase());
    if (!fromId || !toId) continue;

    const relationship: Omit<Relationship, "id" | "createdAt"> = {
      from:     fromId,
      type:     rel.relType ?? "related_to",
      to:       toId,
      metadata: {},
      sources:  [source],
    };

    operations.push({ op: "add-relationship", relationship });
  }

  const patch: CanonicalPatch = {
    id:          makeId("patch"),
    status:      "pending",
    operations,
    sourceRef:   source,
    confidence:  operations.length > 0 ? 0.6 : 0,
    autoCommit:  false,
    createdAt:   Date.now(),
  };

  return patch;
}

/**
 * Convenience: extract from text and persist the patch immediately using a
 * RAGStore instance.  The patch stays `pending` — no doc mutations are made.
 */
export async function extractAndStorePatch(
  text: string,
  kind: SourceKind,
  sourceId: string,
  store: { addPatch(p: CanonicalPatch): Promise<void> },
): Promise<CanonicalPatch> {
  const patch = await extractCanonical(text, kind, sourceId);
  if (patch.operations.length > 0) {
    await store.addPatch(patch);
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Plan 003 — Patch Proposal Pipeline
// ---------------------------------------------------------------------------

/**
 * Minimal store interface required by `applyPatch`.
 * Keeps patchExtractor free of a hard import on the IndexedDB-backed RAGStore.
 */
export interface PatchApplyStore {
  addDoc(doc: CanonicalDoc): Promise<void>;
  updateDoc(id: string, changes: Partial<CanonicalDoc>): Promise<void>;
  addRelationship(rel: Relationship): Promise<void>;
  removeRelationship(id: string): Promise<void>;
  deleteDoc(id: string): Promise<void>;
  updatePatchStatus(id: string, status: CanonicalPatch["status"]): Promise<void>;
}

/**
 * Extract canonical entities and relationships from `text`, matching against
 * `existingDocs` to decide whether to create new docs or update existing ones.
 *
 * Returns an array of up to two `CanonicalPatch` objects:
 *   1. An **auto-commit** patch (confidence 0.90, autoCommit: true) containing
 *      `add-relationship` operations between docs that already exist in the store.
 *   2. A **review** patch (confidence 0.65, autoCommit: false) containing all
 *      `create` and `update` operations, plus relationships involving new docs.
 *
 * Empty patch objects are omitted from the return value.
 *
 * @param text         Prose or research text to analyse.
 * @param existingDocs Current canonical docs from the store (used for name matching).
 * @param sourceRef    Origin of the text (chat message, research artifact, etc.).
 */
export async function extractPatches(
  text: string,
  existingDocs: CanonicalDoc[],
  sourceRef: SourceRef,
): Promise<CanonicalPatch[]> {
  const extraction = await callOllamaExtraction(text);

  // Build lowercase name → existing doc lookup table
  const existingByName = new Map<string, CanonicalDoc>();
  for (const doc of existingDocs) {
    existingByName.set(doc.name.toLowerCase(), doc);
    // Also index aliases stored in details (if present)
    const aliases = (doc.details?.aliases ?? []) as string[];
    for (const alias of aliases) {
      existingByName.set(alias.toLowerCase(), doc);
    }
  }

  // Track all name → docId resolutions (existing + newly-proposed)
  const resolvedIds = new Map<string, string>();
  for (const [name, doc] of existingByName) {
    resolvedIds.set(name, doc.id);
  }

  // Ops split by confidence tier
  const autoOps: PatchOperation[] = [];   // confidence 0.90, autoCommit: true
  const reviewOps: PatchOperation[] = []; // confidence 0.65, autoCommit: false

  // --- Entity operations -------------------------------------------------------
  for (const entity of extraction.entities) {
    const rawType = entity.type?.toLowerCase().replace(/ /g, "_");
    if (!VALID_TYPES.has(rawType)) continue;

    const docType = rawType as CanonicalType;
    const name = entity.name ?? "";
    const nameLower = name.toLowerCase();

    const existing = existingByName.get(nameLower);

    if (existing) {
      // Entity already exists — propose a summary update when content differs
      if (entity.summary && entity.summary.trim() !== existing.summary.trim()) {
        reviewOps.push({
          op: "update",
          docId: existing.id,
          field: "summary",
          oldValue: existing.summary,
          newValue: entity.summary.trim(),
        });
      }
      // Keep resolved for relationship lookup (already registered above)
    } else {
      // New entity — propose create
      const docId = makeDocId(docType, name);
      resolvedIds.set(nameLower, docId);

      const now = Date.now();
      const fields: Partial<CanonicalDoc> = {
        id:            docId,
        type:          docType,
        name,
        summary:       entity.summary ?? "",
        details:       {},
        status:        "draft",
        sources:       [sourceRef],
        relationships: [],
        lastVerified:  0,
        createdAt:     now,
        updatedAt:     now,
      };
      reviewOps.push({ op: "create", docType, fields });
    }
  }

  // --- Relationship operations --------------------------------------------------
  for (const rel of extraction.relationships) {
    const fromName = (rel.from ?? "").toLowerCase();
    const toName   = (rel.to   ?? "").toLowerCase();
    const fromId = resolvedIds.get(fromName);
    const toId   = resolvedIds.get(toName);
    if (!fromId || !toId) continue;

    const relationship: Omit<Relationship, "id" | "createdAt"> = {
      from:     fromId,
      type:     rel.relType ?? "related_to",
      to:       toId,
      metadata: {},
      sources:  [sourceRef],
    };

    // Both ends already exist in the store → high-confidence citation, auto-commit
    const bothExistAlready =
      existingByName.has(fromName) && existingByName.has(toName);

    if (bothExistAlready) {
      autoOps.push({ op: "add-relationship", relationship });
    } else {
      reviewOps.push({ op: "add-relationship", relationship });
    }
  }

  // --- Assemble patches ---------------------------------------------------------
  const patches: CanonicalPatch[] = [];

  if (autoOps.length > 0) {
    patches.push({
      id:         makeId("patch"),
      status:     "pending",
      operations: autoOps,
      sourceRef,
      confidence: 0.9,
      autoCommit: true,
      createdAt:  Date.now(),
    });
  }

  if (reviewOps.length > 0) {
    patches.push({
      id:         makeId("patch"),
      status:     "pending",
      operations: reviewOps,
      sourceRef,
      confidence: 0.65,
      autoCommit: false,
      createdAt:  Date.now(),
    });
  }

  return patches;
}

/**
 * Apply all operations in `patch` to the store, then mark the patch as "accepted".
 *
 * Operations are executed in declaration order. Partial failures are NOT rolled back —
 * callers that require atomicity should wrap in their own store transaction.
 *
 * @param patch  The patch to apply (typically one with `autoCommit: true`).
 * @param store  A store instance exposing the required mutation methods.
 */
export async function applyPatch(
  patch: CanonicalPatch,
  store: PatchApplyStore,
): Promise<void> {
  const now = Date.now();

  for (const op of patch.operations) {
    switch (op.op) {
      case "create": {
        const doc: CanonicalDoc = {
          id:            (op.fields.id as string) ?? makeDocId(op.docType, (op.fields.name as string) ?? ""),
          type:          op.docType,
          name:          (op.fields.name as string) ?? "",
          summary:       (op.fields.summary as string) ?? "",
          details:       (op.fields.details as Record<string, unknown>) ?? {},
          status:        "draft",
          sources:       (op.fields.sources as SourceRef[]) ?? [patch.sourceRef],
          relationships: [],
          lastVerified:  0,
          createdAt:     now,
          updatedAt:     now,
          // Spread last so explicit fields in the proposal win
          ...op.fields,
        };
        await store.addDoc(doc);
        break;
      }

      case "update":
        await store.updateDoc(op.docId, {
          [op.field]: op.newValue,
          updatedAt:  now,
        } as Partial<CanonicalDoc>);
        break;

      case "add-relationship": {
        const rel: Relationship = {
          id:        makeId("rel"),
          createdAt: now,
          ...op.relationship,
        };
        await store.addRelationship(rel);
        break;
      }

      case "remove-relationship":
        await store.removeRelationship(op.relationshipId);
        break;

      case "delete":
        await store.deleteDoc(op.docId);
        break;

      case "mark-contradiction":
        await store.updateDoc(op.docId, {
          status:    "draft",
          updatedAt: now,
        });
        break;
    }
  }

  await store.updatePatchStatus(patch.id, "accepted");
}
