"use client";

/**
 * General thread lifecycle and bucketing hook.
 * Wraps the `generalThreads` IDB store with React state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PersistedGeneralThread, GeneralThreadContextType } from "@/lib/rag/store";
import type { RAGStore } from "@/lib/rag/store";

export interface ThreadBuckets {
  pinned: PersistedGeneralThread[];
  today: PersistedGeneralThread[];
  yesterday: PersistedGeneralThread[];
  last7days: PersistedGeneralThread[];
  older: PersistedGeneralThread[];
}

interface UseGeneralThreadsParams {
  store: RAGStore | null;
  onFocusComposer?: () => void;
}

export interface UseGeneralThreadsReturn {
  threads: PersistedGeneralThread[];
  activeChatId: string | null;
  activeThread: PersistedGeneralThread | null;
  buckets: ThreadBuckets;
  createThread: (
    contextType: GeneralThreadContextType,
    libraryId?: string,
    loraId?: string,
  ) => Promise<PersistedGeneralThread>;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  setActiveChatId: (id: string | null) => void;
  updateThreadMessages: (
    threadId: string,
    messages: { role: "user" | "assistant"; content: string }[],
  ) => void;
}

function bucketThreads(
  threads: PersistedGeneralThread[],
): ThreadBuckets {
  const now = Date.now();
  const dayMs = 86_400_000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();
  const yesterdayStart = todayStart - dayMs;
  const sevenDaysStart = todayStart - 7 * dayMs;

  const pinned: PersistedGeneralThread[] = [];
  const today: PersistedGeneralThread[] = [];
  const yesterday: PersistedGeneralThread[] = [];
  const last7days: PersistedGeneralThread[] = [];
  const older: PersistedGeneralThread[] = [];

  for (const t of threads) {
    if (t.pinned) { pinned.push(t); continue; }
    if (t.createdAt >= todayStart) {
      today.push(t);
    } else if (t.createdAt >= yesterdayStart) {
      yesterday.push(t);
    } else if (t.createdAt >= sevenDaysStart) {
      last7days.push(t);
    } else {
      older.push(t);
    }
  }
  void now; // suppress unused warning
  return { pinned, today, yesterday, last7days, older };
}

export function useGeneralThreads({
  store,
  onFocusComposer,
}: UseGeneralThreadsParams): UseGeneralThreadsReturn {
  const [threads, setThreads] = useState<PersistedGeneralThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const focusRef = useRef(onFocusComposer);
  useEffect(() => { focusRef.current = onFocusComposer; });

  // Load persisted threads on store ready
  useEffect(() => {
    if (!store) return;
    void store.listGeneralThreads().then(setThreads);
  }, [store]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeChatId) ?? null,
    [threads, activeChatId],
  );

  const buckets = useMemo(() => bucketThreads(threads), [threads]);

  const createThread = useCallback(
    async (
      contextType: GeneralThreadContextType,
      libraryId?: string,
      loraId?: string,
    ): Promise<PersistedGeneralThread> => {
      const now = Date.now();
      const thread: PersistedGeneralThread = {
        id: crypto.randomUUID(),
        title: "New Chat",
        preview: "",
        createdAt: now,
        updatedAt: now,
        pinned: false,
        contextType,
        libraryId: contextType === "library" ? libraryId : undefined,
        loraId,
      };
      await store?.putGeneralThread(thread);
      setThreads((prev) => [thread, ...prev]);
      setActiveChatId(thread.id);
      focusRef.current?.();
      return thread;
    },
    [store],
  );

  const selectThread = useCallback((id: string) => {
    setActiveChatId(id);
    focusRef.current?.();
  }, []);

  const deleteThread = useCallback(
    (id: string) => {
      void store?.deleteGeneralThread(id);
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        return next;
      });
      setActiveChatId((prev) => (prev === id ? null : prev));
    },
    [store],
  );

  const renameThread = useCallback(
    (id: string, title: string) => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const updated = { ...t, title, updatedAt: Date.now() };
          void store?.putGeneralThread(updated);
          return updated;
        }),
      );
    },
    [store],
  );

  const togglePin = useCallback(
    (id: string) => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const updated = { ...t, pinned: !t.pinned, updatedAt: Date.now() };
          void store?.putGeneralThread(updated);
          return updated;
        }),
      );
    },
    [store],
  );

  const updateThreadMessages = useCallback(
    (
      threadId: string,
      messages: { role: "user" | "assistant"; content: string }[],
    ) => {
      void store?.putChatMessages(threadId, messages);

      // Auto-title from first user message
      const firstUser = messages.find((m) => m.role === "user");
      if (!firstUser) return;
      const title =
        firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "");
      const preview = firstUser.content.slice(0, 80);

      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const updated = { ...t, title, preview, updatedAt: Date.now() };
          void store?.putGeneralThread(updated);
          return updated;
        }),
      );
    },
    [store],
  );

  return {
    threads,
    activeChatId,
    activeThread,
    buckets,
    createThread,
    selectThread,
    deleteThread,
    renameThread,
    togglePin,
    setActiveChatId,
    updateThreadMessages,
  };
}
