/**
 * Chat — shared TypeScript types used across the Chat feature folder.
 */
import type { EditBlockEvent } from "@/lib/editParser";
import type { FileTarget } from "@/lib/changeSets";
import type {
  AiExecutionMode,
  CloudProviderConfig,
  Entry,
  EntryPatch,
  ResearchRunRecord,
  RunBudget,
} from "@/lib/types";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface QuestionCard {
  id: string;
  text: string;
  answered: boolean;
  dismissed: boolean;
  reply: string;
}

export interface ParsedAssistantMessage {
  vibe: string;
  questions: QuestionCard[];
}

export interface ChatProps {
  libraryId?: string;
  executionMode?: AiExecutionMode;
  providerConfig?: CloudProviderConfig;
  runBudget?: RunBudget;
  chatId?: string;
  variant?: "panel" | "landing";
  /** Manuscript context injected into the system prompt. Built from active doc + world data. */
  context?: string;
  /**
   * Optional async callback invoked with the user's query before each send.
   * Should return a markdown string of semantically relevant passages to append
   * after the static context block (keeps Ollama prefix-cache hits high).
   */
  onBuildContext?: (query: string) => Promise<string>;
  /**
   * Called whenever the AI stream contains an edit block.
   */
  onEditBlock?: (event: EditBlockEvent) => void;
  onResearchRunChange?: () => void;
  /**
   * Called when a deep research run reaches `completed` status.
   */
  onResearchRunComplete?: (run: ResearchRunRecord) => void;
  /**
   * Called after each local-chat assistant response with any patches extracted.
   */
  onPatchesExtracted?: (patches: EntryPatch[]) => Promise<void>;
  /** Canonical docs from the store, forwarded to /api/extract-canonical for name matching. */
  existingEntries?: Entry[];
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  onMessagesChange?: (messages: { role: "user" | "assistant"; content: string }[]) => void;
}

// Re-export for convenience so consumers can import from the folder root
export type { EditBlockEvent, FileTarget };
