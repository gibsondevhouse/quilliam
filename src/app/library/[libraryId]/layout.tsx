"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LibraryContext, type LibraryContextValue } from "@/lib/context/LibraryContext";
import { useRAGContext } from "@/lib/context/RAGContext";
import { useSystemContext } from "@/lib/context/SystemContext";
import { TabBar, type EditorTab } from "@/components/Editor/TabBar";
import { Chat } from "@/components/Chat";
import { StatusBar } from "@/components/Editor/StatusBar";
import type { CharacterEntry, LocationEntry, WorldEntry, ChatSession, ChatMessageEntry, Story } from "@/lib/types";
import type { RAGNode } from "@/lib/rag/hierarchy";
import { createRAGNode } from "@/lib/rag/hierarchy";
import type { RagWorkerRequest, RagWorkerResponse } from "@/lib/rag/messages";
import { embedNode } from "@/lib/rag/embedder";
import { buildRAGContext } from "@/lib/rag/retrieval";
import { chunkScene, needsChunking, staleFragmentIds } from "@/lib/rag/chunker";

function generateId() { return crypto.randomUUID(); }

/* ----------------------------------------------------------------
   Library sub-nav link
   ---------------------------------------------------------------- */
const SUB_NAV_ITEMS = [
  { label: "Dashboard",  path: "dashboard" },
  { label: "Stories",    path: "stories" },
  { label: "Threads",   path: "threads" },
  { label: "Characters", path: "characters" },
  { label: "Locations", path: "locations" },
  { label: "World",     path: "world" },
  { label: "Systems",   path: "systems" },
] as const;

