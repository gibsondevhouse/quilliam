"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pathForEntryType } from "@/lib/domain/entryUtils";
import type { Entry } from "@/lib/types";
import type { BookCardStat, SearchItem } from "../types";
import { STATUS_LABELS } from "../types";
import { MODULE_SECTIONS } from "../moduleSections";

interface UseCommandPaletteParams {
  libraryId: string;
  bookCards: BookCardStat[];
  entryIndex: Entry[];
}

export function useCommandPalette({ libraryId, bookCards, entryIndex }: UseCommandPaletteParams) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Escape listener
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setSearchQuery("");
        setSelectedSearchIndex(0);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Auto-focus input when palette opens
  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => { searchInputRef.current?.focus(); }, 0);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  const searchItems = useMemo<SearchItem[]>(() => {
    const moduleItems = MODULE_SECTIONS.flatMap((section) =>
      section.cards.map((card) => ({
        id: `module:${card.key}`,
        label: card.label,
        hint: section.label,
        icon: card.icon,
        href: `/library/${libraryId}/${card.path}`,
      })),
    );
    const bookItems = bookCards.map((book) => ({
      id: `book:${book.id}`,
      label: book.title,
      hint: `Book · ${STATUS_LABELS[book.status]}`,
      icon: "📖",
      href: `/library/${libraryId}/books/${book.id}`,
    }));
    const entryItems = entryIndex.slice(0, 400).map((entry) => ({
      id: `entry:${entry.id}`,
      label: entry.name || "Unnamed Entry",
      hint: `${entry.entryType.replace(/_/g, " ")} · ${entry.canonStatus}`,
      icon: "•",
      href: `/library/${libraryId}/${pathForEntryType(entry.entryType)}?highlight=${entry.id}`,
    }));
    return [...moduleItems, ...bookItems, ...entryItems];
  }, [bookCards, entryIndex, libraryId]);

  const filteredSearchItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchItems.slice(0, 30);
    return searchItems
      .filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query))
      .slice(0, 30);
  }, [searchItems, searchQuery]);

  const handleSearchSelect = useCallback((item: SearchItem) => {
    setSearchOpen(false);
    setSearchQuery("");
    if (item.onSelect) { item.onSelect(); return; }
    if (item.href) router.push(item.href);
  }, [router]);

  const openPalette = useCallback(() => {
    setSearchOpen(true);
    setSearchQuery("");
    setSelectedSearchIndex(0);
  }, []);

  return {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    selectedSearchIndex,
    setSelectedSearchIndex,
    searchInputRef,
    filteredSearchItems,
    handleSearchSelect,
    openPalette,
  };
}
