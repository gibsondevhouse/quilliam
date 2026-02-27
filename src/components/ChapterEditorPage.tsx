"use client";

import { useEffect } from "react";
import { EditorArea } from "@/components/Editor/EditorArea";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useRAGContext } from "@/lib/context/RAGContext";

interface ChapterEditorPageProps {
  chapterId: string;
}

export function ChapterEditorPage({ chapterId }: ChapterEditorPageProps) {
  const {
    docContents,
    initDoc,
    openTab,
    setActiveTabId,
    handleContentChange,
    handleTitleChange,
    changeSets,
    workingContents,
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
  } = useLibraryContext();
  const { ragNodes, storeRef } = useRAGContext();

  const ragNode = ragNodes[chapterId];
  const currentDoc = docContents[chapterId];

  useEffect(() => {
    if (currentDoc) return;

    if (ragNode) {
      initDoc(chapterId, ragNode.title, ragNode.content);
      return;
    }

    let cancelled = false;
    void (async () => {
      const store = storeRef.current;
      if (!store) {
        if (!cancelled) initDoc(chapterId, "Untitled Chapter", "");
        return;
      }
      const stored = await store.getNode(chapterId);
      if (cancelled) return;
      if (stored) {
        initDoc(chapterId, stored.title, stored.content);
      } else {
        initDoc(chapterId, "Untitled Chapter", "");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chapterId, currentDoc, ragNode, initDoc, storeRef]);

  useEffect(() => {
    const title = docContents[chapterId]?.title ?? ragNode?.title;
    if (!title) return;
    openTab({ id: chapterId, kind: "chapter", title });
    setActiveTabId(chapterId);
  }, [chapterId, docContents, openTab, ragNode?.title, setActiveTabId]);

  if (!currentDoc) {
    return <div className="library-loading">Loading…</div>;
  }

  const pendingChangeSets = (changeSets["__active__"] ?? []).filter(
    (cs) => cs.status === "pending",
  );
  const liveContent = pendingChangeSets.length > 0 ? workingContents[chapterId] : undefined;

  return (
    <EditorArea
      key={chapterId}
      initialContent={currentDoc.content}
      content={liveContent}
      documentTitle={currentDoc.title}
      onContentChange={(content) => handleContentChange(chapterId, content)}
      onTitleChange={(title) => handleTitleChange(chapterId, title)}
      pendingChangeSets={pendingChangeSets}
      onAcceptHunk={(id) => acceptChange(id)}
      onRejectHunk={(id) => rejectChange(id)}
      onAcceptAll={() => acceptAllChanges("__active__")}
      onRejectAll={() => rejectAllChanges("__active__")}
    />
  );
}
