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

export interface RelationStore {
  // Entry-to-entry relations
  addEntryRelation(rel: PersistedRelationship): Promise<void>;
  removeEntryRelation(id: string): Promise<void>;
  getEntryRelationsForEntry(entryId: string): Promise<PersistedRelationship[]>;
  // Canonical relationships (Plan 001 bridge)
  addRelationship(rel: PersistedRelationship): Promise<void>;
  removeRelationship(id: string): Promise<void>;
  getRelationsForDoc(docId: string): Promise<PersistedRelationship[]>;
  // Memberships
  putMembership(entry: PersistedMembership): Promise<void>;
  listMembershipsByCharacter(characterEntryId: string): Promise<PersistedMembership[]>;
  listMembershipsByOrganization(organizationEntryId: string): Promise<PersistedMembership[]>;
  putCultureMembership(entry: PersistedCultureMembership): Promise<void>;
  listCultureMembershipsByCharacter(characterEntryId: string): Promise<PersistedCultureMembership[]>;
  listCultureMembershipsByCulture(cultureEntryId: string): Promise<PersistedCultureMembership[]>;
  putItemOwnership(entry: PersistedItemOwnership): Promise<void>;
  listItemOwnershipByItem(itemEntryId: string): Promise<PersistedItemOwnership[]>;
  listItemOwnershipByOwner(ownerEntryId: string): Promise<PersistedItemOwnership[]>;
  // Scene mentions
  putMention(entry: PersistedMention): Promise<void>;
  listMentionsByScene(sceneId: string): Promise<PersistedMention[]>;
  listMentionsByEntry(entryId: string): Promise<PersistedMention[]>;
  // Bi-temporal versions
  addCultureVersion(entry: PersistedCultureVersion): Promise<void>;
  listCultureVersionsByCulture(cultureEntryId: string): Promise<PersistedCultureVersion[]>;
  addOrganizationVersion(entry: PersistedOrganizationVersion): Promise<void>;
  listOrganizationVersionsByOrganization(organizationEntryId: string): Promise<PersistedOrganizationVersion[]>;
  addReligionVersion(entry: PersistedReligionVersion): Promise<void>;
  listReligionVersionsByReligion(religionEntryId: string): Promise<PersistedReligionVersion[]>;
}
