"use client";

import type { CultureVersion, CultureTraitMap } from "@/lib/types";

interface VersionCardProps {
  version: CultureVersion;
  eventName: (id: string | undefined) => string;
}

function renderTraits(traits: CultureTraitMap): React.ReactNode {
  const entries = Object.entries(traits).slice(0, 6);
  if (entries.length === 0) return <span className="cv-card-no-traits">No traits recorded</span>;
  return (
    <ul className="cv-card-traits">
      {entries.map(([key, val]) => {
        const display =
          typeof val === "object" && val !== null && "value" in val
            ? String((val as { value: unknown }).value)
            : String(val);
        return (
          <li key={key} className="cv-card-trait-row">
            <span className="cv-card-trait-key">{key}</span>
            <span className="cv-card-trait-val">{display}</span>
          </li>
        );
      })}
      {Object.keys(traits).length > 6 && (
        <li className="cv-card-trait-more">+{Object.keys(traits).length - 6} more</li>
      )}
    </ul>
  );
}

export function VersionCard({ version, eventName }: VersionCardProps) {
  const isOpen = !version.validToEventId;

  return (
    <div className={`cv-card ${isOpen ? "cv-card--open" : ""}`}>
      <div className="cv-card-header">
        <span className="cv-card-validity">
          <span className="cv-card-event">↳ {eventName(version.validFromEventId)}</span>
          <span className="cv-card-arrow">→</span>
          <span className={`cv-card-event ${isOpen ? "cv-card-event--open" : ""}`}>
            {isOpen ? "present" : eventName(version.validToEventId)}
          </span>
        </span>
        {isOpen && <span className="cv-card-badge">active</span>}
      </div>
      {version.changeTrigger && (
        <p className="cv-card-trigger">&ldquo;{version.changeTrigger}&rdquo;</p>
      )}
      <div className="cv-card-traits-section">
        {renderTraits(version.traits)}
      </div>
    </div>
  );
}
