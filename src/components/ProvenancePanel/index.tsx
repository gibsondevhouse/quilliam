"use client";

import { useCallback, useState } from "react";
import { useProvenanceData } from "./useProvenanceData";
import type { Entry, SourceRef } from "@/lib/types";

const KIND_LABEL: Record<SourceRef["kind"], string> = {
  chat_message: "Chat",
  research_artifact: "Research",
  scene_node: "Scene",
  manual: "Manual",
};

const KIND_CLASS: Record<SourceRef["kind"], string> = {
  chat_message: "prov-kind--chat",
  research_artifact: "prov-kind--research",
  scene_node: "prov-kind--scene",
  manual: "prov-kind--manual",
};

interface ProvenancePanelProps {
  entry: Entry;
  onEntryUpdated?: () => void;
}

export function ProvenancePanel({ entry, onEntryUpdated }: ProvenancePanelProps) {
  const { mentions, loading, addManualSource, removeSource, refresh } =
    useProvenanceData(entry);

  const [showAddForm, setShowAddForm] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const sources: SourceRef[] = entry.sources ?? [];

  const handleAdd = useCallback(async () => {
    setSaving(true);
    await addManualSource(excerpt);
    setExcerpt("");
    setShowAddForm(false);
    setSaving(false);
    onEntryUpdated?.();
    refresh();
  }, [addManualSource, excerpt, refresh, onEntryUpdated]);

  const handleRemove = useCallback(async (id: string) => {
    await removeSource(id);
    onEntryUpdated?.();
    refresh();
  }, [removeSource, refresh, onEntryUpdated]);

  const totalItems = sources.length + mentions.length;

  return (
    <div className="prov-panel">
      <button className="prov-header" onClick={() => setOpen((v) => !v)}>
        <span className="prov-header-title">
          Provenance &amp; Citations
          <span className="prov-count">{totalItems}</span>
        </span>
        <span className="prov-toggle">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="prov-body">
          {/* ── Scene mentions ───────────────────────────────────── */}
          <div className="prov-section">
            <div className="prov-section-label">
              Scene mentions
              <span className="prov-section-count">{mentions.length}</span>
            </div>
            {loading ? (
              <p className="prov-loading">Loading…</p>
            ) : mentions.length === 0 ? (
              <p className="prov-empty">Not mentioned in any scene yet.</p>
            ) : (
              <ul className="prov-list">
                {mentions.map((m) => (
                  <li key={m.sceneId} className="prov-mention-row">
                    <span className={`prov-kind prov-kind--scene`}>Scene</span>
                    <span className="prov-mention-loc">
                      {m.book?.title ?? "Unknown book"}
                      {m.chapter ? ` · Ch. ${m.chapter.number}${m.chapter.title ? ` "${m.chapter.title}"` : ""}` : ""}
                      {m.scene ? ` · Scene ${m.scene.number}` : ""}
                    </span>
                    {m.scene?.sceneMd && (
                      <span className="prov-excerpt">
                        {m.scene.sceneMd.slice(0, 80)}{m.scene.sceneMd.length > 80 ? "…" : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Explicit source refs ─────────────────────────────── */}
          <div className="prov-section">
            <div className="prov-section-label">
              Source citations
              <span className="prov-section-count">{sources.length}</span>
            </div>

            {sources.length === 0 ? (
              <p className="prov-empty">No citations recorded.</p>
            ) : (
              <ul className="prov-list">
                {sources.map((s) => (
                  <li key={s.id} className="prov-source-row">
                    <span className={`prov-kind ${KIND_CLASS[s.kind]}`}>{KIND_LABEL[s.kind]}</span>
                    <span className="prov-source-id">{s.id.slice(0, 8)}…</span>
                    {s.excerpt && <span className="prov-excerpt">&quot;{s.excerpt}&quot;</span>}
                    <button
                      className="prov-remove-btn"
                      title="Remove citation"
                      onClick={() => void handleRemove(s.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showAddForm ? (
              <div className="prov-add-form cv-form">
                <div className="cv-form-row">
                  <label className="cv-form-label">Note / excerpt (optional)</label>
                  <textarea
                    className="cv-form-textarea"
                    rows={2}
                    placeholder="e.g. 'Confirmed in chapter 3 when Aran mentions the pact'"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                  />
                </div>
                <div className="cv-form-actions">
                  <button
                    className="cv-form-btn cv-form-btn--primary"
                    onClick={() => void handleAdd()}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Add citation"}
                  </button>
                  <button className="cv-form-btn" onClick={() => { setShowAddForm(false); setExcerpt(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="prov-add-btn" onClick={() => setShowAddForm(true)}>
                + Add manual citation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
