"use client";

import { useState } from "react";
import { opSummary } from "@/lib/domain/patch";
import type { EntryPatch } from "@/lib/types";
import { sourceLabel, confidenceBadgeProps } from "./buildFeedUtils";

interface PatchCardProps {
  patch: EntryPatch;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  resolved?: boolean;
  resolvedAs?: "accepted" | "rejected";
}

export function PatchCard({ patch, onAccept, onReject, resolved, resolvedAs }: PatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = confidenceBadgeProps(patch.confidence);

  return (
    <div className={`build-feed-card${resolved ? " build-feed-card--resolved" : ""}`}>
      <div className="build-feed-card-header">
        <div className="build-feed-card-meta">
          <span className="build-feed-card-source">{sourceLabel(patch)}</span>
          <span className="build-feed-card-count">{patch.operations.length} op(s)</span>
          <span className={`build-feed-confidence ${badge.cls}`}>{badge.label}</span>
          {resolved && resolvedAs && (
            <span className={`build-feed-resolved-label build-feed-resolved-label--${resolvedAs}`}>
              {resolvedAs === "accepted" ? "✓ accepted" : "✕ rejected"}
            </span>
          )}
        </div>
        <div className="build-feed-card-actions">
          {!resolved && (
            <>
              <button
                className="build-feed-btn build-feed-btn--accept"
                onClick={() => onAccept(patch.id)}
                title="Accept all operations in this patch"
              >
                Accept
              </button>
              <button
                className="build-feed-btn build-feed-btn--reject"
                onClick={() => onReject(patch.id)}
                title="Reject all operations — archived, not deleted"
              >
                Reject
              </button>
            </>
          )}
          <button
            className="build-feed-btn build-feed-btn--expand"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {expanded && (
        <ul className="build-feed-ops">
          {patch.operations.map((op, i) => (
            <li key={i} className="build-feed-op">
              <code className={`build-feed-op-badge build-feed-op-badge--${op.op}`}>{op.op}</code>
              <span className="build-feed-op-summary">{opSummary(op)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
