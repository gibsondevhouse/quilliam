import { useCallback, useState } from "react";
import type { RefObject } from "react";
import type { CharacterEntry, LocationEntry, WorldEntry } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";

function generateId() {
  return crypto.randomUUID();
}

interface UseEntityStateParams {
  libraryId: string;
  storeRef: RefObject<RAGStore | null>;
}

export function useEntityState({ libraryId, storeRef }: UseEntityStateParams) {
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

  const updateCharacter = useCallback(
    (entry: CharacterEntry) => {
      setCharacters((prev) => prev.map((character) => (character.id === entry.id ? entry : character)));
      void storeRef.current?.putCharacter({ ...entry, updatedAt: Date.now() });
    },
    [storeRef],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      setCharacters((prev) => prev.filter((character) => character.id !== id));
      if (activeCharacterId === id) setActiveCharacterId(null);
      void storeRef.current?.deleteCharacter(id);
    },
    [activeCharacterId, storeRef],
  );

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

  const selectLocation = useCallback((id: string) => {
    setActiveLocationId(id);
  }, []);

  const updateLocation = useCallback(
    (entry: LocationEntry) => {
      setLocations((prev) => prev.map((location) => (location.id === entry.id ? entry : location)));
      void storeRef.current?.putLocation({ ...entry, updatedAt: Date.now() });
    },
    [storeRef],
  );

  const deleteLocation = useCallback(
    (id: string) => {
      setLocations((prev) => prev.filter((location) => location.id !== id));
      if (activeLocationId === id) setActiveLocationId(null);
      void storeRef.current?.deleteLocation(id);
    },
    [activeLocationId, storeRef],
  );

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

  const selectWorldEntry = useCallback((id: string) => {
    setActiveWorldEntryId(id);
  }, []);

  const updateWorldEntry = useCallback(
    (entry: WorldEntry) => {
      setWorldEntries((prev) => prev.map((world) => (world.id === entry.id ? entry : world)));
      void storeRef.current?.putWorldEntry({ ...entry, updatedAt: Date.now() });
    },
    [storeRef],
  );

  const deleteWorldEntry = useCallback(
    (id: string) => {
      setWorldEntries((prev) => prev.filter((world) => world.id !== id));
      if (activeWorldEntryId === id) setActiveWorldEntryId(null);
      void storeRef.current?.deleteWorldEntry(id);
    },
    [activeWorldEntryId, storeRef],
  );

  return {
    characters,
    setCharacters,
    activeCharacterId,
    setActiveCharacterId,
    addCharacter,
    selectCharacter,
    updateCharacter,
    deleteCharacter,
    locations,
    setLocations,
    activeLocationId,
    setActiveLocationId,
    addLocation,
    selectLocation,
    updateLocation,
    deleteLocation,
    worldEntries,
    setWorldEntries,
    activeWorldEntryId,
    setActiveWorldEntryId,
    addWorldEntry,
    selectWorldEntry,
    updateWorldEntry,
    deleteWorldEntry,
  };
}
