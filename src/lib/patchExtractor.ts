/**
 * Canonical entity and relationship extraction (Plan 001 — Phase 4).
 *
 * `extractCanonical` parses prose or research text through the local Ollama
 * model and returns a `CanonicalPatch` containing proposed create / update /
 * add-relationship operations for user review in the Build Feed.
 *
 * All extraction is 100 % local (Ollama). No external API calls are made here.
 * Cloud-assisted extraction goes through /api/cloud/assist with mode="canonical".
 *
 * Confidence tiers (per plan section 8.2):
 *   Low    → adding a citation/synonym       → auto-committed (not returned as pending)
 *   Medium → new doc creation                → pending patch
 *   High   → field update / contradiction    → pending patch
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
 * @param text       The prose or research text to analyse.
 * @param sourceType Origin of the text ("chat" | "research" | "manual").
 * @param sourceId   ID of the originating message, run, or session.
 */
export async function extractCanonical(
  text: string,
  sourceType: CanonicalPatch["sourceType"],
  sourceId: string,
): Promise<CanonicalPatch> {
  const extraction = await callOllamaExtraction(text);

  // Build a name → docId map for relationship resolution
  const nameToId = new Map<string, string>();
  const operations: PatchOperation[] = [];
  const source: SourceRef = { type: sourceType, id: sourceId };

  for (const entity of extraction.entities) {
    const rawType = entity.type?.toLowerCase().replace(/ /g, "_");
    if (!VALID_TYPES.has(rawType)) continue;

    const docType = rawType as CanonicalType;
    const docId = makeDocId(docType, entity.name ?? "");
    nameToId.set((entity.name ?? "").toLowerCase(), docId);

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
      updatedAt: Date.now(),
    };

    operations.push({ op: "create", docType, fields });
  }

  for (const rel of extraction.relationships) {
    const fromId = nameToId.get((rel.from ?? "").toLowerCase());
    const toId   = nameToId.get((rel.to   ?? "").toLowerCase());
    if (!fromId || !toId) continue;

    const relationship: Omit<Relationship, "id"> = {
      from:     fromId,
      type:     rel.relType ?? "related_to",
      to:       toId,
      metadata: {},
      sources:  [source],
    };

    operations.push({ op: "add-relationship", relationship });
  }

  const patch: CanonicalPatch = {
    id:         makeId("patch"),
    status:     "pending",
    operations,
    sourceType,
    sourceId,
    createdAt:  Date.now(),
  };

  return patch;
}

/**
 * Convenience: extract from text and persist the patch immediately using a
 * RAGStore instance.  The patch stays `pending` — no doc mutations are made.
 */
export async function extractAndStorePatch(
  text: string,
  sourceType: CanonicalPatch["sourceType"],
  sourceId: string,
  store: { addPatch(p: CanonicalPatch): Promise<void> },
): Promise<CanonicalPatch> {
  const patch = await extractCanonical(text, sourceType, sourceId);
  if (patch.operations.length > 0) {
    await store.addPatch(patch);
  }
  return patch;
}
