"use client";

import type { CultureFormState } from "./types";

interface CultureOntologySectionProps {
  culture: CultureFormState;
  setCultureField: <K extends keyof CultureFormState>(field: K, value: CultureFormState[K]) => void;
}

export function CultureOntologySection({ culture, setCultureField }: CultureOntologySectionProps) {
  return (
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
  );
}
