"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useRAGContext } from "@/lib/context/RAGContext";
import {
  applyCultureDetails,
  createDefaultCultureDetails,
  normalizeCultureDetails,
} from "@/lib/domain/culture";
import type { CultureDetails, Entry, EntryPatch, EntryType } from "@/lib/types";

const TYPE_PREFIX: Record<EntryType, string> = {
  character: "char",
  location: "loc",
  culture: "cul",
  organization: "org",
  system: "sys",
  item: "itm",
  language: "lng",
  religion: "rel",
  lineage: "lin",
  economy: "eco",
  rule: "rul",
  // Transitional legacy values
  faction: "fac",
  magic_system: "mgc",
  lore_entry: "lre",
  scene: "scn",
  timeline_event: "evt",
};

function makeDocId(type: EntryType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type] ?? "ent"}_${slug}`;
}

function makePatchId(): string {
  return `epatch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function joinList(values?: string[]): string {
  if (!Array.isArray(values) || values.length === 0) return "";
  return values.join(", ");
}

function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

interface CultureFormState {
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

function cultureFormFromDoc(doc: Entry): CultureFormState {
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

function cultureDetailsFromForm(form: CultureFormState): CultureDetails {
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

interface DocFormSaveFields {
  name: string;
  summary: string;
  bodyMd: string;
  details: Record<string, unknown>;
}

interface DocFormProps {
  doc: Entry;
  entryType: EntryType;
  onSave: (fields: DocFormSaveFields) => void;
}

function DocForm({ doc, entryType, onSave }: DocFormProps) {
  const [name, setName] = useState(doc.name);
  const [summary, setSummary] = useState(doc.summary);
  const [bodyMd, setBodyMd] = useState(doc.bodyMd ?? "");
  const [culture, setCulture] = useState<CultureFormState>(() => cultureFormFromDoc(doc));
  const isCulture = entryType === "culture";
  const baseCulture = useMemo(() => normalizeCultureDetails(doc.details), [doc.details]);
  const nextCultureDetails = useMemo(() => cultureDetailsFromForm(culture), [culture]);
  const nextDetails = useMemo(
    () => (isCulture ? applyCultureDetails(doc.details, nextCultureDetails) : doc.details),
    [doc.details, isCulture, nextCultureDetails],
  );
  const cultureDirty = isCulture && JSON.stringify(baseCulture) !== JSON.stringify(nextCultureDetails);
  const dirty =
    name !== doc.name
    || summary !== doc.summary
    || (isCulture && bodyMd !== (doc.bodyMd ?? ""))
    || cultureDirty;

  const setCultureField = useCallback(
    function setCultureField<K extends keyof CultureFormState>(field: K, value: CultureFormState[K]) {
      setCulture((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  return (
    <div className="canonical-doc-form">
      <div className="canonical-doc-field">
        <label htmlFor="doc-name">Name</label>
        <input
          id="doc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="canonical-doc-input"
          placeholder="Display name"
        />
      </div>
      <div className="canonical-doc-field">
        <label htmlFor="doc-summary">Summary</label>
        <textarea
          id="doc-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="canonical-doc-textarea"
          rows={4}
          placeholder="Short description"
        />
      </div>
      {isCulture && (
        <>
          <div className="canonical-doc-field">
            <label htmlFor="doc-body">Culture Notes / Trait Snapshot (Markdown)</label>
            <textarea
              id="doc-body"
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              className="canonical-doc-textarea canonical-doc-textarea--lg"
              rows={6}
              placeholder="Use this for long-form trait notes while isVersioned=false."
            />
          </div>
          <section className="canonical-culture-section">
            <h3>Culture Ontology</h3>
            <div className="canonical-culture-grid">
              <div className="canonical-doc-field">
                <label htmlFor="cul-parent">Parent Culture Entry ID</label>
                <input
                  id="cul-parent"
                  value={culture.parentCultureEntryId}
                  onChange={(e) => setCultureField("parentCultureEntryId", e.target.value)}
                  className="canonical-doc-input"
                  placeholder="cul_veyran"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-homeland">Homeland Location Entry ID</label>
                <input
                  id="cul-homeland"
                  value={culture.homelandLocationEntryId}
                  onChange={(e) => setCultureField("homelandLocationEntryId", e.target.value)}
                  className="canonical-doc-input"
                  placeholder="loc_north_coast"
                />
              </div>
              <label className="canonical-doc-checkbox">
                <input
                  type="checkbox"
                  checked={culture.inheritAll}
                  onChange={(e) => setCultureField("inheritAll", e.target.checked)}
                />
                <span>inheritAll (subculture default)</span>
              </label>
              <label className="canonical-doc-checkbox">
                <input
                  type="checkbox"
                  checked={culture.isVersioned}
                  onChange={(e) => setCultureField("isVersioned", e.target.checked)}
                />
                <span>isVersioned (use CultureVersion snapshots)</span>
              </label>
            </div>
            <div className="canonical-culture-grid">
              <div className="canonical-doc-field">
                <label htmlFor="cul-distinctives">Identity / Distinctives</label>
                <textarea
                  id="cul-distinctives"
                  value={culture.distinctives}
                  onChange={(e) => setCultureField("distinctives", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                  placeholder="What makes this culture distinct."
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-endonyms">Endonyms (comma-separated)</label>
                <input
                  id="cul-endonyms"
                  value={culture.endonyms}
                  onChange={(e) => setCultureField("endonyms", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-exonyms">Exonyms (comma-separated)</label>
                <input
                  id="cul-exonyms"
                  value={culture.exonyms}
                  onChange={(e) => setCultureField("exonyms", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-diaspora">Diaspora Regions (entry IDs)</label>
                <input
                  id="cul-diaspora"
                  value={culture.diasporaLocationEntryIds}
                  onChange={(e) => setCultureField("diasporaLocationEntryIds", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-migrations">Migration Events (entry IDs)</label>
                <input
                  id="cul-migrations"
                  value={culture.migrationEventIds}
                  onChange={(e) => setCultureField("migrationEventIds", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-languages">Primary Languages (entry IDs)</label>
                <input
                  id="cul-languages"
                  value={culture.primaryLanguageEntryIds}
                  onChange={(e) => setCultureField("primaryLanguageEntryIds", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-scripts">Scripts (comma-separated)</label>
                <input
                  id="cul-scripts"
                  value={culture.scripts}
                  onChange={(e) => setCultureField("scripts", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-registers">Registers (comma-separated)</label>
                <input
                  id="cul-registers"
                  value={culture.registers}
                  onChange={(e) => setCultureField("registers", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-naming">Naming Conventions</label>
                <textarea
                  id="cul-naming"
                  value={culture.namingConventions}
                  onChange={(e) => setCultureField("namingConventions", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={2}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-social">Social Structure</label>
                <textarea
                  id="cul-social"
                  value={culture.socialStructure}
                  onChange={(e) => setCultureField("socialStructure", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-economy">Economy</label>
                <textarea
                  id="cul-economy"
                  value={culture.economy}
                  onChange={(e) => setCultureField("economy", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-warfare">Warfare</label>
                <textarea
                  id="cul-warfare"
                  value={culture.warfare}
                  onChange={(e) => setCultureField("warfare", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-religion">Religion &amp; Myth</label>
                <textarea
                  id="cul-religion"
                  value={culture.religionMyth}
                  onChange={(e) => setCultureField("religionMyth", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-material">Material Culture</label>
                <textarea
                  id="cul-material"
                  value={culture.materialCulture}
                  onChange={(e) => setCultureField("materialCulture", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-customs">Customs &amp; Etiquette</label>
                <textarea
                  id="cul-customs"
                  value={culture.customsEtiquette}
                  onChange={(e) => setCultureField("customsEtiquette", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-magic">Relationship To Magic</label>
                <textarea
                  id="cul-magic"
                  value={culture.relationshipToMagic}
                  onChange={(e) => setCultureField("relationshipToMagic", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field canonical-doc-field--full">
                <label htmlFor="cul-intercultural">Intercultural Relations</label>
                <textarea
                  id="cul-intercultural"
                  value={culture.interculturalRelations}
                  onChange={(e) => setCultureField("interculturalRelations", e.target.value)}
                  className="canonical-doc-textarea"
                  rows={3}
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-allies">Allies (culture entry IDs)</label>
                <input
                  id="cul-allies"
                  value={culture.allies}
                  onChange={(e) => setCultureField("allies", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
              <div className="canonical-doc-field">
                <label htmlFor="cul-enemies">Enemies (culture entry IDs)</label>
                <input
                  id="cul-enemies"
                  value={culture.enemies}
                  onChange={(e) => setCultureField("enemies", e.target.value)}
                  className="canonical-doc-input"
                />
              </div>
            </div>
          </section>
        </>
      )}
      <div className="canonical-doc-meta">
        <span className={`canonical-doc-status canonical-doc-status--${doc.canonStatus}`}>
          {doc.canonStatus}
        </span>
        {doc.sources.length > 0 && (
          <span className="canonical-doc-sources">{doc.sources.length} source(s)</span>
        )}
      </div>
      {dirty && (
        <button
          className="library-page-action primary"
          onClick={() => onSave({
            name,
            summary,
            bodyMd,
            details: nextDetails,
          })}
        >
          Save (creates pending patch)
        </button>
      )}
    </div>
  );
}

interface CanonicalDocDashboardProps {
  type: EntryType;
  title: string;
}

export function CanonicalDocDashboard({ type, title }: CanonicalDocDashboardProps) {
  const { storeRef, storeReady } = useRAGContext();
  const searchParams = useSearchParams();
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const highlightId = searchParams.get("highlight");
  const [docs, setDocs] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "proposed" | "canon" | "deprecated" | "retconned" | "alternate-branch"
  >("all");
  const [sortOrder, setSortOrder] = useState<"name" | "updated">("name");

  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    const store = storeRef.current;
    if (!store) return;
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
  }, [storeReady, storeRef, type, highlightId]);

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
    const store = storeRef.current;
    if (!store) return;
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
  }, [libraryId, storeRef, title, type]);

  const handleSave = useCallback(async (fields: DocFormSaveFields) => {
    if (!activeId) return;
    const store = storeRef.current;
    if (!store) return;

    const prev = docs.find((d) => d.id === activeId);
    if (!prev) return;

    const ops: EntryPatch["operations"] = [];
    if (fields.name !== prev.name) {
      ops.push({
        op: "update-entry",
        entryId: activeId,
        field: "name",
        oldValue: prev.name,
        newValue: fields.name,
      });
    }
    if (fields.summary !== prev.summary) {
      ops.push({
        op: "update-entry",
        entryId: activeId,
        field: "summary",
        oldValue: prev.summary,
        newValue: fields.summary,
      });
    }
    if (fields.bodyMd !== (prev.bodyMd ?? "")) {
      ops.push({
        op: "update-entry",
        entryId: activeId,
        field: "bodyMd",
        oldValue: prev.bodyMd ?? "",
        newValue: fields.bodyMd,
      });
    }
    if (JSON.stringify(fields.details) !== JSON.stringify(prev.details)) {
      ops.push({
        op: "update-entry",
        entryId: activeId,
        field: "details",
        oldValue: prev.details,
        newValue: fields.details,
      });
    }
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
  }, [activeId, docs, storeRef]);

  const handleDelete = useCallback(async (id: string) => {
    const store = storeRef.current;
    if (!store) return;
    await store.deleteEntry(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId, storeRef]);

  return (
    <div className="library-page split-page">
      <div className="split-page-list">
        <div className="library-page-header">
          <h2>{title}</h2>
          <button className="library-page-action" onClick={handleAdd}>+ Add</button>
        </div>

        <div className="canonical-dashboard-controls">
          <div className="canonical-dashboard-filter">
            <label htmlFor="status-filter">Status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(
                e.target.value as
                  | "all"
                  | "draft"
                  | "proposed"
                  | "canon"
                  | "deprecated"
                  | "retconned"
                  | "alternate-branch",
              )}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="proposed">Proposed</option>
              <option value="canon">Canon</option>
              <option value="deprecated">Deprecated</option>
              <option value="retconned">Retconned</option>
              <option value="alternate-branch">Alternate Branch</option>
            </select>
          </div>
          <div className="canonical-dashboard-sort">
            <label htmlFor="sort-order">Sort:</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "name" | "updated")}
            >
              <option value="name">Name</option>
              <option value="updated">Last updated</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="library-page-empty"><p>Loading…</p></div>
        ) : docs.length === 0 ? (
          <div className="library-page-empty">
            <p>No {title.toLowerCase()} yet.</p>
            <button className="library-page-action primary" onClick={handleAdd}>
              Add your first {title.toLowerCase().replace(/s$/, "")}
            </button>
          </div>
        ) : displayedDocs.length === 0 ? (
          <div className="library-page-empty">
            <p>No {statusFilter} {title.toLowerCase()}.</p>
          </div>
        ) : (
          <ul className="library-item-list">
            {displayedDocs.map((doc) => (
              <li key={doc.id} className="library-item-row">
                <button
                  className={`library-item-btn ${activeId === doc.id ? "active" : ""}`}
                  onClick={() => setActiveId(doc.id)}
                >
                  <span className="library-item-avatar">
                    {doc.canonStatus === "canon" ? "★" : (doc.name || "?")[0].toUpperCase()}
                  </span>
                  <div className="library-item-info">
                    <span className="library-item-title">{doc.name || "Unnamed"}</span>
                    {doc.summary && (
                      <span className="library-item-preview">{doc.summary.slice(0, 60)}</span>
                    )}
                  </div>
                </button>
                <button
                  className="library-item-delete"
                  onClick={(e) => { e.stopPropagation(); void handleDelete(doc.id); }}
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="split-page-editor">
        {activeDoc ? (
          <DocForm
            key={activeDoc.id}
            doc={activeDoc}
            entryType={type}
            onSave={(fields) => void handleSave(fields)}
          />
        ) : (
          <div className="library-page-empty">
            <p>Select a {title.toLowerCase().replace(/s$/, "")} to edit, or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
