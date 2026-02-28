"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import type { Entry, Relationship } from "@/lib/types";

type RelCategory = "all" | "conflict" | "alliance" | "other";

const CONFLICT_TYPES = new Set([
  "at_war_with",
  "historical_enemy",
  "declared_war",
  "siege",
  "occupation",
]);
const ALLIANCE_TYPES = new Set([
  "allied_with",
  "trade_partner",
  "tributary_of",
  "peace_treaty",
  "defensive_pact",
  "vassalage",
]);

const POLITY_ENTRY_TYPES = [
  "organization",
  "culture",
  "lineage",
  "faction",
] as const;

const REL_TYPE_OPTIONS = [
  "allied_with",
  "at_war_with",
  "trade_partner",
  "tributary_of",
  "historical_enemy",
  "peace_treaty",
  "defensive_pact",
  "vassalage",
] as const;

interface ConflictDraft {
  fromId: string;
  toId: string;
  relationType: string;
  note: string;
}
const BLANK: ConflictDraft = { fromId: "", toId: "", relationType: "at_war_with", note: "" };

function relCategory(type: string): RelCategory {
  if (CONFLICT_TYPES.has(type)) return "conflict";
  if (ALLIANCE_TYPES.has(type)) return "alliance";
  return "other";
}

function RelBadge({ type }: { type: string }) {
  const cat = relCategory(type);
  const colour =
    cat === "conflict" ? "#ef4444" : cat === "alliance" ? "#22c55e" : "#a78bfa";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 3,
        background: `${colour}22`,
        color: colour,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

export default function ConflictsPage() {
  const store = useStore();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [relations, setRelations] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<RelCategory>("all");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<ConflictDraft>(BLANK);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    const polityEntries = (
      await Promise.all(POLITY_ENTRY_TYPES.map((t) => store.queryEntriesByType(t)))
    ).flat();
    setEntries(polityEntries);

    const seen = new Set<string>();
    const relList: Relationship[] = [];
    for (const e of polityEntries) {
      const rels = await store.getEntryRelationsForEntry(e.id);
      for (const r of rels) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          relList.push(r);
        }
      }
    }
    setRelations(relList.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, [store]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const entryName = useCallback(
    (id: string) => entries.find((e) => e.id === id)?.name ?? id.slice(0, 8) + "…",
    [entries],
  );

  const handleAdd = useCallback(async () => {
    if (!draft.fromId || !draft.toId || !draft.relationType) return;
    setSaving(true);
    const now = Date.now();
    const newRel: Relationship = {
      id: crypto.randomUUID(),
      from: draft.fromId,
      to: draft.toId,
      type: draft.relationType,
      fromEntryId: draft.fromId,
      toEntryId: draft.toId,
      relationType: draft.relationType,
      metadata: draft.note ? { note: draft.note } : {},
      meta: draft.note ? { note: draft.note } : {},
      sources: [],
      createdAt: now,
    };
    await store.addEntryRelation(newRel);
    await reload();
    setDraft(BLANK);
    setShowForm(false);
    setSaving(false);
  }, [store, draft, reload]);

  const handleRemove = useCallback(
    async (rel: Relationship) => {
      await store.removeEntryRelation(rel.id);
      setRelations((prev) => prev.filter((r) => r.id !== rel.id));
    },
    [store],
  );

  const filteredRels =
    catFilter === "all"
      ? relations
      : relations.filter((r) => relCategory(r.type) === catFilter);

  if (loading) {
    return <div className="library-page"><p>Loading…</p></div>;
  }

  return (
    <div className="library-page">
      <div className="library-page-header">
        <h2>Conflicts &amp; Treaties</h2>
        <div className="library-page-header-actions">
          {(["all", "conflict", "alliance", "other"] as RelCategory[]).map((cat) => (
            <button
              key={cat}
              className={`continuity-tab${catFilter === cat ? " active" : ""}`}
              onClick={() => setCatFilter(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
          <button className="library-page-action" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="media-add-form">
          <div className="cv-form-row">
            <label className="cv-form-label">From *</label>
            <select
              className="cv-form-select"
              value={draft.fromId}
              onChange={(e) => setDraft((d) => ({ ...d, fromId: e.target.value }))}
            >
              <option value="">— select entity —</option>
              {entries.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.entryType})</option>
              ))}
            </select>
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">Relation *</label>
            <select
              className="cv-form-select"
              value={draft.relationType}
              onChange={(e) => setDraft((d) => ({ ...d, relationType: e.target.value }))}
            >
              {REL_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">To *</label>
            <select
              className="cv-form-select"
              value={draft.toId}
              onChange={(e) => setDraft((d) => ({ ...d, toId: e.target.value }))}
            >
              <option value="">— select entity —</option>
              {entries.filter((e) => e.id !== draft.fromId).map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.entryType})</option>
              ))}
            </select>
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">Note</label>
            <input
              className="cv-form-input"
              placeholder="Optional context or treaty terms"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            />
          </div>
          <div className="cv-form-actions">
            <button
              className="cv-form-btn cv-form-btn--primary"
              onClick={handleAdd}
              disabled={saving || !draft.fromId || !draft.toId}
            >
              {saving ? "Saving…" : "Add Relation"}
            </button>
          </div>
        </div>
      )}

      {filteredRels.length === 0 ? (
        <div className="library-page-empty">
          {relations.length === 0 ? (
            <>
              <p>No inter-polity relations recorded yet.</p>
              <button className="library-page-action primary" onClick={() => setShowForm(true)}>
                Add the first conflict or treaty
              </button>
            </>
          ) : (
            <p>No {catFilter} relations.</p>
          )}
        </div>
      ) : (
        <ul className="library-item-list" style={{ marginTop: 16 }}>
          {filteredRels.map((rel) => {
            const fromId = rel.fromEntryId ?? rel.from;
            const toId = rel.toEntryId ?? rel.to;
            const note = (rel.meta?.note ?? rel.metadata?.note) as string | undefined;
            return (
              <li key={rel.id} className="library-item-row" style={{ padding: "10px 12px", alignItems: "center" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                  <span className="library-item-title" style={{ minWidth: 120 }}>{entryName(fromId)}</span>
                  <RelBadge type={rel.relationType ?? rel.type} />
                  <span className="library-item-title" style={{ minWidth: 120 }}>{entryName(toId)}</span>
                  {note && (
                    <span className="library-item-preview" style={{ flexBasis: "100%", marginTop: 2 }}>
                      {note}
                    </span>
                  )}
                </div>
                <button
                  className="library-item-delete"
                  onClick={() => void handleRemove(rel)}
                  title="Remove"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

