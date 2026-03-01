"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Chat } from "@/components/Chat";
import { useWorkspaceContext } from "@/lib/context/WorkspaceContext";
import { useLandingContext } from "@/lib/landing/useLandingContext";
import { useLoRAs } from "@/lib/landing/useLoRAs";
import { useGeneralThreads } from "@/lib/landing/useGeneralThreads";
import { useSidebarDataRegister } from "@/lib/context/SidebarDataContext";

export default function Home() {
  const { tree, store } = useWorkspaceContext();

  const libraries = useMemo(
    () => tree.filter((n) => n.type === "library"),
    [tree],
  );

  // Build libraryId → name map for the context hook
  const libraryNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const lib of libraries) m[lib.id] = lib.title;
    return m;
  }, [libraries]);

  const { contextType, activeLibraryId, setContext, activeContextLabel } =
    useLandingContext(libraryNameMap);

  const { loras, activeLoRAId, activeLoRA, setActiveLoRA } = useLoRAs();

  const {
    threads,
    activeChatId,
    buckets,
    createThread,
    selectThread,
    deleteThread,
    renameThread,
    updateThreadMessages,
  } = useGeneralThreads({ store });

  // ── Chat key + autoSend (for new chat / starter chips) ──
  const [chatKey, setChatKey] = useState(0);
  const [autoSendPrompt, setAutoSendPrompt] = useState<string | undefined>();

  // ── Loaded messages for the active thread ──
  const [initialMessages, setInitialMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Load persisted messages when active thread changes
  useEffect(() => {
    if (!activeChatId || !store) return;
    void store.listChatMessages(activeChatId).then((msgs) => {
      setInitialMessages(
        msgs.map((m) => ({ role: m.role, content: m.content })),
      );
    });
  }, [activeChatId, store]);

  // ── New chat ──
  const handleNewChat = useCallback(async () => {
    await createThread(contextType, activeLibraryId ?? undefined, activeLoRAId);
    setAutoSendPrompt(undefined);
    setChatKey((k) => k + 1);
  }, [createThread, contextType, activeLibraryId, activeLoRAId]);

  // ── Starter chip auto-send ──
  const handleStarterSend = useCallback(
    async (prompt: string) => {
      await createThread(contextType, activeLibraryId ?? undefined, activeLoRAId);
      setAutoSendPrompt(prompt);
      setChatKey((k) => k + 1);
    },
    [createThread, contextType, activeLibraryId, activeLoRAId],
  );

  // ── Select thread ──
  const handleSelectThread = useCallback(
    (id: string) => {
      selectThread(id);
      setAutoSendPrompt(undefined);
      setChatKey((k) => k + 1);
    },
    [selectThread],
  );

  // ── Context switching ──
  const handleSetContext = useCallback(
    (type: "general" | "library", libraryId?: string) => {
      setContext(type, libraryId);
    },
    [setContext],
  );
  void handleSetContext; // retained for future: context switcher in sidebar header

  // ── Sidebar new-chat callback (stable ref for sidebar data registration) ──
  const handleSidebarNewChat = useCallback(() => {
    void handleNewChat();
  }, [handleNewChat]);

  // ── Register sidebar data so the global OffCanvasSidebar shows threads/loras ──
  useSidebarDataRegister({
    activeLibraryId: activeLibraryId ?? null,
    threads,
    threadBuckets: buckets,
    activeChatId,
    loras,
    activeLoRAId,
    onNewChat: handleSidebarNewChat,
    onSelectThread: handleSelectThread,
    onDeleteThread: deleteThread,
    onRenameThread: renameThread,
    onSelectLoRA: setActiveLoRA,
  });

  // ── Sidebar context/LoRA pill click handlers ──
  const handleContextClick = useCallback(() => {
    // Future: open context popover or focus sidebar
  }, []);
  const handleLoRAClick = useCallback(() => {
    // Future: open LoRA popover or focus sidebar
  }, []);

  return (
    <main className="home-main">
      <Chat
        key={chatKey}
        executionMode="local"
        libraryId={activeLibraryId ?? undefined}
        variant="landing"
        chatId={activeChatId ?? undefined}
        initialMessages={initialMessages}
        autoSendPrompt={autoSendPrompt}
        activeContextLabel={activeContextLabel}
        activeLoRALabel={activeLoRA?.name}
        onContextClick={handleContextClick}
        onLoRAClick={handleLoRAClick}
        onStarterSend={(p) => { void handleStarterSend(p); }}
        onMessagesChange={(msgs) => {
          if (activeChatId) updateThreadMessages(activeChatId, msgs);
        }}
      />
    </main>
  );
}
