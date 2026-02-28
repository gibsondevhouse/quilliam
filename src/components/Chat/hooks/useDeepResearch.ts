"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import type { CloudProviderConfig, ResearchRunRecord, RunBudget } from "@/lib/types";
import { formatResearchRunSummary } from "../chatUtils";
import type { ChatMessage } from "../types";

export function useDeepResearch(params: {
  libraryId?: string;
  providerConfig: CloudProviderConfig;
  runBudget: RunBudget;
  onResearchRunChange?: () => void;
  onResearchRunComplete?: (run: ResearchRunRecord) => void;
  setActiveResearchRun: Dispatch<SetStateAction<ResearchRunRecord | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  pollingControllerRef: RefObject<AbortController | null>;
}) {
  const {
    libraryId,
    providerConfig,
    runBudget,
    onResearchRunChange,
    onResearchRunComplete,
    setActiveResearchRun,
    setMessages,
    pollingControllerRef,
  } = params;

  return useCallback(
    async ({ trimmed, systemContent }: { trimmed: string; systemContent: string }) => {
      if (!libraryId) throw new Error("Deep research mode requires a library context.");

      const response = await fetch("/api/research/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryId,
          query: trimmed,
          context: systemContent,
          providerConfig,
          budget: runBudget,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        run?: ResearchRunRecord;
        error?: string;
      };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error || response.statusText);
      }

      const run = payload.run;
      setActiveResearchRun(run);
      onResearchRunChange?.();
      const startedMessage = `Deep research run started (${run.id.slice(0, 8)}). I will update this thread when it finishes.`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: startedMessage },
      ]);

      const terminal = new Set(["completed", "cancelled", "failed", "budget_exceeded"]);
      pollingControllerRef.current?.abort();
      const controller = new AbortController();
      pollingControllerRef.current = controller;

      void (async () => {
        let failures = 0;
        let lastKnown = run;

        const wait = async (ms: number) =>
          new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
              controller.signal.removeEventListener("abort", onAbort);
              resolve();
            }, ms);
            const onAbort = () => {
              window.clearTimeout(timeout);
              reject(new DOMException("Polling aborted", "AbortError"));
            };
            controller.signal.addEventListener("abort", onAbort, { once: true });
          });

        while (!controller.signal.aborted) {
          try {
            await wait(2500);
            const runResponse = await fetch(`/api/research/runs/${run.id}`, {
              signal: controller.signal,
            });
            if (!runResponse.ok) {
              throw new Error(`Polling failed (${runResponse.status})`);
            }
            const runPayload = (await runResponse.json()) as { run?: ResearchRunRecord };
            const latestRun = runPayload.run;
            if (!latestRun) {
              throw new Error("Polling response missing run payload");
            }

            failures = 0;
            lastKnown = latestRun;
            setActiveResearchRun(latestRun);
            if (terminal.has(latestRun.status)) {
              onResearchRunChange?.();
              if (latestRun.status === "completed") {
                onResearchRunComplete?.(latestRun);
              }
              setMessages((prev) => [
                ...prev,
                { role: "assistant" as const, content: formatResearchRunSummary(latestRun) },
              ]);
              return;
            }
          } catch (error) {
            if (controller.signal.aborted) return;
            failures += 1;
            if (failures >= 3) {
              const detail = error instanceof Error ? error.message : "Unknown polling error";
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant" as const,
                  content:
                    `⚠ Deep research updates stopped before completion. ` +
                    `Last status: ${lastKnown.status} (phase ${lastKnown.phase}). ${detail}`,
                },
              ]);
              return;
            }
            const retryDelay = 400 * 2 ** (failures - 1);
            try {
              await wait(retryDelay);
            } catch {
              return;
            }
          }
        }
      })();
    },
    [
      libraryId,
      onResearchRunChange,
      onResearchRunComplete,
      pollingControllerRef,
      providerConfig,
      runBudget,
      setActiveResearchRun,
      setMessages,
    ],
  );
}
