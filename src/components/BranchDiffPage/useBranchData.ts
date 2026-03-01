import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { Entry } from "@/lib/types";

export interface BranchGroup {
  branchName: string;
  entries: Entry[];
}

export interface DiffField {
  field: string;
  label: string;
  altValue: string;
  canonValue: string;
  changed: boolean;
}

export interface EntryDiff {
  alt: Entry;
  canon: Entry | null;
  fields: DiffField[];
}

const BRANCH_TAG_PREFIX = "branch:";

function extractBranchName(entry: Entry): string {
  const tag = entry.tags?.find((t) => t.startsWith(BRANCH_TAG_PREFIX));
  return tag ? tag.slice(BRANCH_TAG_PREFIX.length) : "Untagged";
}

const DIFF_FIELD_KEYS: Array<{ key: "name" | "summary" | "bodyMd"; label: string }> = [
  { key: "name", label: "Name" },
  { key: "summary", label: "Summary" },
  { key: "bodyMd", label: "Body" },
];

function stripBranchTags(tags: string[] | undefined): string[] {
  return (tags ?? []).filter((t) => !t.startsWith(BRANCH_TAG_PREFIX));
}

function computeDiff(alt: Entry, canon: Entry | null): DiffField[] {
  const scalar = DIFF_FIELD_KEYS.map(({ key, label }) => {
    const av = String(alt[key] ?? "");
    const cv = String(canon?.[key] ?? "");
    return { field: key, label, altValue: av, canonValue: cv, changed: av !== cv };
  });

  const altTags = stripBranchTags(alt.tags).join(", ") || "—";
  const canonTags = stripBranchTags(canon?.tags).join(", ") || "—";
  const altAliases = (alt.aliases ?? []).join(", ") || "—";
  const canonAliases = (canon?.aliases ?? []).join(", ") || "—";

  return [
    ...scalar,
    { field: "tags", label: "Tags", altValue: altTags, canonValue: canonTags, changed: altTags !== canonTags },
    { field: "aliases", label: "Aliases", altValue: altAliases, canonValue: canonAliases, changed: altAliases !== canonAliases },
  ];
}

export function useBranchData() {
  const store = useStore();
  const { libraryId } = useLibraryContext();
  const [branchGroups, setBranchGroups] = useState<BranchGroup[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    const raw = await store.listEntriesByUniverse(libraryId);
    const entries = raw as Entry[];
    setAllEntries(entries);

    const altEntries = entries.filter((e) => e.canonStatus === "alternate-branch");

    const groupMap = new Map<string, Entry[]>();
    for (const e of altEntries) {
      const name = extractBranchName(e);
      const bucket = groupMap.get(name) ?? [];
      bucket.push(e);
      groupMap.set(name, bucket);
    }

    const groups: BranchGroup[] = Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([branchName, es]) => ({
        branchName,
        entries: [...es].sort((a, b) => a.name.localeCompare(b.name)),
      }));

    setBranchGroups(groups);
    setSelectedBranch((prev) => prev ?? (groups[0]?.branchName ?? null));
  }, [store, libraryId]);

  useEffect(() => {
    if (loadedFor.current === libraryId) return;
    loadedFor.current = libraryId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [libraryId, load]);

  const getEntryDiff = useCallback(
    (alt: Entry): EntryDiff => {
      const canon =
        allEntries.find(
          (e) =>
            e.entryType === alt.entryType &&
            e.name.toLowerCase() === alt.name.toLowerCase() &&
            e.canonStatus !== "alternate-branch",
        ) ?? null;
      return { alt, canon, fields: computeDiff(alt, canon) };
    },
    [allEntries],
  );

  const promoteToCanon = useCallback(
    async (altId: string, retconCounterpart: boolean): Promise<void> => {
      const alt = allEntries.find((e) => e.id === altId);
      if (!alt) return;
      await store.updateEntry(altId, { canonStatus: "canon" });
      if (retconCounterpart) {
        const counterpart = allEntries.find(
          (e) =>
            e.entryType === alt.entryType &&
            e.name.toLowerCase() === alt.name.toLowerCase() &&
            e.canonStatus !== "alternate-branch" &&
            e.id !== altId,
        );
        if (counterpart) {
          await store.updateEntry(counterpart.id, { canonStatus: "retconned" });
        }
      }
      loadedFor.current = null;
      await load();
    },
    [store, allEntries, load],
  );

  const refresh = useCallback(() => {
    loadedFor.current = null;
    void load();
  }, [load]);

  const selectedEntry =
    branchGroups
      .find((g) => g.branchName === selectedBranch)
      ?.entries.find((e) => e.id === selectedEntryId) ?? null;

  return {
    branchGroups,
    selectedBranch,
    setSelectedBranch,
    selectedEntryId,
    setSelectedEntryId,
    selectedEntry,
    getEntryDiff,
    promoteToCanon,
    refresh,
  };
}
