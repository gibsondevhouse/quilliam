/**
 * CanonicalDocDashboard — shared TypeScript interfaces.
 */
import type { EntryType, CultureMembershipKind, CultureMembership } from "@/lib/types";

export interface CultureFormState {
  parentCultureEntryId: string;
  homelandLocationEntryId: string;
  inheritAll: boolean;
  isVersioned: boolean;
  distinctives: string;
  endonyms: string;
  exonyms: string;
  diasporaLocationEntryIds: string;
  migrationEventIds: string;
  primaryLanguageEntryIds: string;
  scripts: string;
  registers: string;
  namingConventions: string;
  socialStructure: string;
  economy: string;
  warfare: string;
  religionMyth: string;
  materialCulture: string;
  customsEtiquette: string;
  relationshipToMagic: string;
  interculturalRelations: string;
  allies: string;
  enemies: string;
}

export interface DocFormSaveFields {
  name: string;
  summary: string;
  bodyMd: string;
  details: Record<string, unknown>;
}

export interface CultureMemberRow {
  membership: CultureMembership;
  characterName: string;
}

export interface SceneAppearanceRow {
  sceneId: string;
  sceneTitle: string;
  mentionType: string;
}

export interface LinkedCultureRow {
  entryId: string;
  name: string;
}

export interface RelatedPanelProps {
  entryType: EntryType;
  entryId: string;
  members: CultureMemberRow[];
  appearances: SceneAppearanceRow[];
  linkedCultures: LinkedCultureRow[];
  onAddMember: (characterEntryId: string, kind: CultureMembershipKind) => void;
  onRemoveMember: (membershipId: string) => void;
}

export interface CanonicalDocDashboardProps {
  type: EntryType;
  title: string;
}
