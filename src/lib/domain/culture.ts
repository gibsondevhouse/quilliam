import type { CultureDetails } from "@/lib/types";

export const CULTURE_DETAILS_KEY = "cultureOntology";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asSummaryObject(value: unknown): { summaryMd?: string } | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const summaryMd = asString(record.summaryMd);
  return summaryMd ? { summaryMd } : undefined;
}

export function createDefaultCultureDetails(overrides: Partial<CultureDetails> = {}): CultureDetails {
  return {
    isVersioned: false,
    inheritAll: true,
    identity: {
      endonyms: [],
      exonyms: [],
      distinctives: "",
      ...overrides.identity,
    },
    homelandDiaspora: {
      homelandLocationEntryId: "",
      diasporaLocationEntryIds: [],
      migrationEventIds: [],
      ...overrides.homelandDiaspora,
    },
    language: {
      primaryLanguageEntryIds: [],
      scripts: [],
      registers: [],
      namingConventions: "",
      ...overrides.language,
    },
    socialStructure: { summaryMd: "", ...overrides.socialStructure },
    economy: { summaryMd: "", ...overrides.economy },
    warfare: { summaryMd: "", ...overrides.warfare },
    religionMyth: { summaryMd: "", ...overrides.religionMyth },
    materialCulture: { summaryMd: "", ...overrides.materialCulture },
    customsEtiquette: { summaryMd: "", ...overrides.customsEtiquette },
    relationshipToMagic: { summaryMd: "", ...overrides.relationshipToMagic },
    interculturalRelations: {
      summaryMd: "",
      allies: [],
      enemies: [],
      ...overrides.interculturalRelations,
    },
    ...overrides,
  };
}

export function normalizeCultureDetails(details: Record<string, unknown> | undefined): CultureDetails {
  const root = details ?? {};
  const nested = asRecord(root[CULTURE_DETAILS_KEY]);
  const source = nested ?? root;

  const identity = asRecord(source.identity);
  const homelandDiaspora = asRecord(source.homelandDiaspora);
  const language = asRecord(source.language);
  const interculturalRelations = asRecord(source.interculturalRelations);

  return createDefaultCultureDetails({
    isVersioned: asBoolean(source.isVersioned) ?? asBoolean(root.isVersioned) ?? false,
    parentCultureEntryId:
      asString(source.parentCultureEntryId) ??
      asString(root.parentCultureEntryId),
    inheritAll: asBoolean(source.inheritAll) ?? asBoolean(root.inheritAll) ?? true,
    traitInheritance: asRecord(source.traitInheritance) as CultureDetails["traitInheritance"] | undefined,
    traits: asRecord(source.traits) as CultureDetails["traits"] | undefined,
    identity: {
      endonyms: asStringArray(identity?.endonyms),
      exonyms: asStringArray(identity?.exonyms),
      distinctives: asString(identity?.distinctives),
    },
    homelandDiaspora: {
      homelandLocationEntryId:
        asString(homelandDiaspora?.homelandLocationEntryId) ??
        asString(source.homelandLocationEntryId) ??
        asString(root.homelandLocationEntryId),
      diasporaLocationEntryIds: asStringArray(homelandDiaspora?.diasporaLocationEntryIds),
      migrationEventIds: asStringArray(homelandDiaspora?.migrationEventIds),
    },
    language: {
      primaryLanguageEntryIds: asStringArray(language?.primaryLanguageEntryIds),
      scripts: asStringArray(language?.scripts),
      registers: asStringArray(language?.registers),
      namingConventions: asString(language?.namingConventions),
    },
    socialStructure: asSummaryObject(source.socialStructure),
    economy: asSummaryObject(source.economy),
    warfare: asSummaryObject(source.warfare),
    religionMyth: asSummaryObject(source.religionMyth),
    materialCulture: asSummaryObject(source.materialCulture),
    customsEtiquette: asSummaryObject(source.customsEtiquette),
    relationshipToMagic: asSummaryObject(source.relationshipToMagic),
    interculturalRelations: {
      summaryMd: asString(interculturalRelations?.summaryMd),
      allies: asStringArray(interculturalRelations?.allies),
      enemies: asStringArray(interculturalRelations?.enemies),
    },
  });
}

export function applyCultureDetails(
  baseDetails: Record<string, unknown>,
  cultureDetails: CultureDetails,
): Record<string, unknown> {
  const rest = { ...baseDetails };
  delete rest[CULTURE_DETAILS_KEY];
  delete rest.parentCultureEntryId;
  delete rest.homelandLocationEntryId;
  delete rest.inheritAll;
  delete rest.isVersioned;

  const next: Record<string, unknown> = {
    ...rest,
    [CULTURE_DETAILS_KEY]: cultureDetails,
    inheritAll: cultureDetails.inheritAll ?? true,
    isVersioned: cultureDetails.isVersioned ?? false,
  };

  if (cultureDetails.parentCultureEntryId) {
    next.parentCultureEntryId = cultureDetails.parentCultureEntryId;
  }

  const homelandLocationEntryId = cultureDetails.homelandDiaspora?.homelandLocationEntryId;
  if (homelandLocationEntryId) {
    next.homelandLocationEntryId = homelandLocationEntryId;
  }

  return next;
}
