"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useWorkspaceContext } from "@/lib/context/WorkspaceContext";

export default function BookDashboardPage() {
  const params = useParams<{ libraryId: string; storyId: string }>();
  const { libraryId, storyId } = params;
  const lib = useLibraryContext();
  const { ragNodes, addNode } = useWorkspaceContext();
  const router = useRouter();

  const story = lib.stories.find((s) => s.id === storyId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(story?.title ?? "");
  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const [synopsisDraft, setSynopsisDraft] = useState(story?.synopsis ?? "");

  // Chapters are RAG nodes whose parentId === storyId
  const storyChapters = Object.values(ragNodes).filter(
    (n) => n.parentId === storyId && (n.type === "chapter" || n.type === "scene")
  );

  const handleNewChapter = useCallback(() => {
    const chapterId = addNode(storyId, "chapter");
    router.push(`/library/${libraryId}/books/${storyId}/chapters/${chapterId}`);
  }, [addNode, storyId, libraryId, router]);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    if (story && titleDraft.trim()) {
      lib.updateStory({ ...story, title: titleDraft.trim() });
    }
  }, [story, titleDraft, lib]);

  const commitSynopsis = useCallback(() => {
    setEditingSynopsis(false);
    if (story) {
      lib.updateStory({ ...story, synopsis: synopsisDraft });
    }
  }, [story, synopsisDraft, lib]);

  if (!story) {
    return (
      <div className="library-page-empty">
        <p>Story not found.</p>
        <button className="library-page-action" onClick={() => router.push(`/library/${libraryId}/books`)}>
          ← Back to Books
        </button>
      </div>
    );
  }

  const STATUS_CYCLE: Array<"drafting" | "editing" | "archived"> = ["drafting", "editing", "archived"];
  const STATUS_COLORS: Record<string, string> = {
    drafting: "#3b82f6",
    editing: "#f59e0b",
    archived: "#6b7280",
  };

  return (
    <div className="library-dashboard">
      {/* Book header */}
      <div className="library-dashboard-header">
        <div className="library-dashboard-title-row">
          {editingTitle ? (
            <input
              className="library-dashboard-title-input"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            />
          ) : (
            <h1
              className="library-dashboard-title"
              onClick={() => { setTitleDraft(story.title); setEditingTitle(true); }}
              title="Click to edit"
            >
              {story.title}
            </h1>
          )}
          <span
            className="library-dashboard-status"
            style={{ "--status-color": STATUS_COLORS[story.status] } as React.CSSProperties}
            onClick={() => {
              const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(story.status) + 1) % STATUS_CYCLE.length];
              lib.updateStory({ ...story, status: next });
            }}
            title="Click to cycle status"
          >
            {story.status}
          </span>
        </div>

        {editingSynopsis ? (
          <textarea
            className="library-dashboard-title-input"
            style={{ fontSize: 14, fontWeight: 400, minHeight: 64 }}
            value={synopsisDraft}
            autoFocus
            onChange={(e) => setSynopsisDraft(e.target.value)}
            onBlur={commitSynopsis}
          />
        ) : (
          <p
            className={`library-dashboard-logline${story.synopsis ? "" : " placeholder"}`}
            onClick={() => { setSynopsisDraft(story.synopsis); setEditingSynopsis(true); }}
          >
            {story.synopsis || "Add a synopsis…"}
          </p>
        )}

        <div className="library-dashboard-quick-actions">
          <button className="library-dashboard-action" onClick={handleNewChapter}>
            + New Chapter
          </button>
          <button
            className="library-dashboard-action"
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}/beats`)}
          >
            Beats &amp; Outline
          </button>
          <button
            className="library-dashboard-action"
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}/timeline`)}
          >
            Book Timeline
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="library-dashboard-cards">
        {/* Chapters */}
        <div className="library-dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div className="library-dashboard-card-header">
            <h3>§ Chapters <span className="library-dashboard-count">{storyChapters.length}</span></h3>
            <button onClick={() => router.push(`/library/${libraryId}/books/${storyId}/chapters`)}>
              View all →
            </button>
          </div>
          {storyChapters.length === 0 ? (
            <p className="library-dashboard-empty">
              No chapters yet.{" "}
              <button onClick={handleNewChapter}>Write the first chapter</button>
            </p>
          ) : (
            <ul className="library-dashboard-list">
              {storyChapters.slice(0, 8).map((ch) => (
                <li key={ch.id}>
                  <button
                    onClick={() => router.push(`/library/${libraryId}/books/${storyId}/chapters/${ch.id}`)}
                  >
                    <span className="item-icon">§</span>
                    <span className="item-title">{ch.title || "Untitled Chapter"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Beats placeholder */}
        <div className="library-dashboard-card placeholder-card">
          <div className="library-dashboard-card-header">
            <h3>Beats &amp; Outline</h3>
            <button onClick={() => router.push(`/library/${libraryId}/books/${storyId}/beats`)}>
              View →
            </button>
          </div>
          <p className="library-dashboard-empty">Story beats, act structure &amp; outline — coming soon.</p>
        </div>
      </div>
    </div>
  );
}
