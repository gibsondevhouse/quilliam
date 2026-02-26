"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EditorArea } from "@/components/Editor/EditorArea";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useRAGContext } from "@/lib/context/RAGContext";

export default function StoryChapterPage() {
  const params = useParams<{ libraryId: string; storyId: string; chapterId: string }>();
  const { chapterId } = params;

  const lib = useLibraryContext();
  const { ragNodes, storeRef } = useRAGContext();
  const [loaded, setLoaded] = useState(false);

  const ragNode = ragNodes[chapterId];
  const doc = lib.docContents[chapterId];

  useEffect(() => {
    if (doc) { setLoaded(true); return; }

    if (ragNode) {
      lib.initDoc(chapterId, ragNode.title, ragNode.content);
      setLoaded(true);
      return;
    }

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

  useEffect(() => {
    if (!loaded) return;
    const title = lib.docContents[chapterId]?.title ?? ragNode?.title ?? "Untitled";
    lib.openTab({ id: chapterId, kind: "chapter", title });
    lib.setActiveTabId(chapterId);
  }, [loaded, chapterId, lib, ragNode]);

  if (!loaded) return <div className="library-loading">Loading…</div>;

  const currentDoc = lib.docContents[chapterId];
  if (!currentDoc) return <div className="library-loading">Chapter not found.</div>;

  return (
    <EditorArea
      key={chapterId}
      initialContent={currentDoc.content}
      documentTitle={currentDoc.title}
      onContentChange={(content) => lib.handleContentChange(chapterId, content)}
      onTitleChange={(title) => lib.handleTitleChange(chapterId, title)}
    />
  );
}
