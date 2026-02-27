import { randomUUID } from "crypto";
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_RUN_BUDGET,
  type CloudProviderConfig,
  type ProposedPatchBatch,
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

  return {
    message: parsed.message ?? "Assisted cloud run completed.",
    patches,
    usage,
  };
}
