"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const lib = useLibraryContext();
  const { chats, selectChat } = lib;

  // Activate this thread and open the chat panel
  useEffect(() => {
    if (lib.activeChatId === params.threadId) return;
    if (chats.some((c) => c.id === params.threadId)) {
      selectChat(params.threadId);
    }
  }, [params.threadId, chats, lib.activeChatId, selectChat]);

  return (
    <div className="library-page thread-page">
      <div className="library-page-header">
        <h2>{lib.chats.find((c) => c.id === params.threadId)?.title ?? "Thread"}</h2>
      </div>
      <p className="library-page-hint">
        This thread is open in the AI panel on the right. If the panel is hidden, click the
        <strong> AI</strong> button in the library nav bar.
      </p>
    </div>
  );
}
