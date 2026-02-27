import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_RUN_BUDGET,
  type CloudProviderConfig,
  type ResearchArtifact,
  type ResearchRunRecord,
  type ResearchRunStatus,
  type RunBudget,
  type UsageMeter,
  type Citation,
} from "@/lib/types";
import { callAnthropicText, extractJsonObject } from "@/lib/cloud/anthropic";
import { validateClaimCitations, type ResearchClaim } from "@/lib/research/citations";
import type { CloudApiKeys } from "@/lib/cloud/vault";

interface TavilySearchHit {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
}

interface TavilySearchResponse {
  results?: TavilySearchHit[];
}

interface SourceDoc {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  body: string;
}

interface RunCreateInput {
  libraryId: string;
  query: string;
  context: string;
  budget?: Partial<RunBudget>;
  providerConfig?: Partial<CloudProviderConfig>;
}

interface SynthesizedPayload {
  notes: string;
  outline: string;
  claims: Array<{
    claimRef: string;
    text: string;
    citations: Citation[];
  }>;
  suggestedChanges: string;
}

const STORE_PATH =
  process.env.QUILLIAM_RESEARCH_RUNS_FILE ??
  path.join(process.cwd(), ".quilliam-research-runs.json");

const INPUT_TOKEN_COST = 0.000003;
const OUTPUT_TOKEN_COST = 0.000015;

function now() {
  return Date.now();
}

function elapsedMs(createdAt: number): number {
  return Math.max(0, now() - createdAt);
}

function asRunBudget(input?: Partial<RunBudget>): RunBudget {
  return {
    maxUsd: input?.maxUsd ?? DEFAULT_RUN_BUDGET.maxUsd,
    maxInputTokens: input?.maxInputTokens ?? DEFAULT_RUN_BUDGET.maxInputTokens,
    maxOutputTokens: input?.maxOutputTokens ?? DEFAULT_RUN_BUDGET.maxOutputTokens,
    maxMinutes: input?.maxMinutes ?? DEFAULT_RUN_BUDGET.maxMinutes,
    maxSources: input?.maxSources ?? DEFAULT_RUN_BUDGET.maxSources,
  };
}

function asProviderConfig(input?: Partial<CloudProviderConfig>): CloudProviderConfig {
  return {
    anthropicModel: input?.anthropicModel ?? DEFAULT_PROVIDER_CONFIG.anthropicModel,
    tavilyEnabled: input?.tavilyEnabled ?? DEFAULT_PROVIDER_CONFIG.tavilyEnabled,
  };
}

function createUsage(): UsageMeter {
  return {
    spentUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    sourcesFetched: 0,
    elapsedMs: 0,
  };
}

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string, max = 1800): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

