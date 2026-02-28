"use client";

import { useState, useCallback } from "react";
import { VersionCard } from "./VersionCard";
import { useVersionData, type VersionDraft } from "./useVersionData";

const BLANK_DRAFT: VersionDraft = {
  validFromEventId: "",
  validToEventId: "",
  changeTrigger: "",
  traitsRaw: "",
};

interface CultureVersionPanelProps {
  cultureEntryId: string;
}

export function CultureVersionPanel({ cultureEntryId }: CultureVersionPanelProps) {
  const { versions, events, loading, addVersion, eventName } = useVersionData(cultureEntryId);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<VersionDraft>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState(false);

  const setField = useCallback(
    <K extends keyof VersionDraft>(key: K, value: VersionDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      if (key === "traitsRaw") setJsonError(false);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await addVersion(draft);
    setSaving(false);
    if (!ok) {
      setJsonError(true);
      return;
    }
    setDraft(BLANK_DRAFT);
    setShowForm(false);
    setJsonError(false);
  }, [addVersion, draft]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setDraft(BLANK_DRAFT);
    setJsonError(false);
  }, []);

  return (
    <section className="cv-panel">
      <div className="cv-panel-header">
        <h3 className="cv-panel-title">Era Snapshots</h3>
        <span className="cv-panel-count">{versions.length}</span>
        {!showForm && (
          <button className="cv-panel-add-btn" onClick={() => setShowForm(true)}>
            + Add Snapshot
          </button>
        )}
      </div>

      {showForm && (
        <div className="cv-form">
          <div className="cv-form-row">
            <label className="cv-form-label">Valid from *</label>
            <select
              className="cv-form-select"
              value={draft.validFromEventId}
              onChange={(e) => setField("validFromEventId", e.target.value)}
            >
              <option value="">— select event —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">Valid until</label>
            <select
              className="cv-form-select"
              value={draft.validToEventId}
              onChange={(e) => setField("validToEventId", e.target.value)}
            >
              <option value="">open-ended (still active)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">Change trigger</label>
            <input
              className="cv-form-input"
              placeholder="What caused this cultural shift?"
              value={draft.changeTrigger}
              onChange={(e) => setField("changeTrigger", e.target.value)}
            />
          </div>
          <div className="cv-form-row cv-form-row--col">
            <label className="cv-form-label">
              Traits <span className="cv-form-hint">{`JSON object — e.g. {"language":"iron_age"}`}</span>
            </label>
            <textarea
              className={`cv-form-textarea ${jsonError ? "cv-form-textarea--error" : ""}`}
              rows={4}
              placeholder='{"trait_key": "trait_value"}'
              value={draft.traitsRaw}
              onChange={(e) => setField("traitsRaw", e.target.value)}
            />
            {jsonError && (
              <span className="cv-form-error">Invalid JSON — check syntax and try again.</span>
            )}
          </div>
          <div className="cv-form-actions">
            <button
              className="cv-form-btn cv-form-btn--primary"
              onClick={handleSave}
              disabled={saving || !draft.validFromEventId}
            >
              {saving ? "Saving…" : "Save Snapshot"}
            </button>
            <button className="cv-form-btn" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="cv-panel-empty">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="cv-panel-empty">
          No snapshots yet. Add one to track how this culture evolves across eras.
        </p>
      ) : (
        <div className="cv-card-list">
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} eventName={eventName} />
          ))}
        </div>
      )}
    </section>
  );
}
