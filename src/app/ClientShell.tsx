"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
// router reserved for future library creation actions in the sidebar
import { SystemStatus, type StartupStatus } from "@/components/SystemStatus";
import { SystemContext } from "@/lib/context/SystemContext";
import { WorkspaceContext } from "@/lib/context/WorkspaceContext";
import type { RAGStore } from "@/lib/rag/store";
import { checkStorageHealth, createRAGStore, getCorpusStats } from "@/lib/rag/db";
import { useLibraryTree } from "@/lib/context/useLibraryTree";
import { SidebarProvider, useSidebar } from "@/lib/context/SidebarContext";
import { SidebarDataProvider } from "@/lib/context/SidebarDataContext";
import { OffCanvasSidebar } from "@/components/Sidebar";
import { SidebarTrigger } from "@/components/Sidebar/SidebarTrigger";
import { SidebarBackdrop } from "@/components/Sidebar/SidebarBackdrop";

/* ------------------------------------------------------------------
   SidebarShell — inner component that reads useSidebar() to apply
   the push-layout class to ide-main when the sidebar is pinned.
   ------------------------------------------------------------------ */
interface SidebarShellProps {
  children: React.ReactNode;
}

function SidebarShell({ children }: SidebarShellProps) {
  const { isPinned } = useSidebar();

  return (
    <div className="ide-root">
      {/* Fixed-position sidebar layer */}
      <SidebarTrigger />
      <SidebarBackdrop />
      <OffCanvasSidebar />

      {/* Main content area — shifts right when sidebar is pinned */}
      <div className={`ide-main${isPinned ? " ide-main--sidebar-pinned" : ""}`}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   ClientShell
   ------------------------------------------------------------------ */
export function ClientShell({ children }: { children: React.ReactNode }) {
  // router available for future library creation / navigation actions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

  const [systemStatus, setSystemStatus] = useState<StartupStatus | null>(null);
  // storeState is exposed via WorkspaceContext as `store` and drives useLibraryTree.
  const [storeState, setStoreState] = useState<RAGStore | null>(null);

  const {
    tree,
    ragNodes,
    addNode,
    renameNode,
    deleteNode,
    toggleExpand,
    moveNode,
    putRagNode,
    loadFromStore,
  } = useLibraryTree(storeState);

  const handleReady = useCallback((status: StartupStatus) => {
    setSystemStatus(status);
  }, []);

  /* ---- Store initialization (runs once after system ready) ---- */
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      // Request persistent storage so the browser doesn't evict IDB under
      // quota pressure. Safari private-browsing always denies this; Chrome
      // and Firefox honour it. A denial is non-fatal — log and continue.
      if (navigator.storage?.persist) {
        const persisted = await navigator.storage.persist();
        if (!persisted) {
          console.warn(
            "Quilliam: persistent storage not granted — IndexedDB may be evicted under quota pressure.",
          );
        }
      }

      const store = await createRAGStore();
      if (cancelled) return;

      // Detect Safari private-browsing zero-quota (navigator.storage.estimate()
      // is silently broken on Safari, so we probe with a real write instead).
      const storageHealth = await checkStorageHealth();
      if (storageHealth === "privateMode") {
        console.warn(
          "Quilliam: IndexedDB is in private-browsing mode — quota is zero. " +
          "RAG indexing and chat history will not persist across page loads.",
        );
      } else if (storageHealth === "unavailable") {
        console.warn("Quilliam: IndexedDB is unavailable in this environment.");
      }

      // Log corpus stats in dev; warn when approaching Safari's ~10k-record
      // performance cliff (see run001 phase 3 research).
      if (process.env.NODE_ENV !== "production") {
        const stats = await getCorpusStats();
        if (stats.nearPerformanceCliff) {
          console.warn(
            `Quilliam: corpus is approaching the IndexedDB performance cliff ` +
            `(${stats.fragmentCount} fragments + ${stats.embeddingCount} embeddings). ` +
            "Consider pruning old libraries or planning an OPFS migration.",
          );
        } else {
          console.debug("Quilliam: corpus stats", stats);
        }
      }

      if (!cancelled) {
        setStoreState(store);
      }
    };
    void setup();
    return () => { cancelled = true; };
  }, []);

  // Load the sidebar tree once the store is ready.
  useEffect(() => {
    if (storeState) void loadFromStore();
  }, [storeState, loadFromStore]);

  /* ---- Derive current library from pathname for sidebar highlighting ---- */
  // (handled inside DomainNavAccordion via usePathname + localStorage)

  if (!systemStatus) {
    return (
      <div className="ide-startup">
        <SystemStatus onReady={handleReady} />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <SidebarDataProvider>
        <SystemContext.Provider value={{ status: systemStatus }}>
          <WorkspaceContext.Provider
            value={{
              store: storeState,
              tree,
              ragNodes,
              addNode,
              renameNode,
              deleteNode,
              toggleExpand,
              moveNode,
              putRagNode,
            }}
          >
            <SidebarShell>
              {children}
            </SidebarShell>
          </WorkspaceContext.Provider>
        </SystemContext.Provider>
      </SidebarDataProvider>
    </SidebarProvider>
  );
}

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */

