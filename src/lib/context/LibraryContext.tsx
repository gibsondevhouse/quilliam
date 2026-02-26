"use client";

import { createContext, useContext, type RefObject } from "react";
import type { CharacterEntry, LocationEntry, WorldEntry, ChatSession, ChatMessageEntry, Story } from "@/lib/types";
import type { EditorTab } from "@/components/Editor/TabBar";
import type { RAGStore } from "@/lib/rag/store";

export interface LibraryContextValue {
  libraryId: string;
  libraryTitle: string;
  libraryDescription: string;
  libraryStatus: "drafting" | "editing" | "archived";
  setLibraryTitle: (title: string) => void;
  setLibraryDescription: (desc: string) => void;
  setLibraryStatus: (status: "drafting" | "editing" | "archived") => void;

  // Stories (Library → Story → Chapter)
  stories: Story[];
  activeStoryId: string | null;
  addStory: () => Story;
  selectStory: (id: string) => void;
  updateStory: (entry: Story) => void;
  deleteStory: (id: string) => void;

  // Characters
  characters: CharacterEntry[];
  activeCharacterId: string | null;
  addCharacter: () => CharacterEntry;
  selectCharacter: (id: string) => void;
  updateCharacter: (entry: CharacterEntry) => void;
  deleteCharacter: (id: string) => void;

  // Locations
  locations: LocationEntry[];
  activeLocationId: string | null;
  addLocation: () => LocationEntry;
  selectLocation: (id: string) => void;
  updateLocation: (entry: LocationEntry) => void;
  deleteLocation: (id: string) => void;

  // World entries
  worldEntries: WorldEntry[];
  activeWorldEntryId: string | null;
  addWorldEntry: () => WorldEntry;
  selectWorldEntry: (id: string) => void;
  updateWorldEntry: (entry: WorldEntry) => void;
  deleteWorldEntry: (id: string) => void;

  // Chat / Threads
  chats: ChatSession[];
  activeChatId: string | null;
  chatMessages: Record<string, ChatMessageEntry[]>;
  addChat: () => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  updateChatMessages: (chatId: string, messages: ChatMessageEntry[]) => void;
  setBottomPanelOpen: (open: boolean) => void;
  bottomPanelOpen: boolean;
  chatPanelWidth: number;
  setChatPanelWidth: (w: number) => void;

  // Editor tabs (chapter/character/location/world)
  openTabs: EditorTab[];
  activeTabId: string | null;
  openTab: (tab: EditorTab) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateTabTitle: (id: string, title: string) => void;

  // Document contents (chapter content cache)
  docContents: Record<string, { title: string; content: string }>;
  dirtyIds: Set<string>;
  initDoc: (id: string, title: string, content: string) => void;
  handleContentChange: (chapterId: string, content: string) => void;
  handleTitleChange: (chapterId: string, title: string) => void;

  // RAG
  buildContext: (query: string) => Promise<string>;
  storeRef: RefObject<RAGStore | null>;
  workerRef: RefObject<Worker | null>;
  storeReady: boolean;
  indexingCount: number;
}

export const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryContext must be used within a LibraryLayout");
  return ctx;
}
