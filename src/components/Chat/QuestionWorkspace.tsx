"use client";

import type { QuestionCard } from "./types";

interface QuestionWorkspaceProps {
  questions: QuestionCard[];
  onDismiss: (id: string) => void;
  onReply: (id: string, text: string) => void;
  onSubmitReply: (id: string) => void;
}

export function QuestionWorkspace({
  questions,
  onDismiss,
  onReply,
  onSubmitReply,
}: QuestionWorkspaceProps) {
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
