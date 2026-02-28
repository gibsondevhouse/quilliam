"use client";

import { useCallback, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { CanonStatus, CoreEntryType, EntryType } from "@/lib/types";

const CORE_ENTRY_TYPES: CoreEntryType[] = [
  "character",
  "location",
  "culture",
  "organization",
  "system",
  "item",
  "language",
  "religion",
  "lineage",
  "economy",
  "rule",
];

const VALID_CANON_STATUSES: CanonStatus[] = [
  "draft",
  "proposed",
  "canon",
  "deprecated",
  "retconned",
  "alternate-branch",
];

interface ParsedRow {
  name: string;
  entryType: EntryType;
  summary: string;
  canonStatus: CanonStatus;
  tags: string[];
}

interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCsv(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["CSV must have a header row and at least one data row."] };

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const nameIdx = headers.indexOf("name");
  const typeIdx = headers.indexOf("entrytype") !== -1 ? headers.indexOf("entrytype") : headers.indexOf("type");
  const summaryIdx = headers.indexOf("summary");
  const statusIdx = headers.indexOf("canonstatus") !== -1 ? headers.indexOf("canonstatus") : headers.indexOf("status");
  const tagsIdx = headers.indexOf("tags");

  if (nameIdx === -1) return { rows: [], errors: ["CSV must have a 'name' column."] };
  if (typeIdx === -1) return { rows: [], errors: ["CSV must have an 'entryType' (or 'type') column."] };

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV field split — handles quoted fields containing commas
    const cells: string[] = [];
    let inQ = false;
    let cur = "";
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);

    const name = cells[nameIdx]?.trim() ?? "";
    const rawType = cells[typeIdx]?.trim().toLowerCase() ?? "";
    const summary = summaryIdx !== -1 ? (cells[summaryIdx]?.trim() ?? "") : "";
    const rawStatus = statusIdx !== -1 ? (cells[statusIdx]?.trim().toLowerCase() ?? "") : "draft";
    const rawTags = tagsIdx !== -1 ? (cells[tagsIdx]?.trim() ?? "") : "";

    if (!name) { errors.push(`Row ${i + 1}: 'name' is required.`); continue; }

    const entryType = CORE_ENTRY_TYPES.includes(rawType as CoreEntryType)
      ? (rawType as EntryType)
      : null;
    if (!entryType) {
      errors.push(`Row ${i + 1}: unknown entryType "${rawType}". Valid values: ${CORE_ENTRY_TYPES.join(", ")}.`);
      continue;
    }

    const canonStatus: CanonStatus = VALID_CANON_STATUSES.includes(rawStatus as CanonStatus)
      ? (rawStatus as CanonStatus)
      : "draft";

    const tags = rawTags
      ? rawTags.split(/[;|]/).map((t) => t.trim()).filter(Boolean)
      : [];

    rows.push({ name, entryType, summary, canonStatus, tags });
  }

  return { rows, errors };
}

interface BulkImportPanelProps {
  defaultEntryType?: EntryType;
  onImported?: (count: number) => void;
}

export function BulkImportPanel({ defaultEntryType, onImported }: BulkImportPanelProps) {
  const store = useStore();
  const { libraryId } = useLibraryContext();

  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const handlePreview = useCallback(() => {
    setPreview(parseCsv(csvText));
    setDone(null);
  }, [csvText]);

  const handleImport = useCallback(async () => {
    if (!preview || preview.rows.length === 0) return;
    setImporting(true);
    const now = Date.now();
    for (const row of preview.rows) {
      await store.addEntry({
        id: crypto.randomUUID(),
        universeId: libraryId,
        entryType: row.entryType,
        name: row.name,
        slug: slugify(row.name),
        summary: row.summary,
        canonStatus: row.canonStatus,
        visibility: "private",
        tags: row.tags.length ? row.tags : undefined,
        type: row.entryType,
        details: {},
        status: row.canonStatus === "canon" ? "canon" : "draft",
        sources: [],
        relationships: [],
        lastVerified: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    const count = preview.rows.length;
    setImporting(false);
    setDone(count);
    setPreview(null);
    setCsvText("");
    onImported?.(count);
  }, [store, libraryId, preview, onImported]);

  const EXAMPLE = `name,entryType,summary,canonStatus,tags
"The Iron Compact",organization,"A mercenary guild of the eastern passes.",draft,"military,guild"
"Veyran People",culture,"Nomadic herders of the Ashplain.",canon,"nomad,steppe"`;

  return (
    <div className="bulk-import-panel">
      <p className="bulk-import-hint">
        Paste CSV with columns:{" "}
        <code>name</code>, <code>entryType</code>, <code>summary</code> (opt),{" "}
        <code>canonStatus</code> (opt), <code>tags</code> (opt, semicolon-separated).
        {defaultEntryType && (
          <> All rows should use <strong>{defaultEntryType}</strong> or override the type per row.</>
        )}
      </p>

      <button
        className="cv-form-btn"
        style={{ marginBottom: 6, fontSize: 11 }}
        onClick={() => setCsvText(EXAMPLE)}
      >
        Load example
      </button>

      <textarea
        className="cv-form-textarea"
        rows={6}
        placeholder={EXAMPLE}
        value={csvText}
        onChange={(e) => { setCsvText(e.target.value); setPreview(null); setDone(null); }}
      />

      <div className="cv-form-actions">
        <button
          className="cv-form-btn"
          onClick={handlePreview}
          disabled={!csvText.trim()}
        >
          Preview
        </button>
        {preview && preview.rows.length > 0 && preview.errors.length === 0 && (
          <button
            className="cv-form-btn cv-form-btn--primary"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? "Importing…" : `Import ${preview.rows.length} ${preview.rows.length === 1 ? "entry" : "entries"}`}
          </button>
        )}
      </div>

      {done !== null && (
        <p style={{ color: "#22c55e", fontSize: 13, marginTop: 6 }}>
          ✓ Imported {done} {done === 1 ? "entry" : "entries"}.
        </p>
      )}

      {preview && (
        <div className="bulk-import-preview">
          {preview.errors.length > 0 && (
            <ul className="bulk-import-errors">
              {preview.errors.map((e, i) => (
                <li key={i} className="cv-form-error" style={{ listStyle: "none" }}>{e}</li>
              ))}
            </ul>
          )}
          {preview.rows.length > 0 && (
            <>
              <p className="bulk-import-count">{preview.rows.length} row{preview.rows.length !== 1 ? "s" : ""} ready</p>
              <ul className="bulk-import-row-list">
                {preview.rows.slice(0, 8).map((r, i) => (
                  <li key={i} className="bulk-import-row">
                    <strong>{r.name}</strong>
                    <span className="media-card-type" style={{ marginLeft: 6 }}>{r.entryType}</span>
                    {r.canonStatus !== "draft" && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: "#a78bfa" }}>{r.canonStatus}</span>
                    )}
                    {r.summary && (
                      <span style={{ marginLeft: 6, color: "var(--text-muted)", fontSize: 12 }}>
                        — {r.summary.slice(0, 60)}{r.summary.length > 60 ? "…" : ""}
                      </span>
                    )}
                  </li>
                ))}
                {preview.rows.length > 8 && (
                  <li style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    …and {preview.rows.length - 8} more
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
