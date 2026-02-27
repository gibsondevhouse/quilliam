import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ChatMessageEntry, ChatSession } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";

function generateId() {
  return crypto.randomUUID();
}

interface UseChatStateParams {
  libraryId: string;
  storeRef: RefObject<RAGStore | null>;
  onNavigateToChat: (chatId: string) => void;
}

export function useChatState({
  libraryId,
  storeRef,
  onNavigateToChat,
}: UseChatStateParams) {
  const initialChatId = useMemo(() => generateId(), []);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessageEntry[]>>({});
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(340);
  const chatPanelWidthRef = useRef(340);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(340);

  const addChat = useCallback((): string => {
    const id = generateId();
    const now = Date.now();
    const session: ChatSession = { id, libraryId, title: "New Thread", createdAt: now, preview: "" };
    setChats((prev) => [session, ...prev]);
    setChatMessages((prev) => ({ ...prev, [id]: [] }));
    setActiveChatId(id);
    setBottomPanelOpen(true);
    void storeRef.current?.putChatSession({
      id,
      libraryId,
      title: "New Thread",
      preview: "",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }, [libraryId, storeRef]);

  const selectChat = useCallback(
    (id: string) => {
      setActiveChatId(id);
      setBottomPanelOpen(true);
      onNavigateToChat(id);
    },
    [onNavigateToChat],
  );

  const deleteChat = useCallback(
    (id: string) => {
      void storeRef.current?.deleteChatSession(id);
      setChats((prev) => {
        const remaining = prev.filter((chat) => chat.id !== id);
        if (activeChatId === id) {
          setActiveChatId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      setChatMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [activeChatId, storeRef],
  );

  const updateChatMessages = useCallback(
    (chatId: string, messages: ChatMessageEntry[]) => {
      setChatMessages((prev) => ({ ...prev, [chatId]: messages }));
      const firstUser = messages.find((message) => message.role === "user");
      const title = firstUser
        ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "")
        : "New Thread";
      const preview = firstUser ? firstUser.content.slice(0, 60) : "";
      if (firstUser) {
        setChats((prev) =>
          prev.map((chat) => (chat.id === chatId ? { ...chat, title, preview } : chat)),
        );
      }
      void storeRef.current?.putChatMessages(chatId, messages);
      const now = Date.now();
      void storeRef.current?.listChatSessionsByLibrary(libraryId).then((sessions) => {
        const existing = sessions.find((session) => session.id === chatId);
        if (existing) {
          void storeRef.current?.putChatSession({
            ...existing,
            libraryId,
            title,
            preview,
            updatedAt: now,
          });
        }
      });
    },
    [libraryId, storeRef],
  );

  return {
    initialChatId,
    chats,
    setChats,
    activeChatId,
    setActiveChatId,
    chatMessages,
    setChatMessages,
    addChat,
    selectChat,
    deleteChat,
    updateChatMessages,
    bottomPanelOpen,
    setBottomPanelOpen,
    chatPanelWidth,
    setChatPanelWidth,
    chatPanelWidthRef,
    isDraggingRef,
    dragStartXRef,
    dragStartWidthRef,
  };
}
