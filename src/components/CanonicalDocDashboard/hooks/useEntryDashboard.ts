"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyCultureDetails, createDefaultCultureDetails } from "@/lib/domain/culture";
import type { Entry, EntryPatch, EntryType } from "@/lib/types";
import { useStore } from "@/lib/context/useStore";
import type { DocFormSaveFields } from "../types";
import { makeDocId, makePatchId } from "../cultureFormHelpers";

type CanonStatus =
  | "all"
  | "draft"
  | "proposed"
  | "canon"
  | "deprecated"
  | "retconned"
  | "alternate-branch";

interface UseEntryDashboardParams {
  libraryId: string;
  type: EntryType;
  title: string;
  highlightId: string | null;
}

interface UseEntryDashboardReturn {
  docs: Entry[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  loading: boolean;
  statusFilter: CanonStatus;
  setStatusFilter: (v: CanonStatus) => void;
  sortOrder: "name" | "updated";
  setSortOrder: (v: "name" | "updated") => void;
  displayedDocs: Entry[];
  activeDoc: Entry | null;
  handleAdd: () => void;
  handleSave: (fields: DocFormSaveFields) => void;
  handleDelete: (id: string) => void;
}

export function useEntryDashboard({
  libraryId,
  type,
  title,
  highlightId,
}: UseEntryDashboardParams): UseEntryDashboardReturn {
  const store = useStore();
  const [docs, setDocs] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const [statusFilter, setStatusFilter] = useState<CanonStatus>("all");
  const [sortOrder, setSortOrder] = useState<"name" | "updated">("name");

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const entries = await store.queryEntriesByType(type);
      const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
      setDocs(sorted);
      setLoading(false);
      if (highlightId && sorted.some((d) => d.id === highlightId)) {
        setActiveId(highlightId);
      }
    })();
  }, [store, type, highlightId]);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeId) ?? null,
    [docs, activeId],
  );

  const displayedDocs = useMemo(() => {
    const filtered = statusFilter === "all"
      ? docs
      : docs.filter((d) => d.canonStatus === statusFilter);
    return [...filtered].sort((a, b) =>
      sortOrder === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt - a.updatedAt,
    );
  }, [docs, statusFilter, sortOrder]);

  const handleAdd = useCallback(async () => {
    const name = `New ${title.replace(/s$/, "")}`;
    const now = Date.now();
    const details = type === "culture"
      ? applyCultureDetails({}, createDefaultCultureDetails())
      : {};

    const doc: Entry = {
      id: makeDocId(type, `${name}-${now}`),
      universeId: libraryId,
      entryType: type,
      type,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      summary: "",
      bodyMd: "",
      canonStatus: "draft",
      visibility: "private",
      details,
      status: "draft",
      sources: [],
      relationships: [],
      lastVerified: 0,
      createdAt: now,
      updatedAt: now,
    };

    await store.addEntry(doc);
    setDocs((prev) => [...prev, doc].sort((a, b) => a.name.localeCompare(b.name)));
    setActiveId(doc.id);
  }, [libraryId, store, title, type]);

  const handleSave = useCallback(async (fields: DocFormSaveFields) => {
    if (!activeId) return;
    const prev = docs.find((d) => d.id === activeId);
    if (!prev) return;

    const ops: EntryPatch["operations"] = [];
    if (fields.name !== prev.name) ops.push({ op: "update-entry", entryId: activeId, field: "name", oldValue: prev.name, newValue: fields.name });
    if (fields.summary !== prev.summary) ops.push({ op: "update-entry", entryId: activeId, field: "summary", oldValue: prev.summary, newValue: fields.summary });
    if (fields.bodyMd !== (prev.bodyMd ?? "")) ops.push({ op: "update-entry", entryId: activeId, field: "bodyMd", oldValue: prev.bodyMd ?? "", newValue: fields.bodyMd });
    if (JSON.stringify(fields.details) !== JSON.stringify(prev.details)) ops.push({ op: "update-entry", entryId: activeId, field: "details", oldValue: prev.details, newValue: fields.details });
    if (ops.length === 0) return;

    const patch: EntryPatch = {
      id: makePatchId(),
      status: "pending",
      operations: ops,
      sourceRef: { kind: "manual", id: activeId },
      confidence: 1,
      autoCommit: false,
      createdAt: Date.now(),
    };

    await store.addEntryPatch(patch);
    await store.addPatch(patch);
    const now = Date.now();
    setDocs((prevDocs) =>
      prevDocs.map((d) =>
        d.id === activeId
          ? {
              ...d,
              ...fields,
              slug: fields.name
                ? fields.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
                : d.slug,
              updatedAt: now,
            }
          : d,
      ),
    );
  }, [activeId, docs, store]);

  const handleDelete = useCallback(async (id: string) => {
    await store.deleteEntry(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId, store]);

  return {
    docs,
    activeId,
    setActiveId,
    loading,
    statusFilter,
    setStatusFilter,
    sortOrder,
    setSortOrder,
    displayedDocs,
    activeDoc,
    handleAdd: () => { void handleAdd(); },
    handleSave: (fields) => { void handleSave(fields); },
    handleDelete: (id) => { void handleDelete(id); },
  };
}
