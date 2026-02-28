"use client";

import { useParams, useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";

export default function BookBeatsPage() {
  const params = useParams<{ libraryId: string; storyId: string }>();
  const { libraryId, storyId } = params;
  const lib = useLibraryContext();
  const router = useRouter();

  const story = lib.stories.find((s) => s.id === storyId);

  return (
    <div className="library-page">
      <div className="library-page-header">
        <div>
          <button
            className="library-page-action"
            style={{ marginBottom: 4, fontSize: 11 }}
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}`)}
          >
            ← {story?.title ?? "Book"}
          </button>
          <h2>Beats &amp; Outline</h2>
        </div>
      </div>
      <div className="placeholder-page">
        <div className="placeholder-content">
          <div className="placeholder-icon">🎭</div>
          <h2>Beats &amp; Outline</h2>
          <p>
            Act structure, story beats, and scene outlines will live here.
            Helps you plan before you write.
          </p>
        </div>
      </div>
    </div>
  );
}
