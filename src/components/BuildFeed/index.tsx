"use client";

import { useParams } from "next/navigation";
import { PatchCard } from "./PatchCard";
import { ContinuityIssueCard } from "./ContinuityIssueCard";
import { sourceLabel } from "./buildFeedUtils";
import { useBuildFeedActions } from "./hooks/useBuildFeedActions";

export function BuildFeed() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;

  const {
    patches,
    resolvedPatches,
    scanReport,
    scanPending,
    busyIssueId,
    issueError,
    loading,
    groups,
    openIssues,
    handleAccept,
    handleReject,
    handleAcceptAll,
    handleRejectAll,
    handleRunChecks,
    handleSetIssueStatus,
  } = useBuildFeedActions({ libraryId });

  if (loading) {
    return (
      <div className="build-feed">
        <div className="build-feed-header"><h2>Continuity + Suggestions</h2></div>
        <div className="build-feed-empty">Loading build feed…</div>
      </div>
    );
  }

  return (
    <div className="build-feed">
      <div className="build-feed-header">
        <h2>Continuity + Suggestions</h2>
        <span className="build-feed-count">
          {openIssues.length} open issue(s) · {patches.length} pending patch(es)
        </span>
      </div>

      <section className="build-feed-group">
        <div className="build-feed-group-header">
          <div className="build-feed-group-title">Continuity Issues</div>
          <div className="build-feed-group-actions">
            <button className="build-feed-btn" disabled={scanPending} onClick={handleRunChecks}>
              {scanPending ? "Running…" : "Run Checks"}
            </button>
          </div>
        </div>

        {issueError && <div className="build-feed-error">{issueError}</div>}

        {scanReport && (
          <div className="build-feed-continuity-report">
            Detected: {scanReport.detected} · New: {scanReport.created} · Reopened: {scanReport.reopened} · Auto-resolved: {scanReport.autoResolved}
          </div>
        )}

        <div className="build-feed-group-list">
          {openIssues.length === 0 ? (
            <div className="build-feed-empty">No open continuity issues.</div>
          ) : (
            openIssues.map((issue) => (
              <ContinuityIssueCard
                key={issue.id}
                issue={issue}
                busy={busyIssueId === issue.id}
                onSetStatus={handleSetIssueStatus}
              />
            ))
          )}
        </div>
      </section>

      {patches.length === 0 && resolvedPatches.length === 0 ? (
        <div className="build-feed-empty">No pending suggestions.</div>
      ) : (
        <>
          {Array.from(groups.entries()).map(([sourceKey, group]) => (
            <section key={sourceKey} className="build-feed-group">
              <div className="build-feed-group-header">
                <div className="build-feed-group-title">{sourceLabel(group[0])}</div>
                <div className="build-feed-group-actions">
                  <button className="build-feed-btn" onClick={() => handleAcceptAll(sourceKey)}>
                    Accept All
                  </button>
                  <button className="build-feed-btn" onClick={() => handleRejectAll(sourceKey)}>
                    Reject All
                  </button>
                </div>
              </div>
              <div className="build-feed-group-list">
                {group.map((patch) => (
                  <PatchCard
                    key={patch.id}
                    patch={patch}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </section>
          ))}

          {resolvedPatches.length > 0 && (
            <section className="build-feed-resolved">
              <h3>Resolved</h3>
              <div className="build-feed-group-list">
                {resolvedPatches
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .slice(0, 20)
                  .map((patch) => (
                    <PatchCard
                      key={`resolved-${patch.id}`}
                      patch={patch}
                      resolved
                      resolvedAs={patch.resolvedAs}
                      onAccept={() => undefined}
                      onReject={() => undefined}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
