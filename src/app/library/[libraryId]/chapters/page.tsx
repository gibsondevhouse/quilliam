"use client";

import { useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useRAGContext } from "@/lib/context/RAGContext";
import type { SidebarNode } from "@/lib/navigation";
import type { NodeType } from "@/lib/rag/hierarchy";

export default function ChaptersPage() {
  const { libraryId } = useLibraryContext();
  const { tree, addNode } = useRAGContext();
  const router = useRouter();

  const libraryNode = tree.find((n) => n.id === libraryId);

  const gatherChapters = (nodes: SidebarNode[]): { id: string; title: string; type: NodeType }[] => {
    if (!nodes) return [];
    const results: { id: string; title: string; type: NodeType }[] = [];
    for (const n of nodes) {
      if (n.type === "chapter" || n.type === "scene") results.push(n);
      if (n.type === "book" || n.type === "part") results.push(...gatherChapters(n.children));
    }
    return results;
  };

  const chapters = gatherChapters(libraryNode?.children ?? []);

  const handleNewChapter = () => {
    const id = addNode(libraryId, "chapter");
    router.push(`/library/${libraryId}/chapters/${id}`);
  };

  return (
    <div className="library-page chapters-page">
      <div className="library-page-header">
        <h2>Chapters</h2>
        <button className="library-page-action" onClick={handleNewChapter}>+ New Chapter</button>
      </div>
      {chapters.length === 0 ? (
        <div className="library-page-empty">
          <p>No chapters yet.</p>
          <button className="library-page-action primary" onClick={handleNewChapter}>Create your first chapter</button>
        </div>
      ) : (
        <ul className="library-item-list">
          {chapters.map((ch) => (
            <li key={ch.id} className="library-item-row">
              <button
                className="library-item-btn"
                onClick={() => router.push(`/library/${libraryId}/chapters/${ch.id}`)}
              >
                <span className="library-item-icon">§</span>
                <span className="library-item-title">{ch.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
