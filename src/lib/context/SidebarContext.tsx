"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarSection = "chats";

interface SidebarState {
  isOpen: boolean;
  isPinned: boolean;
  activeSection: SidebarSection;
  openGroupId: string | null;
}

interface SidebarContextValue extends SidebarState {
  open: () => void;
  close: () => void;
  toggle: () => void;
  pin: () => void;
  unpin: () => void;
  setSection: (s: SidebarSection) => void;
  setOpenGroupId: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SidebarContext = createContext<SidebarContextValue | null>(null);

// ---------------------------------------------------------------------------
// localStorage helpers — graceful for SSR
// ---------------------------------------------------------------------------

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SidebarState>(() => ({
    isOpen: readLS("sidebar_open", "false") === "true",
    isPinned: readLS("sidebar_pinned", "false") === "true",
    activeSection: "chats" as SidebarSection,
    openGroupId: readLS("sidebar_open_group", "") || null,
  }));

  // Persist to localStorage whenever state changes
  const prevRef = useRef(state);
  useEffect(() => {
    const prev = prevRef.current;
    if (
      prev.isOpen !== state.isOpen ||
      prev.isPinned !== state.isPinned ||
      prev.activeSection !== state.activeSection ||
      prev.openGroupId !== state.openGroupId
    ) {
      writeLS("sidebar_open", String(state.isOpen));
      writeLS("sidebar_pinned", String(state.isPinned));
      writeLS("sidebar_section", state.activeSection);
      writeLS("sidebar_open_group", state.openGroupId ?? "");
      prevRef.current = state;
    }
  }, [state]);

  // Global ⇧⌘O shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "O") {
        e.preventDefault();
        setState((s) => ({ ...s, isOpen: !s.isOpen }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const open = useCallback(() => setState((s) => ({ ...s, isOpen: true })), []);
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);
  const toggle = useCallback(
    () => setState((s) => ({ ...s, isOpen: !s.isOpen })),
    [],
  );
  const pin = useCallback(() => setState((s) => ({ ...s, isPinned: true })), []);
  const unpin = useCallback(
    () => setState((s) => ({ ...s, isPinned: false })),
    [],
  );
  const setSection = useCallback(
    (section: SidebarSection) =>
      setState((s) => ({ ...s, activeSection: section })),
    [],
  );
  const setOpenGroupId = useCallback(
    (id: string | null) => setState((s) => ({ ...s, openGroupId: id })),
    [],
  );

  return (
    <SidebarContext.Provider
      value={{ ...state, open, close, toggle, pin, unpin, setSection, setOpenGroupId }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
