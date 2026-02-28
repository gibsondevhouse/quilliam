import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { applyEdits, fileTargetKey, type ChangeSet } from "@/lib/changeSets";
import type { RAGStore } from "@/lib/rag/store";
import type { CharacterEntry, LocationEntry, WorldEntry } from "@/lib/types";

interface UseChangeSetMachineParams {
  activeTabId: string | null;
  docContents: Record<string, { title: string; content: string }>;
  setDocContents: Dispatch<SetStateAction<Record<string, { title: string; content: string }>>>;
  setWorkingContents: Dispatch<SetStateAction<Record<string, string>>>;
  characters: CharacterEntry[];
  setCharacters: Dispatch<SetStateAction<CharacterEntry[]>>;
  locations: LocationEntry[];
  setLocations: Dispatch<SetStateAction<LocationEntry[]>>;
  worldEntries: WorldEntry[];
  setWorldEntries: Dispatch<SetStateAction<WorldEntry[]>>;
  store: RAGStore | null;
}

export function useChangeSetMachine(params: UseChangeSetMachineParams) {
  const {
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
  } = params;

  const [changeSets, setChangeSets] = useState<Record<string, ChangeSet[]>>({});
  const [entityDrafts, setEntityDrafts] = useState<Record<string, string>>({});

  const resolveEntityBaseText = useCallback(
    (key: string): string => {
      if (key.startsWith("character:")) {
        const name = key.slice("character:".length);
        return characters.find((c) => c.name.trim().toLowerCase() === name)?.notes ?? "";
      }
      if (key.startsWith("location:")) {
        const name = key.slice("location:".length);
        return locations.find((l) => l.name.trim().toLowerCase() === name)?.description ?? "";
      }
      if (key.startsWith("world:")) {
        const title = key.slice("world:".length);
        return worldEntries.find((w) => w.title.trim().toLowerCase() === title)?.notes ?? "";
      }
      return "";
    },
    [characters, locations, worldEntries],
  );

  const commitEntityDraft = useCallback(
    (key: string) => {
      const draft = entityDrafts[key];
      if (draft === undefined) return;
      const now = Date.now();

      if (key.startsWith("character:")) {
        const name = key.slice("character:".length);
        setCharacters((prev) =>
          prev.map((character) => {
            if (character.name.trim().toLowerCase() !== name) return character;
            const updated = { ...character, notes: draft };
            void store?.putCharacter({ ...updated, updatedAt: now });
            return updated;
          }),
        );
      } else if (key.startsWith("location:")) {
        const name = key.slice("location:".length);
        setLocations((prev) =>
          prev.map((location) => {
            if (location.name.trim().toLowerCase() !== name) return location;
            const updated = { ...location, description: draft };
            void store?.putLocation({ ...updated, updatedAt: now });
            return updated;
          }),
        );
      } else if (key.startsWith("world:")) {
        const title = key.slice("world:".length);
        setWorldEntries((prev) =>
          prev.map((entry) => {
            if (entry.title.trim().toLowerCase() !== title) return entry;
            const updated = { ...entry, notes: draft };
            void store?.putWorldEntry({ ...updated, updatedAt: now });
            return updated;
          }),
        );
      }

      setEntityDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [entityDrafts, setCharacters, setLocations, setWorldEntries, store],
  );

  const revertEntityDraft = useCallback((key: string) => {
    setEntityDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const applyIncomingEdit = useCallback(
    (changeSet: ChangeSet) => {
      const key = fileTargetKey(changeSet.fileTarget);

      setChangeSets((prev) => {
        const list = prev[key] ?? [];
        return { ...prev, [key]: [...list, changeSet] };
      });

      if (key === "__active__" && activeTabId) {
        setWorkingContents((prev) => {
          const base = prev[activeTabId] ?? docContents[activeTabId]?.content ?? "";
          return { ...prev, [activeTabId]: applyEdits(base, changeSet.edits) };
        });
      } else {
        setEntityDrafts((prev) => {
          const base = prev[key] ?? resolveEntityBaseText(key);
          return { ...prev, [key]: applyEdits(base, changeSet.edits) };
        });
      }
    },
    [activeTabId, docContents, resolveEntityBaseText, setWorkingContents],
  );

  const acceptChange = useCallback(
    (changeSetId: string) => {
      let acceptedKey: string | null = null;
      setChangeSets((prev) => {
        const next: Record<string, ChangeSet[]> = {};
        for (const [key, list] of Object.entries(prev)) {
          const matched = list.find((changeSet) => changeSet.id === changeSetId);
          if (matched) {
            acceptedKey = key;
            if (key === "__active__" && activeTabId) {
              // Commit ONLY the accepted edit to docContents (not all pending),
              // then rebuild workingContents from remaining pending on the new base.
              setDocContents((currentDoc) => {
                const oldBase = currentDoc[activeTabId]?.content ?? "";
                const newBase = applyEdits(oldBase, matched.edits);
                const remaining = list.filter(
                  (cs) => cs.id !== changeSetId && cs.status === "pending",
                );
                const rebuilt = remaining.reduce(
                  (acc, cs) => applyEdits(acc, cs.edits),
                  newBase,
                );
                setWorkingContents((wc) => ({ ...wc, [activeTabId]: rebuilt }));
                return {
                  ...currentDoc,
                  [activeTabId]: { ...currentDoc[activeTabId], content: newBase },
                };
              });
            }
            next[key] = list.map((changeSet) =>
              changeSet.id === changeSetId
                ? { ...changeSet, status: "accepted" as const }
                : changeSet,
            );
          } else {
            next[key] = list;
          }
        }
        return next;
      });
      if (acceptedKey && acceptedKey !== "__active__") {
        commitEntityDraft(acceptedKey);
      }
    },
    [activeTabId, commitEntityDraft, setDocContents, setWorkingContents],
  );

  const rejectChange = useCallback(
    (changeSetId: string) => {
      let targetKey: string | null = null;
      let updatedList: ChangeSet[] = [];
      setChangeSets((prev) => {
        const next: Record<string, ChangeSet[]> = {};
        for (const [key, list] of Object.entries(prev)) {
          if (list.some((changeSet) => changeSet.id === changeSetId)) {
            const updated = list.map((changeSet) =>
              changeSet.id === changeSetId
                ? { ...changeSet, status: "rejected" as const }
                : changeSet,
            );
            targetKey = key;
            updatedList = updated;
            if (key === "__active__" && activeTabId) {
              const base = docContents[activeTabId]?.content ?? "";
              const remaining = updated.filter((changeSet) => changeSet.status === "pending");
              const rebuilt = remaining.reduce(
                (accumulator, changeSet) => applyEdits(accumulator, changeSet.edits),
                base,
              );
              setWorkingContents((currentWorking) => ({
                ...currentWorking,
                [activeTabId]: rebuilt,
              }));
            }
            next[key] = updated;
          } else {
            next[key] = list;
          }
        }
        return next;
      });

      if (targetKey && targetKey !== "__active__") {
        const remaining = updatedList.filter((changeSet) => changeSet.status === "pending");
        if (remaining.length === 0) {
          revertEntityDraft(targetKey);
        } else {
          const base = resolveEntityBaseText(targetKey);
          const rebuilt = remaining.reduce(
            (accumulator, changeSet) => applyEdits(accumulator, changeSet.edits),
            base,
          );
          setEntityDrafts((prev) => ({ ...prev, [targetKey!]: rebuilt }));
        }
      }
    },
    [activeTabId, docContents, resolveEntityBaseText, revertEntityDraft, setWorkingContents],
  );

  const acceptAllChanges = useCallback(
    (key: string) => {
      setChangeSets((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((changeSet) =>
          changeSet.status === "pending"
            ? { ...changeSet, status: "accepted" as const }
            : changeSet,
        ),
      }));
      if (key === "__active__" && activeTabId) {
        setWorkingContents((currentWorking) => {
          const committed = currentWorking[activeTabId];
          if (committed !== undefined) {
            setDocContents((currentDoc) => ({
              ...currentDoc,
              [activeTabId]: { ...currentDoc[activeTabId], content: committed },
            }));
          }
          return currentWorking;
        });
      }
      if (key !== "__active__") commitEntityDraft(key);
    },
    [activeTabId, commitEntityDraft, setDocContents, setWorkingContents],
  );

  const rejectAllChanges = useCallback(
    (key: string) => {
      setChangeSets((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((changeSet) =>
          changeSet.status === "pending"
            ? { ...changeSet, status: "rejected" as const }
            : changeSet,
        ),
      }));
      if (key === "__active__" && activeTabId) {
        setWorkingContents((currentWorking) => ({
          ...currentWorking,
          [activeTabId]: docContents[activeTabId]?.content ?? "",
        }));
      }
      if (key !== "__active__") revertEntityDraft(key);
    },
    [activeTabId, docContents, revertEntityDraft, setWorkingContents],
  );

  return {
    changeSets,
    entityDrafts,
    applyIncomingEdit,
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
    commitEntityDraft,
    revertEntityDraft,
  };
}
