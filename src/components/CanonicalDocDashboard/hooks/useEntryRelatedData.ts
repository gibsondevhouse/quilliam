"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { CultureMembership, CultureMembershipKind, EntryType } from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";
import type { CultureMemberRow, SceneAppearanceRow, LinkedCultureRow } from "../types";

interface UseEntryRelatedDataParams {
  activeId: string | null;
  storeRef: RefObject<RAGStore | null>;
  storeReady: boolean;
  type: EntryType;
}

interface UseEntryRelatedDataReturn {
  members: CultureMemberRow[];
  appearances: SceneAppearanceRow[];
  linkedCultures: LinkedCultureRow[];
  handleAddMember: (characterEntryId: string, kind: CultureMembershipKind) => void;
  handleRemoveMember: (membershipId: string) => void;
}

export function useEntryRelatedData({
  activeId,
  storeRef,
  storeReady,
  type,
}: UseEntryRelatedDataParams): UseEntryRelatedDataReturn {
  const [members, setMembers] = useState<CultureMemberRow[]>([]);
  const [appearances, setAppearances] = useState<SceneAppearanceRow[]>([]);
  const [linkedCultures, setLinkedCultures] = useState<LinkedCultureRow[]>([]);

  useEffect(() => {
    if (!activeId || !storeReady) return;
    const store = storeRef.current;
    if (!store) return;
    void (async () => {
      if (type === "culture") {
        const memberships = await store.listCultureMembershipsByCulture(activeId);
        const rows = await Promise.all(
          memberships.map(async (m) => {
            const charEntry = await store.getEntryById(m.characterEntryId);
            return { membership: m, characterName: charEntry?.name ?? m.characterEntryId };
          }),
        );
        setMembers(rows);
      } else if (type === "character") {
        const mentions = await store.listMentionsByEntry(activeId);
        const rows = await Promise.all(
          mentions.map(async (m) => {
            const node = await store.getNode(m.sceneId);
            return {
              sceneId: m.sceneId,
              sceneTitle: node?.title || m.sceneId,
              mentionType: m.mentionType,
            };
          }),
        );
        const seen = new Set<string>();
        const deduped = rows.filter((r) => {
          if (seen.has(r.sceneId)) return false;
          seen.add(r.sceneId);
          return true;
        });
        setAppearances(deduped);
      } else if (type === "location") {
        const allCultures = await store.queryEntriesByType("culture");
        const linked = allCultures.filter((c) => {
          const d = c.details as { homelandDiaspora?: { homelandLocationEntryId?: string } };
          return d?.homelandDiaspora?.homelandLocationEntryId === activeId;
        });
        setLinkedCultures(linked.map((c) => ({ entryId: c.id, name: c.name })));
      }
    })();
  }, [activeId, storeReady, storeRef, type]);

  const handleAddMember = useCallback(async (
    characterEntryId: string,
    kind: CultureMembershipKind,
  ) => {
    if (!activeId) return;
    const store = storeRef.current;
    if (!store) return;
    const now = Date.now();
    const membership: CultureMembership = {
      id: `cmem_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      cultureEntryId: activeId,
      characterEntryId,
      membershipKind: kind,
      createdAt: now,
      updatedAt: now,
    };
    await store.putCultureMembership(membership);
    const charEntry = await store.getEntryById(characterEntryId);
    setMembers((prev) => [
      ...prev,
      { membership, characterName: charEntry?.name ?? characterEntryId },
    ]);
  }, [activeId, storeRef]);

  const handleRemoveMember = useCallback((_membershipId: string) => {
    setMembers((prev) => prev.filter((r) => r.membership.id !== _membershipId));
  }, []);

  return {
    members,
    appearances,
    linkedCultures,
    handleAddMember: (charId, kind) => { void handleAddMember(charId, kind); },
    handleRemoveMember,
  };
}
