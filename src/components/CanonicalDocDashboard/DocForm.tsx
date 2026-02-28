"use client";

import { useCallback, useMemo, useState } from "react";
import { applyCultureDetails } from "@/lib/domain/culture";
import { normalizeCultureDetails } from "@/lib/domain/culture";
import type { Entry, EntryType } from "@/lib/types";
import type { CultureFormState, DocFormSaveFields } from "./types";
import { cultureFormFromDoc, cultureDetailsFromForm } from "./cultureFormHelpers";
import { CultureOntologySection } from "./CultureOntologySection";

interface DocFormProps {
  doc: Entry;
  entryType: EntryType;
  onSave: (fields: DocFormSaveFields) => void;
}

export function DocForm({ doc, entryType, onSave }: DocFormProps) {
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
          <CultureOntologySection culture={culture} setCultureField={setCultureField} />
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
