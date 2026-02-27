"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { parseEditStream, type EditBlockEvent } from "@/lib/editParser";
import type { FileTarget } from "@/lib/changeSets";
import { useSystemContext } from "@/lib/context/SystemContext";
import type {
  AiExecutionMode,
  CloudProviderConfig,
  ProposedPatchBatch,
  ResearchRunRecord,
  RunBudget,
} from "@/lib/types";
import { DEFAULT_PROVIDER_CONFIG, DEFAULT_RUN_BUDGET } from "@/lib/types";

/* ================================================================
   Types
   ================================================================ */

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface QuestionCard {
  id: string;
  text: string;
  answered: boolean;
  dismissed: boolean;
  reply: string;
}

interface ParsedAssistantMessage {
  vibe: string; // The brief main response
  questions: QuestionCard[];
}

interface ChatProps {
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
   * Return "" to signal no additional context.
   */
  onBuildContext?: (query: string) => Promise<string>;
  /**
   * Called whenever the AI stream contains an edit block.
   * The parent (library layout) picks it up and applies it to the appropriate document.
   */
  onEditBlock?: (event: EditBlockEvent) => void;
  onResearchRunChange?: () => void;
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  onMessagesChange?: (messages: { role: "user" | "assistant"; content: string }[]) => void;
}

/* ================================================================
   System prompt — enforces the Modular Architect pattern
   ================================================================ */

const SYSTEM_PROMPT_LOCAL = `You are Quilliam, a writing assistant for authors and journalists. In Local mode, processing remains on-device via Ollama.

## RESPONSE FORMAT

Keep your conversational reply brief — 1 to 3 short sentences. Never ask clarifying questions; if the request is ambiguous, make a reasonable creative choice and proceed.

## DOCUMENT EDITING AND WRITING

**Whenever the user asks you to write, draft, create, or generate any content meant for the document — always deliver it via an edit block, not as plain chat text.** This includes articles, chapters, sections, paragraphs, outlines, or any other textual content. If the document is empty, use \`line=1+\` to insert at the start.

When asked to edit or improve existing text, also use fenced edit blocks. Lines are 1-based.

Replace lines 3–5:
\`\`\`edit line=3-5
new line 3
new line 4
\`\`\`

Insert after line 2:
\`\`\`edit line=2+
inserted line
\`\`\`

Delete lines 4–6:
\`\`\`edit line=4-6 delete
\`\`\`

To edit a world-building entity instead of the active document, add a \`file=\` qualifier:
\`\`\`edit line=1 file=character:Elena
Updated character description
\`\`\`

\`\`\`edit line=1-3 file=location:Harbortown
Updated location notes
\`\`\`

\`\`\`edit line=1 file=world:MagicSystem
Updated world entry
\`\`\`

Outside edit fences, write plain commentary. Never nest fence markers.`;

const SYSTEM_PROMPT_ASSISTED =
  "You are Quilliam Assisted Cloud. Return concise guidance and conservative, review-first edits only.";

const SYSTEM_PROMPT_DEEP_RESEARCH =
  "You are Quilliam Deep Research. Every substantive claim must include at least one citation with URL + quote.";


/* ================================================================
   Parser — splits assistant content into vibe + question cards
   ================================================================ */

let questionIdCounter = 0;
function nextQuestionId() {
  return `q-${++questionIdCounter}-${Date.now()}`;
}

function parseAssistantMessage(content: string): ParsedAssistantMessage {
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
      // Only add to vibe if we haven't started questions yet,
      // or it's not an empty line between questions
      if (questions.length === 0 || trimmed !== "") {
        if (questions.length === 0) {
          vibeLines.push(line);
        }
        // after questions start, ignore non-[Q] lines (stray text)
      }
    }
  }

  return {
    vibe: vibeLines.join("\n").trim(),
    questions,
  };
}

function patchTargetToFileTarget(patch: ProposedPatchBatch): FileTarget {
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

function formatResearchRunSummary(run: ResearchRunRecord): string {
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
  if (outline) {
    sections.push(`\n${outline}`);
  }
  if (citationLines.length > 0) {
    sections.push(`\nCitations:\n${citationLines.join("\n")}`);
  }
  return sections.join("\n");
}

function useLocalChat(params: {
  onEditBlock?: (event: EditBlockEvent) => void;
  initQuestionStates: (msgIndex: number, content: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingContent: Dispatch<SetStateAction<string>>;
}) {
  const { onEditBlock, initQuestionStates, setMessages, setStreamingContent } = params;

  return useCallback(
    async ({
      apiMessages,
      newMessages,
    }: {
      apiMessages: { role: "system" | "user" | "assistant"; content: string }[];
      newMessages: ChatMessage[];
    }) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
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
    },
    [initQuestionStates, onEditBlock, setMessages, setStreamingContent],
  );
}

function useAssistedCloud(params: {
  providerConfig: CloudProviderConfig;
  runBudget: RunBudget;
  initQuestionStates: (msgIndex: number, content: string) => void;
  onEditBlock?: (event: EditBlockEvent) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}) {
  const { providerConfig, runBudget, initQuestionStates, onEditBlock, setMessages } = params;

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

      const assistantIndex = newMessages.length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: fullContent },
      ]);
      initQuestionStates(assistantIndex, fullContent);
    },
    [initQuestionStates, onEditBlock, providerConfig, runBudget, setMessages],
  );
}

