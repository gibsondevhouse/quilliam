import type {
  PersistedCultureMembership,
  PersistedCultureVersion,
  PersistedItemOwnership,
  PersistedMembership,
  PersistedMention,
  PersistedOrganizationVersion,
  PersistedRelationship,
  PersistedReligionVersion,
} from "@/lib/rag/store";
import type { RelationStore } from "@/lib/rag/store/RelationStore";
import type { QuillDB } from "./schema";

export function createRelationStore(db: QuillDB): RelationStore {
  return {
    // ------------------------------------------------------------------
    // Entry-to-entry relations (Plan-002 `entryRelations` store)
    // ------------------------------------------------------------------
    async addEntryRelation(rel: PersistedRelationship): Promise<void> {
      await db.put("entryRelations", rel);
    },
    async removeEntryRelation(id: string): Promise<void> {
      await db.delete("entryRelations", id);
    },
    async getEntryRelationsForEntry(entryId: string): Promise<PersistedRelationship[]> {
      const [from, to] = await Promise.all([
        db.getAllFromIndex("entryRelations", "by_from", entryId),
        db.getAllFromIndex("entryRelations", "by_to", entryId),
      ]);
      const byId = new Map<string, PersistedRelationship>();
      [...from, ...to].forEach((rel) => byId.set(rel.id, rel));
      return [...byId.values()];
    },

    // ------------------------------------------------------------------
    // Canonical relationships (Plan 001 bridge — writes to both stores)
    // ------------------------------------------------------------------
    async addRelationship(rel: PersistedRelationship): Promise<void> {
      const tx = db.transaction(["relationships", "relationIndexByDoc", "entryRelations"], "readwrite");
      await tx.objectStore("relationships").put(rel);
      await tx.objectStore("entryRelations").put(rel);
      await tx.objectStore("relationIndexByDoc").put({ docId: rel.from, relationshipId: rel.id });
      await tx.objectStore("relationIndexByDoc").put({ docId: rel.to, relationshipId: rel.id });
      await tx.done;
    },
    async removeRelationship(id: string): Promise<void> {
      const tx = db.transaction(["relationships", "relationIndexByDoc", "entryRelations"], "readwrite");
      const rel = await tx.objectStore("relationships").get(id);
      if (rel) {
        await tx.objectStore("relationships").delete(id);
        await tx.objectStore("entryRelations").delete(id);
        await tx.objectStore("relationIndexByDoc").delete([rel.from, id]);
        await tx.objectStore("relationIndexByDoc").delete([rel.to, id]);
      }
      await tx.done;
    },
    async getRelationsForDoc(docId: string): Promise<PersistedRelationship[]> {
      const [entryFrom, entryTo] = await Promise.all([
        db.getAllFromIndex("entryRelations", "by_from", docId),
        db.getAllFromIndex("entryRelations", "by_to", docId),
      ]);
      if (entryFrom.length + entryTo.length > 0) {
        const map = new Map<string, PersistedRelationship>();
        [...entryFrom, ...entryTo].forEach((row) => map.set(row.id, row));
        return [...map.values()];
      }
      const entries = await db.getAllFromIndex("relationIndexByDoc", "by_doc", docId);
      if (entries.length === 0) return [];
      const tx = db.transaction("relationships", "readonly");
      const results = await Promise.all(entries.map((e) => tx.store.get(e.relationshipId)));
      return results.filter((r): r is PersistedRelationship => r !== undefined);
    },

    // ------------------------------------------------------------------
    // Memberships
    // ------------------------------------------------------------------
    async putMembership(entry: PersistedMembership): Promise<void> {
      await db.put("memberships", entry);
    },
    async listMembershipsByCharacter(characterEntryId: string): Promise<PersistedMembership[]> {
      return db.getAllFromIndex("memberships", "by_character", characterEntryId);
    },
    async listMembershipsByOrganization(organizationEntryId: string): Promise<PersistedMembership[]> {
      return db.getAllFromIndex("memberships", "by_organization", organizationEntryId);
    },

    async putCultureMembership(entry: PersistedCultureMembership): Promise<void> {
      await db.put("cultureMemberships", entry);
    },
    async listCultureMembershipsByCharacter(
      characterEntryId: string,
    ): Promise<PersistedCultureMembership[]> {
      return db.getAllFromIndex("cultureMemberships", "by_character", characterEntryId);
    },
    async listCultureMembershipsByCulture(
      cultureEntryId: string,
    ): Promise<PersistedCultureMembership[]> {
      return db.getAllFromIndex("cultureMemberships", "by_culture", cultureEntryId);
    },

    async putItemOwnership(entry: PersistedItemOwnership): Promise<void> {
      await db.put("itemOwnerships", entry);
    },
    async listItemOwnershipByItem(itemEntryId: string): Promise<PersistedItemOwnership[]> {
      return db.getAllFromIndex("itemOwnerships", "by_item", itemEntryId);
    },
    async listItemOwnershipByOwner(ownerEntryId: string): Promise<PersistedItemOwnership[]> {
      return db.getAllFromIndex("itemOwnerships", "by_owner", ownerEntryId);
    },

    // ------------------------------------------------------------------
    // Scene mentions
    // ------------------------------------------------------------------
    async putMention(entry: PersistedMention): Promise<void> {
      await db.put("mentions", entry);
    },
    async listMentionsByScene(sceneId: string): Promise<PersistedMention[]> {
      return db.getAllFromIndex("mentions", "by_scene", sceneId);
    },
    async listMentionsByEntry(entryId: string): Promise<PersistedMention[]> {
      return db.getAllFromIndex("mentions", "by_entry", entryId);
    },

    // ------------------------------------------------------------------
    // Bi-temporal versions
    // ------------------------------------------------------------------
    async addCultureVersion(entry: PersistedCultureVersion): Promise<void> {
      await db.put("cultureVersions", entry);
    },
    async listCultureVersionsByCulture(cultureEntryId: string): Promise<PersistedCultureVersion[]> {
      return db.getAllFromIndex("cultureVersions", "by_culture", cultureEntryId);
    },

    async addOrganizationVersion(entry: PersistedOrganizationVersion): Promise<void> {
      await db.put("organizationVersions", entry);
    },
    async listOrganizationVersionsByOrganization(
      organizationEntryId: string,
    ): Promise<PersistedOrganizationVersion[]> {
      return db.getAllFromIndex("organizationVersions", "by_organization", organizationEntryId);
    },

    async addReligionVersion(entry: PersistedReligionVersion): Promise<void> {
      await db.put("religionVersions", entry);
    },
    async listReligionVersionsByReligion(religionEntryId: string): Promise<PersistedReligionVersion[]> {
      return db.getAllFromIndex("religionVersions", "by_religion", religionEntryId);
    },
  };
}
