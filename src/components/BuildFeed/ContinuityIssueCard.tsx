"use client";

import type { ContinuityIssue } from "@/lib/types";
import { compactStatus, evidenceLabel } from "./buildFeedUtils";

interface ContinuityIssueCardProps {
  issue: ContinuityIssue;
  busy?: boolean;
  onSetStatus: (issue: ContinuityIssue, status: ContinuityIssue["status"]) => void;
}

export function ContinuityIssueCard({ issue, busy, onSetStatus }: ContinuityIssueCardProps) {
  const canMarkOpen = issue.status !== "open";
  const canMarkInReview = issue.status !== "in_review";
  const canResolve = issue.status !== "resolved";
  const canWontFix = issue.status !== "wont_fix";

  return (
    <div className="build-feed-card build-feed-card--issue">
      <div className="build-feed-card-header">
        <div className="build-feed-card-meta">
          <span className={`build-feed-severity build-feed-severity--${issue.severity}`}>
            {issue.severity}
          </span>
          <span className={`build-feed-issue-status build-feed-issue-status--${issue.status}`}>
            {compactStatus(issue.status)}
          </span>
          <span className="build-feed-card-source">{issue.checkType}</span>
          <span className="build-feed-card-count">{evidenceLabel(issue)}</span>
        </div>
        <div className="build-feed-card-actions">
          <button
            className="build-feed-btn"
            disabled={!canMarkOpen || busy}
            onClick={() => onSetStatus(issue, "open")}
            title="Move issue back to open"
          >
            Open
          </button>
          <button
            className="build-feed-btn"
            disabled={!canMarkInReview || busy}
            onClick={() => onSetStatus(issue, "in_review")}
            title="Mark issue as in review"
          >
            Review
          </button>
          <button
            className="build-feed-btn build-feed-btn--accept"
            disabled={!canResolve || busy}
            onClick={() => onSetStatus(issue, "resolved")}
            title="Resolve issue"
          >
            Resolve
          </button>
          <button
            className="build-feed-btn build-feed-btn--reject"
            disabled={!canWontFix || busy}
            onClick={() => onSetStatus(issue, "wont_fix")}
            title="Mark issue as won't-fix"
          >
            Won&apos;t Fix
          </button>
        </div>
      </div>
      <div className="build-feed-issue-description">{issue.description}</div>
      {issue.evidence.length > 0 && (
        <ul className="build-feed-issue-evidence">
          {issue.evidence.slice(0, 4).map((row) => (
            <li key={`${issue.id}:${row.type}:${row.id}`} className="build-feed-issue-evidence-item">
              <code>{row.type}</code>
              <span>{row.excerpt ?? row.id}</span>
            </li>
          ))}
        </ul>
      )}
      {issue.resolution && (
        <div className="build-feed-issue-resolution">
          Resolution: {issue.resolution}
        </div>
      )}
    </div>
  );
}