function useDeepResearch(params: {
  libraryId?: string;
  providerConfig: CloudProviderConfig;
  runBudget: RunBudget;
  onResearchRunChange?: () => void;
  setActiveResearchRun: Dispatch<SetStateAction<ResearchRunRecord | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  pollingControllerRef: RefObject<AbortController | null>;
}) {
  const {
    libraryId,
    providerConfig,
    runBudget,
    onResearchRunChange,
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
              const detail =
                error instanceof Error ? error.message : "Unknown polling error";
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
      pollingControllerRef,
      providerConfig,
      runBudget,
      setActiveResearchRun,
      setMessages,
    ],
  );
}

/* ================================================================
   QuestionWorkspace — renders interactive question cards
   ================================================================ */

function QuestionWorkspace({
  questions,
  onDismiss,
  onReply,
  onSubmitReply,
}: {
  questions: QuestionCard[];
  onDismiss: (id: string) => void;
  onReply: (id: string, text: string) => void;
  onSubmitReply: (id: string) => void;
}) {
  const activeQuestions = questions.filter((q) => !q.dismissed);
  if (activeQuestions.length === 0) return null;

  return (
    <div className="qw-container">
      <div className="qw-header">
        <span className="qw-label">Workspace</span>
        <span className="qw-count">{activeQuestions.length}</span>
      </div>
      <div className="qw-cards">
        {activeQuestions.map((q) => (
          <div key={q.id} className={`qw-card ${q.answered ? "answered" : ""}`}>
            <div className="qw-card-top">
              <p className="qw-card-question">{q.text}</p>
              <button
                className="qw-card-dismiss"
                onClick={() => onDismiss(q.id)}
                title="Dismiss"
              >
                ×
              </button>
            </div>
            {q.answered ? (
              <div className="qw-card-answered">
                <span className="qw-answered-label">✓</span>
                <span className="qw-answered-text">{q.reply}</span>
              </div>
            ) : (
              <div className="qw-card-reply">
                <input
                  className="qw-card-input"
                  type="text"
                  placeholder="Type your answer..."
                  value={q.reply}
                  onChange={(e) => onReply(q.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && q.reply.trim()) {
                      onSubmitReply(q.id);
                    }
                  }}
                />
                <button
                  className="qw-card-send"
                  disabled={!q.reply.trim()}
                  onClick={() => onSubmitReply(q.id)}
                >
                  →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   AssistantMessage — renders vibe + workspace
   ================================================================ */

function AssistantMessage({
  content,
  messageIndex,
  questionStates,
  onDismiss,
  onReply,
  onSubmitReply,
}: {
  content: string;
  messageIndex: number;
  questionStates: Map<number, QuestionCard[]>;
  onDismiss: (msgIdx: number, qId: string) => void;
  onReply: (msgIdx: number, qId: string, text: string) => void;
  onSubmitReply: (msgIdx: number, qId: string) => void;
}) {
  const parsed = parseAssistantMessage(content);
  const cards = questionStates.get(messageIndex) ?? parsed.questions;

  return (
    <>
      <div className="chat-msg-content">{parsed.vibe || content}</div>
      {parsed.questions.length > 0 && (
        <QuestionWorkspace
          questions={cards}
          onDismiss={(qId) => onDismiss(messageIndex, qId)}
          onReply={(qId, text) => onReply(messageIndex, qId, text)}
          onSubmitReply={(qId) => onSubmitReply(messageIndex, qId)}
        />
      )}
    </>
  );
}

/* ================================================================
   Chat component
   ================================================================ */

export function Chat({
  libraryId,
  executionMode = "local",
  providerConfig = DEFAULT_PROVIDER_CONFIG,
  runBudget = DEFAULT_RUN_BUDGET,
  chatId,
  variant = "panel",
  context,
  onBuildContext,
  onEditBlock,
  onResearchRunChange,
  initialMessages,
  onMessagesChange,
}: ChatProps) {
  const { status: systemStatus } = useSystemContext();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages.map((m) => ({ role: m.role, content: m.content }));
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeResearchRun, setActiveResearchRun] = useState<ResearchRunRecord | null>(null);
  const [questionStates, setQuestionStates] = useState<
    Map<number, QuestionCard[]>
  >(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingControllerRef = useRef<AbortController | null>(null);
  // Ref so handleSubmitReply can call sendMessage even though it is defined later
  const sendMessageRef = useRef<((overrideInput?: string) => Promise<void>) | null>(null);

  useEffect(() => {
    const pollingRef = pollingControllerRef;
    return () => {
      pollingRef.current?.abort();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // Notify parent when messages change (for multi-chat persistence)
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(
        messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    }
  }, [messages, onMessagesChange]);

  /* -- Initialize question card states when a new assistant message lands -- */
  const initQuestionStates = useCallback(
    (msgIndex: number, content: string) => {
      const parsed = parseAssistantMessage(content);
      if (parsed.questions.length > 0) {
        setQuestionStates((prev) => {
          const next = new Map(prev);
          next.set(msgIndex, parsed.questions);
          return next;
        });
      }
    },
    []
  );

  /* -- Question card interactions -- */
  const handleDismissQuestion = useCallback(
    (msgIdx: number, qId: string) => {
      setQuestionStates((prev) => {
        const next = new Map(prev);
        const cards = (next.get(msgIdx) ?? []).map((q) =>
          q.id === qId ? { ...q, dismissed: true } : q
        );
        next.set(msgIdx, cards);
        return next;
      });
    },
    []
  );

  const handleReplyChange = useCallback(
    (msgIdx: number, qId: string, text: string) => {
      setQuestionStates((prev) => {
        const next = new Map(prev);
        const cards = (next.get(msgIdx) ?? []).map((q) =>
          q.id === qId ? { ...q, reply: text } : q
        );
        next.set(msgIdx, cards);
        return next;
      });
    },
    []
  );

  const handleSubmitReply = useCallback(
    (msgIdx: number, qId: string) => {
      let questionText = "";
      let replyText = "";

      setQuestionStates((prev) => {
        const next = new Map(prev);
        const cards = (next.get(msgIdx) ?? []).map((q) => {
          if (q.id === qId && q.reply.trim()) {
            questionText = q.text;
            replyText = q.reply.trim();
            return { ...q, answered: true };
          }
          return q;
        });
        next.set(msgIdx, cards);
        return next;
      });

      // Send the answer as a user message to continue the conversation
      if (questionText && replyText) {
        const answerMessage = `Re: "${questionText}"\n${replyText}`;
        sendMessageRef.current?.(answerMessage);
      }
    },
    []
  );

  const runLocalChat = useLocalChat({
    onEditBlock,
    initQuestionStates,
    setMessages,
    setStreamingContent,
  });

  const runAssistedCloud = useAssistedCloud({
    providerConfig,
    runBudget,
    initQuestionStates,
    onEditBlock,
    setMessages,
  });

  const runDeepResearch = useDeepResearch({
    libraryId,
    providerConfig,
    runBudget,
    onResearchRunChange,
    setActiveResearchRun,
    setMessages,
    pollingControllerRef,
  });

  /* -- Send message -- */
  const sendMessage = useCallback(async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
    if (!trimmed || isSending) return;

    if (executionMode !== "local" && typeof window !== "undefined") {
      const confirmed = window.confirm(
        executionMode === "assisted_cloud"
          ? `This action will use Assisted Cloud (${providerConfig.anthropicModel}) and your BYO API key. Proceed?`
          : `This action will start a Deep Research run with hard caps (up to $${runBudget.maxUsd}, ${runBudget.maxMinutes} min, ${runBudget.maxSources} sources). Proceed?`,
      );
      if (!confirmed) return;
    }

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsSending(true);
    setStreaming(executionMode === "local");
    setStreamingContent("");

    try {
      // Build base context block (static — stays prefix-cached by Ollama)
      const basePrompt =
        executionMode === "local"
          ? SYSTEM_PROMPT_LOCAL
          : executionMode === "assisted_cloud"
            ? SYSTEM_PROMPT_ASSISTED
            : SYSTEM_PROMPT_DEEP_RESEARCH;
      let systemContent = context
        ? `${basePrompt}\n\n## ACTIVE MANUSCRIPT CONTEXT\n\n${context}\n---\nUse this context to give specific, grounded responses about the author's actual work. Always prefer this over general advice.`
        : basePrompt;

      // Append dynamic RAG passages at the end (after static prefix, so cache is preserved)
      if (onBuildContext && executionMode !== "deep_research") {
        const ragContext = await onBuildContext(trimmed);
        if (ragContext) {
          systemContent += `\n\n${ragContext}`;
        }
      }

      const apiMessages = [
        { role: "system" as const, content: systemContent },
        ...newMessages,
      ];

      if (executionMode === "local") {
        await runLocalChat({ apiMessages, newMessages });
      } else if (executionMode === "assisted_cloud") {
        setStreaming(false);
        await runAssistedCloud({
          trimmed,
          systemContent,
          apiMessages,
          newMessages,
        });
      } else {
        setStreaming(false);
        await runDeepResearch({ trimmed, systemContent });
      }
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: `⚠ ${errMsg}` },
      ]);
      setStreamingContent("");
    } finally {
      setIsSending(false);
      setStreaming(false);
    }
  }, [
    input,
    isSending,
    executionMode,
    providerConfig,
    runBudget,
    messages,
    context,
    onBuildContext,
    runLocalChat,
    runAssistedCloud,
    runDeepResearch,
  ]);

  // Keep the ref current so handleSubmitReply can forward to this callback
  sendMessageRef.current = sendMessage;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const hasMessages = messages.length > 0 || streaming;

  /* -- Compute assistant message index (only assistant msgs are indexed) -- */
  function getAssistantMsgIndex(globalIndex: number): number {
    return globalIndex;
  }

  return (
    <div
      className={[
        "chat-container",
        `chat-container--${variant}`,
        hasMessages ? "has-messages" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-chat-id={chatId ?? ""}
    >
      {/* Messages area */}
      <div className="chat-messages">
        {!hasMessages && (
          <div className="chat-welcome">
            <div className="chat-welcome-inner">
              <h1 className="chat-welcome-brand">Quilliam</h1>
              <p className="chat-welcome-tagline">
                Local-by-default writing assistant with opt-in cloud power
              </p>
              <div className="chat-welcome-chips">
                <button
                  className="chat-chip"
                  onClick={() =>
                    setInput(
                      "Help me brainstorm ideas for a mystery novel"
                    )
                  }
                >
                  Brainstorm a mystery novel
                </button>
                <button
                  className="chat-chip"
                  onClick={() =>
                    setInput(
                      "Create a detailed character profile for a protagonist"
                    )
                  }
                >
                  Character profile
                </button>
                <button
                  className="chat-chip"
                  onClick={() =>
                    setInput(
                      "Outline a 3-act structure for a short story"
                    )
                  }
                >
                  Story outline
                </button>
                <button
                  className="chat-chip"
                  onClick={() =>
                    setInput(
                      "Help me build a fantasy world with unique magic rules"
                    )
                  }
                >
                  World-building
                </button>
              </div>
              <p className="chat-welcome-hint">
                <span className="chat-model-badge">{systemStatus.model}</span>
                <span className="chat-mode-badge">{systemStatus.mode}</span>
                <span className="chat-mode-badge">{executionMode.replace(/_/g, " ")}</span>
                — local by default, cloud on explicit approval
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-avatar">
              {msg.role === "user" ? "You" : "Q"}
            </div>
            <div className="chat-msg-body">
              {msg.role === "assistant" ? (
                <AssistantMessage
                  content={msg.content}
                  messageIndex={getAssistantMsgIndex(i)}
                  questionStates={questionStates}
                  onDismiss={handleDismissQuestion}
                  onReply={handleReplyChange}
                  onSubmitReply={handleSubmitReply}
                />
              ) : (
                <div className="chat-msg-content">{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {streaming && streamingContent && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-avatar">Q</div>
            <div className="chat-msg-body">
              <div className="chat-msg-content">
                {parseAssistantMessage(streamingContent).vibe || streamingContent}
                <span className="chat-cursor" />
              </div>
            </div>
          </div>
        )}

        {streaming && !streamingContent && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-avatar">Q</div>
            <div className="chat-msg-body">
              <div className="chat-msg-thinking">
                <span className="chat-dot" />
                <span className="chat-dot" />
                <span className="chat-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-bar">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              executionMode === "local"
                ? "Ask Quilliam anything about your writing..."
                : executionMode === "assisted_cloud"
                  ? "Cloud-assisted prompt (opt-in per send)..."
                  : "Start a deep research run (opt-in per send)..."
            }
            rows={1}
            disabled={isSending}
          />
          <button
            className="chat-send"
            onClick={() => {
              void sendMessage();
            }}
            disabled={isSending || !input.trim()}
            title="Send (Enter)"
          >
            ↑
          </button>
        </div>
        <p className="chat-input-hint">
          Shift+Enter for new line · {executionMode === "local" ? "Processing stays local." : "Cloud actions require explicit confirmation."}
        </p>
        {activeResearchRun && (
          <p className="chat-input-hint">
            Deep Research: {activeResearchRun.status} · phase {activeResearchRun.phase}
          </p>
        )}
      </div>
    </div>
  );
}
