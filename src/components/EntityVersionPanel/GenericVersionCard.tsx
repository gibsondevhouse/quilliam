"use client";

interface GenericVersionCardProps {
  id: string;
  validFromEventId: string;
  validToEventId?: string;
  changeTrigger?: string;
  traits: Record<string, unknown>;
  eventName: (id: string | undefined) => string;
}

export function GenericVersionCard({
  validFromEventId,
  validToEventId,
  changeTrigger,
  traits,
  eventName,
}: GenericVersionCardProps) {
  const isOpen = !validToEventId;
  const entries = Object.entries(traits).slice(0, 6);

  return (
    <div className={`cv-card ${isOpen ? "cv-card--open" : ""}`}>
      <div className="cv-card-header">
        <span className="cv-card-validity">
          <span className="cv-card-event">↳ {eventName(validFromEventId)}</span>
          <span className="cv-card-arrow">→</span>
          <span className={`cv-card-event ${isOpen ? "cv-card-event--open" : ""}`}>
            {isOpen ? "present" : eventName(validToEventId)}
          </span>
        </span>
        {isOpen && <span className="cv-card-badge">active</span>}
      </div>
      {changeTrigger && (
        <p className="cv-card-trigger">&ldquo;{changeTrigger}&rdquo;</p>
      )}
      <div className="cv-card-traits-section">
        {entries.length === 0 ? (
          <span className="cv-card-no-traits">No traits recorded</span>
        ) : (
          <ul className="cv-card-traits">
            {entries.map(([key, val]) => (
              <li key={key} className="cv-card-trait-row">
                <span className="cv-card-trait-key">{key}</span>
                <span className="cv-card-trait-val">
                  {typeof val === "object" && val !== null ? JSON.stringify(val) : String(val)}
                </span>
              </li>
            ))}
            {Object.keys(traits).length > 6 && (
              <li className="cv-card-trait-more">+{Object.keys(traits).length - 6} more</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
