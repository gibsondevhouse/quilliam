"use client";

import { useEffect, useState } from "react";

export interface StartupStatus {
  ram: number;
  model: string;
  contextWindow: number;
  mode: string;
  ollamaReady: boolean;
  modelAvailable: boolean;
  error?: string;
}

interface SystemStatusProps {
  onReady?: (status: StartupStatus) => void;
}

export function SystemStatus({ onReady }: SystemStatusProps) {
  const [status, setStatus] = useState<StartupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/status");
        const data = await response.json();
        setStatus(data);

        // If system is ready, auto-transition to editor
        if (data.ollamaReady && data.modelAvailable && onReady) {
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(() => onReady(data), 600);
          }, 1200);
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
        setStatus({
          ram: 0,
          model: "unknown",
          contextWindow: 0,
          mode: "unknown",
          ollamaReady: false,
          modelAvailable: false,
          error: "Failed to fetch system status. Check the console for details.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [onReady]);

  if (loading) {
    return (
      <div className="startup-screen">
        <div className="startup-content">
          <div className="startup-spinner" />
          <p className="startup-text">Initializing Quilliam...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="startup-screen">
        <div className="startup-content">
          <p className="startup-error">Failed to initialize system status</p>
        </div>
      </div>
    );
  }

  const allReady = status.ollamaReady && status.modelAvailable;

  return (
    <div className={`startup-screen ${fadeOut ? "fade-out" : ""}`}>
      <div className="startup-card">
        <div className="startup-card-inner">
          <h1 className="startup-brand">Quilliam</h1>
          <p className="startup-tagline">Local-first IDE for writers</p>

          {/* Status checks */}
          <div className="startup-checks">
            <div className="startup-check-row">
              <span className="startup-check-label">Ollama</span>
              <span
                className={`startup-check-badge ${status.ollamaReady ? "ok" : "fail"}`}
              >
                {status.ollamaReady ? "Connected" : "Not Found"}
              </span>
            </div>
            <div className="startup-check-row">
              <span className="startup-check-label">Model</span>
              <span
                className={`startup-check-badge ${status.modelAvailable ? "ok" : "warn"}`}
              >
                {status.modelAvailable ? status.model : "Missing"}
              </span>
            </div>
            <div className="startup-check-row">
              <span className="startup-check-label">Mode</span>
              <span className="startup-check-badge ok">{status.mode}</span>
            </div>
          </div>

          {/* Error message */}
          {status.error && (
            <div className="startup-error-box">
              <p>{status.error}</p>
            </div>
          )}

          {/* Status message */}
          {allReady ? (
            <div className="startup-ready">
              <span className="startup-ready-dot" />
              Launching editor...
            </div>
          ) : (
            <div className="startup-blocked">
              {!status.ollamaReady && (
                <p>
                  Run <code>ollama serve</code> in your terminal to start Ollama.
                </p>
              )}
              {status.ollamaReady && !status.modelAvailable && (
                <p>
                  Run <code>ollama pull {status.model}</code> to download the model.
                </p>
              )}
              <button
                className="startup-retry-btn"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
