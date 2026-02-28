"use client";

import { useState, useCallback } from "react";
import { GenericVersionCard } from "./GenericVersionCard";
import {
  useEntityVersionData,
  BLANK_DRAFT,
  type EntityVersionKind,
  type VersionDraft,
} from "./useEntityVersionData";

const ENTITY_LABELS: Record<EntityVersionKind, string> = {
  organization: "Organisation",
  religion: "Religion",
};

interface EntityVersionPanelProps {
  entityKind: EntityVersionKind;
  entryId: string;
}

export function EntityVersionPanel({ entityKind, entryId }: EntityVersionPanelProps) {
  const { versions, events, loading, addVersion, eventName } = useEntityVersionData(
    entityKind,
    entryId,
  );
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

  const label = ENTITY_LABELS[entityKind];

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
              placeholder={`What changed for this ${label.toLowerCase()}?`}
              value={draft.changeTrigger}
              onChange={(e) => setField("changeTrigger", e.target.value)}
            />
          </div>
          <div className="cv-form-row cv-form-row--col">
            <label className="cv-form-label">
              Traits{" "}
              <span className="cv-form-hint">{`JSON object — e.g. {"doctrine":"reformed"}`}</span>
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
          No snapshots yet. Add one to track how this {label.toLowerCase()} evolves across eras.
        </p>
      ) : (
        <div className="cv-card-list">
          {versions.map((v) => {
            const traits =
              "traits" in v && typeof v.traits === "object" && v.traits !== null
                ? (v.traits as Record<string, unknown>)
                : {};
            return (
              <GenericVersionCard
                key={v.id}
                id={v.id}
                validFromEventId={v.validFromEventId}
                validToEventId={v.validToEventId}
                changeTrigger={v.changeTrigger}
                traits={traits}
                eventName={eventName}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
