"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { parseEditStream, type EditBlockEvent } from "@/lib/editParser";
import { extractFence } from "@/lib/fenceParser";
import { buildPatchesFromExtraction } from "@/lib/patchExtractor";
import type { Entry, EntryPatch, SourceRef } from "@/lib/types";
import type { ChatMessage, QuestionCard } from "../types";

export function useLocalChat(params: {
  onEditBlock?: (event: EditBlockEvent) => void;
  initQuestionStates: (msgIndex: number, content: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingContent: Dispatch<SetStateAction<string>>;
  onPatchesExtracted?: (patches: EntryPatch[]) => Promise<void>;
  existingEntries?: Entry[];
  /** Gate extraction on this flag. Defaults to false (no extraction in local Ollama mode). */
  extractionEnabled?: boolean;
}) {
  const {
    onEditBlock,
    initQuestionStates,
    setMessages,
    setStreamingContent,
    onPatchesExtracted,
    existingEntries,
    extractionEnabled = false,
  } = params;

  return useCallback(
    async ({
      apiMessages,
      newMessages,
      sourceId,
    }: {
      apiMessages: { role: "system" | "user" | "assistant"; content: string }[];
      newMessages: ChatMessage[];
      sourceId?: string;
    }) => {
      // Only request extraction when explicitly enabled (cloud/assisted modes).
      // Local Ollama mode leaves extractionEnabled=false to avoid token overhead
      // and low-quality structured output from small models.
      const wantExtraction = extractionEnabled && typeof onPatchesExtracted === "function";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || response.statusText);
      }
      if (!response.body) throw new Error("No response stream");

      let fullContent = "";

      for await (const event of parseEditStream(response.body)) {
        if (event.type === "token") {
          fullContent += event.text;
          setStreamingContent(fullContent);
        } else if (event.type === "editBlock") {
          onEditBlock?.(event);
        }
      }

      // Strip the canonical_extraction fence before displaying the message.
      const { prose, fence } = extractFence(fullContent);
      const displayContent = prose || fullContent;

      const assistantIndex = newMessages.length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: displayContent },
      ]);
      initQuestionStates(assistantIndex, displayContent);
      setStreamingContent("");

      // Build patches locally from the inline fence — zero extra network calls.
      if (wantExtraction && fence && fence.entities.length > 0) {
        const sourceRef: SourceRef = {
          kind: "chat_message",
          id: sourceId ?? `chat_${Date.now()}`,
        };
        try {
          const patches = buildPatchesFromExtraction(
            fence,
            existingEntries ?? [],
            sourceRef,
          );
          if (patches.length > 0) {
            await onPatchesExtracted!(patches);
          }
        } catch {
          // Best-effort — never block the chat flow
        }
      }
    },
    [initQuestionStates, onEditBlock, onPatchesExtracted, existingEntries, extractionEnabled, setMessages, setStreamingContent],
  );
}

// Re-export QuestionCard so callers don't need a separate import
export type { QuestionCard };

