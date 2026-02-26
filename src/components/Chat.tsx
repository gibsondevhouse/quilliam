"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  model: string;
  mode: string;
  chatId?: string;
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  onMessagesChange?: (messages: { role: "user" | "assistant"; content: string }[]) => void;
}

/* ================================================================
   System prompt — enforces the Modular Architect pattern
   ================================================================ */

const SYSTEM_PROMPT = `You are Quilliam, a local writing assistant for authors and journalists. You run entirely on the user's machine — their work never leaves their device.

## RESPONSE FORMAT — MANDATORY

You MUST structure EVERY response in exactly two sections:

### Section 1: VIBE
A brief, conversational reply — 1 to 3 short sentences max. This is the core of what you want to say. No questions here. No lists of options. Just the essence.

### Section 2: WORKSPACE
If you need more information from the user, list each question as a separate line starting with [Q] — one question per line, no grouping, no paragraphs. Each question should be self-contained and answerable independently. If you have no questions, omit this section entirely.

### Example output:

Love the noir direction — a rain-soaked coastal town with a disappearing lighthouse keeper has real potential. Let me help shape this.

[Q] What era should this be set in — modern day, mid-century, or historical?
[Q] Is the protagonist a local or an outsider arriving in town?
[Q] Should the tone lean hardboiled or more literary/atmospheric?
[Q] Any themes you want woven in — grief, corruption, family secrets?

### Rules:
- NEVER put questions inside the vibe section.
- NEVER group multiple questions into one [Q] line.
- NEVER number the questions — just use [Q] prefix.
- Keep the vibe SHORT. The workspace does the heavy lifting.
- If the user's request is clear and complete, just respond with the vibe — no workspace needed.`;

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
      <div className="chat-msg-content">{parsed.vibe}</div>
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

export function Chat({ model, mode, chatId, initialMessages, onMessagesChange }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages.map((m) => ({ role: m.role, content: m.content }));
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [questionStates, setQuestionStates] = useState<
    Map<number, QuestionCard[]>
  >(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        setInput(answerMessage);
      }
    },
    []
  );

  /* -- Send message -- */
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    try {
      const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...newMessages,
      ];

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

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              setStreamingContent(fullContent);
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      const assistantIndex = newMessages.length; // index in the messages array
      setMessages((prev) => {
        const updated = [
          ...prev,
          { role: "assistant" as const, content: fullContent },
        ];
        return updated;
      });
      initQuestionStates(assistantIndex, fullContent);
      setStreamingContent("");
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: `⚠ ${errMsg}` },
      ]);
      setStreamingContent("");
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming, initQuestionStates]);

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
    <div className="chat-container">
      {/* Messages area */}
      <div className="chat-messages">
        {!hasMessages && (
          <div className="chat-welcome">
            <div className="chat-welcome-inner">
              <h1 className="chat-welcome-brand">Quilliam</h1>
              <p className="chat-welcome-tagline">
                Your local writing assistant
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
                <span className="chat-model-badge">{model}</span>
                <span className="chat-mode-badge">{mode}</span>
                — running locally on your machine
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
                {parseAssistantMessage(streamingContent).vibe}
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
            placeholder="Ask Quilliam anything about your writing..."
            rows={1}
            disabled={streaming}
          />
          <button
            className="chat-send"
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            title="Send (Enter)"
          >
            ↑
          </button>
        </div>
        <p className="chat-input-hint">
          Shift+Enter for new line · All processing happens locally
        </p>
      </div>
    </div>
  );
}
