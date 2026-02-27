"use client";

import type { AiExecutionMode } from "@/lib/types";
import { useSystemContext } from "@/lib/context/SystemContext";

interface StatusBarProps {
  executionMode?: AiExecutionMode;
  /** True while the RAG worker is processing document hashes */
  indexing?: boolean;
  onToggleChat?: () => void;
  bottomPanelOpen?: boolean;
}

export function StatusBar({
  executionMode = "local",
  indexing,
  onToggleChat,
  bottomPanelOpen,
}: StatusBarProps) {
  const { status } = useSystemContext();

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">
          <span className={`status-dot ${status.ollamaReady ? "connected" : "disconnected"}`} />
          Ollama
        </span>
        <span className="status-bar-separator">·</span>
        <span className="status-bar-item">{status.model}</span>
        <span className="status-bar-separator">·</span>
        <span className="status-bar-item">{status.mode}</span>
        <span className="status-bar-separator">·</span>
        <span className="status-bar-item" title="AI execution tier">
          {executionMode.replace(/_/g, " ")}
        </span>
        {indexing && (
          <>
            <span className="status-bar-separator">·</span>
            <span className="status-bar-item indexing" title="Indexing document fragments">
              <span className="status-dot indexing-pulse" />Indexing
            </span>
          </>
        )}
        {status.embedModelAvailable === false && (
          <>
            <span className="status-bar-separator">·</span>
            <span
              className="status-bar-item"
              style={{ color: "var(--status-warn, #f5a623)" }}
              title="Embedding model not available — run: ollama pull nomic-embed-text"
            >
              ⚠ Embeddings offline
            </span>
          </>
        )}
      </div>
      <div className="status-bar-right">
        {onToggleChat && (
          <button
            className={`status-bar-btn ${bottomPanelOpen ? "active" : ""}`}
            onClick={onToggleChat}
            title="Toggle AI Chat"
          >
            AI Chat
          </button>
        )}
        <span className="status-bar-separator">·</span>
        <span className="status-bar-item brand">Quilliam</span>
      </div>
    </footer>
  );
}
