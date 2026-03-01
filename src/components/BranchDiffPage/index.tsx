"use client";

import { useState } from "react";
import { useBranchData } from "./useBranchData";
import type { EntryDiff } from "./useBranchData";

function DiffTable({ diff }: { diff: EntryDiff }) {
  return (
    <table className="branch-diff-table">
      <thead>
        <tr>
          <th className="branch-diff-th branch-diff-th--field">Field</th>
          <th className="branch-diff-th branch-diff-th--alt">Alternate Branch</th>
          <th className="branch-diff-th branch-diff-th--canon">Canon / Current</th>
        </tr>
      </thead>
      <tbody>
        {diff.fields.map((f) => (
          <tr
            key={f.field}
            className={`branch-diff-row${f.changed ? " branch-diff-row--changed" : ""}`}
          >
            <td className="branch-diff-td branch-diff-td--field">{f.label}</td>
            <td className="branch-diff-td branch-diff-td--alt">
              {f.altValue && f.altValue !== "—" ? (
                <span className={f.changed ? "branch-diff-changed-val" : ""}>{f.altValue}</span>
              ) : (
                <em className="branch-diff-empty">—</em>
              )}
            </td>
            <td className="branch-diff-td branch-diff-td--canon">
              {f.canonValue && f.canonValue !== "—" ? (
                f.canonValue
              ) : (
                <em className="branch-diff-empty">—</em>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BranchDiffPage() {
  const {
    branchGroups,
    selectedBranch,
    setSelectedBranch,
    selectedEntryId,
    setSelectedEntryId,
    getEntryDiff,
    promoteToCanon,
    refresh,
  } = useBranchData();

  const [retconCounterpart, setRetconCounterpart] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);

  const activeBranch = branchGroups.find((g) => g.branchName === selectedBranch);
  const activeEntry = activeBranch?.entries.find((e) => e.id === selectedEntryId) ?? null;
  const diff: EntryDiff | null = activeEntry ? getEntryDiff(activeEntry) : null;

  const handlePromote = async (id: string) => {
    setPromoting(id);
    await promoteToCanon(id, retconCounterpart);
    setPromoting(null);
    setSelectedEntryId(null);
  };

  return (
    <div className="branch-diff-page">
      <div className="branch-header">
        <h1 className="branch-title">Branch Diff</h1>
        <p className="branch-subtitle">
          Compare <strong>alternate-branch</strong> entries against their canon counterparts.
          Tag entries with <code>branch:Name</code> to group them into named branches.
        </p>
        <button className="branch-refresh-btn" onClick={refresh}>
          ↻ Refresh
        </button>
      </div>

      {branchGroups.length === 0 ? (
        <div className="branch-empty">
          <p>No alternate-branch entries found.</p>
          <p className="branch-empty-hint">
            Set an entry&apos;s canon status to <strong>Alternate Branch</strong> and add a tag like{" "}
            <code>branch:WhatIf</code> to start comparing timelines.
          </p>
        </div>
      ) : (
        <div className="branch-layout">
          {/* Sidebar: branch groups + entry list */}
          <aside className="branch-sidebar">
            {branchGroups.map((g) => (
              <div key={g.branchName} className="branch-group">
                <button
                  className={`branch-group-btn${selectedBranch === g.branchName ? " branch-group-btn--active" : ""}`}
                  onClick={() => {
                    setSelectedBranch(g.branchName);
                    setSelectedEntryId(null);
                  }}
                >
                  <span className="branch-group-name">{g.branchName}</span>
                  <span className="branch-group-count">{g.entries.length}</span>
                </button>
                {selectedBranch === g.branchName && (
                  <ul className="branch-entry-list">
                    {g.entries.map((e) => (
                      <li key={e.id}>
                        <button
                          className={`branch-entry-btn${selectedEntryId === e.id ? " branch-entry-btn--active" : ""}`}
                          onClick={() => setSelectedEntryId(e.id)}
                        >
                          <span className="branch-entry-type">{e.entryType}</span>
                          <span className="branch-entry-name">{e.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </aside>

          {/* Main panel: diff table */}
          <main className="branch-diff-panel">
            {!diff ? (
              <div className="branch-diff-placeholder">
                Select an entry on the left to compare it with its canon counterpart.
              </div>
            ) : (
              <>
                <div className="branch-diff-header">
                  <div className="branch-diff-meta">
                    <span className="branch-diff-type">{diff.alt.entryType}</span>
                    <h2 className="branch-diff-name">{diff.alt.name}</h2>
                  </div>
                  <div className="branch-diff-actions">
                    <label className="branch-retcon-label">
                      <input
                        type="checkbox"
                        checked={retconCounterpart}
                        onChange={(e) => setRetconCounterpart(e.target.checked)}
                      />
                      Retcon existing canon entry
                    </label>
                    <button
                      className="branch-promote-btn"
                      disabled={promoting === diff.alt.id}
                      onClick={() => void handlePromote(diff.alt.id)}
                    >
                      {promoting === diff.alt.id ? "Promoting…" : "✓ Promote to Canon"}
                    </button>
                  </div>
                </div>

                {!diff.canon && (
                  <div className="branch-diff-no-canon">
                    No canon counterpart found — this entry would be <em>added</em> as new canon.
                  </div>
                )}

                <div className="branch-diff-changed-summary">
                  {diff.fields.filter((f) => f.changed).length} of {diff.fields.length} fields differ
                </div>

                <DiffTable diff={diff} />
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
