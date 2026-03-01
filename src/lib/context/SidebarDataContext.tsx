"use client";

/**
 * SidebarDataContext
 *
 * Decouples the sidebar shell (mounted in ClientShell) from the data that
 * only certain child pages (e.g. page.tsx) can provide.
 *
 * Pattern:
 *  1. ClientShell mounts <SidebarDataProvider> once.
 *  2. page.tsx calls useSidebarDataRegister(data) to inject threads / loras /
 *     callbacks into the context while the page is mounted.
 *  3. OffCanvasSidebar reads from useSidebarData().
 *
 * All fields are optional / nullable so the sidebar degrades gracefully on
 * routes that don't register data (e.g. analytics, maps, etc.).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PersistedGeneralThread } from "@/lib/rag/store";
import type { ThreadBuckets } from "@/lib/landing/useGeneralThreads";
import type { LoRA } from "@/lib/landing/loras";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarData {
  activeLibraryId: string | null;
  threads: PersistedGeneralThread[];
  threadBuckets: ThreadBuckets;
  activeChatId: string | null;
  loras: LoRA[];
  activeLoRAId: string;
  onNewChat: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onSelectLoRA: (id: string) => void;
}

interface SidebarDataContextValue {
  data: SidebarData | null;
  register: (data: SidebarData) => void;
  unregister: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SidebarDataContext = createContext<SidebarDataContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SidebarDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SidebarData | null>(null);

  const register = useCallback((d: SidebarData) => setData(d), []);
  const unregister = useCallback(() => setData(null), []);

  const value = useMemo(
    (): SidebarDataContextValue => ({ data, register, unregister }),
    [data, register, unregister],
  );

  return (
    <SidebarDataContext.Provider value={value}>
      {children}
    </SidebarDataContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer — used by OffCanvasSidebar
// ---------------------------------------------------------------------------

export function useSidebarData(): SidebarData | null {
  const ctx = useContext(SidebarDataContext);
  if (!ctx) throw new Error("useSidebarData must be within SidebarDataProvider");
  return ctx.data;
}

// ---------------------------------------------------------------------------
// Registrar hook — used by page.tsx (home page) to inject live data
// ---------------------------------------------------------------------------

/**
 * Call in a page component to push live sidebar data into the global sidebar
 * shell while the page is mounted. Data is cleared on unmount.
 *
 * Stabilise the data object with useMemo before passing it here so that
 * the effect only fires when meaningful values actually change.
 */
export function useSidebarDataRegister(data: SidebarData): void {
  const ctx = useContext(SidebarDataContext);
  if (!ctx) throw new Error("useSidebarDataRegister must be within SidebarDataProvider");

  const { register, unregister } = ctx;

  useEffect(() => {
    register(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    register,
    data.threads,
    data.threadBuckets,
    data.activeChatId,
    data.loras,
    data.activeLoRAId,
    data.onNewChat,
    data.onSelectThread,
    data.onDeleteThread,
    data.onRenameThread,
    data.onSelectLoRA,
  ]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);
}

