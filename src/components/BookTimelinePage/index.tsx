"use client";

import { useParams, useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useBookTimelineData, type EventWithScenes, type SceneSummary } from "./useBookTimelineData";

function SceneChip({ s, libraryId, storyId }: { s: SceneSummary; libraryId: string; storyId: string }) {
  const router = useRouter();
  return (
    <button
      className="bt-scene-chip"
      title={`${s.chapterTitle} — ${s.nodeTitle}`}
      onClick={() => router.push(`/library/${libraryId}/books/${storyId}/chapters/${s.nodeId}`)}
    >
      <span className="bt-scene-chip-title">{s.nodeTitle || "Scene"}</span>
      <span className="bt-scene-chip-meta">
        {s.chapterTitle}
        {s.povCharacterName && <> · 👤 {s.povCharacterName}</>}
        {s.locationName && <> · 📍 {s.locationName}</>}
      </span>
    </button>
  );
}

function EventRow({
  group,
  libraryId,
  storyId,
  index,
}: {
  group: EventWithScenes;
  libraryId: string;
  storyId: string;
  index: number;
}) {
  const { event, scenes } = group;
  return (
    <div className="bt-event-row">
      <div className="bt-event-spine" aria-hidden="true">
        <span className="bt-event-dot">{index + 1}</span>
        <span className="bt-event-line" />
      </div>
      <div className="bt-event-body">
        <div className="bt-event-header">
          <h3 className="bt-event-name">{event.name}</h3>
          {event.eventType && (
            <span className="bt-event-type">{event.eventType}</span>
          )}
          {event.eraId && (
            <span className="bt-event-era">({event.eraId.slice(0, 6)}…)</span>
          )}
        </div>
        {event.descriptionMd && (
          <p className="bt-event-desc">{event.descriptionMd.slice(0, 120)}{event.descriptionMd.length > 120 ? "…" : ""}</p>
        )}
        <div className="bt-scene-chips">
          {scenes.map((s) => (
            <SceneChip key={s.nodeId} s={s} libraryId={libraryId} storyId={storyId} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface BookTimelinePageProps {
  storyId: string;
}

export function BookTimelinePage({ storyId }: BookTimelinePageProps) {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const lib = useLibraryContext();
  const router = useRouter();
  const story = lib.stories.find((s) => s.id === storyId);
  const { eventGroups, unlinked, loading } = useBookTimelineData(storyId);

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-page-header">
          <h2>Book Timeline</h2>
        </div>
        <p className="library-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className="library-page bt-page">
      <div className="library-page-header">
        <div className="bt-breadcrumb">
          <button
            className="bt-back-btn"
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}`)}
          >
            ← {story?.title ?? "Book"}
          </button>
          <span className="bt-breadcrumb-sep">/</span>
          <span className="bt-breadcrumb-current">Timeline</span>
        </div>
        <div className="bt-summary">
          <span className="bt-summary-stat">{eventGroups.length} events</span>
          <span className="bt-summary-dot">·</span>
          <span className="bt-summary-stat">
            {eventGroups.reduce((n, g) => n + g.scenes.length, 0)} linked scenes
          </span>
          {unlinked.length > 0 && (
            <>
              <span className="bt-summary-dot">·</span>
              <span className="bt-summary-unlinked">{unlinked.length} unlinked</span>
            </>
          )}
        </div>
      </div>

      {eventGroups.length === 0 && unlinked.length === 0 ? (
        <div className="library-page-empty">
          <p>No scenes linked to timeline events yet.</p>
          <p className="bt-hint">
            Open a scene in the chapter editor and use the <strong>Scene Metadata</strong> panel
            to align it to a timeline event.
          </p>
        </div>
      ) : (
        <div className="bt-body">
          {eventGroups.length > 0 && (
            <section className="bt-event-list">
              {eventGroups.map((group, i) => (
                <EventRow
                  key={group.event.id}
                  group={group}
                  libraryId={libraryId}
                  storyId={storyId}
                  index={i}
                />
              ))}
            </section>
          )}

          {unlinked.length > 0 && (
            <section className="bt-unlinked-section">
              <h3 className="bt-unlinked-heading">
                Unlinked Scenes
                <span className="bt-unlinked-count">{unlinked.length}</span>
              </h3>
              <p className="bt-unlinked-hint">
                These scenes have no timeline event assigned.
              </p>
              <div className="bt-scene-chips">
                {unlinked.map((s) => (
                  <SceneChip key={s.nodeId} s={s} libraryId={libraryId} storyId={storyId} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
