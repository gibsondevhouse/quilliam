/**
 * Chat — pure utility functions and parser.
 */
import type { ParsedAssistantMessage, QuestionCard } from "./types";
import type { ProposedPatchBatch, ResearchRunRecord } from "@/lib/types";
import type { FileTarget } from "@/lib/changeSets";

let questionIdCounter = 0;
export function nextQuestionId(): string {
  return `q-${++questionIdCounter}-${Date.now()}`;
}

/**
 * Split an assistant message into a vibe (main reply) and [Q] question cards.
 */
export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const lines = content.split("\n");
  const vibeLines: string[] = [];
  const questions: QuestionCard[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[Q]")) {
      questions.push({
        id: nextQuestionId(),
        text: trimmed.replace(/^\[Q\]\s*/, ""),
        answered: false,
        dismissed: false,
        reply: "",
      });
    } else {
      if (questions.length === 0 || trimmed !== "") {
        if (questions.length === 0) {
          vibeLines.push(line);
        }
      }
    }
  }

  return {
    vibe: vibeLines.join("\n").trim(),
    questions,
  };
}

/**
 * Map a ProposedPatchBatch to the FileTarget needed by onEditBlock.
 */
export function patchTargetToFileTarget(patch: ProposedPatchBatch): FileTarget {
  if (patch.targetKind === "character") {
    const name = patch.targetKey?.startsWith("character:")
      ? patch.targetKey.slice("character:".length)
      : patch.targetId;
    return { kind: "character", name };
  }
  if (patch.targetKind === "location") {
    const name = patch.targetKey?.startsWith("location:")
      ? patch.targetKey.slice("location:".length)
      : patch.targetId;
    return { kind: "location", name };
  }
  if (patch.targetKind === "world") {
    const key = patch.targetKey?.startsWith("world:")
      ? patch.targetKey.slice("world:".length)
      : patch.targetId;
    return { kind: "world", key };
  }
  return { kind: "active" };
}

/**
 * Format a completed (or in-progress) research run as a chat message string.
 */
export function formatResearchRunSummary(run: ResearchRunRecord): string {
  const header = `Deep Research ${run.status.replace(/_/g, " ")} (${run.id.slice(0, 8)})`;
  if (run.status !== "completed") {
    return `${header}\nPhase: ${run.phase}\n${run.error ?? "No additional details."}`;
  }

  const outline = run.artifacts.find((a) => a.kind === "outline")?.content ?? "";
  const claims = run.artifacts.find((a) => a.kind === "claims");
  const citations = claims?.citations ?? [];
  const citationLines = citations
    .slice(0, 6)
    .map((c) => `- [${c.title}](${c.url}) — "${c.quote.slice(0, 120)}"`);

  const sections = [header];
  if (outline) sections.push(`\n${outline}`);
  if (citationLines.length > 0) sections.push(`\nCitations:\n${citationLines.join("\n")}`);
  return sections.join("\n");
}
