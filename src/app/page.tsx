"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SystemStatus, StartupStatus } from "@/components/SystemStatus";
import { EditorArea } from "@/components/Editor/EditorArea";
import {
  Sidebar,
  type SidebarNode,
  type SidebarTab,
  type ChatSession,
  type CharacterEntry,
  type LocationEntry,
  type WorldEntry,
  type OutlineHeading,
} from "@/components/Editor/Sidebar";
import { ActivityBar } from "@/components/Editor/ActivityBar";
import { TabBar, type EditorTab } from "@/components/Editor/TabBar";
import { StatusBar } from "@/components/Editor/StatusBar";
import { CharacterEditor } from "@/components/Editor/CharacterEditor";
import { LocationEditor } from "@/components/Editor/LocationEditor";
import { WorldEditor } from "@/components/Editor/WorldEditor";
import { Chat } from "@/components/Chat";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import { EDITABLE_TYPES, createRAGNode } from "@/lib/rag/hierarchy";
import { createRAGStore } from "@/lib/rag/db";
import type { RAGStore } from "@/lib/rag/store";
import type { RagWorkerRequest, RagWorkerResponse } from "@/lib/rag/messages";

function generateId() {
  return crypto.randomUUID();
}

const DEFAULT_TITLES: Record<NodeType, string> = {
  library: "Untitled Library",
  book: "Untitled Book",
  part: "Untitled Part",
  chapter: "Untitled Chapter",
  scene: "Untitled Scene",
};

/* -----------------------------------------------------------
   Tree helpers
   ----------------------------------------------------------- */
function insertChild(nodes: SidebarNode[], parentId: string, child: SidebarNode): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, child], isExpanded: true };
    return { ...n, children: insertChild(n.children, parentId, child) };
  });
}

function renameInTree(nodes: SidebarNode[], nodeId: string, newTitle: string): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, title: newTitle };
    return { ...n, children: renameInTree(n.children, nodeId, newTitle) };
  });
}

function deleteFromTree(nodes: SidebarNode[], nodeId: string): SidebarNode[] {
  return nodes.filter((n) => n.id !== nodeId).map((n) => ({ ...n, children: deleteFromTree(n.children, nodeId) }));
}

function findNode(nodes: SidebarNode[], id: string): SidebarNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function collectIds(node: SidebarNode): string[] {
  return [node.id, ...node.children.flatMap(collectIds)];
}

function findParentId(nodes: SidebarNode[], id: string, parentId: string | null = null): string | null {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    const found = findParentId(node.children, id, node.id);
    if (found !== null) return found;
  }
  return null;
}

function rebuildRagNodesFromTree(
  nodes: SidebarNode[],
  existing: Record<string, RAGNode>,
  docContents: Record<string, { title: string; content: string }>
): Record<string, RAGNode> {
  const next: Record<string, RAGNode> = {};

  const walk = (list: SidebarNode[], parentId: string | null) => {
    list.forEach((node) => {
      const current = existing[node.id];
      const doc = docContents[node.id];
      const createdAt = current?.createdAt ?? Date.now();
      const updatedAt = current?.updatedAt ?? createdAt;

      next[node.id] = {
        id: node.id,
        type: node.type,
        title: doc?.title ?? node.title,
        content: doc?.content ?? current?.content ?? "",
        contentHash: current?.contentHash ?? "",
        parentId,
        childrenIds: node.children.map((c) => c.id),
        createdAt,
        updatedAt,
        vectorEmbedding: current?.vectorEmbedding,
        voiceProfile: current?.voiceProfile,
        themeId: current?.themeId,
        tokenCount: current?.tokenCount,
        semanticHash: current?.semanticHash,
      };

      if (node.children.length > 0) {
        walk(node.children, node.id);
      }
    });
  };

  walk(nodes, null);
  return next;
}

