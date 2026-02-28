"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/context/useStore";
import type { Media, MediaType } from "@/lib/types";

const MEDIA_TYPES: MediaType[] = ["image", "audio", "video", "document", "other"];

const MEDIA_ICONS: Record<MediaType, string> = {
  image: "🖼",
  audio: "🎵",
  video: "🎞",
  document: "📄",
  other: "📎",
};

interface MediaDraft {
  storageUri: string;
  mediaType: MediaType;
  name: string;
}

const BLANK: MediaDraft = { storageUri: "", mediaType: "image", name: "" };

function MediaCard({ item, onDelete }: { item: Media; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const name = (item.metadata?.name as string | undefined) ?? "";
  const isImage = item.mediaType === "image";

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(item.storageUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [item.storageUri]);

  return (
    <div className="media-card">
      <div className="media-card-preview">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.storageUri}
            alt={name || "media"}
            className="media-card-img"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="media-card-icon">{MEDIA_ICONS[item.mediaType]}</div>
        )}
      </div>
      <div className="media-card-meta">
        <span className="media-card-name" title={name || item.storageUri}>
          {name || item.storageUri.split("/").pop() || "Untitled"}
        </span>
        <span className="media-card-type">{item.mediaType}</span>
      </div>
      <div className="media-card-actions">
        <button className="media-card-btn" onClick={handleCopy} title="Copy URL">
          {copied ? "Copied!" : "Copy URL"}
        </button>
        <a
          className="media-card-btn"
          href={item.storageUri}
          target="_blank"
          rel="noopener noreferrer"
          title="Open"
        >
          Open ↗
        </a>
        <button
          className="media-card-btn media-card-btn--danger"
          onClick={() => onDelete(item.id)}
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function MediaLibraryPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params?.libraryId ?? "";
  const store = useStore();

  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<MediaType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<MediaDraft>(BLANK);
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState(false);

  const reload = useCallback(async () => {
    const media = await store.listMediaByUniverse(libraryId);
    setItems(media.sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }, [store, libraryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const handleAdd = useCallback(async () => {
    const uri = draft.storageUri.trim();
    if (!uri) { setUrlError(true); return; }
    setSaving(true);
    const now = Date.now();
    await store.putMedia({
      id: crypto.randomUUID(),
      universeId: libraryId,
      mediaType: draft.mediaType,
      storageUri: uri,
      metadata: draft.name.trim() ? { name: draft.name.trim() } : {},
      createdAt: now,
      updatedAt: now,
    });
    await reload();
    setDraft(BLANK);
    setShowForm(false);
    setSaving(false);
    setUrlError(false);
  }, [store, libraryId, draft, reload]);

  const handleDelete = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((m) => m.id !== id));
    },
    [],
  );

  const displayed = typeFilter === "all" ? items : items.filter((m) => m.mediaType === typeFilter);

  return (
    <div className="library-page">
      <div className="library-page-header">
        <h2>Media Library</h2>
        <div className="library-page-header-actions">
          <select
            className="canonical-doc-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MediaType | "all")}
          >
            <option value="all">All types</option>
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button className="library-page-action" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Media"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="media-add-form">
          <div className="cv-form-row">
            <label className="cv-form-label">URL *</label>
            <input
              className={`cv-form-input${urlError ? " cv-form-textarea--error" : ""}`}
              placeholder="https://…"
              value={draft.storageUri}
              onChange={(e) => { setDraft((d) => ({ ...d, storageUri: e.target.value })); setUrlError(false); }}
            />
            {urlError && <span className="cv-form-error">URL is required.</span>}
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">Type</label>
            <select
              className="cv-form-select"
              value={draft.mediaType}
              onChange={(e) => setDraft((d) => ({ ...d, mediaType: e.target.value as MediaType }))}
            >
              {MEDIA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="cv-form-row">
            <label className="cv-form-label">Name</label>
            <input
              className="cv-form-input"
              placeholder="Optional display name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="cv-form-actions">
            <button
              className="cv-form-btn cv-form-btn--primary"
              onClick={handleAdd}
              disabled={saving}
            >
              {saving ? "Saving…" : "Add"}
            </button>
            <button
              className="cv-form-btn"
              onClick={() => { setShowForm(false); setDraft(BLANK); setUrlError(false); }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="library-page-empty"><p>Loading…</p></div>
      ) : displayed.length === 0 ? (
        <div className="library-page-empty">
          {items.length === 0 ? (
            <>
              <p>No media yet.</p>
              <button className="library-page-action primary" onClick={() => setShowForm(true)}>
                Add your first media item
              </button>
            </>
          ) : (
            <p>No {typeFilter} items.</p>
          )}
        </div>
      ) : (
        <div className="media-grid">
          {displayed.map((item) => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
