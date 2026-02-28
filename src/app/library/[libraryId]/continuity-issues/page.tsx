"use client";

/**
 * Continuity Viewer — relationship graph, contradiction list, timeline, and rule-checks.
 * Route: /library/[libraryId]/continuity-issues
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/context/useStore";
import { ContinuityIssueCard } from "@/components/BuildFeed/ContinuityIssueCard";
import { runDeterministicContinuityChecks } from "@/lib/domain/continuity/checks";
import type { ContinuityIssue, Entry, EntryType, Relationship } from "@/lib/types";

const ALL_TYPES: EntryType[] = [
  "character",
  "location",
  "culture",
  "organization",
  "system",
  "item",
  "language",
  "religion",
  "lineage",
  "economy",
  "rule",
  "scene",
  "timeline_event",
  // Transitional legacy values
  "faction",
  "magic_system",
  "lore_entry",
];

/** Number of days without review before a draft is considered stale. */
const STALE_DAYS = 14;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
/** Snapshot of "now" captured at module load — safe for render comparisons. */
const PAGE_NOW_MS = Date.now();

interface DocMap { [id: string]: Entry }

const SEV_ORDER: Record<ContinuityIssue["severity"], number> = {
  blocker: 0, warning: 1, note: 2,
};

export default function ContinuityPage() {
  const store = useStore();
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const [docs, setDocs] = useState<Entry[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  // Start with loading=true — avoids synchronous setState inside the effect.
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [tab, setTab] = useState<"graph" | "contradictions" | "timeline" | "checks">("graph");
  const loadedRef = useRef(false);

  // ----- Rule checks state -----
  const [checkIssues, setCheckIssues] = useState<ContinuityIssue[]>([]);
  const [checksLoaded, setChecksLoaded] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);

  const loadSavedIssues = useCallback(async () => {
    const saved = await store.listContinuityIssuesByUniverse(libraryId);
    setCheckIssues(
      saved.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.createdAt - a.createdAt),
    );
    setChecksLoaded(true);
  }, [store, libraryId]);

  const handleRunChecks = useCallback(async () => {
    setRunningChecks(true);
    try {
      const [mentionsNested, membershipsNested] = await Promise.all([
        Promise.all(docs.map((d) => store.listMentionsByEntry(d.id))),
        Promise.all(
          docs
            .filter((d) => d.entryType === "culture")
            .map((d) => store.listCultureMembershipsByCulture(d.id)),
        ),
      ]);
      const ctx = {
        universeId: libraryId,
        entries: docs,
        mentions: mentionsNested.flat(),
        cultureMemberships: membershipsNested.flat(),
      };
      const newIssues = runDeterministicContinuityChecks(ctx);
      await Promise.all(newIssues.map((issue) => store.addContinuityIssue(issue)));
      await loadSavedIssues();
    } finally {
      setRunningChecks(false);
    }
  }, [store, libraryId, docs, loadSavedIssues]);

  const handleSetIssueStatus = useCallback(
    async (issue: ContinuityIssue, status: ContinuityIssue["status"]) => {
      await store.updateContinuityIssueStatus(issue.id, status);
      await loadSavedIssues();
    },
    [store, loadSavedIssues],
  );

  useEffect(() => {
    if (tab === "checks" && !checksLoaded) {
      void loadSavedIssues();
    }
  }, [tab, checksLoaded, loadSavedIssues]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const allDocs = (
        await Promise.all(ALL_TYPES.map((t) => store.queryEntriesByType(t)))
      ).flat();
      setDocs(allDocs);

      // Collect all unique relationship IDs from doc relationship refs
      const relSet = new Set<string>();
      for (const doc of allDocs) {
        for (const r of doc.relationships) relSet.add(r.relationshipId);
      }
      // Fetch relationships individually per entry.
      const relList: Relationship[] = [];
      for (const doc of allDocs) {
        const rels = await store.getEntryRelationsForEntry(doc.id);
        for (const r of rels) {
          if (!relList.find((x) => x.id === r.id)) relList.push(r);
        }
      }
      setRelationships(relList);
      setLoading(false);
    })();
  }, [store]);

  const docMap: DocMap = Object.fromEntries(docs.map((d) => [d.id, d]));
  const filteredDocs = typeFilter === "all" ? docs : docs.filter((d) => d.entryType === typeFilter);
  const contradictionDocs = docs.filter(
    (d) => Array.isArray(d.details.contradictions) && (d.details.contradictions as unknown[]).length > 0,
  );
  const staleDraftDocs = docs.filter(
    (d) => d.canonStatus === "draft" && (PAGE_NOW_MS - (d.lastVerified || d.createdAt)) > STALE_MS,
  );
  const timelineDocs = docs
    .filter((d) => d.entryType === "timeline_event")
    .sort((a, b) => String(a.details.date ?? "").localeCompare(String(b.details.date ?? "")));

  if (loading) return <div className="library-page"><p>Loading continuity data…</p></div>;

  return (
    <div className="library-page continuity-page">
      <div className="library-page-header">
        <h2>Continuity Viewer</h2>
        <div className="continuity-tabs">
          {(["graph", "contradictions", "timeline", "checks"] as const).map((t) => (
            <button
              key={t}
              className={`continuity-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === "graph" && (
        <div className="continuity-graph">
          <div className="continuity-filter">
            <label htmlFor="type-filter">Filter by type:</label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EntryType | "all")}
            >
              <option value="all">All types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          {filteredDocs.length === 0 ? (
            <p className="library-page-empty">No entries yet. Write in chat to extract entities.</p>
          ) : (
            <table className="continuity-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Relationships</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const rels = relationships.filter((r) => r.from === doc.id || r.to === doc.id);
                  return (
                    <tr key={doc.id}>
                      <td><strong>{doc.name}</strong></td>
                      <td><code>{doc.entryType.replace(/_/g, " ")}</code></td>
                      <td>
                        <span className={`canonical-doc-status canonical-doc-status--${doc.canonStatus}`}>
                          {doc.canonStatus}
                        </span>
                      </td>
                      <td>
                        {rels.length === 0 ? "—" : (
                          <ul className="continuity-rel-list">
                            {rels.map((r) => {
                              const other = docMap[r.from === doc.id ? r.to : r.from];
                              return (
                                <li key={r.id}>
                                  {r.from === doc.id ? "→" : "←"}{" "}
                                  <em>{r.type}</em>{" "}
                                  {other ? other.name : r.from === doc.id ? r.to : r.from}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                      <td>{doc.summary || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "contradictions" && (
        <div className="continuity-contradictions">
          <h3 className="continuity-section-heading">Confirmed Contradictions</h3>
          {contradictionDocs.length === 0 ? (
            <p className="library-page-empty">No contradictions recorded.</p>
          ) : (
            <ul className="continuity-contradiction-list">
              {contradictionDocs.map((doc) => {
                const contras = doc.details.contradictions as {
                  note: string;
                  at: number;
                }[];
                return (
                  <li key={doc.id} className="continuity-contradiction-item">
                    <strong>{doc.name}</strong>
                    <ul>
                      {contras.map((c, i) => (
                        <li key={i}>
                          {c.note}{" "}
                          <small>({new Date(c.at).toLocaleDateString()})</small>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="continuity-section-heading" style={{ marginTop: 24 }}>
            Stale Drafts <small>(not reviewed in {STALE_DAYS}+ days)</small>
          </h3>
          {staleDraftDocs.length === 0 ? (
            <p className="library-page-empty">No stale draft docs.</p>
          ) : (
            <table className="canon-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {staleDraftDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td><strong>{doc.name}</strong></td>
                    <td>{doc.entryType.replace(/_/g, " ")}</td>
                    <td>
                      {doc.lastVerified
                        ? new Date(doc.lastVerified).toLocaleDateString()
                        : <em>never</em>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className="continuity-timeline">
          {timelineDocs.length === 0 ? (
            <p className="library-page-empty">No timeline events yet.</p>
          ) : (
            <ol className="continuity-timeline-list">
              {timelineDocs.map((doc) => (
                <li key={doc.id} className="continuity-timeline-item">
                  <span className="continuity-timeline-date">
                    {String(doc.details.date ?? "Unknown date")}
                  </span>
                  <strong>{doc.name}</strong>
                  {doc.summary && <p>{doc.summary}</p>}
                  {Array.isArray(doc.details.participants) && (
                    <p>Participants: {(doc.details.participants as string[]).join(", ")}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === "checks" && (
        <div className="continuity-checks">
          <div className="continuity-checks-toolbar">
            <span className="continuity-checks-count">
              {checkIssues.length} issue{checkIssues.length !== 1 ? "s" : ""}
            </span>
            <button
              className="library-page-action"
              onClick={() => void handleRunChecks()}
              disabled={runningChecks || loading}
            >
              {runningChecks ? "Running…" : "▶ Run Checks"}
            </button>
          </div>

          {!checksLoaded ? (
            <p className="library-page-empty">Select this tab to load saved issues.</p>
          ) : checkIssues.length === 0 ? (
            <div className="library-page-empty">
              <p>No issues recorded. Click <strong>Run Checks</strong> to scan for problems.</p>
              <p className="continuity-checks-hint">
                Checks: duplicate canonical names · broken mention refs ·
                conflicting timeline events · culture membership overlap · death-before-appearance
              </p>
            </div>
          ) : (
            <ul className="continuity-checks-list">
              {checkIssues.map((issue) => (
                <li key={issue.id}>
                  <ContinuityIssueCard
                    issue={issue}
                    onSetStatus={(iss, status) => void handleSetIssueStatus(iss, status)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
