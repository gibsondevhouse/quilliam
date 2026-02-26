"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EditorArea } from "@/components/Editor/EditorArea";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useRAGContext } from "@/lib/context/RAGContext";

export default function ChapterPage() {
  const params = useParams<{ libraryId: string; chapterId: string }>();
  const { chapterId } = params;

  const lib = useLibraryContext();
  const { ragNodes, storeRef } = useRAGContext();
  const [loaded, setLoaded] = useState(false);

  const ragNode = ragNodes[chapterId];
  const doc = lib.docContents[chapterId];

  /* Load content from IDB on first visit, then register via initDoc */
  useEffect(() => {
    if (doc) {
      setLoaded(true);
      return;
    }

    const node = ragNode;
    if (node) {
      // Node is already in ragNodes (in-memory), use its content directly
      lib.initDoc(chapterId, node.title, node.content);
      setLoaded(true);
      return;
    }

    // Not in memory — try IDB
    void (async () => {
      const store = storeRef.current;
      if (!store) { setLoaded(true); return; }
      const stored = await store.getNode(chapterId);
      if (stored) {
        lib.initDoc(chapterId, stored.title, stored.content);
      } else {
        lib.initDoc(chapterId, "Untitled Chapter", "");
      }
      setLoaded(true);
    })();
  }, [chapterId, doc, ragNode, lib, storeRef]);

  /* Open/activate this chapter as a tab */
  useEffect(() => {
    if (!loaded) return;
    const title = lib.docContents[chapterId]?.title ?? ragNode?.title ?? "Untitled";
    lib.openTab({ id: chapterId, kind: "chapter", title });
    lib.setActiveTabId(chapterId);
  }, [loaded, chapterId, lib, ragNode]);

  if (!loaded) {
    return <div className="library-loading">Loading…</div>;
  }

  const currentDoc = lib.docContents[chapterId];
  if (!currentDoc) {
    return <div className="library-loading">Chapter not found.</div>;
  }

  const pendingChangeSets = (lib.changeSets["__active__"] ?? []).filter(
    (cs) => cs.status === "pending"
  );

  // workingContents holds the AI-patched text; fall back to saved content when
  // no AI edits are pending so the editor stays in sync after accept/reject.
  // Only pass liveContent while there are actually pending hunks — once all are
  // settled, hand full control back to the user (avoid stomping user keystrokes).
  const liveContent = pendingChangeSets.length > 0 ? lib.workingContents[chapterId] : undefined;

  return (
    <EditorArea
      key={chapterId}
      initialContent={currentDoc.content}
      content={liveContent}
      documentTitle={currentDoc.title}
      onContentChange={(content) => lib.handleContentChange(chapterId, content)}
      onTitleChange={(title) => lib.handleTitleChange(chapterId, title)}
      pendingChangeSets={pendingChangeSets}
      onAcceptHunk={(id) => lib.acceptChange(id)}
      onRejectHunk={(id) => lib.rejectChange(id)}
    />
  );
}
