"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
} from "react";
import type { EditBlockEvent } from "@/lib/editParser";
import type { CloudProviderConfig, EntryPatch, ProposedPatchBatch, RunBudget } from "@/lib/types";
import { patchTargetToFileTarget } from "../chatUtils";
import type { ChatMessage } from "../types";

export function useAssistedCloud(params: {
  providerConfig: CloudProviderConfig;
  runBudget: RunBudget;
  initQuestionStates: (msgIndex: number, content: string) => void;
  onEditBlock?: (event: EditBlockEvent) => void;
  onPatchesExtracted?: (patches: EntryPatch[]) => Promise<void>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}) {
  const { providerConfig, runBudget, initQuestionStates, onEditBlock, onPatchesExtracted, setMessages } = params;

  return useCallback(
    async ({
      trimmed,
      systemContent,
      apiMessages,
      newMessages,
    }: {
      trimmed: string;
      systemContent: string;
      apiMessages: { role: "system" | "user" | "assistant"; content: string }[];
      newMessages: ChatMessage[];
    }) => {
      const response = await fetch("/api/cloud/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          context: systemContent,
          messages: apiMessages,
          providerConfig,
          budget: runBudget,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        patches?: ProposedPatchBatch[];
        entryPatches?: EntryPatch[];
        canonicalPatches?: EntryPatch[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || response.statusText);
      }

      const fullContent = payload.message ?? "Assisted cloud run completed.";
      const patches = Array.isArray(payload.patches) ? payload.patches : [];
      for (const patch of patches) {
        const fileTarget = patchTargetToFileTarget(patch);
        for (const edit of patch.edits) {
          onEditBlock?.({
            type: "editBlock",
            edit,
            fileTarget,
            commentary: patch.rationale || fullContent,
          });
        }
      }

      const entryPatches = Array.isArray(payload.entryPatches)
        ? payload.entryPatches.filter((p) => p.operations.length > 0)
        : Array.isArray(payload.canonicalPatches)
          ? payload.canonicalPatches.filter((p) => p.operations.length > 0)
          : [];
      if (entryPatches.length > 0 && onPatchesExtracted) {
        await onPatchesExtracted(entryPatches).catch(console.error);
      }

      const assistantIndex = newMessages.length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: fullContent },
      ]);
      initQuestionStates(assistantIndex, fullContent);
    },
    [initQuestionStates, onEditBlock, onPatchesExtracted, providerConfig, runBudget, setMessages],
  );
}
