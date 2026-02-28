import { randomUUID } from "crypto";
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_RUN_BUDGET,
  type CloudProviderConfig,
  type Entry,
  type EntryPatch,
  type EntryPatchOperation,
  type EntryType,
  type ProposedPatchBatch,
  type Relationship,
  type RunBudget,
  type UsageMeter,
} from "@/lib/types";
import type { LineEdit } from "@/lib/changeSets";
import { callAnthropicText, extractJsonObject } from "@/lib/cloud/anthropic";

export interface AssistInput {
  query: string;
  context: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  providerConfig?: Partial<CloudProviderConfig>;
  budget?: Partial<RunBudget>;
}

export interface AssistResult {
  message: string;
  patches: ProposedPatchBatch[];
  /** Plan-002 patch stream used by Chat/BuildFeed. */
  entryPatches: EntryPatch[];
  /** Compatibility alias for one release cycle. */
  canonicalPatches: EntryPatch[];
  usage: UsageMeter;
}

interface RawAssistResult {
  message?: string;
  patches?: Array<{
    id?: string;
    targetId?: string;
    targetKind?: ProposedPatchBatch["targetKind"];
    targetKey?: string;
    edits?: LineEdit[];
    rationale?: string;
    citations?: ProposedPatchBatch["citations"];
  }>;
  entryPatches?: Array<{
    op?: string;
    entryType?: string;
    docType?: string;
    fields?: Partial<Entry>;
    entry?: Partial<Entry>;
    relationship?: Omit<Relationship, "id" | "createdAt">;
    relation?: Omit<Relationship, "id" | "createdAt">;
    confidence?: number;
  }>;
  canonicalPatches?: Array<{
    op?: string;
    docType?: string;
    fields?: Partial<Entry>;
    relationship?: Omit<Relationship, "id" | "createdAt">;
    confidence?: number;
  }>;
}

function normalizeProviderConfig(input?: Partial<CloudProviderConfig>): CloudProviderConfig {
  return {
    anthropicModel: input?.anthropicModel ?? DEFAULT_PROVIDER_CONFIG.anthropicModel,
    tavilyEnabled: input?.tavilyEnabled ?? DEFAULT_PROVIDER_CONFIG.tavilyEnabled,
  };
}

function normalizeBudget(input?: Partial<RunBudget>): RunBudget {
  return {
    maxUsd: input?.maxUsd ?? DEFAULT_RUN_BUDGET.maxUsd,
    maxInputTokens: input?.maxInputTokens ?? DEFAULT_RUN_BUDGET.maxInputTokens,
    maxOutputTokens: input?.maxOutputTokens ?? DEFAULT_RUN_BUDGET.maxOutputTokens,
    maxMinutes: input?.maxMinutes ?? DEFAULT_RUN_BUDGET.maxMinutes,
    maxSources: input?.maxSources ?? DEFAULT_RUN_BUDGET.maxSources,
  };
}

function isLineEdit(value: unknown): value is LineEdit {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "replace") {
    return (
      typeof candidate.start === "number" &&
      typeof candidate.end === "number" &&
      Array.isArray(candidate.newLines)
    );
  }
  if (candidate.type === "insert") {
    return typeof candidate.afterIndex === "number" && Array.isArray(candidate.newLines);
  }
  if (candidate.type === "delete") {
    return typeof candidate.start === "number" && typeof candidate.end === "number";
  }
  return false;
}

function normalizeEntryType(value?: string): EntryType {
  switch ((value ?? "").toLowerCase()) {
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
      return value as EntryType;
    default:
      return "culture";
  }
}

function normalizeEntryPatchOp(raw: {
  op?: string;
  entryType?: string;
  docType?: string;
  fields?: Partial<Entry>;
  entry?: Partial<Entry>;
  relationship?: Omit<Relationship, "id" | "createdAt">;
  relation?: Omit<Relationship, "id" | "createdAt">;
}): EntryPatchOperation | null {
  const op = raw.op ?? "create-entry";

  if ((op === "create" || op === "create-entry") && (raw.entry || raw.fields)) {
    const payload = raw.entry ?? raw.fields ?? {};
    const entryType = normalizeEntryType(raw.entryType ?? raw.docType ?? payload.entryType ?? payload.type?.toString());
    return {
      op: "create-entry",
      entryType,
      entry: {
        ...payload,
        entryType,
        type: entryType,
        name: payload.name ?? "",
        summary: payload.summary ?? "",
      },
    };
  }

  if ((op === "add-relation" || op === "add-relationship") && (raw.relation || raw.relationship)) {
    const relation = raw.relation ?? raw.relationship;
    if (!relation) return null;
    return {
      op: "add-relation",
      relation,
    };
  }

  return null;
}

