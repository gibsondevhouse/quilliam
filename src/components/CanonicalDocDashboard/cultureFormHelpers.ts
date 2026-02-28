import {
  applyCultureDetails,
  createDefaultCultureDetails,
  normalizeCultureDetails,
} from "@/lib/domain/culture";
import { TYPE_PREFIX } from "@/lib/domain/entryUtils";
import type { CultureDetails, Entry, EntryType } from "@/lib/types";
import type { CultureFormState } from "./types";

export function makeDocId(type: EntryType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type] ?? "ent"}_${slug}`;
}

export function makePatchId(): string {
  return `epatch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function joinList(values?: string[]): string {
  if (!Array.isArray(values) || values.length === 0) return "";
  return values.join(", ");
}

export function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function cultureFormFromDoc(doc: Entry): CultureFormState {
  const details = normalizeCultureDetails(doc.details);
  return {
    parentCultureEntryId: details.parentCultureEntryId ?? "",
    homelandLocationEntryId: details.homelandDiaspora?.homelandLocationEntryId ?? "",
    inheritAll: details.inheritAll ?? true,
    isVersioned: details.isVersioned ?? false,
    distinctives: details.identity?.distinctives ?? "",
    endonyms: joinList(details.identity?.endonyms),
    exonyms: joinList(details.identity?.exonyms),
    diasporaLocationEntryIds: joinList(details.homelandDiaspora?.diasporaLocationEntryIds),
    migrationEventIds: joinList(details.homelandDiaspora?.migrationEventIds),
    primaryLanguageEntryIds: joinList(details.language?.primaryLanguageEntryIds),
    scripts: joinList(details.language?.scripts),
    registers: joinList(details.language?.registers),
    namingConventions: details.language?.namingConventions ?? "",
    socialStructure: details.socialStructure?.summaryMd ?? "",
    economy: details.economy?.summaryMd ?? "",
    warfare: details.warfare?.summaryMd ?? "",
    religionMyth: details.religionMyth?.summaryMd ?? "",
    materialCulture: details.materialCulture?.summaryMd ?? "",
    customsEtiquette: details.customsEtiquette?.summaryMd ?? "",
    relationshipToMagic: details.relationshipToMagic?.summaryMd ?? "",
    interculturalRelations: details.interculturalRelations?.summaryMd ?? "",
    allies: joinList(details.interculturalRelations?.allies),
    enemies: joinList(details.interculturalRelations?.enemies),
  };
}

export function cultureDetailsFromForm(form: CultureFormState): CultureDetails {
  return createDefaultCultureDetails({
    isVersioned: form.isVersioned,
    parentCultureEntryId: toOptionalString(form.parentCultureEntryId),
    inheritAll: form.inheritAll,
    identity: {
      distinctives: toOptionalString(form.distinctives),
      endonyms: splitList(form.endonyms),
      exonyms: splitList(form.exonyms),
    },
    homelandDiaspora: {
      homelandLocationEntryId: toOptionalString(form.homelandLocationEntryId),
      diasporaLocationEntryIds: splitList(form.diasporaLocationEntryIds),
      migrationEventIds: splitList(form.migrationEventIds),
    },
    language: {
      primaryLanguageEntryIds: splitList(form.primaryLanguageEntryIds),
      scripts: splitList(form.scripts),
      registers: splitList(form.registers),
      namingConventions: toOptionalString(form.namingConventions),
    },
    socialStructure: { summaryMd: toOptionalString(form.socialStructure) },
    economy: { summaryMd: toOptionalString(form.economy) },
    warfare: { summaryMd: toOptionalString(form.warfare) },
    religionMyth: { summaryMd: toOptionalString(form.religionMyth) },
    materialCulture: { summaryMd: toOptionalString(form.materialCulture) },
    customsEtiquette: { summaryMd: toOptionalString(form.customsEtiquette) },
    relationshipToMagic: { summaryMd: toOptionalString(form.relationshipToMagic) },
    interculturalRelations: {
      summaryMd: toOptionalString(form.interculturalRelations),
      allies: splitList(form.allies),
      enemies: splitList(form.enemies),
    },
  });
}

export function makeDefaultEntryDetails(type: EntryType): Record<string, unknown> {
  return type === "culture"
    ? applyCultureDetails({}, createDefaultCultureDetails())
    : {};
}