/* ----------------------------------------------------------------
   Library Layout
   ---------------------------------------------------------------- */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const router = useRouter();
  const pathname = usePathname();

  const { storeRef, storeReady, ragNodes, putRagNode, addNode } = useRAGContext();
  const { status: systemStatus } = useSystemContext();

  /* ---- Library metadata ---- */
  const libraryRagNode = ragNodes[libraryId];
  const [libraryTitle, setLibraryTitleState] = useState(libraryRagNode?.title ?? "Untitled Library");
  const [libraryDescription, setLibraryDescriptionState] = useState<string>("");
  const [libraryStatus, setLibraryStatusState] = useState<"drafting" | "editing" | "archived">("drafting");

  // Sync title from tree when it changes externally
  useEffect(() => {
    if (libraryRagNode?.title) setLibraryTitleState(libraryRagNode.title);
  }, [libraryRagNode?.title]);

  const setLibraryTitle = useCallback((title: string) => {
    setLibraryTitleState(title);
    const node = ragNodes[libraryId];
    if (node) putRagNode({ ...node, title, updatedAt: Date.now() });
  }, [libraryId, ragNodes, putRagNode]);

  const setLibraryDescription = useCallback((desc: string) => {
    setLibraryDescriptionState(desc);
    // Store as metadata on the library node's voiceProfile field (re-purposed temporarily)
    // TODO: add a dedicated metadata field to RAGNode
  }, []);

  const setLibraryStatus = useCallback((s: "drafting" | "editing" | "archived") => {
    setLibraryStatusState(s);
  }, []);

  /* ---- Tab state ---- */
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback((tab: EditorTab) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === tab.id)) return prev;
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((cur) => {
        if (cur !== id) return cur;
        return next[Math.min(idx, next.length - 1)]?.id ?? null;
      });
      return next;
    });
  }, []);

  const updateTabTitle = useCallback((id: string, title: string) => {
    setOpenTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }, []);

  /* ---- Document contents (chapter content cache) ---- */
  const [docContents, setDocContents] = useState<Record<string, { title: string; content: string }>>({});
  const [savedContents, setSavedContents] = useState<Record<string, string>>({});
  const docContentsRef = useRef(docContents);
  useEffect(() => { docContentsRef.current = docContents; }, [docContents]);

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, doc] of Object.entries(docContents)) {
      if (doc.content !== (savedContents[id] ?? "")) ids.add(id);
    }
    return ids;
  }, [docContents, savedContents]);

  /* ---- Characters ---- */
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  const addCharacter = useCallback((): CharacterEntry => {
    const id = generateId();
    const entry: CharacterEntry = { id, libraryId, name: "", role: "", notes: "" };
    setCharacters((prev) => [...prev, entry]);
    setActiveCharacterId(id);
    void storeRef.current?.putCharacter({ ...entry, updatedAt: Date.now() });
    return entry;
  }, [libraryId, storeRef]);

  const selectCharacter = useCallback((id: string) => {
    setActiveCharacterId(id);
  }, []);

  const updateCharacter = useCallback((entry: CharacterEntry) => {
    setCharacters((prev) => prev.map((c) => (c.id === entry.id ? entry : c)));
    void storeRef.current?.putCharacter({ ...entry, updatedAt: Date.now() });
  }, [storeRef]);

  const deleteCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    if (activeCharacterId === id) setActiveCharacterId(null);
    void storeRef.current?.deleteCharacter(id);
  }, [activeCharacterId, storeRef]);

  /* ---- Locations ---- */
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const addLocation = useCallback((): LocationEntry => {
    const id = generateId();
    const entry: LocationEntry = { id, libraryId, name: "", description: "" };
    setLocations((prev) => [...prev, entry]);
    setActiveLocationId(id);
    void storeRef.current?.putLocation({ ...entry, updatedAt: Date.now() });
    return entry;
  }, [libraryId, storeRef]);

  const selectLocation = useCallback((id: string) => { setActiveLocationId(id); }, []);

  const updateLocation = useCallback((entry: LocationEntry) => {
    setLocations((prev) => prev.map((l) => (l.id === entry.id ? entry : l)));
    void storeRef.current?.putLocation({ ...entry, updatedAt: Date.now() });
  }, [storeRef]);

  const deleteLocation = useCallback((id: string) => {
    setLocations((prev) => prev.filter((l) => l.id !== id));
    if (activeLocationId === id) setActiveLocationId(null);
    void storeRef.current?.deleteLocation(id);
  }, [activeLocationId, storeRef]);

  /* ---- World entries ---- */
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([]);
  const [activeWorldEntryId, setActiveWorldEntryId] = useState<string | null>(null);

  const addWorldEntry = useCallback((): WorldEntry => {
    const id = generateId();
    const entry: WorldEntry = { id, libraryId, title: "", category: "", notes: "" };
    setWorldEntries((prev) => [...prev, entry]);
    setActiveWorldEntryId(id);
    void storeRef.current?.putWorldEntry({ ...entry, updatedAt: Date.now() });
    return entry;
  }, [libraryId, storeRef]);

  const selectWorldEntry = useCallback((id: string) => { setActiveWorldEntryId(id); }, []);

  const updateWorldEntry = useCallback((entry: WorldEntry) => {
    setWorldEntries((prev) => prev.map((w) => (w.id === entry.id ? entry : w)));
    void storeRef.current?.putWorldEntry({ ...entry, updatedAt: Date.now() });
  }, [storeRef]);

  const deleteWorldEntry = useCallback((id: string) => {
    setWorldEntries((prev) => prev.filter((w) => w.id !== id));
    if (activeWorldEntryId === id) setActiveWorldEntryId(null);
    void storeRef.current?.deleteWorldEntry(id);
  }, [activeWorldEntryId, storeRef]);

  /* ---- Stories ---- */
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);

  const addStory = useCallback((): Story => {
    const now = Date.now();
    // addNode creates the "book" RAG node (Library → Book is valid in the hierarchy)
    // and returns the new node's id
    const id = addNode(libraryId, "book");
    const entry: Story = { id, libraryId, title: "Untitled Story", synopsis: "", genre: "", status: "drafting", createdAt: now };
    setStories((prev) => [...prev, entry]);
    setActiveStoryId(id);
    void storeRef.current?.putStory({ ...entry, updatedAt: now });
    return entry;
  }, [libraryId, storeRef, addNode]);

  const selectStory = useCallback((id: string) => { setActiveStoryId(id); }, []);

  const updateStory = useCallback((entry: Story) => {
    setStories((prev) => prev.map((s) => (s.id === entry.id ? entry : s)));
    // Also sync the RAG node title
    const node = ragNodes[entry.id];
    if (node) putRagNode({ ...node, title: entry.title, updatedAt: Date.now() });
    void storeRef.current?.putStory({ ...entry, updatedAt: Date.now() });
  }, [storeRef, ragNodes, putRagNode]);

  const deleteStory = useCallback((id: string) => {
    setStories((prev) => prev.filter((s) => s.id !== id));
    if (activeStoryId === id) setActiveStoryId(null);
    void storeRef.current?.deleteStory(id);
  }, [activeStoryId, storeRef]);

  /* ---- Chat / Threads ---- */
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
    void storeRef.current?.putChatSession({ id, libraryId, title: "New Thread", preview: "", createdAt: now, updatedAt: now });
    return id;
  }, [libraryId, storeRef]);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setBottomPanelOpen(true);
    router.push(`/library/${libraryId}/threads/${id}`);
  }, [libraryId, router]);

  const deleteChat = useCallback((id: string) => {
    void storeRef.current?.deleteChatSession(id);
    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeChatId === id) {
        setActiveChatId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
    setChatMessages((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, [activeChatId, storeRef]);

  const updateChatMessages = useCallback((chatId: string, messages: ChatMessageEntry[]) => {
    setChatMessages((prev) => ({ ...prev, [chatId]: messages }));
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "") : "New Thread";
    const preview = firstUser ? firstUser.content.slice(0, 60) : "";
    if (firstUser) {
      setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, title, preview } : c));
    }
    void storeRef.current?.putChatMessages(chatId, messages);
    const now = Date.now();
    void storeRef.current?.listChatSessionsByLibrary(libraryId).then((sessions) => {
      const existing = sessions.find((s) => s.id === chatId);
      if (existing) {
        void storeRef.current?.putChatSession({ ...existing, libraryId, title, preview, updatedAt: now });
      }
    });
  }, [libraryId, storeRef]);

  /* ---- RAG Worker ---- */
  const [storeReady2, setStoreReady2] = useState(false);
  const [indexingCount, setIndexingCount] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const ragNodesRef = useRef(ragNodes);
  const systemStatusRef = useRef(systemStatus);
  useEffect(() => { ragNodesRef.current = ragNodes; }, [ragNodes]);
  useEffect(() => { systemStatusRef.current = systemStatus; }, [systemStatus]);

  useEffect(() => {
    let cancelled = false;
    if (!storeReady) return;

    const worker = new Worker(new URL("../../../workers/rag-indexer.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = async (event: MessageEvent<RagWorkerResponse>) => {
      if (cancelled) return;
      const data = event.data;

      if (data.type === "hash-result") {
        const { fragmentId, contentHash, tokenCount } = data.result;
        const doc = docContentsRef.current[fragmentId];
        setIndexingCount((c) => Math.max(0, c - 1));
        if (!doc) return;

        const existingNode = ragNodesRef.current[fragmentId];
        const updated: RAGNode = {
          ...(existingNode ?? createRAGNode(fragmentId, "chapter", doc.title, doc.content, null, contentHash)),
          title: doc.title,
          content: doc.content,
          contentHash,
          tokenCount,
          updatedAt: Date.now(),
        };

        putRagNode(updated);
        setSavedContents((prev) => ({ ...prev, [fragmentId]: doc.content }));

        const prevChunkTotal = existingNode?.chunkTotal ?? 0;
        const willChunk = needsChunking(doc.content);
        let chunks: RAGNode[] = [];
        if (willChunk) {
          chunks = await chunkScene(fragmentId, doc.title, doc.content);
          putRagNode({ ...updated, chunkTotal: chunks.length, childrenIds: chunks.map((c) => c.id) });
        }
        if (prevChunkTotal > 0) {
          const staleIds = staleFragmentIds(fragmentId, prevChunkTotal);
          for (const id of staleIds) void storeRef.current?.deleteNode(id);
        }
        if (willChunk && chunks.length > 0 && storeRef.current) {
          for (const c of chunks) {
            putRagNode(c);
            void embedNode(c.id, c.content, c.contentHash, systemStatusRef.current?.embedModel ?? "nomic-embed-text", storeRef.current);
          }
        } else if (!willChunk && storeRef.current) {
          void embedNode(fragmentId, doc.content, contentHash, systemStatusRef.current?.embedModel ?? "nomic-embed-text", storeRef.current);
        }
      }
    };

    setStoreReady2(true);
    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
    };
  }, [storeReady, putRagNode, storeRef]);

  /* ---- Hydrate library-scoped data from IDB ---- */
  useEffect(() => {
    if (!storeReady) return;
    const store = storeRef.current;
    if (!store) return;
    void (async () => {
      const [chars, locs, world, sessions, storyRows] = await Promise.all([
        store.getCharactersByLibrary(libraryId),
        store.getLocationsByLibrary(libraryId),
        store.getWorldEntriesByLibrary(libraryId),
        store.listChatSessionsByLibrary(libraryId),
        store.getStoriesByLibrary(libraryId),
      ]);
      setCharacters(chars.map((c) => ({ id: c.id, libraryId: c.libraryId, name: c.name, role: c.role, notes: c.notes })));
      setLocations(locs.map((l) => ({ id: l.id, libraryId: l.libraryId, name: l.name, description: l.description })));
      setWorldEntries(world.map((w) => ({ id: w.id, libraryId: w.libraryId, title: w.title, category: w.category, notes: w.notes })));
      setStories(storyRows.map((s) => ({ id: s.id, libraryId: s.libraryId, title: s.title, synopsis: s.synopsis, genre: s.genre, status: s.status, createdAt: s.createdAt })));

      if (sessions.length > 0) {
        const sessionObjects: ChatSession[] = sessions.map((s) => ({
          id: s.id, libraryId: s.libraryId ?? libraryId, title: s.title, preview: s.preview, createdAt: s.createdAt,
        }));
        setChats(sessionObjects);
        setActiveChatId(sessionObjects[0].id);
        const allMessages = await Promise.all(
          sessions.map(async (s) => {
            const msgs = await store.listChatMessages(s.id);
            return { id: s.id, messages: msgs.map((m) => ({ role: m.role, content: m.content })) };
          })
        );
        setChatMessages(() => {
          const next: Record<string, ChatMessageEntry[]> = {};
          allMessages.forEach(({ id, messages }) => { next[id] = messages; });
          return next;
        });
      } else {
        // Create a default chat session for new libraries
        const id = initialChatId;
        const now = Date.now();
        const session: ChatSession = { id, libraryId, title: "New Thread", createdAt: now, preview: "" };
        setChats([session]);
        setActiveChatId(id);
        void store.putChatSession({ id, libraryId, title: "New Thread", preview: "", createdAt: now, updatedAt: now });
      }
    })();
  }, [storeReady, storeRef, libraryId, initialChatId]);

  /* ---- Build RAG context for chat ---- */
  const buildContext = useCallback(async (query: string): Promise<string> => {
    const store = storeRef.current;
    if (!store) return "";
    const nodes = Object.values(ragNodesRef.current);
    return buildRAGContext(query, nodes, store, systemStatus.embedModel ?? "nomic-embed-text");
  }, [storeRef, systemStatus.embedModel]);

  /* ---- Document content handlers ---- */
  const initDoc = useCallback((id: string, title: string, content: string) => {
    setDocContents((prev) => {
      if (prev[id]) return prev; // already loaded
      return { ...prev, [id]: { title, content } };
    });
    setSavedContents((prev) => {
      if (prev[id] !== undefined) return prev;
      return { ...prev, [id]: content };
    });
  }, []);

  const handleContentChange = useCallback((chapterId: string, content: string) => {
    setDocContents((prev) => {
      if (!prev[chapterId]) return prev;
      return { ...prev, [chapterId]: { ...prev[chapterId], content } };
    });
    const worker = workerRef.current;
    if (worker) {
      setIndexingCount((c) => c + 1);
      const request: RagWorkerRequest = { type: "hash", fragment: { fragmentId: chapterId, content } };
      worker.postMessage(request);
    }
  }, []);

  const handleTitleChange = useCallback((chapterId: string, title: string) => {
    setDocContents((prev) => {
      if (!prev[chapterId]) return prev;
      return { ...prev, [chapterId]: { ...prev[chapterId], title } };
    });
    setOpenTabs((prev) => prev.map((t) => (t.id === chapterId ? { ...t, title } : t)));
    const node = ragNodesRef.current[chapterId];
    if (node) putRagNode({ ...node, title, updatedAt: Date.now() });
  }, [putRagNode]);

  /* ---- Resize chat panel ---- */
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = chatPanelWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - ev.clientX;
      const newWidth = Math.max(260, Math.min(720, dragStartWidthRef.current + delta));
      chatPanelWidthRef.current = newWidth;
      setChatPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  /* ---- Active sub-nav segment ---- */
  const activeSegment = useMemo(() => {
    const match = pathname?.match(/^\/library\/[^/]+\/([^/]+)/);
    return match ? match[1] : "dashboard";
  }, [pathname]);

  /* ---- Chat context for AI ---- */
  const chatContext = useMemo(() => {
    const lines: string[] = [];
    lines.push(`### Library: ${libraryTitle}`);
    if (characters.length > 0) {
      lines.push(`\n### Characters`);
      characters.slice(0, 15).forEach((c) => {
        const parts = [c.name || "Unnamed"];
        if (c.role) parts.push(`(${c.role})`);
        if (c.notes) parts.push(`— ${c.notes.slice(0, 120)}`);
        lines.push(`- ${parts.join(" ")}`);
      });
    }
    if (locations.length > 0) {
      lines.push(`\n### Locations`);
      locations.slice(0, 10).forEach((l) => {
        lines.push(`- ${l.name || "Unnamed"}${l.description ? ` — ${l.description.slice(0, 120)}` : ""}`.trimEnd());
      });
    }
    if (worldEntries.length > 0) {
      lines.push(`\n### World`);
      worldEntries.slice(0, 10).forEach((w) => {
        lines.push(`- ${w.title || "Untitled"}${w.category ? ` (${w.category})` : ""}${w.notes ? ` — ${w.notes.slice(0, 120)}` : ""}`.trimEnd());
      });
    }
    return lines.join("\n");
  }, [libraryTitle, characters, locations, worldEntries]);

  /* ---- Persist library ID in localStorage ---- */
  useEffect(() => {
    localStorage.setItem("quilliam_last_library", libraryId);
  }, [libraryId]);

  /* ---- Compose LibraryContext value ---- */
  const ctxValue: LibraryContextValue = {
    libraryId,
    libraryTitle,
    libraryDescription,
    libraryStatus,
    setLibraryTitle,
    setLibraryDescription,
    setLibraryStatus,
    stories,
    activeStoryId,
    addStory,
    selectStory,
    updateStory,
    deleteStory,
    characters,
    activeCharacterId,
    addCharacter,
    selectCharacter,
    updateCharacter,
    deleteCharacter,
    locations,
    activeLocationId,
    addLocation,
    selectLocation,
    updateLocation,
    deleteLocation,
    worldEntries,
    activeWorldEntryId,
    addWorldEntry,
    selectWorldEntry,
    updateWorldEntry,
    deleteWorldEntry,
    chats,
    activeChatId,
    chatMessages,
    addChat,
    selectChat,
    deleteChat,
    updateChatMessages,
    bottomPanelOpen,
    setBottomPanelOpen,
    chatPanelWidth,
    setChatPanelWidth,
    openTabs,
    activeTabId,
    openTab,
    closeTab,
    setActiveTabId,
    updateTabTitle,
    docContents,
    dirtyIds,
    initDoc,
    handleContentChange,
    handleTitleChange,
    buildContext,
    storeRef,
    workerRef,
    storeReady: storeReady2,
    indexingCount,
  };

  const activeChatMessages = activeChatId ? chatMessages[activeChatId] ?? [] : [];

  return (
    <LibraryContext.Provider value={ctxValue}>
      <div className="library-layout">
        {/* Secondary nav: library-scoped tabs */}
        <nav className="library-subnav">
          <span className="library-subnav-title" title={libraryTitle}>
            {libraryTitle}
          </span>
          <div className="library-subnav-links">
            {SUB_NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                href={`/library/${libraryId}/${item.path}`}
                className={`library-subnav-link ${activeSegment === item.path ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button
            className={`library-subnav-chat-btn ${bottomPanelOpen ? "active" : ""}`}
            onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
            title="Toggle AI Thread Panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            AI
          </button>
        </nav>

        {/* Body: content + optional tabs + optional chat panel */}
        <div className="library-body">
          {/* Left/main area: tab bar + page content */}
          <div className="library-main">
            {openTabs.length > 0 && (
              <TabBar
                tabs={openTabs}
                activeTabId={activeTabId}
                onSelectTab={setActiveTabId}
                onCloseTab={closeTab}
              />
            )}
            <div className="library-content">
              {children}
            </div>
          </div>

          {/* Right-side AI Chat panel (Copilot-style) */}
          {bottomPanelOpen && (
            <div className="library-chat-panel" style={{ width: chatPanelWidth }}>
              <div className="library-chat-panel-resize" onMouseDown={handleResizeStart} />
              <div className="library-chat-panel-header">
                <span className="library-chat-panel-title">
                  <span className="library-chat-panel-title-accent">✦</span>
                  Quilliam AI
                </span>
                <div className="library-chat-panel-actions">
                  <button
                    className="library-chat-panel-btn"
                    onClick={() => addChat()}
                    title="New thread"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <button
                    className="library-chat-panel-btn"
                    onClick={() => setBottomPanelOpen(false)}
                    title="Close panel"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="library-chat-panel-body">
                {activeChatId && (
                  <Chat
                    key={activeChatId}
                    chatId={activeChatId}
                    model={systemStatus.model}
                    mode={systemStatus.mode}
                    context={chatContext}
                    initialMessages={activeChatMessages}
                    onMessagesChange={(msgs) => updateChatMessages(activeChatId, msgs)}
                    onBuildContext={buildContext}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <StatusBar
          model={systemStatus.model}
          mode={systemStatus.mode}
          ollamaReady={systemStatus.ollamaReady}
          embeddingReady={systemStatus.embedModelAvailable}
          indexing={indexingCount > 0}
          onToggleChat={() => setBottomPanelOpen((v) => !v)}
          bottomPanelOpen={bottomPanelOpen}
        />
      </div>
    </LibraryContext.Provider>
  );
}