function buildEntryPatchFromRaw(
  raw: {
    op?: string;
    entryType?: string;
    docType?: string;
    fields?: Partial<Entry>;
    entry?: Partial<Entry>;
    relationship?: Omit<Relationship, "id" | "createdAt">;
    relation?: Omit<Relationship, "id" | "createdAt">;
    confidence?: number;
  },
): EntryPatch | null {
  const operation = normalizeEntryPatchOp(raw);
  if (!operation) return null;

  const confidence = typeof raw.confidence === "number"
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0.65;

  return {
    id: `epatch_${randomUUID().slice(0, 8)}`,
    status: "pending",
    operations: [operation],
    sourceRef: { kind: "chat_message", id: randomUUID() },
    confidence,
    autoCommit: confidence >= 0.85,
    createdAt: Date.now(),
  };
}

export async function runAssistedCloud(input: AssistInput, anthropicApiKey: string): Promise<AssistResult> {
  const providerConfig = normalizeProviderConfig(input.providerConfig);
  const budget = normalizeBudget(input.budget);

  const prompt = JSON.stringify(
    {
      task: "Assistive writing and scoped refactor suggestions",
      instructions: [
        "Return strict JSON only.",
        "Use patches only when an explicit text change is requested.",
        "Each patch must include targetKind and edits in line-edit format.",
        "If the response introduces new narrative entities, add them to entryPatches.",
        "Do not include markdown code fences.",
      ],
      query: input.query,
      context: input.context.slice(0, 12_000),
      messages: input.messages.slice(-8),
      outputSchema: {
        message: "string",
        patches: [
          {
            id: "string",
            targetId: "string",
            targetKind: "active | chapter | character | location | world",
            targetKey: "string | undefined",
            rationale: "string",
            edits: [{ type: "replace | insert | delete" }],
            citations: [],
          },
        ],
        entryPatches: [
          {
            op: "create-entry | add-relation",
            entryType: "character | location | culture | organization | system | item | language | religion | lineage | economy | rule | scene | timeline_event",
            fields: { name: "string", summary: "string" },
            confidence: 0.9,
          },
        ],
      },
    },
    null,
    2,
  );

  const anthropic = await callAnthropicText({
    apiKey: anthropicApiKey,
    model: providerConfig.anthropicModel,
    system: "You are Quilliam Assisted Cloud. Produce conservative, review-first edits.",
    user: prompt,
    maxTokens: 2200,
    temperature: 0.2,
  });

  const parsed = extractJsonObject<RawAssistResult>(anthropic.text);

  const usage: UsageMeter = {
    spentUsd:
      anthropic.usage.inputTokens * 0.000003 +
      anthropic.usage.outputTokens * 0.000015,
    inputTokens: anthropic.usage.inputTokens,
    outputTokens: anthropic.usage.outputTokens,
    sourcesFetched: 0,
    elapsedMs: 0,
  };

  if (usage.inputTokens > budget.maxInputTokens || usage.outputTokens > budget.maxOutputTokens) {
    throw new Error("Assisted cloud request exceeded token budget limits.");
  }

  if (!parsed) {
    return {
      message: anthropic.text || "Assisted cloud completed, but no structured patches were returned.",
      patches: [],
      entryPatches: [],
      canonicalPatches: [],
      usage,
    };
  }

  const patches: ProposedPatchBatch[] = [];
  for (const patch of parsed.patches ?? []) {
    const edits = (patch.edits ?? []).filter(isLineEdit);
    if (edits.length === 0) continue;
    patches.push({
      id: patch.id ?? randomUUID(),
      targetId: patch.targetId ?? "active",
      targetKind: patch.targetKind ?? "active",
      targetKey: patch.targetKey,
      edits,
      rationale: patch.rationale ?? "Assisted cloud suggestion",
      citations: patch.citations,
    });
  }

  const rawEntryOps = [
    ...(parsed.entryPatches ?? []),
    ...(parsed.canonicalPatches ?? []),
  ];

  const entryPatches = rawEntryOps
    .map(buildEntryPatchFromRaw)
    .filter((patch): patch is EntryPatch => patch !== null);

  return {
    message: parsed.message ?? "Assisted cloud run completed.",
    patches,
    entryPatches,
    canonicalPatches: entryPatches,
    usage,
  };
}
