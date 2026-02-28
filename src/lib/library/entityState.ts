import { useCallback, useState } from "react";
import type { CharacterEntry, LocationEntry, WorldEntry } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";

function generateId() {
  return crypto.randomUUID();
}

interface UseEntityStateParams {
  libraryId: string;
  store: RAGStore | null;
}

export function useEntityState({ libraryId, store }: UseEntityStateParams) {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  const addCharacter = useCallback((): CharacterEntry => {
    const id = generateId();
    const entry: CharacterEntry = { id, libraryId, name: "", role: "", notes: "" };
    setCharacters((prev) => [...prev, entry]);
    setActiveCharacterId(id);
    void store?.putCharacter({ ...entry, updatedAt: Date.now() });
    return entry;
  }, [libraryId, store]);

  const selectCharacter = useCallback((id: string) => {
    setActiveCharacterId(id);
  }, []);

  const updateCharacter = useCallback(
    (entry: CharacterEntry) => {
      setCharacters((prev) => prev.map((character) => (character.id === entry.id ? entry : character)));
      void store?.putCharacter({ ...entry, updatedAt: Date.now() });
    },
    [store],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      setCharacters((prev) => prev.filter((character) => character.id !== id));
      if (activeCharacterId === id) setActiveCharacterId(null);
      void store?.deleteCharacter(id);
    },
    [activeCharacterId, store],
  );

  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const addLocation = useCallback((): LocationEntry => {
    const id = generateId();
    const entry: LocationEntry = { id, libraryId, name: "", description: "" };
    setLocations((prev) => [...prev, entry]);
    setActiveLocationId(id);
    void store?.putLocation({ ...entry, updatedAt: Date.now() });
    return entry;
  }, [libraryId, store]);

  const selectLocation = useCallback((id: string) => {
    setActiveLocationId(id);
  }, []);

  const updateLocation = useCallback(
    (entry: LocationEntry) => {
      setLocations((prev) => prev.map((location) => (location.id === entry.id ? entry : location)));
      void store?.putLocation({ ...entry, updatedAt: Date.now() });
    },
    [store],
  );

  const deleteLocation = useCallback(
    (id: string) => {
      setLocations((prev) => prev.filter((location) => location.id !== id));
      if (activeLocationId === id) setActiveLocationId(null);
      void store?.deleteLocation(id);
    },
    [activeLocationId, store],
  );

  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([]);
  const [activeWorldEntryId, setActiveWorldEntryId] = useState<string | null>(null);

  const addWorldEntry = useCallback((): WorldEntry => {
    const id = generateId();
    const entry: WorldEntry = { id, libraryId, title: "", category: "", notes: "" };
    setWorldEntries((prev) => [...prev, entry]);
    setActiveWorldEntryId(id);
    void store?.putWorldEntry({ ...entry, updatedAt: Date.now() });
    return entry;
  }, [libraryId, store]);

  const selectWorldEntry = useCallback((id: string) => {
    setActiveWorldEntryId(id);
  }, []);

  const updateWorldEntry = useCallback(
    (entry: WorldEntry) => {
      setWorldEntries((prev) => prev.map((world) => (world.id === entry.id ? entry : world)));
      void store?.putWorldEntry({ ...entry, updatedAt: Date.now() });
    },
    [store],
  );

  const deleteWorldEntry = useCallback(
    (id: string) => {
      setWorldEntries((prev) => prev.filter((world) => world.id !== id));
      if (activeWorldEntryId === id) setActiveWorldEntryId(null);
      void store?.deleteWorldEntry(id);
    },
    [activeWorldEntryId, store],
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
