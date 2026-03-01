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
import { useWorkspaceContext } from "@/lib/context/WorkspaceContext";
import { StoreGate } from "@/lib/context/StoreGate";
import { useSystemContext } from "@/lib/context/SystemContext";
import { TabBar, type EditorTab } from "@/components/Editor/TabBar";
import { Chat } from "@/components/Chat";
import { BuildFeed } from "@/components/BuildFeed";
import { StatusBar } from "@/components/Editor/StatusBar";
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_RUN_BUDGET,
  AiExecutionMode,
  Entry,
  EntryPatch,
  ChatMessageEntry,
  ChatSession,
  type CloudProviderConfig,
  ResearchRunRecord,
  Story,
  type Book,
  type RunBudget,
} from "@/lib/types";
import type { PersistedLibraryMeta } from "@/lib/rag/store";
import { buildRAGContext } from "@/lib/rag/retrieval";
import { applyEdits, type ChangeSet } from "@/lib/changeSets";
import type { EditBlockEvent } from "@/lib/editParser";
import { buildChatContext as createChatContext } from "@/lib/library/chatContextBuilder";
import { useChatState } from "@/lib/library/chatState";
import { useChangeSetMachine } from "@/lib/library/changeSetMachine";
import { useEntityState } from "@/lib/library/entityState";
import { useRagWorker } from "@/lib/library/ragWorker";
import { applyEntryPatch } from "@/lib/domain/patch";

/* ----------------------------------------------------------------
   Library sub-nav link
   ---------------------------------------------------------------- */
