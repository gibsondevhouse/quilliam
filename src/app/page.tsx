"use client";

import { useMemo, useState } from "react";
import { Chat } from "@/components/Chat";
import type { AiExecutionMode } from "@/lib/types";

export default function Home() {
  const [executionMode, setExecutionMode] = useState<AiExecutionMode>("local");
  const libraryId = undefined;
  const requiresLibraryHint = useMemo(
    () => "Open a library to use Assisted Cloud or Deep Research.",
    [],
  );

  return (
    <div className="home-chat-page">
      <div className="home-mode-guard">
        <label htmlFor="home-mode-select" className="home-mode-guard-label">
          Execution mode
        </label>
        <select
          id="home-mode-select"
          className="home-mode-guard-select"
          value={executionMode}
          onChange={(e) => setExecutionMode(e.target.value as AiExecutionMode)}
          title={requiresLibraryHint}
        >
          <option value="local">Local</option>
          <option value="assisted_cloud" disabled>
            Assisted Cloud (open library required)
          </option>
          <option value="deep_research" disabled>
            Deep Research (open library required)
          </option>
        </select>
        <p className="home-mode-guard-hint" title={requiresLibraryHint}>
          {requiresLibraryHint}
        </p>
      </div>
      <Chat
        executionMode={executionMode}
        libraryId={libraryId}
        variant="landing"
      />
    </div>
  );
}
