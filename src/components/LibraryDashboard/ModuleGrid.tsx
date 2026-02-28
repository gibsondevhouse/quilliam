"use client";

import type { ModuleStat } from "./types";
import { EMPTY_STAT } from "./types";
import { MODULE_SECTIONS } from "./moduleSections";
import { formatLastUpdated } from "./dashboardUtils";

interface ModuleGridProps {
  moduleStats: Record<string, ModuleStat>;
  libraryId: string;
  onNavigate: (path: string) => void;
}

export function ModuleGrid({ moduleStats, libraryId, onNavigate }: ModuleGridProps) {
  return (
    <div className="library-dashboard-sections">
      {MODULE_SECTIONS.map((section) => (
        <section key={section.key} className="library-dashboard-section">
          <div className="library-dashboard-section-heading">
            <h2>{section.label}</h2>
          </div>
          <div className="library-dashboard-cards">
            {section.cards.map((card) => {
              const stat = moduleStats[card.key] ?? EMPTY_STAT;
              return (
                <div key={card.key} className="library-dashboard-card">
                  <div className="library-dashboard-card-header">
                    <h3>
                      <span>{card.icon}</span>
                      <span>{card.label}</span>
                      <span className="library-dashboard-count">{stat.count}</span>
                    </h3>
                    <button
                      className="library-dashboard-card-cta"
                      onClick={() => onNavigate(`/library/${libraryId}/${card.path}`)}
                    >
                      {card.cta} →
                    </button>
                  </div>
                  <p className="library-dashboard-empty">{card.description}</p>
                  <div className="library-dashboard-card-meta">
                    <span>{formatLastUpdated(stat.lastUpdated)}</span>
                    <span className="library-dashboard-card-issues">
                      {stat.openIssues ?? 0} continuity issue{(stat.openIssues ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
