"use client";

import type { ChangeSet } from "@/lib/changeSets";

interface EntityChangePanelProps {
  entityLabel: string;
  pendingChangeSets: ChangeSet[];
  draftText: string;
  onAcceptHunk?: (id: string) => void;
  onRejectHunk?: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function EntityChangePanel({
  entityLabel,
  pendingChangeSets,
  draftText,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: EntityChangePanelProps) {
  if (pendingChangeSets.length === 0) return null;

  return (
    <section className="entity-change-panel" aria-live="polite">
      <div className="entity-change-header">
        <div>
          <p className="entity-change-title">AI Draft Changes</p>
          <p className="entity-change-subtitle">
            {entityLabel} · {pendingChangeSets.length} pending
          </p>
        </div>
        <div className="entity-change-actions">
          {onAcceptAll && (
            <button
              type="button"
              className="entity-change-btn accept"
              onClick={onAcceptAll}
            >
              Accept All
            </button>
          )}
          {onRejectAll && (
            <button
              type="button"
              className="entity-change-btn reject"
              onClick={onRejectAll}
            >
              Reject All
            </button>
          )}
        </div>
      </div>

      <textarea
        className="detail-textarea entity-change-preview"
        value={draftText}
        readOnly
      />

      <div className="entity-change-hunks">
        {pendingChangeSets.map((cs, index) => (
          <div className="entity-change-hunk" key={cs.id}>
            <div className="entity-change-hunk-copy">
              <span className="entity-change-hunk-label">Hunk {index + 1}</span>
              {cs.commentary.trim() && (
                <span className="entity-change-hunk-note">
                  {cs.commentary.trim().slice(0, 120)}
                </span>
              )}
            </div>
            <div className="entity-change-hunk-actions">
              {onAcceptHunk && (
                <button
                  type="button"
                  className="entity-change-btn accept"
                  onClick={() => onAcceptHunk(cs.id)}
                >
                  Accept
                </button>
              )}
              {onRejectHunk && (
                <button
                  type="button"
                  className="entity-change-btn reject"
                  onClick={() => onRejectHunk(cs.id)}
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
