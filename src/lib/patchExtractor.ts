/**
 * Entry extraction and patch proposal pipeline.
 *
 * This file keeps legacy function names (`extractCanonical`, `applyPatch`) as
 * compatibility wrappers while emitting Plan-002 `EntryPatch` operations.
 */

import { OLLAMA_BASE_URL } from "@/lib/ollama";
import { getSystemInfo } from "@/lib/system";
import { applyEntryPatch, type EntryPatchStore } from "@/lib/domain/patch";
import type {
  Entry,
  EntryPatch,
  EntryPatchOperation,
  EntryType,
  Relationship,
  SourceRef,
} from "@/lib/types";

type SourceKind = SourceRef["kind"];

const TYPE_PREFIX: Record<EntryType, string> = {
  character: "char",
  location: "loc",
  culture: "cul",
  organization: "org",
  system: "sys",
  item: "itm",
  language: "lng",
  religion: "rel",
  lineage: "lin",
  economy: "eco",
  rule: "rul",
  // Transitional legacy values
  faction: "fac",
  magic_system: "mgc",
  lore_entry: "lre",
  scene: "scn",
  timeline_event: "evt",
};

const EXTRACTION_SYSTEM_PROMPT = `You are an entry extractor for a narrative writing tool.
Given a passage of prose or research notes, identify entities and relationships.
Respond ONLY with valid JSON.

JSON format:
{
  "entities": [
    { "type": "<EntryType>", "name": "<name>", "summary": "<one sentence>" }
  ],
  "relationships": [
    { "from": "<name>", "relType": "<edge label>", "to": "<name>" }
  ]
}

Valid EntryType values: character, location, culture, organization, system, item, language, religion, lineage, economy, rule, scene, timeline_event
Legacy aliases accepted: faction, magic_system, lore_entry
Return empty arrays if nothing clearly matches.`;

interface RawEntity {
  type?: string;
  name?: string;
  summary?: string;
}

interface RawRelationship {
  from?: string;
  relType?: string;
  to?: string;
}

interface ExtractionResult {
  entities: RawEntity[];
  relationships: RawRelationship[];
}

const VALID_TYPES = new Set<string>([
  "character",
  "location",
  "culture",
  "organization",
  "system",
  "item",
  "language",
  "religion",
  "lineage",
  "economy",
  "rule",
  "scene",
  "timeline_event",
  "faction",
  "magic_system",
  "lore_entry",
]);

function mapRawType(raw: string): EntryType | null {
  switch (raw) {
    case "faction":
      return "organization";
    case "magic_system":
      return "system";
    case "character":
    case "location":
    case "culture":
    case "organization":
    case "system":
    case "item":
    case "language":
    case "religion":
    case "lineage":
    case "economy":
    case "rule":
    case "scene":
    case "timeline_event":
    case "lore_entry":
      return raw;
    default:
      return null;
  }
}

