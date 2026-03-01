"use client";

import { QuestionWorkspace } from "./QuestionWorkspace";
import { parseAssistantMessage } from "./chatUtils";
import { MarkdownContent } from "./MarkdownContent";
import type { QuestionCard } from "./types";

interface AssistantMessageProps {
  content: string;
  messageIndex: number;
  questionStates: Map<number, QuestionCard[]>;
  onDismiss: (msgIdx: number, qId: string) => void;
  onReply: (msgIdx: number, qId: string, text: string) => void;
  onSubmitReply: (msgIdx: number, qId: string) => void;
}

export function AssistantMessage({
  content,
  messageIndex,
  questionStates,
  onDismiss,
  onReply,
  onSubmitReply,
}: AssistantMessageProps) {
  const parsed = parseAssistantMessage(content);
  const cards = questionStates.get(messageIndex) ?? parsed.questions;
  const text = parsed.vibe || content;

  return (
    <>
      <MarkdownContent>{text}</MarkdownContent>
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

