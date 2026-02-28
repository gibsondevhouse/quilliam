"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSystemContext } from "@/lib/context/SystemContext";
import type { ResearchRunRecord } from "@/lib/types";
import { DEFAULT_PROVIDER_CONFIG, DEFAULT_RUN_BUDGET } from "@/lib/types";

import { parseAssistantMessage } from "./chatUtils";
import {
  SYSTEM_PROMPT_LOCAL,
  SYSTEM_PROMPT_ASSISTED,
  SYSTEM_PROMPT_DEEP_RESEARCH,
} from "./systemPrompts";
import { AssistantMessage } from "./AssistantMessage";
import { useLocalChat } from "./hooks/useLocalChat";
import { useAssistedCloud } from "./hooks/useAssistedCloud";
import { useDeepResearch } from "./hooks/useDeepResearch";
import type { ChatMessage, ChatProps, QuestionCard } from "./types";

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
  onResearchRunComplete,
  onPatchesExtracted,
  existingEntries,
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
  const [questionStates, setQuestionStates] = useState<Map<number, QuestionCard[]>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingControllerRef = useRef<AbortController | null>(null);
  const sendMessageRef = useRef<((overrideInput?: string) => Promise<void>) | null>(null);

  // Cancel polling on unmount
  useEffect(() => {
    const ref = pollingControllerRef;
    return () => { ref.current?.abort(); };
  }, []);

  // Auto-scroll
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
  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);

  // Sync messages to parent
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(
        messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      );
    }
  }, [messages, onMessagesChange]);

  const initQuestionStates = useCallback((msgIndex: number, content: string) => {
    const parsed = parseAssistantMessage(content);
    if (parsed.questions.length > 0) {
      setQuestionStates((prev) => {
        const next = new Map(prev);
        next.set(msgIndex, parsed.questions);
        return next;
      });
    }
  }, []);

  const handleDismissQuestion = useCallback((msgIdx: number, qId: string) => {
    setQuestionStates((prev) => {
      const next = new Map(prev);
      const cards = (next.get(msgIdx) ?? []).map((q) =>
        q.id === qId ? { ...q, dismissed: true } : q,
      );
      next.set(msgIdx, cards);
      return next;
    });
  }, []);

  const handleReplyChange = useCallback((msgIdx: number, qId: string, text: string) => {
    setQuestionStates((prev) => {
      const next = new Map(prev);
      const cards = (next.get(msgIdx) ?? []).map((q) =>
        q.id === qId ? { ...q, reply: text } : q,
      );
      next.set(msgIdx, cards);
      return next;
    });
  }, []);

  const handleSubmitReply = useCallback((msgIdx: number, qId: string) => {
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
    if (questionText && replyText) {
      sendMessageRef.current?.(`Re: "${questionText}"\n${replyText}`);
    }
  }, []);

  const runLocalChat = useLocalChat({
    onEditBlock,
    initQuestionStates,
    setMessages,
    setStreamingContent,
    onPatchesExtracted,
    existingEntries,
    // Enable entity extraction only on cloud-assisted paths where structured
    // output quality is reliable. Local Ollama (7B/13B) skips extraction
    // entirely to avoid token overhead and low-quality JSON fences.
    extractionEnabled: executionMode !== "local",
  });

  const runAssistedCloud = useAssistedCloud({
    providerConfig,
    runBudget,
    initQuestionStates,
    onEditBlock,
    onPatchesExtracted,
    setMessages,
  });

  const runDeepResearch = useDeepResearch({
    libraryId,
    providerConfig,
    runBudget,
    onResearchRunChange,
    onResearchRunComplete,
    setActiveResearchRun,
    setMessages,
    pollingControllerRef,
  });

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
      const basePrompt =
        executionMode === "local"
          ? SYSTEM_PROMPT_LOCAL
          : executionMode === "assisted_cloud"
            ? SYSTEM_PROMPT_ASSISTED
            : SYSTEM_PROMPT_DEEP_RESEARCH;
      let systemContent = context
        ? `${basePrompt}\n\n## ACTIVE MANUSCRIPT CONTEXT\n\n${context}\n---\nUse this context to give specific, grounded responses about the author's actual work. Always prefer this over general advice.`
        : basePrompt;

      if (onBuildContext && executionMode !== "deep_research") {
        const ragContext = await onBuildContext(trimmed);
        if (ragContext) systemContent += `\n\n${ragContext}`;
      }

      const apiMessages = [
        { role: "system" as const, content: systemContent },
        ...newMessages,
      ];

      if (executionMode === "local") {
        await runLocalChat({ apiMessages, newMessages, sourceId: `chat_${Date.now()}` });
      } else if (executionMode === "assisted_cloud") {
        setStreaming(false);
        await runAssistedCloud({ trimmed, systemContent, apiMessages, newMessages });
      } else {
        setStreaming(false);
        await runDeepResearch({ trimmed, systemContent });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
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
    input, isSending, executionMode, providerConfig, runBudget,
    messages, context, onBuildContext,
    runLocalChat, runAssistedCloud, runDeepResearch,
  ]);

  sendMessageRef.current = sendMessage;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  const hasMessages = messages.length > 0 || streaming;

  return (
    <div
      className={["chat-container", `chat-container--${variant}`, hasMessages ? "has-messages" : ""]
        .filter(Boolean)
        .join(" ")}
      data-chat-id={chatId ?? ""}
    >
      <div className="chat-messages">
        {!hasMessages && (
          <div className="chat-welcome">
            <div className="chat-welcome-inner">
              <h1 className="chat-welcome-brand">Quilliam</h1>
              <p className="chat-welcome-tagline">
                Local-by-default writing assistant with opt-in cloud power
              </p>
              <div className="chat-welcome-chips">
                <button className="chat-chip" onClick={() => setInput("Help me brainstorm ideas for a mystery novel")}>
                  Brainstorm a mystery novel
                </button>
                <button className="chat-chip" onClick={() => setInput("Create a detailed character profile for a protagonist")}>
                  Character profile
                </button>
                <button className="chat-chip" onClick={() => setInput("Outline a 3-act structure for a short story")}>
                  Story outline
                </button>
                <button className="chat-chip" onClick={() => setInput("Help me build a fantasy world with unique magic rules")}>
                  World-building
                </button>
              </div>
              <p className="chat-welcome-hint">
                <span className="chat-model-badge">{systemStatus.model}</span>
                <span className="chat-mode-badge">{systemStatus.mode}</span>
                <span className="chat-mode-badge">{executionMode.replace(/_/g, " ")}</span>
                {" "}— local by default, cloud on explicit approval
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-avatar">{msg.role === "user" ? "You" : "Q"}</div>
            <div className="chat-msg-body">
              {msg.role === "assistant" ? (
                <AssistantMessage
                  content={msg.content}
                  messageIndex={i}
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
            onClick={() => { void sendMessage(); }}
            disabled={isSending || !input.trim()}
            title="Send (Enter)"
          >
            ↑
          </button>
        </div>
        <p className="chat-input-hint">
          Shift+Enter for new line ·{" "}
          {executionMode === "local"
            ? "Processing stays local."
            : "Cloud actions require explicit confirmation."}
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
