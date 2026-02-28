"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import { parseEditStream, type EditBlockEvent } from "@/lib/editParser";
import type { Entry, EntryPatch } from "@/lib/types";
import type { ChatMessage, QuestionCard } from "../types";

export function useLocalChat(params: {
  onEditBlock?: (event: EditBlockEvent) => void;
  initQuestionStates: (msgIndex: number, content: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingContent: Dispatch<SetStateAction<string>>;
  onPatchesExtracted?: (patches: EntryPatch[]) => Promise<void>;
  existingEntries?: Entry[];
}) {
  const {
    onEditBlock,
    initQuestionStates,
    setMessages,
    setStreamingContent,
    onPatchesExtracted,
    existingEntries,
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

      const assistantIndex = newMessages.length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: fullContent },
      ]);
      initQuestionStates(assistantIndex, fullContent);
      setStreamingContent("");

      if (onPatchesExtracted && fullContent.trim().length > 0) {
        try {
          const res = await fetch("/api/extract-canonical", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: fullContent,
              sourceType: "chat",
              sourceId: sourceId ?? `chat_${Date.now()}`,
              existingEntries: existingEntries ?? [],
            }),
          });
          if (res.ok) {
            const payload = (await res.json()) as { patches?: EntryPatch[] };
            const patches = Array.isArray(payload.patches) ? payload.patches : [];
            if (patches.length > 0) {
              await onPatchesExtracted(patches);
            }
          }
        } catch {
          // Best-effort — never block the chat flow
        }
      }
    },
    [initQuestionStates, onEditBlock, onPatchesExtracted, existingEntries, setMessages, setStreamingContent],
  );
}

// Re-export QuestionCard so callers don't need a separate import
export type { QuestionCard };
