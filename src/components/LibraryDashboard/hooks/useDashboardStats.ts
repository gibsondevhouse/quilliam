"use client";

import { useCallback, useEffect, useState } from "react";
import { applyCultureDetails, createDefaultCultureDetails } from "@/lib/domain/culture";
import { makeEntryId } from "@/lib/domain/entryUtils";
import type { Entry, EntryType, Story } from "@/lib/types";
import { useStore } from "@/lib/context/useStore";
import type { BookCardStat, ModuleStat } from "../types";
import { buildIssueHeatmap, newest } from "../dashboardUtils";

interface UseDashboardStatsParams {
  libraryId: string;
  stories: Story[];
}

interface UseDashboardStatsReturn {
  moduleStats: Record<string, ModuleStat>;
  bookCards: BookCardStat[];
  entryIndex: Entry[];
  reload: () => void;
}

export function useDashboardStats({
  libraryId,
  stories,
}: UseDashboardStatsParams): UseDashboardStatsReturn {
  const store = useStore();
  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStat>>({});
  const [bookCards, setBookCards] = useState<BookCardStat[]>([]);
  const [entryIndex, setEntryIndex] = useState<Entry[]>([]);

  const loadDashboardData = useCallback(async () => {
    const [
      characters, locations, cultures, religions, languages, economics,
      organizations, factions, lineages, items, rules, scenes, timeline,
      systems, suggestions, continuity, maps, media,
    ] = await Promise.all([
      store.queryEntriesByType("character"),
      store.queryEntriesByType("location"),
      store.queryEntriesByType("culture"),
      store.queryEntriesByType("religion"),
      store.queryEntriesByType("language"),
      store.queryEntriesByType("economy"),
      store.queryEntriesByType("organization"),
      store.queryEntriesByType("faction"),
      store.queryEntriesByType("lineage"),
      store.queryEntriesByType("item"),
      store.queryEntriesByType("rule"),
      store.queryEntriesByType("scene"),
      store.queryEntriesByType("timeline_event"),
      store.queryEntriesByType("system"),
      store.listSuggestionsByUniverse(libraryId),
      store.listContinuityIssuesByUniverse(libraryId),
      store.listMapsByUniverse(libraryId),
      store.listMediaByUniverse(libraryId),
    ]);

    const allEntries = [
      ...characters, ...locations, ...cultures, ...religions, ...languages,
      ...economics, ...organizations, ...factions, ...lineages, ...items,
      ...rules, ...scenes, ...timeline, ...systems,
    ];

    const openIssues = continuity.filter(
      (issue) => issue.status === "open" || issue.status === "in_review",
    );
    const issueHeat = buildIssueHeatmap(openIssues, allEntries);
    const relationCount = new Set(
      allEntries.flatMap((entry) => entry.relationships.map((rel) => rel.relationshipId)),
    ).size;

    setModuleStats({
      overview:           { count: 1,                    lastUpdated: newest(allEntries),   openIssues: issueHeat.overview ?? 0 },
      timeline:           { count: timeline.length,      lastUpdated: newest(timeline),     openIssues: issueHeat.timeline ?? 0 },
      cosmology:          { count: 1,                    lastUpdated: newest(rules),        openIssues: issueHeat.cosmology ?? 0 },
      systems:            { count: systems.length,       lastUpdated: newest(systems),      openIssues: issueHeat.systems ?? 0 },
      rules:              { count: rules.length,         lastUpdated: newest(rules),        openIssues: issueHeat.rules ?? 0 },
      laws:               { count: rules.length,         lastUpdated: newest(rules),        openIssues: issueHeat.laws ?? 0 },
      locations:          { count: locations.length,     lastUpdated: newest(locations),    openIssues: issueHeat.locations ?? 0 },
      cultures:           { count: cultures.length,      lastUpdated: newest(cultures),     openIssues: issueHeat.cultures ?? 0 },
      religions:          { count: religions.length,     lastUpdated: newest(religions),    openIssues: issueHeat.religions ?? 0 },
      languages:          { count: languages.length,     lastUpdated: newest(languages),    openIssues: issueHeat.languages ?? 0 },
      economics:          { count: economics.length,     lastUpdated: newest(economics),    openIssues: issueHeat.economics ?? 0 },
      organizations:      { count: organizations.length, lastUpdated: newest(organizations), openIssues: issueHeat.organizations ?? 0 },
      factions:           { count: factions.length,      lastUpdated: newest(factions),     openIssues: issueHeat.factions ?? 0 },
      conflicts: {
        count: openIssues.filter((i) => i.severity !== "note").length,
        lastUpdated: newest(openIssues),
        openIssues: issueHeat.conflicts ?? openIssues.length,
      },
      characters:         { count: characters.length,    lastUpdated: newest(characters),   openIssues: issueHeat.characters ?? 0 },
      lineages:           { count: lineages.length,      lastUpdated: newest(lineages),     openIssues: issueHeat.lineages ?? 0 },
      "relationship-web": { count: relationCount,        lastUpdated: newest(allEntries),   openIssues: issueHeat["relationship-web"] ?? 0 },
      items:              { count: items.length,         lastUpdated: newest(items),        openIssues: issueHeat.items ?? 0 },
      maps:               { count: maps.length,          lastUpdated: newest(maps),         openIssues: issueHeat.maps ?? 0 },
      media:              { count: media.length,         lastUpdated: newest(media),        openIssues: issueHeat.media ?? 0 },
      books: {
        count: stories.length,
        lastUpdated: newest(stories.map((s) => ({ updatedAt: s.createdAt }))),
        openIssues: issueHeat.books ?? 0,
      },
      scenes:      { count: scenes.length,       lastUpdated: newest(scenes),      openIssues: issueHeat.scenes ?? 0 },
      suggestions: {
        count: suggestions.filter((r) => r.status === "pending").length,
        lastUpdated: newest(suggestions),
        openIssues: issueHeat.suggestions ?? 0,
      },
      continuity:   { count: openIssues.length,  lastUpdated: newest(openIssues),  openIssues: openIssues.length },
      "change-log": { count: 0,                  lastUpdated: newest(allEntries),  openIssues: issueHeat["change-log"] ?? 0 },
    });

    const bookRows = await Promise.all(stories.map(async (story) => {
      const chapters = await store.listChaptersByBook(story.id);
      const sceneGroups = await Promise.all(chapters.map((ch) => store.listScenesByChapter(ch.id)));
      const scenesCount = sceneGroups.reduce((acc, g) => acc + g.length, 0);
      const lastEdited = Math.max(story.createdAt, ...chapters.map((c) => c.updatedAt), ...sceneGroups.flat().map((s) => s.updatedAt));
      return {
        id: story.id,
        title: story.title,
        status: story.status,
        chapters: chapters.length,
        scenes: scenesCount,
        lastEdited,
        notes: scenesCount === 0 ? "Outline in progress" : `${scenesCount} scene${scenesCount === 1 ? "" : "s"} drafted`,
      } satisfies BookCardStat;
    }));

    setBookCards(bookRows.sort((a, b) => b.lastEdited - a.lastEdited));
    setEntryIndex(allEntries.sort((a, b) => b.updatedAt - a.updatedAt));
  }, [libraryId, stories, store]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboardData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboardData]);

  return { moduleStats, bookCards, entryIndex, reload: loadDashboardData };
}

// ---- quickCreateEntry helper (used in QuickAdd) ----------------------------

export function useQuickCreate({
  libraryId,
  reload,
}: {
  libraryId: string;
  reload: () => void;
}) {
  const store = useStore();
  return useCallback(
    async (entryType: EntryType, label: string): Promise<string> => {
      const now = Date.now();
      const id = makeEntryId(entryType, `${label}-${now}`);
      const details = entryType === "culture"
        ? applyCultureDetails({}, createDefaultCultureDetails())
        : {};

      const entry: Entry = {
        id,
        universeId: libraryId,
        entryType,
        name: label,
        slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        summary: "",
        bodyMd: "",
        canonStatus: "draft",
        visibility: "private",
        details,
        type: entryType,
        status: "draft",
        sources: [],
        relationships: [],
        lastVerified: 0,
        createdAt: now,
        updatedAt: now,
      };

      await store.addEntry(entry);
      reload();
      return id;
    },
    [libraryId, store, reload],
  );
}
