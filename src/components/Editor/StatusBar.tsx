"use client";

interface StatusBarProps {
  model: string;
  mode: string;
  ollamaReady: boolean;
  /** True while the RAG worker is processing document hashes */
  indexing?: boolean;
  /** Whether the dedicated embedding model is available in Ollama */
  embeddingReady?: boolean;
  onToggleChat?: () => void;
  bottomPanelOpen?: boolean;
}

export function StatusBar({ model, mode, ollamaReady, indexing, embeddingReady, onToggleChat, bottomPanelOpen }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">
          <span className={`status-dot ${ollamaReady ? "connected" : "disconnected"}`} />
          Ollama
        </span>
        <span className="status-bar-separator">·</span>
        <span className="status-bar-item">{model}</span>
        <span className="status-bar-separator">·</span>
        <span className="status-bar-item">{mode}</span>
        {indexing && (
          <>
            <span className="status-bar-separator">·</span>
            <span className="status-bar-item indexing" title="Indexing document fragments">
              <span className="status-dot indexing-pulse" />Indexing
            </span>
          </>
        )}
        {embeddingReady === false && (
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
