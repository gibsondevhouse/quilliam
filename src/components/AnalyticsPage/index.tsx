"use client";

import { useAnalyticsData } from "./useAnalyticsData";
import type { OrphanedEntry, UnanchoredCharacter, UncitedRule, UnusedOrg } from "./useAnalyticsData";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="analytics-stat-card">
      <span className="analytics-stat-value">{value}</span>
      <span className="analytics-stat-label">{label}</span>
      {sub && <span className="analytics-stat-sub">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="analytics-section-header">
      <h3 className="analytics-section-title">{title}</h3>
      {count !== undefined && (
        <span className={`analytics-section-badge${count === 0 ? " ok" : " warn"}`}>{count}</span>
      )}
    </div>
  );
}

function EntryRow({ name, type, detail }: { name: string; type: string; detail: string }) {
  return (
    <li className="analytics-entry-row">
      <span className="analytics-entry-type">{type}</span>
      <span className="analytics-entry-name">{name}</span>
      <span className="analytics-entry-detail">{detail}</span>
    </li>
  );
}

export function AnalyticsPage() {
  const { data, loading, error, refresh } = useAnalyticsData();

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-page-header"><h2>Analytics</h2></div>
        <div className="library-page-empty"><p>Computing analytics…</p></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="library-page">
        <div className="library-page-header"><h2>Analytics</h2></div>
        <div className="library-page-empty">
          <p style={{ color: "#ef4444" }}>Error: {error ?? "No data"}</p>
          <button className="library-page-action" onClick={refresh}>Retry</button>
        </div>
      </div>
    );
  }

  const { byType, totalEntries, canonRate, manuscript, orphanedEntries, unanchoredCharacters, unusedOrgs, uncitedRules } = data;

  return (
    <div className="library-page analytics-page">
      <div className="library-page-header">
        <h2>Analytics</h2>
        <button className="library-page-action" onClick={refresh}>↻ Refresh</button>
      </div>

      {/* ── Overview stats ─────────────────────────────────────────── */}
      <div className="analytics-stats-row">
        <StatCard label="Total Entries" value={totalEntries} />
        <StatCard label="Canon Rate" value={`${canonRate}%`} sub={`${byType.reduce((s, t) => s + t.canon, 0)} canon`} />
        <StatCard label="Books" value={manuscript.bookCount} />
        <StatCard label="Chapters" value={manuscript.chapterCount} />
        <StatCard label="Scenes" value={manuscript.sceneCount} sub={`${manuscript.scenesWithPov} with POV`} />
        <StatCard
          label="Scenes w/o POV"
          value={manuscript.scenesWithoutPov}
          sub={manuscript.sceneCount > 0 ? `${Math.round((manuscript.scenesWithoutPov / manuscript.sceneCount) * 100)}%` : "—"}
        />
      </div>

      {/* ── Entry type breakdown ────────────────────────────────────── */}
      <section className="analytics-section">
        <SectionHeader title="Entry type breakdown" />
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Total</th>
              <th>Canon</th>
              <th>Draft</th>
              <th>Proposed</th>
              <th>Other</th>
              <th className="analytics-bar-col">Canon %</th>
            </tr>
          </thead>
          <tbody>
            {byType.map((row) => (
              <tr key={row.type}>
                <td className="analytics-type-cell">{row.type}</td>
                <td>{row.total}</td>
                <td className="analytics-canon">{row.canon}</td>
                <td className="analytics-draft">{row.draft}</td>
                <td className="analytics-proposed">{row.proposed}</td>
                <td>{row.other}</td>
                <td className="analytics-bar-col">
                  <div className="analytics-bar">
                    <div
                      className="analytics-bar-fill"
                      style={{ width: `${row.total > 0 ? Math.round((row.canon / row.total) * 100) : 0}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Orphaned entries ────────────────────────────────────────── */}
      <section className="analytics-section">
        <SectionHeader title="Orphaned entries (no relations & no mentions)" count={orphanedEntries.length} />
        {orphanedEntries.length === 0 ? (
          <p className="analytics-ok-msg">✓ All entries have at least one relation or mention.</p>
        ) : (
          <ul className="analytics-entry-list">
            {orphanedEntries.slice(0, 30).map(({ entry }: OrphanedEntry) => (
              <EntryRow key={entry.id} name={entry.name} type={entry.entryType ?? entry.type ?? "?"} detail="0 relations, 0 mentions" />
            ))}
            {orphanedEntries.length > 30 && (
              <li className="analytics-more">…and {orphanedEntries.length - 30} more</li>
            )}
          </ul>
        )}
      </section>

      {/* ── Unanchored characters ────────────────────────────────────── */}
      <section className="analytics-section">
        <SectionHeader title="Unanchored characters (missing culture or org membership)" count={unanchoredCharacters.length} />
        {unanchoredCharacters.length === 0 ? (
          <p className="analytics-ok-msg">✓ All characters have culture and organization memberships.</p>
        ) : (
          <ul className="analytics-entry-list">
            {unanchoredCharacters.slice(0, 30).map(({ entry, hasCultureMembership, hasOrgMembership }: UnanchoredCharacter) => (
              <EntryRow
                key={entry.id}
                name={entry.name}
                type="character"
                detail={[
                  !hasCultureMembership ? "no culture" : null,
                  !hasOrgMembership ? "no org" : null,
                ].filter(Boolean).join(", ")}
              />
            ))}
            {unanchoredCharacters.length > 30 && (
              <li className="analytics-more">…and {unanchoredCharacters.length - 30} more</li>
            )}
          </ul>
        )}
      </section>

      {/* ── Unused organizations ────────────────────────────────────── */}
      <section className="analytics-section">
        <SectionHeader title="Unused organizations (0 character members)" count={unusedOrgs.length} />
        {unusedOrgs.length === 0 ? (
          <p className="analytics-ok-msg">✓ All organizations have at least one member.</p>
        ) : (
          <ul className="analytics-entry-list">
            {unusedOrgs.slice(0, 30).map(({ entry }: UnusedOrg) => (
              <EntryRow key={entry.id} name={entry.name} type={entry.entryType ?? entry.type ?? "org"} detail="0 members" />
            ))}
            {unusedOrgs.length > 30 && (
              <li className="analytics-more">…and {unusedOrgs.length - 30} more</li>
            )}
          </ul>
        )}
      </section>

      {/* ── Uncited rules ───────────────────────────────────────────── */}
      <section className="analytics-section">
        <SectionHeader title="Uncited rules (never mentioned in a scene)" count={uncitedRules.length} />
        {uncitedRules.length === 0 ? (
          <p className="analytics-ok-msg">✓ All rules appear in at least one scene.</p>
        ) : (
          <ul className="analytics-entry-list">
            {uncitedRules.slice(0, 30).map(({ entry }: UncitedRule) => (
              <EntryRow key={entry.id} name={entry.name} type="rule" detail="0 scene mentions" />
            ))}
            {uncitedRules.length > 30 && (
              <li className="analytics-more">…and {uncitedRules.length - 30} more</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