const SIDEBAR_GROUPS = [
  {
    label: "Universe Core",
    items: [
      { label: "Overview", path: "universe" },
      { label: "Master Timeline", path: "master-timeline" },
      { label: "Cosmology", path: "cosmology" },
      { label: "Magic/Tech Systems", path: "magic-systems" },
      { label: "Rules of Reality", path: "rules" },
    ],
  },
  {
    label: "World Structures",
    items: [
      { label: "Regions & Locations", path: "locations" },
      { label: "Cultures", path: "cultures" },
      { label: "Religions", path: "religions" },
      { label: "Languages", path: "languages" },
      { label: "Economics", path: "economics" },
    ],
  },
  {
    label: "Power Structures",
    items: [
      { label: "Kingdoms & Empires", path: "organizations" },
      { label: "Factions & Orders", path: "factions" },
      { label: "Conflicts", path: "conflicts" },
    ],
  },
  {
    label: "Cast & Lineages",
    items: [
      { label: "Characters", path: "characters" },
      { label: "Lineages", path: "lineages" },
      { label: "Relationship Web", path: "relationship-web" },
    ],
  },
  {
    label: "Artifacts & Media",
    items: [
      { label: "Items & Relics", path: "items" },
      { label: "Maps", path: "maps" },
      { label: "Media Library", path: "media" },
    ],
  },
  {
    label: "Manuscripts",
    items: [
      { label: "Books", path: "books" },
      { label: "Scenes", path: "scenes" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Suggestions", path: "suggestions" },
      { label: "Continuity Issues", path: "continuity-issues" },
      { label: "Analytics", path: "analytics" },
      { label: "Branch Diff", path: "branches" },
      { label: "Change Log", path: "change-log" },
    ],
  },
] as const;

/* ----------------------------------------------------------------
   Library Layout
   ---------------------------------------------------------------- */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const router = useRouter();
  const pathname = usePathname();

  const { store, ragNodes, putRagNode, addNode, deleteNode } = useWorkspaceContext();
  const { status: systemStatus } = useSystemContext();

  /* ---- Library metadata ---- */
  const libraryRagNode = ragNodes[libraryId];
  const [libraryMeta, setLibraryMeta] = useState<PersistedLibraryMeta | null>(null);
  const libraryTitle = libraryRagNode?.title ?? libraryMeta?.title ?? "Untitled Library";
  const libraryDescription = libraryMeta?.description ?? "";
  const libraryStatus = libraryMeta?.status ?? "drafting";

  /* ---- Migration banner ---- */
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  const upsertLibraryMeta = useCallback((patch: Partial<PersistedLibraryMeta>) => {
    setLibraryMeta((prev) => {
      const base: PersistedLibraryMeta = prev ?? {
        libraryId,
        title: libraryRagNode?.title ?? "Untitled Library",
        description: "",
        status: "drafting",
        updatedAt: Date.now(),
      };
      const next: PersistedLibraryMeta = {
        ...base,
        ...patch,
        libraryId,
        updatedAt: Date.now(),
      };
      void store?.putLibraryMeta(next);
      return next;
    });
  }, [libraryId, libraryRagNode?.title, store]);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void (async () => {
      const stored = await store.getLibraryMeta(libraryId);
      if (cancelled) return;
      if (stored) {
        setLibraryMeta(stored);
      } else {
        setLibraryMeta((prev) => {
          // Avoid clobbering edits that landed while this async lookup was in flight.
          if (prev && prev.libraryId === libraryId) return prev;
          const fresh: PersistedLibraryMeta = {
            libraryId,
            title: libraryRagNode?.title ?? "Untitled Library",
            description: "",
            status: "drafting",
            updatedAt: Date.now(),
          };
          void store.putLibraryMeta(fresh);
          return fresh;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryId, libraryRagNode?.title, store]);

  /* ---- First-boot migration offer ---- */
  useEffect(() => {
    if (!store) return;
    void (async () => {
      // Check if we've already offered migration
      const offered = await store.getMetadata<boolean>("migrationOffered");
      if (offered) return;

      // Check if legacy data exists
      const chars = await store.getCharactersByLibrary(libraryId);
      const locs  = await store.getLocationsByLibrary(libraryId);
      if (chars.length + locs.length === 0) return;

      // Only offer if canonical store is still empty
      const canonDocs = await store.queryDocsByType("character");
      if (canonDocs.length > 0) return;

      setShowMigrationBanner(true);
      await store.setMetadata({ key: "migrationOffered", value: true, updatedAt: Date.now() });
    })();
  }, [libraryId, store]);

  const setLibraryTitle = useCallback((title: string) => {
    const node = ragNodes[libraryId];
    if (node) putRagNode({ ...node, title, updatedAt: Date.now() });
    upsertLibraryMeta({ title });
  }, [libraryId, ragNodes, putRagNode, upsertLibraryMeta]);

  const setLibraryDescription = useCallback((desc: string) => {
    upsertLibraryMeta({ description: desc });
  }, [upsertLibraryMeta]);

  const setLibraryStatus = useCallback((s: "drafting" | "editing" | "archived") => {
    upsertLibraryMeta({ status: s });
  }, [upsertLibraryMeta]);

  /* ---- AI execution settings ---- */
  const [aiModeState, setAiModeState] = useState<AiExecutionMode>("local");
  const [cloudProviderConfigState, setCloudProviderConfigState] = useState<CloudProviderConfig>(DEFAULT_PROVIDER_CONFIG);
  const [defaultRunBudgetState, setDefaultRunBudgetState] = useState<RunBudget>(DEFAULT_RUN_BUDGET);
  const [researchRuns, setResearchRuns] = useState<ResearchRunRecord[]>([]);
  const [existingEntries, setExistingEntries] = useState<Entry[]>([]);

  const persistAiSettings = useCallback(
    (next: {
      executionMode: AiExecutionMode;
      providerConfig: CloudProviderConfig;
      defaultBudget: RunBudget;
    }) => {
      void store?.putAiLibrarySettings({
        libraryId,
        executionMode: next.executionMode,
        providerConfig: next.providerConfig,
        defaultBudget: next.defaultBudget,
        updatedAt: Date.now(),
      });
    },
    [libraryId, store],
  );

  const setAiMode = useCallback(
    (mode: AiExecutionMode) => {
      setAiModeState(mode);
      persistAiSettings({
        executionMode: mode,
        providerConfig: cloudProviderConfigState,
        defaultBudget: defaultRunBudgetState,
      });
    },
    [cloudProviderConfigState, defaultRunBudgetState, persistAiSettings],
  );

  const setCloudProviderConfig = useCallback(
    (cfg: CloudProviderConfig) => {
      setCloudProviderConfigState(cfg);
      persistAiSettings({
        executionMode: aiModeState,
        providerConfig: cfg,
        defaultBudget: defaultRunBudgetState,
      });
    },
    [aiModeState, defaultRunBudgetState, persistAiSettings],
  );

  const setDefaultRunBudget = useCallback(
    (budget: RunBudget) => {
      setDefaultRunBudgetState(budget);
      persistAiSettings({
        executionMode: aiModeState,
        providerConfig: cloudProviderConfigState,
        defaultBudget: budget,
      });
    },
    [aiModeState, cloudProviderConfigState, persistAiSettings],
  );

  const refreshResearchRuns = useCallback(async () => {
    try {
      const response = await fetch(`/api/research/runs?libraryId=${encodeURIComponent(libraryId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { runs?: ResearchRunRecord[] };
      const runs = Array.isArray(payload.runs) ? payload.runs : [];
      setResearchRuns(runs);

      if (store) {
        for (const run of runs) {
          await store.putResearchRun(run);
          await store.putUsageLedger({
            runId: run.id,
            usage: run.usage,
            updatedAt: run.updatedAt,
          });
          for (const artifact of run.artifacts) {
            await store.putResearchArtifact(artifact);
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh research runs", error);
      // Leave stale data intact when offline or route unavailable.
    }
  }, [libraryId, store]);

  const handlePatchesExtracted = useCallback(async (patches: EntryPatch[]) => {
    if (!store || patches.length === 0) return;

    for (const patch of patches) {
      if (patch.operations.length === 0) continue;
      // `addPatch` mirrors into both legacy and entry patch stores.
      await store.addPatch(patch);

      if (patch.autoCommit) {
        await applyEntryPatch(patch, {
          addEntry: store.addEntry,
          updateEntry: store.updateEntry,
          deleteEntry: store.deleteEntry,
          addEntryRelation: store.addEntryRelation,
          removeEntryRelation: store.removeEntryRelation,
          addContinuityIssue: store.addContinuityIssue,
          updateContinuityIssueStatus: store.updateContinuityIssueStatus,
          addCultureVersion: store.addCultureVersion,
          updatePatchStatus: store.updatePatchStatus,
          getEntryById: store.getEntryById,
        });
      }
    }

    const latest = await store.listEntriesByUniverse(libraryId);
    setExistingEntries(latest);
  }, [libraryId, store]);

  /**
   * Called by Chat when a deep research run completes.
   * Extracts entry patches from research artifacts and routes them through
   * auto-commit vs review-first handling.
   */
  const handleResearchRunComplete = useCallback(async (run: ResearchRunRecord) => {
    try {
      const artifactText = run.artifacts
        .filter((a) => a.kind === "notes" || a.kind === "outline" || a.kind === "claims")
        .map((a) => a.content)
        .join("\n\n")
        .trim();

      if (!artifactText) return;

      const response = await fetch("/api/extract-canonical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: artifactText,
          sourceType: "research",
          sourceId: run.id,
          existingEntries,
        }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as { patches?: EntryPatch[] };
      const patches = Array.isArray(payload.patches) ? payload.patches : [];
      if (patches.length === 0) return;
      await handlePatchesExtracted(patches);
    } catch (error) {
      console.error("Research canonical extraction failed:", error);
    }
  }, [existingEntries, handlePatchesExtracted]);
  /* ---- Tab state ---- */  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
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
  /** Working copies modified by AI edits but not yet accepted. */
  const [workingContents, setWorkingContents] = useState<Record<string, string>>({});
  const docContentsRef = useRef(docContents);
  useEffect(() => { docContentsRef.current = docContents; }, [docContents]);

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, doc] of Object.entries(docContents)) {
      if (doc.content !== (savedContents[id] ?? "")) ids.add(id);
    }
    return ids;
  }, [docContents, savedContents]);
  
  const {
    characters,
    setCharacters,
    activeCharacterId,
    addCharacter,
    selectCharacter,
    updateCharacter,
    deleteCharacter,
    locations,
    setLocations,
    activeLocationId,
    addLocation,
    selectLocation,
    updateLocation,
    deleteLocation,
    worldEntries,
    setWorldEntries,
    activeWorldEntryId,
    addWorldEntry,
    selectWorldEntry,
    updateWorldEntry,
    deleteWorldEntry,
  } = useEntityState({
    libraryId,
    store,
  });

  /* ---- Stories ---- */
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);

  const addStory = useCallback((): Story => {
    const now = Date.now();
    // addNode creates the "book" RAG node (Library -> Book is valid in the hierarchy)
    // and returns the new node's id
    const id = addNode(libraryId, "book");
    const entry: Story = { id, libraryId, title: "Untitled Story", synopsis: "", genre: "", status: "drafting", createdAt: now };
    setStories((prev) => [...prev, entry]);
    setActiveStoryId(id);
    void store?.putStory({ ...entry, updatedAt: now });
    // Bridge-write to the Plan-002 books store so books/[storyId]/page.tsx can find it
    const bookRecord: Book = {
      id,
      universeId: libraryId,
      title: "Untitled Book",
      status: "drafting",
      orderIndex: now,
      createdAt: now,
      updatedAt: now,
    };
    void store?.putBook(bookRecord);
    return entry;
  }, [libraryId, store, addNode]);

  const selectStory = useCallback((id: string) => { setActiveStoryId(id); }, []);

  const updateStory = useCallback((entry: Story) => {
    setStories((prev) => prev.map((s) => (s.id === entry.id ? entry : s)));
    // Also sync the RAG node title
    const node = ragNodes[entry.id];
    if (node) putRagNode({ ...node, title: entry.title, updatedAt: Date.now() });
    void store?.putStory({ ...entry, updatedAt: Date.now() });
    // Sync to Plan-002 books store
    void (async () => {
      const now = Date.now();
      await store?.putBook({
        id: entry.id,
        universeId: libraryId,
        title: entry.title,
        status: entry.status as Book["status"],
        orderIndex: entry.createdAt,
        createdAt: entry.createdAt,
        updatedAt: now,
      } satisfies Book);
    })();
  }, [libraryId, store, ragNodes, putRagNode]);

  const deleteStory = useCallback((id: string) => {
    const removedNodeIds = new Set<string>();
    const queue: string[] = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (removedNodeIds.has(current)) continue;
      removedNodeIds.add(current);
      const node = ragNodes[current];
      if (node) queue.push(...node.childrenIds);
    }

    setStories((prev) => prev.filter((s) => s.id !== id));
    if (activeStoryId === id) setActiveStoryId(null);
    setOpenTabs((prev) => prev.filter((t) => !removedNodeIds.has(t.id)));
    if (activeTabId && removedNodeIds.has(activeTabId)) setActiveTabId(null);
    setDocContents((prev) => {
      const next = { ...prev };
      removedNodeIds.forEach((nodeId) => { delete next[nodeId]; });
      return next;
    });
    setSavedContents((prev) => {
      const next = { ...prev };
      removedNodeIds.forEach((nodeId) => { delete next[nodeId]; });
      return next;
    });
    setWorkingContents((prev) => {
      const next = { ...prev };
      removedNodeIds.forEach((nodeId) => { delete next[nodeId]; });
      return next;
    });
    const storyNodeExists = Boolean(ragNodes[id]);
    deleteNode(id);
    if (!storyNodeExists) {
      void store?.deleteStoryCascade(id);
    }
  }, [activeStoryId, activeTabId, deleteNode, ragNodes, store]);

  /* ---- Chat / Threads ---- */
  const {
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
  } = useChatState({
    libraryId,
    store,
    onNavigateToChat: (id) => {
      router.push(`/library/${libraryId}/threads/${id}`);
    },
  });

  const [buildFeedOpen, setBuildFeedOpen] = useState(false);

  /* ---- RAG Worker ---- */
  const {
    workerRef,
    ragNodesRef,
    indexingCount,
    queueHash,
  } = useRagWorker({
    store,
    ragNodes,
    putRagNode,
    systemStatus,
    docContentsRef,
    setSavedContents,
  });

  /* ---- Hydrate library-scoped data from IDB ---- */
  useEffect(() => {
    if (!store) return;
    void (async () => {
      const [chars, locs, world, sessions, storyRows, aiSettings, localRuns, entryRows] = await Promise.all([
        store.getCharactersByLibrary(libraryId),
        store.getLocationsByLibrary(libraryId),
        store.getWorldEntriesByLibrary(libraryId),
        store.listChatSessionsByLibrary(libraryId),
        store.getStoriesByLibrary(libraryId),
        store.getAiLibrarySettings(libraryId),
        store.listResearchRunsByLibrary(libraryId),
        store.listEntriesByUniverse(libraryId),
      ]);
      setCharacters(chars.map((c) => ({ id: c.id, libraryId: c.libraryId, name: c.name, role: c.role, notes: c.notes })));
      setLocations(locs.map((l) => ({ id: l.id, libraryId: l.libraryId, name: l.name, description: l.description })));
      setWorldEntries(world.map((w) => ({ id: w.id, libraryId: w.libraryId, title: w.title, category: w.category, notes: w.notes })));
      setStories(storyRows.map((s) => ({ id: s.id, libraryId: s.libraryId, title: s.title, synopsis: s.synopsis, genre: s.genre, status: s.status, createdAt: s.createdAt })));

      // Auto-init Universe record (Plan-002: libraryId === universeId)
      const existingUniverse = await store.getUniverse(libraryId);
      if (!existingUniverse) {
        const libMeta = await store.getLibraryMeta(libraryId);
        await store.putUniverse({
          id: libraryId,
          name: libMeta?.title ?? "My Universe",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Bridge-migrate any legacy Story records that don't yet have a Book record
      const existingBooks = await store.listBooksByUniverse(libraryId);
      const existingBookIds = new Set(existingBooks.map((b) => b.id));
      for (const s of storyRows) {
        if (!existingBookIds.has(s.id)) {
          const now = Date.now();
          await store.putBook({
            id: s.id,
            universeId: libraryId,
            title: s.title,
            status: (s.status as Book["status"]) ?? "drafting",
            orderIndex: s.createdAt,
            createdAt: s.createdAt,
            updatedAt: now,
          } satisfies Book);
        }
      }

      if (entryRows.length > 0) {
        setExistingEntries(entryRows);
      } else {
        // Compatibility bootstrap for libraries upgraded from pre-entry schema.
        const legacyDocs = (
          await Promise.all([
            store.queryDocsByType("character"),
            store.queryDocsByType("location"),
            store.queryDocsByType("faction"),
            store.queryDocsByType("magic_system"),
            store.queryDocsByType("item"),
            store.queryDocsByType("lore_entry"),
            store.queryDocsByType("rule"),
            store.queryDocsByType("scene"),
            store.queryDocsByType("timeline_event"),
            store.queryDocsByType("culture"),
            store.queryDocsByType("organization"),
            store.queryDocsByType("system"),
            store.queryDocsByType("language"),
            store.queryDocsByType("religion"),
            store.queryDocsByType("lineage"),
            store.queryDocsByType("economy"),
          ])
        ).flat();
        setExistingEntries(legacyDocs);
      }
      setAiModeState(aiSettings?.executionMode ?? "local");
      setCloudProviderConfigState(aiSettings?.providerConfig ?? DEFAULT_PROVIDER_CONFIG);
      setDefaultRunBudgetState(aiSettings?.defaultBudget ?? DEFAULT_RUN_BUDGET);
      setResearchRuns(localRuns);

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

      await refreshResearchRuns();
    })();
  }, [
    store,
    libraryId,
    initialChatId,
    refreshResearchRuns,
    setCharacters,
    setLocations,
    setWorldEntries,
    setChats,
    setActiveChatId,
    setChatMessages,
  ]);

  /* ---- Build RAG context for chat ---- */
  const buildContext = useCallback(async (query: string): Promise<string> => {
    if (!store) return "";
    const nodes = Object.values(ragNodesRef.current);
    return buildRAGContext(
      query,
      nodes,
      store,
      systemStatus.embedModel ?? "nomic-embed-text",
      5,
      workerRef.current ?? undefined,
    );
  }, [store, systemStatus.embedModel, ragNodesRef, workerRef]);

  /* ---- Stable chat messages callback (prevents infinite-loop from inline arrow in JSX) ---- */
  const handleMessagesChange = useCallback(
    (msgs: { role: "user" | "assistant"; content: string }[]) => {
      if (activeChatId) updateChatMessages(activeChatId, msgs);
    },
    [activeChatId, updateChatMessages],
  );

  /* ---- Document content handlers ---- */
  const handleContentChange = useCallback((chapterId: string, content: string) => {
    setDocContents((prev) => {
      if (!prev[chapterId]) return prev;
      return { ...prev, [chapterId]: { ...prev[chapterId], content } };
    });
    queueHash(chapterId, content);
  }, [queueHash]);

  const handleTitleChange = useCallback((chapterId: string, title: string) => {
    setDocContents((prev) => {
      if (!prev[chapterId]) return prev;
      return { ...prev, [chapterId]: { ...prev[chapterId], title } };
    });
    setOpenTabs((prev) => prev.map((t) => (t.id === chapterId ? { ...t, title } : t)));
    const node = ragNodesRef.current[chapterId];
    if (node) putRagNode({ ...node, title, updatedAt: Date.now() });
    // Sync to IDB chapters store for Plan-002 chapters (may have no RAG node)
    void store?.getChapter(chapterId).then((chapter) => {
      if (chapter) void store?.putChapter({ ...chapter, title, updatedAt: Date.now() });
    });
  }, [putRagNode, ragNodesRef, store]);

  /* ---- AI ChangeSets ---- */
  const {
    changeSets,
    entityDrafts,
    applyIncomingEdit,
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
    commitEntityDraft,
    revertEntityDraft,
  } = useChangeSetMachine({
    activeTabId,
    docContents,
    setDocContents,
    setWorkingContents,
    characters,
    setCharacters,
    locations,
    setLocations,
    worldEntries,
    setWorldEntries,
    store,
  });

  /** Handles a raw EditBlockEvent from Chat's parseEditStream. Constructs a ChangeSet and calls applyIncomingEdit. */
  const handleEditBlock = useCallback(
    (event: EditBlockEvent) => {
      const id = crypto.randomUUID();
      const cs: ChangeSet = {
        id,
        edits: [event.edit],
        fileTarget: event.fileTarget,
        status: "pending",
        commentary: event.commentary,
      };
      applyIncomingEdit(cs);
    },
    [applyIncomingEdit]
  );

  /** Open a chapter doc in the editor.
   * Moves content into docContents and, if any __active__ AI edits arrived before this
   * tab was opened, immediately applies them to workingContents so they are not lost.
   */
  const initDoc = useCallback(
    (id: string, title: string, content: string) => {
      setDocContents((prev) => {
        if (prev[id]) return prev; // already loaded
        return { ...prev, [id]: { title, content } };
      });
      setSavedContents((prev) => {
        if (prev[id] !== undefined) return prev;
        return { ...prev, [id]: content };
      });
      // Apply any pending __active__ changesets that arrived before this tab was opened
      const pendingSets = (changeSets["__active__"] ?? []).filter(
        (cs) => cs.status === "pending",
      );
      if (pendingSets.length > 0) {
        setWorkingContents((prev) => {
          if (prev[id] !== undefined) return prev; // already has a working copy
          const rebuilt = pendingSets.reduce(
            (acc, cs) => applyEdits(acc, cs.edits),
            content,
          );
          return { ...prev, [id]: rebuilt };
        });
      }
    },
    [changeSets, setWorkingContents],
  );

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
  }, [chatPanelWidthRef, dragStartWidthRef, dragStartXRef, isDraggingRef, setChatPanelWidth]);

  // Keep the ref in sync so external setChatPanelWidth calls don't cause a position jump on next drag
  useEffect(() => {
    chatPanelWidthRef.current = chatPanelWidth;
  }, [chatPanelWidth, chatPanelWidthRef]);

  /* ---- Active sub-nav segment ---- */
  const activeSegment = useMemo(() => {
    const match = pathname?.match(/^\/library\/[^/]+\/([^/]+)/);
    return match ? match[1] : "universe";
  }, [pathname]);

  /* ---- Sidebar collapsed groups ---- */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  /* ---- Chat context for AI ---- */
  const chatContext = useMemo(() => {
    return createChatContext({
      libraryTitle,
      activeTabId,
      docContents,
      workingContents,
      characters,
      locations,
      worldEntries,
      entityDrafts,
    });
  }, [libraryTitle, activeTabId, docContents, workingContents, characters, locations, worldEntries, entityDrafts]);

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
    aiMode: aiModeState,
    setAiMode,
    cloudProviderConfig: cloudProviderConfigState,
    setCloudProviderConfig,
    defaultRunBudget: defaultRunBudgetState,
    setDefaultRunBudget,
    researchRuns,
    refreshResearchRuns,
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
    workingContents,
    entityDrafts,
    dirtyIds,
    initDoc,
    handleContentChange,
    handleTitleChange,
    changeSets,
    applyIncomingEdit,
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
    commitEntityDraft,
    revertEntityDraft,
    buildContext,
    indexingCount,
  };

  const activeChatMessages = activeChatId ? chatMessages[activeChatId] ?? [] : [];

  return (
    <LibraryContext.Provider value={ctxValue}>
      <div className="library-layout">
        {/* First-boot migration offer banner */}
        {showMigrationBanner && (
          <div className="migration-banner">
            <p>
              Legacy character and location data detected. Run a one-time migration to
              populate the canonical docs stores?
            </p>
            <button
              className="library-page-action primary"
              onClick={() => {
                setShowMigrationBanner(false);
                router.push(`/library/${libraryId}/settings#migration`);
              }}
            >
              Go to migration
            </button>
            <button
              className="library-page-action"
              onClick={() => setShowMigrationBanner(false)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Topbar: universe title + panel toggles */}
        <div className="library-subnav">
          <span className="library-subnav-title" title={libraryTitle}>
            {libraryTitle}
          </span>
          <div className="library-subnav-actions">
            <button
              className={`library-subnav-chat-btn ${buildFeedOpen ? "active" : ""}`}
              onClick={() => setBuildFeedOpen(!buildFeedOpen)}
              title="Toggle Build Feed Panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Feed
            </button>
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
          </div>
        </div>

        {/* Body: sidebar + content + optional panels */}
        <div className="library-body">
          {/* Left sidebar nav */}
          <nav className="library-sidebar">
            {/* Library switcher link */}
            <div className="library-sidebar-switcher">
              <Link href="/" className="library-sidebar-home-link" title="All Libraries">
                ←&nbsp;All Libraries
              </Link>
              <Link
                href={`/library/${libraryId}/settings`}
                className={`library-sidebar-item${activeSegment === "settings" ? " active" : ""}`}
                title="Library settings, migration, and export"
              >
                Settings
              </Link>
            </div>
            {SIDEBAR_GROUPS.map((group) => {
              const isCollapsed = collapsedGroups.has(group.label);
              return (
                <div key={group.label} className="library-sidebar-group">
                  <button
                    className="library-sidebar-group-header"
                    onClick={() => toggleGroup(group.label)}
                    type="button"
                  >
                    <svg
                      className={`library-sidebar-chevron${isCollapsed ? "" : " expanded"}`}
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span>{group.label}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="library-sidebar-group-items">
                      {group.items.map((item) => (
                        <Link
                          key={item.path}
                          href={`/library/${libraryId}/${item.path}`}
                          className={`library-sidebar-item${activeSegment === item.path ? " active" : ""}`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          {/* Left Build Feed panel */}
          {buildFeedOpen && (
            <div className="library-build-feed-panel">
              <div className="library-build-feed-panel-header">
                <span className="library-build-feed-panel-title">
                  ⚡ Build Feed
                </span>
                <button
                  className="library-build-feed-panel-btn"
                  onClick={() => setBuildFeedOpen(false)}
                  title="Close Build Feed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="library-build-feed-panel-body">
                <BuildFeed />
              </div>
            </div>
          )}

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
              <StoreGate>
                {children}
              </StoreGate>
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
                <div className="library-chat-panel-mode">
                  <label htmlFor="ql-ai-mode" className="library-chat-panel-mode-label">
                    Mode
                  </label>
                  <select
                    id="ql-ai-mode"
                    className="library-chat-panel-mode-select"
                    value={aiModeState}
                    onChange={(e) => setAiMode(e.target.value as AiExecutionMode)}
                  >
                    <option value="local">Local</option>
                    <option value="assisted_cloud">Assisted Cloud</option>
                    <option value="deep_research">Deep Research</option>
                  </select>
                </div>
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
                    libraryId={libraryId}
                    executionMode={aiModeState}
                    providerConfig={cloudProviderConfigState}
                    runBudget={defaultRunBudgetState}
                    context={chatContext}
                    initialMessages={activeChatMessages}
                    onMessagesChange={handleMessagesChange}
                    onBuildContext={buildContext}
                    onEditBlock={handleEditBlock}
                    onResearchRunChange={refreshResearchRuns}
                    onResearchRunComplete={handleResearchRunComplete}
                    onPatchesExtracted={handlePatchesExtracted}
                    existingEntries={existingEntries}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <StatusBar
          executionMode={aiModeState}
          indexing={indexingCount > 0}
          onToggleChat={() => setBottomPanelOpen((v) => !v)}
          bottomPanelOpen={bottomPanelOpen}
        />
      </div>
    </LibraryContext.Provider>
  );
}
