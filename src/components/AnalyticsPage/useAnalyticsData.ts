import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { Entry, EntryType } from "@/lib/types";

export interface EntryTypeStat {
  type: EntryType;
  total: number;
  canon: number;
  draft: number;
  proposed: number;
  other: number;
}

export interface OrphanedEntry {
  entry: Entry;
  relations: number;
  mentions: number;
}

export interface UnanchoredCharacter {
  entry: Entry;
  hasCultureMembership: boolean;
  hasOrgMembership: boolean;
}

export interface UnusedOrg {
  entry: Entry;
  memberCount: number;
}

export interface UncitedRule {
  entry: Entry;
  mentionCount: number;
}

export interface ManuscriptStats {
  bookCount: number;
  chapterCount: number;
  sceneCount: number;
  scenesWithPov: number;
  scenesWithoutPov: number;
}

export interface AnalyticsData {
  totalEntries: number;
  byType: EntryTypeStat[];
  canonRate: number;
  orphanedEntries: OrphanedEntry[];
  unanchoredCharacters: UnanchoredCharacter[];
  unusedOrgs: UnusedOrg[];
  uncitedRules: UncitedRule[];
  manuscript: ManuscriptStats;
}

export function useAnalyticsData() {
  const store = useStore();
  const { libraryId } = useLibraryContext();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const compute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ── 1. Load all entries ──────────────────────────────────────────────
      const entries = await store.listEntriesByUniverse(libraryId);
      const totalEntries = entries.length;

      // ── 2. By-type breakdown ─────────────────────────────────────────────
      const typeMap = new Map<EntryType, EntryTypeStat>();
      for (const e of entries) {
        const t = e.entryType ?? e.type ?? ("unknown" as EntryType);
        let stat = typeMap.get(t);
        if (!stat) {
          stat = { type: t, total: 0, canon: 0, draft: 0, proposed: 0, other: 0 };
          typeMap.set(t, stat);
        }
        stat.total++;
        if (e.canonStatus === "canon") stat.canon++;
        else if (e.canonStatus === "draft") stat.draft++;
        else if (e.canonStatus === "proposed") stat.proposed++;
        else stat.other++;
      }
      const byType = [...typeMap.values()].sort((a, b) => b.total - a.total);
      const canonRate =
        totalEntries > 0
          ? Math.round((byType.reduce((s, t) => s + t.canon, 0) / totalEntries) * 100)
          : 0;

      // ── 3. Orphaned entries (0 relations + 0 mentions) ───────────────────
      const orphanedEntries: OrphanedEntry[] = [];
      const CORE_TYPES = new Set<EntryType>([
        "character", "location", "culture", "organization", "system",
        "item", "language", "religion", "lineage", "economy", "rule",
      ]);
      const coreEntries = entries.filter((e) => CORE_TYPES.has(e.entryType ?? e.type as EntryType));

      const [allRelSets, allMentionSets] = await Promise.all([
        Promise.all(coreEntries.map((e) => store.getEntryRelationsForEntry(e.id))),
        Promise.all(coreEntries.map((e) => store.listMentionsByEntry(e.id))),
      ]);
      for (let i = 0; i < coreEntries.length; i++) {
        const rels = allRelSets[i].length;
        const mentions = allMentionSets[i].length;
        if (rels === 0 && mentions === 0) {
          orphanedEntries.push({ entry: coreEntries[i], relations: rels, mentions });
        }
      }

      // ── 4. Unanchored characters ─────────────────────────────────────────
      const characters = entries.filter((e) => (e.entryType ?? e.type) === "character");
      const [charCultureMembs, charOrgMembs] = await Promise.all([
        Promise.all(characters.map((c) => store.listCultureMembershipsByCharacter(c.id))),
        Promise.all(characters.map((c) => store.listMembershipsByCharacter(c.id))),
      ]);
      const unanchoredCharacters: UnanchoredCharacter[] = [];
      for (let i = 0; i < characters.length; i++) {
        const hasCultureMembership = charCultureMembs[i].length > 0;
        const hasOrgMembership = charOrgMembs[i].length > 0;
        if (!hasCultureMembership || !hasOrgMembership) {
          unanchoredCharacters.push({ entry: characters[i], hasCultureMembership, hasOrgMembership });
        }
      }

      // ── 5. Unused organizations (0 character members) ────────────────────
      const orgs = entries.filter((e) => ["organization", "faction"].includes(e.entryType ?? e.type as string));
      const orgMembs = await Promise.all(orgs.map((o) => store.listMembershipsByOrganization(o.id)));
      const unusedOrgs: UnusedOrg[] = orgs
        .map((o, i) => ({ entry: o, memberCount: orgMembs[i].length }))
        .filter((r) => r.memberCount === 0);

      // ── 6. Uncited rules (0 scene mentions) ──────────────────────────────
      const rules = entries.filter((e) => (e.entryType ?? e.type) === "rule");
      const ruleMentions = await Promise.all(rules.map((r) => store.listMentionsByEntry(r.id)));
      const uncitedRules: UncitedRule[] = rules
        .map((r, i) => ({ entry: r, mentionCount: ruleMentions[i].length }))
        .filter((r) => r.mentionCount === 0);

      // ── 7. Manuscript stats ───────────────────────────────────────────────
      const books = await store.listBooksByUniverse(libraryId);
      let chapterCount = 0;
      let sceneCount = 0;
      let scenesWithPov = 0;
      for (const book of books) {
        const chapters = await store.listChaptersByBook(book.id);
        chapterCount += chapters.length;
        for (const ch of chapters) {
          const scenes = await store.listScenesByChapter(ch.id);
          sceneCount += scenes.length;
          scenesWithPov += scenes.filter((s) => s.povCharacterEntryId).length;
        }
      }

      setData({
        totalEntries,
        byType,
        canonRate,
        orphanedEntries,
        unanchoredCharacters,
        unusedOrgs,
        uncitedRules,
        manuscript: {
          bookCount: books.length,
          chapterCount,
          sceneCount,
          scenesWithPov,
          scenesWithoutPov: sceneCount - scenesWithPov,
        },
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [store, libraryId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void compute();
  }, [compute]);

  return { data, loading, error, refresh: () => { loadedRef.current = false; void compute(); } };
}