function buildSidebarTreeFromRAG(nodes: RAGNode[]): SidebarNode[] {
  const map = new Map<string, SidebarNode>();
  nodes.forEach((node) => {
    map.set(node.id, {
      id: node.id,
      title: node.title,
      type: node.type,
      children: [],
      isExpanded: true,
    });
  });

  const roots: SidebarNode[] = [];
  nodes.forEach((node) => {
    const sidebarNode = map.get(node.id)!;
    if (node.parentId === null) {
      roots.push(sidebarNode);
    } else {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(sidebarNode);
      }
    }
  });

  return roots;
}

function toggleExpandInTree(nodes: SidebarNode[], nodeId: string): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, isExpanded: !n.isExpanded };
    return { ...n, children: toggleExpandInTree(n.children, nodeId) };
  });
}

function removeFromTree(nodes: SidebarNode[], nodeId: string): { remaining: SidebarNode[]; removed: SidebarNode | null } {
  let removed: SidebarNode | null = null;
  const remaining = nodes.filter((n) => {
    if (n.id === nodeId) { removed = n; return false; }
    return true;
  }).map((n) => {
    if (removed) return n;
    const result = removeFromTree(n.children, nodeId);
    if (result.removed) removed = result.removed;
    return { ...n, children: result.remaining };
  });
  return { remaining, removed };
}

function addChildToNode(nodes: SidebarNode[], targetId: string, child: SidebarNode): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === targetId) return { ...n, children: [...n.children, child], isExpanded: true };
    return { ...n, children: addChildToNode(n.children, targetId, child) };
  });
}

/* -----------------------------------------------------------
   Chat message type
   ----------------------------------------------------------- */
interface ChatMessageEntry {
  role: "user" | "assistant";
  content: string;
}

/* -----------------------------------------------------------
   Page component
   ----------------------------------------------------------- */