function makeDocId(type: EntryType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type] ?? "ent"}_${slug}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

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
        { role: "user", content: `Extract entities and relationships from:\n\n${text}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama extraction failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const raw = data.message?.content ?? "{}";
  const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<ExtractionResult>;
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    };
  } catch {
    return { entities: [], relationships: [] };
  }
}

/** Legacy-compatible single-patch extraction. */
export async function extractCanonical(
  text: string,
  kind: SourceKind,
  sourceId: string,
): Promise<EntryPatch> {
  const extraction = await callOllamaExtraction(text);

  const nameToId = new Map<string, string>();
  const operations: EntryPatchOperation[] = [];
  const source: SourceRef = { kind, id: sourceId };

  for (const entity of extraction.entities) {
    const rawType = entity.type?.toLowerCase().replace(/ /g, "_") ?? "";
    if (!VALID_TYPES.has(rawType)) continue;

    const entryType = mapRawType(rawType);
    const name = entity.name?.trim() ?? "";
    if (!entryType || !name) continue;

    const entryId = makeDocId(entryType, name);
    nameToId.set(name.toLowerCase(), entryId);

    const now = Date.now();
    operations.push({
      op: "create-entry",
      entryType,
      entry: {
        id: entryId,
        entryType,
        type: entryType,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        summary: entity.summary?.trim() ?? "",
        bodyMd: "",
        canonStatus: "draft",
        status: "draft",
        visibility: "private",
        details: {},
        sources: [source],
        relationships: [],
        lastVerified: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const rel of extraction.relationships) {
    const fromId = nameToId.get((rel.from ?? "").toLowerCase());
    const toId = nameToId.get((rel.to ?? "").toLowerCase());
    if (!fromId || !toId) continue;

    operations.push({
      op: "add-relation",
      relation: {
        from: fromId,
        to: toId,
        type: rel.relType ?? "related_to",
        metadata: {},
        sources: [source],
      },
    });
  }

  return {
    id: makeId("epatch"),
    status: "pending",
    operations,
    sourceRef: source,
    confidence: operations.length > 0 ? 0.65 : 0,
    autoCommit: false,
    createdAt: Date.now(),
  };
}

export async function extractAndStorePatch(
  text: string,
  kind: SourceKind,
  sourceId: string,
  store: { addPatch?: (p: EntryPatch) => Promise<void>; addEntryPatch?: (p: EntryPatch) => Promise<void> },
): Promise<EntryPatch> {
  const patch = await extractCanonical(text, kind, sourceId);
  if (patch.operations.length > 0) {
    if (store.addEntryPatch) {
      await store.addEntryPatch(patch);
    } else if (store.addPatch) {
      await store.addPatch(patch);
    }
  }
  return patch;
}

/**
 * Name-aware extraction with confidence-tier split:
 * - autoCommit patch (0.90): add-relation where both ends already exist
 * - review patch  (0.65): create-entry/update-entry and other relations
 */
export async function extractPatches(
  text: string,
  existingEntries: Entry[],
  sourceRef: SourceRef,
): Promise<EntryPatch[]> {
  const extraction = await callOllamaExtraction(text);

  const existingByName = new Map<string, Entry>();
  for (const entry of existingEntries) {
    existingByName.set(entry.name.toLowerCase(), entry);
    for (const alias of entry.aliases ?? []) {
      existingByName.set(alias.toLowerCase(), entry);
    }
    const detailAliases = Array.isArray(entry.details?.aliases)
      ? (entry.details.aliases as string[])
      : [];
    for (const alias of detailAliases) {
      existingByName.set(alias.toLowerCase(), entry);
    }
  }

  const resolvedIds = new Map<string, string>();
  for (const [name, entry] of existingByName) {
    resolvedIds.set(name, entry.id);
  }

  const autoOps: EntryPatchOperation[] = [];
  const reviewOps: EntryPatchOperation[] = [];

  for (const entity of extraction.entities) {
    const rawType = entity.type?.toLowerCase().replace(/ /g, "_") ?? "";
    if (!VALID_TYPES.has(rawType)) continue;

    const entryType = mapRawType(rawType);
    const name = entity.name?.trim() ?? "";
    if (!entryType || !name) continue;

    const key = name.toLowerCase();
    const existing = existingByName.get(key);

    if (existing) {
      const incomingSummary = entity.summary?.trim() ?? "";
      if (incomingSummary && incomingSummary !== existing.summary.trim()) {
        reviewOps.push({
          op: "update-entry",
          entryId: existing.id,
          field: "summary",
          oldValue: existing.summary,
          newValue: incomingSummary,
        });
      }
      resolvedIds.set(key, existing.id);
      continue;
    }

    const entryId = makeDocId(entryType, name);
    resolvedIds.set(key, entryId);

    const now = Date.now();
    reviewOps.push({
      op: "create-entry",
      entryType,
      entry: {
        id: entryId,
        entryType,
        type: entryType,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        summary: entity.summary?.trim() ?? "",
        bodyMd: "",
        canonStatus: "draft",
        status: "draft",
        visibility: "private",
        details: {},
        sources: [sourceRef],
        relationships: [],
        lastVerified: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  for (const rel of extraction.relationships) {
    const fromName = (rel.from ?? "").toLowerCase();
    const toName = (rel.to ?? "").toLowerCase();
    const fromId = resolvedIds.get(fromName);
    const toId = resolvedIds.get(toName);
    if (!fromId || !toId) continue;

    const relation: Omit<Relationship, "id" | "createdAt"> = {
      from: fromId,
      to: toId,
      type: rel.relType ?? "related_to",
      metadata: {},
      sources: [sourceRef],
    };

    const bothExistAlready = existingByName.has(fromName) && existingByName.has(toName);
    if (bothExistAlready) {
      autoOps.push({ op: "add-relation", relation });
    } else {
      reviewOps.push({ op: "add-relation", relation });
    }
  }

  const patches: EntryPatch[] = [];

  if (autoOps.length > 0) {
    patches.push({
      id: makeId("epatch"),
      status: "pending",
      operations: autoOps,
      sourceRef,
      confidence: 0.9,
      autoCommit: true,
      createdAt: Date.now(),
    });
  }

  if (reviewOps.length > 0) {
    patches.push({
      id: makeId("epatch"),
      status: "pending",
      operations: reviewOps,
      sourceRef,
      confidence: 0.65,
      autoCommit: false,
      createdAt: Date.now(),
    });
  }

  return patches;
}

export interface PatchApplyStore extends EntryPatchStore {
  addDoc?: (doc: Entry) => Promise<void>;
  updateDoc?: (id: string, patch: Partial<Entry>) => Promise<void>;
  addRelationship?: (rel: Relationship) => Promise<void>;
  removeRelationship?: (id: string) => Promise<void>;
  deleteDoc?: (id: string) => Promise<void>;
}

/** Legacy helper retained for callers that still import `applyPatch`. */
export async function applyPatch(patch: EntryPatch, store: PatchApplyStore): Promise<void> {
  await applyEntryPatch(patch, store);
}
