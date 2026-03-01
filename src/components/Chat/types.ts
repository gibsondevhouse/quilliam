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
  /** Landing variant: label shown in the Context pill (e.g. "General" or "My Library") */
  activeContextLabel?: string;
  /** Landing variant: name of the active LoRA shown in the LoRA pill */
  activeLoRALabel?: string;
  /** Landing variant: called when the user clicks the Context pill */
  onContextClick?: () => void;
  /** Landing variant: called when the user clicks the LoRA pill */
  onLoRAClick?: () => void;
  /**
   * Landing variant: called when a starter chip is clicked.
   * When provided, chips create a new thread and auto-send instead of pre-filling.
   */
  onStarterSend?: (prompt: string) => void;
  /**
   * When set, Chat auto-sends this prompt immediately on mount.
   * Used by the landing page to implement starter chip auto-send.
   * Pass a new `key` to Chat simultaneously to force remount.
   */
  autoSendPrompt?: string;
}

// Re-export for convenience so consumers can import from the folder root
export type { EditBlockEvent, FileTarget };
