import { randomUUID } from "crypto";
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_RUN_BUDGET,
  type CanonicalDoc,
  type CanonicalPatch,
  type CanonicalType,
  type CloudProviderConfig,
  type PatchOperation,
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
  /**
   * Canonical entity / relationship patches extracted from the AI response.
   * Confidence >= 0.85 → autoCommit: true (apply without user review).
   * Confidence < 0.85  → autoCommit: false (surfaced in Build Feed).
   */
  canonicalPatches: CanonicalPatch[];
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
  /**
   * Raw canonical entity/relationship ops returned by the cloud model.
   * Each item corresponds to a single PatchOperation.
   */
  canonicalPatches?: Array<{
    op?: string;
    docType?: string;
    fields?: Partial<CanonicalDoc>;
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
        "If the response introduces new narrative entities (characters, locations, etc.) add them to canonicalPatches.",
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
            edits: [
              {
                type: "replace | insert | delete",
              },
            ],
            citations: [],
          },
        ],
        canonicalPatches: [
          {
            op: "create | add-relationship",
            docType: "character | location | faction | magic_system | item | lore_entry | rule | scene | timeline_event",
            fields: {
              name: "string",
              summary: "string",
              type: "<CanonicalType>",
            },
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
      canonicalPatches: [],
      usage,
    };
  }

  const patches: ProposedPatchBatch[] = (parsed.patches ?? [])
    .map((patch) => {
      const edits = (patch.edits ?? []).filter(isLineEdit);
      if (edits.length === 0) return null;

      return {
        id: patch.id ?? randomUUID(),
        targetId: patch.targetId ?? "active",
        targetKind: patch.targetKind ?? "active",
        targetKey: patch.targetKey,
        edits,
        rationale: patch.rationale ?? "Assisted cloud suggestion",
        citations: patch.citations,
      } as ProposedPatchBatch;
    })
    .filter((patch): patch is ProposedPatchBatch => patch !== null);

  // Normalise raw canonical entity ops into typed CanonicalPatch records.
  const canonicalPatches: CanonicalPatch[] = (parsed.canonicalPatches ?? [])
    .map((raw): CanonicalPatch | null => {
      const opStr = raw.op ?? "create";
      let operation: PatchOperation | null = null;

      if (opStr === "create" && raw.fields) {
        const docType = (raw.docType ?? raw.fields.type ?? "lore_entry") as CanonicalType;
        operation = {
          op: "create",
          docType,
          fields: { ...raw.fields, type: docType },
        };
      } else if (opStr === "add-relationship" && raw.relationship) {
        operation = { op: "add-relationship", relationship: raw.relationship };
      }

      if (!operation) return null;

      const confidence = typeof raw.confidence === "number" ? Math.min(1, Math.max(0, raw.confidence)) : 0.65;
      return {
        id: `cpatch_${randomUUID().slice(0, 8)}`,
        status: "pending",
        operations: [operation],
        sourceRef: { kind: "chat_message", id: randomUUID() },
        confidence,
        autoCommit: confidence >= 0.85,
        createdAt: Date.now(),
      } satisfies CanonicalPatch;
    })
    .filter((p): p is CanonicalPatch => p !== null);

  return {
    message: parsed.message ?? "Assisted cloud run completed.",
    patches,
    canonicalPatches,
    usage,
  };
}