export default function Home() {
  const [systemStatus, setSystemStatus] = useState<StartupStatus | null>(null);

  // ---- Layout state ----
  const [activePanel, setActivePanel] = useState<SidebarTab>("manuscripts");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);

  // ---- Editor tabs ----
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // ---- Manuscripts ----
  const [tree, setTree] = useState<SidebarNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [docContents, setDocContents] = useState<Record<string, { title: string; content: string }>>({});
  const [ragNodes, setRagNodes] = useState<Record<string, RAGNode>>({});

  // ---- Chats (bottom panel) ----
  const [chats, setChats] = useState<ChatSession[]>(() => {
    const id = generateId();
    return [{ id, title: "New Chat", createdAt: Date.now(), preview: "" }];
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(() => chats[0]?.id ?? null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessageEntry[]>>(() => {
    const id = chats[0]?.id;
    return id ? { [id]: [] } : {};
  });

  // ---- Characters ----
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  // ---- Locations ----
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  // ---- World ----
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([]);
  const [activeWorldEntryId, setActiveWorldEntryId] = useState<string | null>(null);

  // ---- Outline (for sidebar outline panel) ----
  const [outlineHeadings, setOutlineHeadings] = useState<OutlineHeading[]>([]);

  // ---- Dirty tracking ----
  const [savedContents, setSavedContents] = useState<Record<string, string>>({});
  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, doc] of Object.entries(docContents)) {
      const saved = savedContents[id] ?? "";
      if (doc.content !== saved) ids.add(id);
    }
    return ids;
  }, [docContents, savedContents]);

  /* ============ RAG context for AI chat ============ */

  const chatContext = useMemo(() => {
    if (!activeTabId) return undefined;
    const doc = docContents[activeTabId];
    if (!doc) return undefined;

    const lines: string[] = [];

    // Build hierarchy path
    const buildPath = (nodes: SidebarNode[], id: string, acc: string[] = []): string[] => {
      for (const n of nodes) {
        if (n.id === id) return [...acc, n.title];
        const found = buildPath(n.children, id, [...acc, n.title]);
        if (found.length > acc.length + 1) return found;
      }
      return acc;
    };
    const path = buildPath(tree, activeTabId);
    lines.push(`### Document`);
    if (path.length > 0) lines.push(`**Path:** ${path.join(" > ")}`);
    lines.push(`**Title:** ${doc.title}`);
    if (doc.content.trim()) {
      lines.push(`**Content (excerpt):**`);
      lines.push(doc.content.slice(0, 3000) + (doc.content.length > 3000 ? "\n[...truncated]" : ""));
    } else {
      lines.push(`*Document is empty — nothing written yet.*`);
    }

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
        const desc = l.description ? `— ${l.description.slice(0, 120)}` : "";
        lines.push(`- ${l.name || "Unnamed"} ${desc}`.trimEnd());
      });
    }

    if (worldEntries.length > 0) {
      lines.push(`\n### World`);
      worldEntries.slice(0, 10).forEach((w) => {
        const cat = w.category ? ` (${w.category})` : "";
        const notes = w.notes ? `— ${w.notes.slice(0, 120)}` : "";
        lines.push(`- ${w.title || "Untitled"}${cat} ${notes}`.trimEnd());
      });
    }

    return lines.join("\n");
  }, [activeTabId, docContents, tree, characters, locations, worldEntries]);

  useEffect(() => {
    docContentsRef.current = docContents;
  }, [docContents]);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    ragNodesRef.current = ragNodes;
  }, [ragNodes]);

  const hydrateFromStore = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;

    const storedNodes = await store.listAllNodes();
    if (storedNodes.length === 0) return;

    setRagNodes(() => storedNodes.reduce<Record<string, RAGNode>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {}));

    setDocContents(() => {
      const next: Record<string, { title: string; content: string }> = {};
      storedNodes.forEach((node) => {
        if ((EDITABLE_TYPES as string[]).includes(node.type)) {
          next[node.id] = { title: node.title, content: node.content };
        }
      });
      return next;
    });

    setSavedContents(() => {
      const next: Record<string, string> = {};
      storedNodes.forEach((node) => {
        if ((EDITABLE_TYPES as string[]).includes(node.type)) {
          next[node.id] = node.content;
        }
      });
      return next;
    });

    setTree(buildSidebarTreeFromRAG(storedNodes));

    // Rehydrate chat sessions
    const storedSessions = await store.listChatSessions();
    if (storedSessions.length > 0) {
      const sessionObjects: ChatSession[] = storedSessions.map((s) => ({
        id: s.id,
        title: s.title,
        preview: s.preview,
        createdAt: s.createdAt,
      }));
      setChats(sessionObjects);
      setActiveChatId(sessionObjects[0].id);

      // Load messages for all sessions in parallel
      const allMessages = await Promise.all(
        storedSessions.map(async (s) => {
          const msgs = await store.listChatMessages(s.id);
          return { id: s.id, messages: msgs.map((m) => ({ role: m.role, content: m.content })) };
        })
      );
      setChatMessages(() => {
        const next: Record<string, ChatMessageEntry[]> = {};
        allMessages.forEach(({ id, messages }) => { next[id] = messages; });
        return next;
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const store = await createRAGStore();
      if (cancelled) return;
      storeRef.current = store;
      await hydrateFromStore();

      const worker = new Worker(new URL("../workers/rag-indexer.ts", import.meta.url));
      workerRef.current = worker;

      worker.onmessage = async (event: MessageEvent<RagWorkerResponse>) => {
        if (cancelled) return;

        const data = event.data;

        if (data.type === "hash-result") {
          const { fragmentId, contentHash, tokenCount } = data.result;
          const doc = docContentsRef.current[fragmentId];
          const treeNodes = treeRef.current;
          setIndexingCount((c) => Math.max(0, c - 1));
          if (!doc) return;
          const sidebarNode = findNode(treeNodes, fragmentId);
          const parentId = findParentId(treeNodes, fragmentId);
          const nodeType = sidebarNode?.type ?? "chapter";

          const updated: RAGNode = {
            ...(ragNodesRef.current[fragmentId] ?? createRAGNode(fragmentId, nodeType, doc.title, doc.content, parentId, contentHash)),
            title: doc.title,
            content: doc.content,
            contentHash,
            tokenCount,
            parentId,
            childrenIds: sidebarNode?.children.map((c) => c.id) ?? [],
            updatedAt: Date.now(),
          };

          setRagNodes((prev) => ({ ...prev, [fragmentId]: updated }));
          await storeRef.current?.putNode(updated);
          setSavedContents((prev) => ({ ...prev, [fragmentId]: doc.content }));
        }

        if (data.type === "hash-batch-result") {
          setIndexingCount((c) => Math.max(0, c - 1));
          for (const item of data.results) {
            const { fragmentId, contentHash, tokenCount } = item;
            const doc = docContentsRef.current[fragmentId];
            const treeNodes = treeRef.current;
            if (!doc) continue;
            const sidebarNode = findNode(treeNodes, fragmentId);
            const parentId = findParentId(treeNodes, fragmentId);
            const nodeType = sidebarNode?.type ?? "chapter";

            const updated: RAGNode = {
              ...(ragNodesRef.current[fragmentId] ?? createRAGNode(fragmentId, nodeType, doc.title, doc.content, parentId, contentHash)),
              title: doc.title,
              content: doc.content,
              contentHash,
              tokenCount,
              parentId,
              childrenIds: sidebarNode?.children.map((c) => c.id) ?? [],
              updatedAt: Date.now(),
            };

            setRagNodes((prev) => ({ ...prev, [fragmentId]: updated }));
            await storeRef.current?.putNode(updated);
            setSavedContents((prev) => ({ ...prev, [fragmentId]: doc.content }));
          }
        }
      };

      setStoreReady(true);
    };

    void setup();

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
    };
  }, [hydrateFromStore]);

  // ---- Persistence + worker ----
  const [storeReady, setStoreReady] = useState(false);
  const [indexingCount, setIndexingCount] = useState(0);
  const indexing = indexingCount > 0;
  const storeRef = useRef<RAGStore | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const docContentsRef = useRef(docContents);
  const treeRef = useRef(tree);
  const ragNodesRef = useRef(ragNodes);

  const handleReady = useCallback((status: StartupStatus) => {
    setSystemStatus(status);
  }, []);

  useEffect(() => {
    if (!storeReady) return;
    const store = storeRef.current;
    if (!store) return;

    void (async () => {
      const nodes = Object.values(ragNodes);
      await Promise.all(nodes.map((node) => store.putNode(node)));
    })();
  }, [ragNodes, storeReady]);

  /* ============ Tab management ============ */

  const openTab = useCallback((tab: EditorTab) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === tab.id)) return prev;
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        return next[Math.min(idx, next.length - 1)]?.id ?? null;
      });
      return next;
    });
  }, []);

  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setOpenTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, title } : t)));
  }, []);

  /* ============ Activity bar panel toggle ============ */

  const handlePanelChange = useCallback((panel: SidebarTab) => {
    if (panel === activePanel && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setActivePanel(panel);
      setSidebarVisible(true);
    }
  }, [activePanel, sidebarVisible]);

  /* ============ Manuscript handlers ============ */

  const handleAddChild = useCallback((parentId: string | null, childType: NodeType) => {
    const id = generateId();
    const newNode: SidebarNode = { id, title: DEFAULT_TITLES[childType], type: childType, children: [], isExpanded: true };
    if (parentId === null) {
      setTree((prev) => [...prev, newNode]);
    } else {
      setTree((prev) => insertChild(prev, parentId, newNode));
    }
    const parentSidebar = parentId ? findNode(treeRef.current, parentId) : null;
    const ragNode = createRAGNode(id, childType, DEFAULT_TITLES[childType], "", parentId);
    setRagNodes((prev) => {
      const next = { ...prev, [id]: ragNode };
      if (parentId && prev[parentId]) {
        next[parentId] = { ...prev[parentId], childrenIds: [...prev[parentId].childrenIds, id] };
      }
      return next;
    });
    void storeRef.current?.putNode(ragNode);
    if (parentSidebar && ragNodesRef.current[parentSidebar.id]) {
      const updatedParent = {
        ...ragNodesRef.current[parentSidebar.id],
        childrenIds: [...ragNodesRef.current[parentSidebar.id].childrenIds, id],
        updatedAt: Date.now(),
      };
      void storeRef.current?.putNode(updatedParent);
    }
    const isEditable = (EDITABLE_TYPES as string[]).includes(childType);
    if (isEditable) {
      const kind = childType === "scene" ? "chapter" : "chapter"; // both use chapter editor
      setDocContents((prev) => ({ ...prev, [id]: { title: DEFAULT_TITLES[childType], content: "" } }));
      setSavedContents((prev) => ({ ...prev, [id]: "" }));
      openTab({ id, kind, title: DEFAULT_TITLES[childType] });
    }
    setActiveNodeId(id);
  }, [openTab]);

  const handleRenameNode = useCallback((id: string, newTitle: string) => {
    setTree((prev) => renameInTree(prev, id, newTitle));
    setDocContents((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], title: newTitle } } : prev));
    updateTabTitle(id, newTitle);
    setRagNodes((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const updated = { ...existing, title: newTitle, updatedAt: Date.now() };
      void storeRef.current?.putNode(updated);
      return { ...prev, [id]: updated };
    });
  }, [updateTabTitle]);

  const handleDeleteNode = useCallback((id: string) => {
    const node = findNode(tree, id);
    if (node) {
      const ids = new Set(collectIds(node));
      setDocContents((prev) => { const next = { ...prev }; for (const rid of ids) delete next[rid]; return next; });
      for (const rid of ids) closeTab(rid);
      if (activeNodeId && ids.has(activeNodeId)) setActiveNodeId(null);
      setRagNodes((prev) => {
        const next = { ...prev };
        ids.forEach((rid) => {
          delete next[rid];
          void storeRef.current?.deleteNode(rid);
        });
        return next;
      });
    }
    setTree((prev) => deleteFromTree(prev, id));
  }, [tree, activeNodeId, closeTab]);

  const handleNodeSelect = useCallback((id: string) => {
    setActiveNodeId(id);
    const node = findNode(tree, id);
    if (node && (EDITABLE_TYPES as string[]).includes(node.type)) {
      openTab({ id, kind: "chapter", title: node.title });
    }
  }, [tree, openTab]);

  const handleContentChange = useCallback((content: string) => {
    if (!activeTabId) return;
    setDocContents((prev) => {
      if (!prev[activeTabId]) return prev;
      return { ...prev, [activeTabId]: { ...prev[activeTabId], content } };
    });
    const worker = workerRef.current;
    if (worker) {
      setIndexingCount((c) => c + 1);
      const request: RagWorkerRequest = {
        type: "hash",
        fragment: { fragmentId: activeTabId, content },
      };
      worker.postMessage(request);
    }
  }, [activeTabId]);

  const handleTitleChange = useCallback((title: string) => {
    if (!activeTabId) return;
    setDocContents((prev) => {
      if (!prev[activeTabId]) return prev;
      return { ...prev, [activeTabId]: { ...prev[activeTabId], title } };
    });
    setTree((prev) => renameInTree(prev, activeTabId, title));
    updateTabTitle(activeTabId, title);
    setRagNodes((prev) => {
      const existing = prev[activeTabId];
      if (!existing) return prev;
      const updated = { ...existing, title, updatedAt: Date.now() };
      void storeRef.current?.putNode(updated);
      return { ...prev, [activeTabId]: updated };
    });
  }, [activeTabId, updateTabTitle]);

  /* ============ Tree expand / move ============ */

  const handleToggleExpand = useCallback((id: string) => {
    setTree((prev) => toggleExpandInTree(prev, id));
  }, []);

  const handleMoveNode = useCallback((dragId: string, targetId: string) => {
    setTree((prev) => {
      const { remaining, removed } = removeFromTree(prev, dragId);
      if (!removed) return prev;
      const nextTree = addChildToNode(remaining, targetId, removed);
      setRagNodes((current) => rebuildRagNodesFromTree(nextTree, current, docContentsRef.current));
      return nextTree;
    });
  }, []);

  const handleOutlineJumpTo = useCallback((_offset: number) => {
    // Outline jump is a no-op for now — EditorArea doesn't expose jumpToOffset yet
  }, []);

  /* ============ Chat handlers ============ */

  const handleNewChat = useCallback(() => {
    const id = generateId();
    const now = Date.now();
    const session: ChatSession = { id, title: "New Chat", createdAt: now, preview: "" };
    setChats((prev) => [session, ...prev]);
    setChatMessages((prev) => ({ ...prev, [id]: [] }));
    setActiveChatId(id);
    setBottomPanelOpen(true);
    void storeRef.current?.putChatSession({ id, title: "New Chat", preview: "", createdAt: now, updatedAt: now });
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setBottomPanelOpen(true);
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    void storeRef.current?.deleteChatSession(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    setChatMessages((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (activeChatId === id) {
      setChats((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveChatId(remaining[0].id);
        } else {
          const newId = generateId();
          const now = Date.now();
          const session: ChatSession = { id: newId, title: "New Chat", createdAt: now, preview: "" };
          setChatMessages((p) => ({ ...p, [newId]: [] }));
          setActiveChatId(newId);
          void storeRef.current?.putChatSession({ id: newId, title: "New Chat", preview: "", createdAt: now, updatedAt: now });
          return [session];
        }
        return remaining;
      });
    }
  }, [activeChatId]);

  const handleChatMessagesUpdate = useCallback((chatId: string, messages: ChatMessageEntry[]) => {
    setChatMessages((prev) => ({ ...prev, [chatId]: messages }));
    const firstUser = messages.find((m) => m.role === "user");
    const now = Date.now();
    const title = firstUser
      ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "")
      : "New Chat";
    const preview = firstUser ? firstUser.content.slice(0, 60) : "";
    if (firstUser) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, title, preview } : c
        )
      );
    }
    // Persist messages and update session header in DB
    void storeRef.current?.putChatMessages(chatId, messages);
    void storeRef.current?.listChatSessions().then((sessions) => {
      const existing = sessions.find((s) => s.id === chatId);
      if (existing) {
        void storeRef.current?.putChatSession({ ...existing, title, preview, updatedAt: now });
      }
    });
  }, []);

  /* ============ Character handlers ============ */

  const handleAddCharacter = useCallback(() => {
    const id = generateId();
    const entry: CharacterEntry = { id, name: "", role: "", notes: "" };
    setCharacters((prev) => [...prev, entry]);
    setActiveCharacterId(id);
    openTab({ id, kind: "character", title: "Unnamed" });
  }, [openTab]);

  const handleSelectCharacter = useCallback((id: string) => {
    setActiveCharacterId(id);
    const ch = characters.find((c) => c.id === id);
    openTab({ id, kind: "character", title: ch?.name || "Unnamed" });
  }, [characters, openTab]);

  const handleDeleteCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    closeTab(id);
    if (activeCharacterId === id) setActiveCharacterId(null);
  }, [activeCharacterId, closeTab]);

  const handleCharacterChange = useCallback((updated: CharacterEntry) => {
    setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    updateTabTitle(updated.id, updated.name || "Unnamed");
  }, [updateTabTitle]);

  /* ============ Location handlers ============ */

  const handleAddLocation = useCallback(() => {
    const id = generateId();
    const entry: LocationEntry = { id, name: "", description: "" };
    setLocations((prev) => [...prev, entry]);
    setActiveLocationId(id);
    openTab({ id, kind: "location", title: "Unnamed" });
  }, [openTab]);

  const handleSelectLocation = useCallback((id: string) => {
    setActiveLocationId(id);
    const loc = locations.find((l) => l.id === id);
    openTab({ id, kind: "location", title: loc?.name || "Unnamed" });
  }, [locations, openTab]);

  const handleDeleteLocation = useCallback((id: string) => {
    setLocations((prev) => prev.filter((l) => l.id !== id));
    closeTab(id);
    if (activeLocationId === id) setActiveLocationId(null);
  }, [activeLocationId, closeTab]);

  const handleLocationChange = useCallback((updated: LocationEntry) => {
    setLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    updateTabTitle(updated.id, updated.name || "Unnamed");
  }, [updateTabTitle]);

  /* ============ World handlers ============ */

  const handleAddWorldEntry = useCallback(() => {
    const id = generateId();
    const entry: WorldEntry = { id, title: "", category: "", notes: "" };
    setWorldEntries((prev) => [...prev, entry]);
    setActiveWorldEntryId(id);
    openTab({ id, kind: "world", title: "Untitled" });
  }, [openTab]);

  const handleSelectWorldEntry = useCallback((id: string) => {
    setActiveWorldEntryId(id);
    const w = worldEntries.find((e) => e.id === id);
    openTab({ id, kind: "world", title: w?.title || "Untitled" });
  }, [worldEntries, openTab]);

  const handleDeleteWorldEntry = useCallback((id: string) => {
    setWorldEntries((prev) => prev.filter((w) => w.id !== id));
    closeTab(id);
    if (activeWorldEntryId === id) setActiveWorldEntryId(null);
  }, [activeWorldEntryId, closeTab]);

  const handleWorldEntryChange = useCallback((updated: WorldEntry) => {
    setWorldEntries((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    updateTabTitle(updated.id, updated.title || "Untitled");
  }, [updateTabTitle]);

  /* ============ Render ============ */

  if (!systemStatus) {
    return <SystemStatus onReady={handleReady} />;
  }

  // ---- Render active tab content ----
  const renderTabContent = () => {
    if (!activeTabId) return null;
    const tab = openTabs.find((t) => t.id === activeTabId);
    if (!tab) return null;

    switch (tab.kind) {
      case "chapter": {
        const doc = docContents[tab.id];
        if (!doc) return null;
        return (
          <EditorArea
            key={tab.id}
            initialContent={doc.content}
            documentTitle={doc.title}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
          />
        );
      }
      case "character": {
        const ch = characters.find((c) => c.id === tab.id);
        if (!ch) return null;
        return <CharacterEditor key={ch.id} character={ch} onChange={handleCharacterChange} />;
      }
      case "location": {
        const loc = locations.find((l) => l.id === tab.id);
        if (!loc) return null;
        return <LocationEditor key={loc.id} location={loc} onChange={handleLocationChange} />;
      }
      case "world": {
        const entry = worldEntries.find((w) => w.id === tab.id);
        if (!entry) return null;
        return <WorldEditor key={entry.id} entry={entry} onChange={handleWorldEntryChange} />;
      }
    }
  };

  const hasOpenTabs = openTabs.length > 0;
  const activeChatMessages = activeChatId ? chatMessages[activeChatId] ?? [] : [];

  return (
    <div className="ide-root">
      <div className="ide-body">
        {/* Activity Bar — far left icon strip */}
        <ActivityBar
          activePanel={sidebarVisible ? activePanel : null}
          onPanelChange={handlePanelChange}
          bottomPanelOpen={bottomPanelOpen}
          onToggleBottomPanel={() => setBottomPanelOpen(!bottomPanelOpen)}
        />

        {/* Sidebar — explorer, chats, characters, etc. */}
        {sidebarVisible && (
          <Sidebar
            activePanel={activePanel}
            tree={tree}
            activeNodeId={activeNodeId}
            onNodeSelect={handleNodeSelect}
            onAddChild={handleAddChild}
            onRenameNode={handleRenameNode}
            onDeleteNode={handleDeleteNode}
            onToggleExpand={handleToggleExpand}
            onMoveNode={handleMoveNode}
            dirtyIds={dirtyIds}
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            characters={characters}
            activeCharacterId={activeCharacterId}
            onSelectCharacter={handleSelectCharacter}
            onAddCharacter={handleAddCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            locations={locations}
            activeLocationId={activeLocationId}
            onSelectLocation={handleSelectLocation}
            onAddLocation={handleAddLocation}
            onDeleteLocation={handleDeleteLocation}
            worldEntries={worldEntries}
            activeWorldEntryId={activeWorldEntryId}
            onSelectWorldEntry={handleSelectWorldEntry}
            onAddWorldEntry={handleAddWorldEntry}
            onDeleteWorldEntry={handleDeleteWorldEntry}
            outlineHeadings={outlineHeadings}
            outlineDocumentTitle={activeTabId ? (docContents[activeTabId]?.title ?? null) : null}
            onOutlineJumpTo={handleOutlineJumpTo}
          />
        )}

        {/* Main editor area */}
        <div className="ide-main">
          {/* Tab bar */}
          <TabBar
            tabs={openTabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={closeTab}
          />

          {/* Editor content or welcome */}
          <div className="ide-editor-area">
            {hasOpenTabs && activeTabId ? (
              renderTabContent()
            ) : (
              <div className="ide-welcome">
                <div className="ide-welcome-inner">
                  <div className="ide-welcome-brand">Q</div>
                  <h1 className="ide-welcome-title">Quilliam</h1>
                  <p className="ide-welcome-subtitle">Author & Journalist IDE</p>
                  <div className="ide-welcome-actions">
                    <button className="ide-welcome-action" onClick={() => { setActivePanel("manuscripts"); setSidebarVisible(true); }}>
                      <span className="ide-welcome-key">Explorer</span>
                      <span className="ide-welcome-desc">Create libraries and chapters</span>
                    </button>
                    <button className="ide-welcome-action" onClick={() => setBottomPanelOpen(true)}>
                      <span className="ide-welcome-key">AI Chat</span>
                      <span className="ide-welcome-desc">Get writing help from Quilliam</span>
                    </button>
                    <button className="ide-welcome-action" onClick={() => { setActivePanel("characters"); setSidebarVisible(true); }}>
                      <span className="ide-welcome-key">Characters</span>
                      <span className="ide-welcome-desc">Build your cast</span>
                    </button>
                    <button className="ide-welcome-action" onClick={() => { setActivePanel("world"); setSidebarVisible(true); }}>
                      <span className="ide-welcome-key">World</span>
                      <span className="ide-welcome-desc">Lore, rules, history, culture</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom panel — AI Chat */}
          {bottomPanelOpen && (
            <div className="ide-bottom-panel">
              <div className="bottom-panel-header">
                <div className="bottom-panel-tab-list">
                  <button className="bottom-panel-tab active">AI Chat</button>
                </div>
                <div className="bottom-panel-actions">
                  <button
                    className="bottom-panel-close"
                    onClick={() => setBottomPanelOpen(false)}
                    title="Close panel"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="bottom-panel-content">
                {activeChatId && (
                  <Chat
                    key={activeChatId}
                    chatId={activeChatId}
                    model={systemStatus.model}
                    mode={systemStatus.mode}
                    context={chatContext}
                    initialMessages={activeChatMessages}
                    onMessagesChange={(msgs) => handleChatMessagesUpdate(activeChatId, msgs)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar — full width at bottom */}
      <StatusBar
        model={systemStatus.model}
        mode={systemStatus.mode}
        ollamaReady={systemStatus.ollamaReady}
        indexing={indexing}
        onToggleChat={() => setBottomPanelOpen(!bottomPanelOpen)}
        bottomPanelOpen={bottomPanelOpen}
      />
    </div>
  );
}
