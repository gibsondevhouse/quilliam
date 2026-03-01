"use client";

import type { CSSProperties } from "react";

interface FirstRunBannerProps {
  libraryId: string;
  libraryTitle: string;
  onNavigate: (path: string) => void;
  onNewBook: () => void;
}

const GETTING_STARTED_STEPS = [
  {
    icon: "📚",
    label: "Create your first book",
    hint: "Add a book and start writing chapters.",
    action: "book",
  },
  {
    icon: "👤",
    label: "Add characters",
    hint: "Build out your cast in the Characters module.",
    action: "characters",
  },
  {
    icon: "🌍",
    label: "Define your world",
    hint: "Add locations, cultures, factions, and lore.",
    action: "locations",
  },
  {
    icon: "📅",
    label: "Set up a timeline",
    hint: "Anchor events to a master calendar.",
    action: "master-timeline",
  },
] as const;

export function FirstRunBanner({
  libraryId,
  libraryTitle,
  onNavigate,
  onNewBook,
}: FirstRunBannerProps) {
  return (
    <section className="library-dashboard-section first-run-banner">
      <div
        className="first-run-banner-hero"
        style={{ "--accent": "#6366f1" } as CSSProperties}
      >
        <div className="first-run-banner-text">
          <h2>Welcome to <em>{libraryTitle || "your new universe"}</em></h2>
          <p>
            Your universe is empty and waiting. Start by creating a book to
            write in, or build out your world with characters, locations, and
            lore — in any order you like.
          </p>
        </div>
        <button
          className="first-run-banner-cta"
          onClick={onNewBook}
        >
          ＋ Create your first book
        </button>
      </div>

      <div className="first-run-banner-steps">
        {GETTING_STARTED_STEPS.map((step) => (
          <button
            key={step.action}
            className="first-run-banner-step"
            onClick={() => {
              if (step.action === "book") {
                onNewBook();
              } else {
                onNavigate(`/library/${libraryId}/${step.action}`);
              }
            }}
          >
            <span className="first-run-step-icon">{step.icon}</span>
            <span className="first-run-step-body">
              <strong>{step.label}</strong>
              <span className="first-run-step-hint">{step.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