class ResearchRunManager {
  private runs = new Map<string, ResearchRunRecord>();
  private emitter = new EventEmitter();
  private abortControllers = new Map<string, AbortController>();
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw) as { runs?: ResearchRunRecord[] };
      for (const run of parsed.runs ?? []) {
        this.runs.set(run.id, run);
      }
    } catch {
      // First run: no persistence file yet.
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    const payload = {
      runs: Array.from(this.runs.values()).sort((a, b) => b.updatedAt - a.updatedAt),
      updatedAt: now(),
    };
    await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
  }

  private emit(run: ResearchRunRecord): void {
    this.emitter.emit(run.id, run);
  }

  subscribe(runId: string, handler: (run: ResearchRunRecord) => void): () => void {
    this.emitter.on(runId, handler);
    return () => this.emitter.off(runId, handler);
  }

  async list(libraryId?: string): Promise<ResearchRunRecord[]> {
    await this.ensureLoaded();
    const all = Array.from(this.runs.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!libraryId) return all;
    return all.filter((run) => run.libraryId === libraryId);
  }

  async get(runId: string): Promise<ResearchRunRecord | null> {
    await this.ensureLoaded();
    return this.runs.get(runId) ?? null;
  }

  async create(input: RunCreateInput, keys: CloudApiKeys): Promise<ResearchRunRecord> {
    await this.ensureLoaded();

    const run: ResearchRunRecord = {
      id: randomUUID(),
      libraryId: input.libraryId,
      query: input.query,
      status: "queued",
      phase: "plan",
      checkpoint: {
        context: clip(input.context, 2000),
        providerConfig: asProviderConfig(input.providerConfig),
      },
      budget: asRunBudget(input.budget),
      usage: createUsage(),
      artifacts: [],
      createdAt: now(),
      updatedAt: now(),
    };

    this.runs.set(run.id, run);
    await this.persist();
    this.emit(run);

    void this.execute(run.id, keys, input.context, asProviderConfig(input.providerConfig));

    return run;
  }

  async cancel(runId: string): Promise<ResearchRunRecord | null> {
    await this.ensureLoaded();
    const run = this.runs.get(runId);
    if (!run) return null;

    const controller = this.abortControllers.get(runId);
    if (controller) controller.abort();

    if (run.status === "queued" || run.status === "running") {
      const next: ResearchRunRecord = {
        ...run,
        status: "cancelled",
        updatedAt: now(),
        usage: {
          ...run.usage,
          elapsedMs: elapsedMs(run.createdAt),
        },
      };
      this.runs.set(runId, next);
      await this.persist();
      this.emit(next);
      return next;
    }

    return run;
  }

  private async updateRun(
    runId: string,
    updater: (run: ResearchRunRecord) => ResearchRunRecord,
  ): Promise<ResearchRunRecord> {
    const current = this.runs.get(runId);
    if (!current) throw new Error(`Run ${runId} not found`);

    const next = updater(current);
    this.runs.set(runId, next);
    await this.persist();
    this.emit(next);
    return next;
  }

  private overBudget(run: ResearchRunRecord): { exceeded: boolean; reason?: string } {
    const usage = {
      ...run.usage,
      elapsedMs: elapsedMs(run.createdAt),
    };

    if (usage.spentUsd > run.budget.maxUsd) {
      return { exceeded: true, reason: "Maximum USD budget exceeded." };
    }
    if (usage.inputTokens > run.budget.maxInputTokens) {
      return { exceeded: true, reason: "Maximum input token budget exceeded." };
    }
    if (usage.outputTokens > run.budget.maxOutputTokens) {
      return { exceeded: true, reason: "Maximum output token budget exceeded." };
    }
    if (usage.sourcesFetched > run.budget.maxSources) {
      return { exceeded: true, reason: "Maximum source budget exceeded." };
    }
    if (usage.elapsedMs > run.budget.maxMinutes * 60 * 1000) {
      return { exceeded: true, reason: "Maximum run time exceeded." };
    }

    return { exceeded: false };
  }

  private async enforceBudget(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    const status = this.overBudget(run);
    if (!status.exceeded) return;

    await this.updateRun(runId, (current) => ({
      ...current,
      status: "budget_exceeded",
      error: status.reason,
      usage: {
        ...current.usage,
        elapsedMs: elapsedMs(current.createdAt),
      },
      updatedAt: now(),
    }));

    const controller = this.abortControllers.get(runId);
    if (controller) controller.abort();
    throw new Error(status.reason);
  }

  private async execute(
    runId: string,
    keys: CloudApiKeys,
    context: string,
    providerConfig: CloudProviderConfig,
  ): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(runId, controller);

    const finish = async (status: ResearchRunStatus, error?: string) => {
      await this.updateRun(runId, (run) => ({
        ...run,
        status,
        error,
        usage: {
          ...run.usage,
          elapsedMs: elapsedMs(run.createdAt),
        },
        updatedAt: now(),
      }));
      this.abortControllers.delete(runId);
    };

    try {
      await this.updateRun(runId, (run) => ({
        ...run,
        status: "running",
        phase: "plan",
        checkpoint: {
          ...run.checkpoint,
          plan: "Build research map and execution budget for query.",
        },
        updatedAt: now(),
      }));

      await this.enforceBudget(runId);

      await this.updateRun(runId, (run) => ({
        ...run,
        phase: "query",
        updatedAt: now(),
      }));

      const runAfterPlan = this.runs.get(runId);
      if (!runAfterPlan) throw new Error("Run not found");

      const sourceHints = providerConfig.tavilyEnabled
        ? await this.searchSources(runAfterPlan.query, runAfterPlan.budget.maxSources, keys.tavilyApiKey)
        : [];

      await this.updateRun(runId, (run) => ({
        ...run,
        checkpoint: {
          ...run.checkpoint,
          sourceHints,
        },
        usage: {
          ...run.usage,
          sourcesFetched: sourceHints.length,
          elapsedMs: elapsedMs(run.createdAt),
        },
        updatedAt: now(),
      }));

      await this.enforceBudget(runId);

      await this.updateRun(runId, (run) => ({
        ...run,
        phase: "fetch",
        updatedAt: now(),
      }));

      const fetched = await this.fetchSources(sourceHints, controller.signal);

      await this.updateRun(runId, (run) => ({
        ...run,
        checkpoint: {
          ...run.checkpoint,
          fetchedSources: fetched.map((s) => ({ title: s.title, url: s.url, publishedAt: s.publishedAt })),
        },
        updatedAt: now(),
      }));

      await this.enforceBudget(runId);

      await this.updateRun(runId, (run) => ({
        ...run,
        phase: "extract",
        updatedAt: now(),
      }));

      const extracted = fetched.map((source, index) => ({
        claimRef: `C${index + 1}`,
        text: clip(source.body, 320),
        citations: [
          {
            url: source.url,
            title: source.title,
            publishedAt: source.publishedAt,
            quote: clip(source.body, 180),
            claimRef: `C${index + 1}`,
          },
        ] as Citation[],
      }));

      await this.updateRun(runId, (run) => ({
        ...run,
        checkpoint: {
          ...run.checkpoint,
          extractedClaimCount: extracted.length,
        },
        updatedAt: now(),
      }));

      await this.enforceBudget(runId);

      await this.updateRun(runId, (run) => ({
        ...run,
        phase: "synthesize",
        updatedAt: now(),
      }));

      const synthesized = await this.synthesize(
        runId,
        this.runs.get(runId)?.query ?? "",
        context,
        extracted,
        keys.anthropicApiKey,
        providerConfig,
      );

      const claimValidation = validateClaimCitations(
        synthesized.claims.map((claim) => ({
          claimRef: claim.claimRef,
          text: claim.text,
          citations: claim.citations,
        })),
      );

      if (!claimValidation.valid) {
        throw new Error(claimValidation.error ?? "Citation validation failed.");
      }

      await this.updateRun(runId, (run) => ({
        ...run,
        phase: "propose",
        updatedAt: now(),
      }));

      const artifacts: ResearchArtifact[] = [
        {
          id: randomUUID(),
          runId,
          kind: "notes",
          content: synthesized.notes,
          createdAt: now(),
        },
        {
          id: randomUUID(),
          runId,
          kind: "outline",
          content: synthesized.outline,
          createdAt: now(),
        },
        {
          id: randomUUID(),
          runId,
          kind: "claims",
          content: JSON.stringify(synthesized.claims, null, 2),
          citations: synthesized.claims.flatMap((c) => c.citations),
          createdAt: now(),
        },
        {
          id: randomUUID(),
          runId,
          kind: "patches",
          content: synthesized.suggestedChanges,
          citations: synthesized.claims.flatMap((c) => c.citations),
          createdAt: now(),
        },
      ];

      await this.updateRun(runId, (run) => ({
        ...run,
        artifacts,
        updatedAt: now(),
      }));

      await this.enforceBudget(runId);

      await finish("completed");
    } catch (error) {
      const current = this.runs.get(runId);
      if (!current) return;

      if (current.status === "cancelled" || current.status === "budget_exceeded") {
        return;
      }

      if ((error as Error).name === "AbortError") {
        await finish("cancelled");
        return;
      }

      await finish("failed", error instanceof Error ? error.message : "Deep research run failed.");
    } finally {
      this.abortControllers.delete(runId);
    }
  }

  private async searchSources(
    query: string,
    maxSources: number,
    tavilyApiKey?: string,
  ): Promise<SourceDoc[]> {
    if (!tavilyApiKey) {
      throw new Error("Tavily API key is required for deep research mode.");
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: "basic",
        max_results: Math.min(Math.max(maxSources, 1), 20),
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed (${response.status}).`);
    }

    const data = (await response.json()) as TavilySearchResponse;
    const results = (data.results ?? [])
      .filter((r): r is Required<Pick<TavilySearchHit, "url">> & TavilySearchHit => Boolean(r.url))
      .slice(0, maxSources)
      .map((result) => ({
        title: result.title ?? result.url ?? "Untitled source",
        url: result.url ?? "",
        snippet: result.content ?? "",
        publishedAt: result.published_date,
        body: "",
      }));

    return results;
  }

  private async fetchSources(hints: SourceDoc[], signal: AbortSignal): Promise<SourceDoc[]> {
    const results: SourceDoc[] = [];

    for (const hint of hints) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

      try {
        const response = await fetch(hint.url, {
          method: "GET",
          signal,
          headers: {
            "User-Agent": "Quilliam-Research/1.0",
          },
        });
        const html = await response.text();
        results.push({
          ...hint,
          body: clip(plainTextFromHtml(html), 4000),
        });
      } catch {
        results.push({
          ...hint,
          body: clip(hint.snippet, 4000),
        });
      }
    }

    return results;
  }

  private async synthesize(
    runId: string,
    query: string,
    context: string,
    extractedClaims: ResearchClaim[],
    anthropicApiKey: string | undefined,
    providerConfig: CloudProviderConfig,
  ): Promise<SynthesizedPayload> {
    if (!anthropicApiKey) {
      // Deterministic fallback that still maintains claim-level citation linkage.
      const notes = extractedClaims
        .map((claim) => `- ${claim.claimRef}: ${claim.text}`)
        .join("\n");

      return {
        notes,
        outline: `Research outline for: ${query}\n\n1) Core facts\n2) Contradictions\n3) Proposed story integration`,
        claims: extractedClaims.map((claim) => ({
          claimRef: claim.claimRef,
          text: claim.text,
          citations: claim.citations,
        })),
        suggestedChanges: "No automatic rewrite patches generated because Anthropic key is missing.",
      };
    }

    const system = [
      "You are Quilliam Deep Research.",
      "Return valid JSON only.",
      "Every claim MUST include at least one citation entry.",
      "Do not include markdown code fences.",
    ].join(" ");

    const user = JSON.stringify(
      {
        task: "Synthesize research for writing workflow with mandatory per-claim citations.",
        query,
        context: clip(context, 3000),
        claims: extractedClaims,
        outputSchema: {
          notes: "string",
          outline: "string",
          claims: [
            {
              claimRef: "string",
              text: "string",
              citations: [
                {
                  url: "string",
                  title: "string",
                  publishedAt: "string | undefined",
                  quote: "string",
                  claimRef: "string",
                },
              ],
            },
          ],
          suggestedChanges: "string",
        },
      },
      null,
      2,
    );

    const anthropic = await callAnthropicText({
      apiKey: anthropicApiKey,
      model: providerConfig.anthropicModel,
      system,
      user,
      maxTokens: 2200,
      temperature: 0.2,
    });

    await this.updateRunUsageFromAnthropic(runId, anthropic.usage);

    const parsed = extractJsonObject<SynthesizedPayload>(anthropic.text);
    if (!parsed) {
      throw new Error("Could not parse synthesized research JSON from Anthropic output.");
    }

    return {
      notes: parsed.notes ?? "",
      outline: parsed.outline ?? "",
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      suggestedChanges: parsed.suggestedChanges ?? "",
    };
  }

  private async updateRunUsageFromAnthropic(
    runId: string,
    usage: { inputTokens: number; outputTokens: number },
  ): Promise<void> {
    await this.updateRun(runId, (run) => ({
      ...run,
      usage: {
        ...run.usage,
        inputTokens: run.usage.inputTokens + usage.inputTokens,
        outputTokens: run.usage.outputTokens + usage.outputTokens,
        spentUsd:
          run.usage.spentUsd +
          usage.inputTokens * INPUT_TOKEN_COST +
          usage.outputTokens * OUTPUT_TOKEN_COST,
        elapsedMs: elapsedMs(run.createdAt),
      },
      updatedAt: now(),
    }));
  }
}

const singleton = new ResearchRunManager();

export function getResearchRunManager(): ResearchRunManager {
  return singleton;
}
