"use client";

import type { BookCardStat } from "./types";
import { STATUS_LABELS } from "./types";
import { formatLastUpdated } from "./dashboardUtils";

interface BooksGridProps {
  bookCards: BookCardStat[];
  libraryId: string;
  onNavigate: (path: string) => void;
  onNewBook: () => void;
}

export function BooksGrid({ bookCards, libraryId, onNavigate, onNewBook }: BooksGridProps) {
  return (
    <section className="library-dashboard-section">
      <div className="library-dashboard-section-heading">
        <h2>Books</h2>
      </div>
      <div className="library-dashboard-book-grid">
        {bookCards.map((book) => (
          <article key={book.id} className="library-dashboard-book-card">
            <div className="library-dashboard-book-title-row">
              <strong>{book.title}</strong>
              <span className="library-dashboard-count">{STATUS_LABELS[book.status]}</span>
            </div>
            <div className="library-dashboard-book-metrics">
              <span>{book.chapters} chapter{book.chapters === 1 ? "" : "s"}</span>
              <span>{book.scenes} scene{book.scenes === 1 ? "" : "s"}</span>
            </div>
            <p className="library-dashboard-book-note">{book.notes}</p>
            <div className="library-dashboard-card-meta">
              <span>{formatLastUpdated(book.lastEdited)}</span>
              <button
                className="library-dashboard-book-open"
                onClick={() => onNavigate(`/library/${libraryId}/books/${book.id}`)}
              >
                Open →
              </button>
            </div>
          </article>
        ))}
        <button
          className="library-dashboard-book-card library-dashboard-book-card--new"
          onClick={onNewBook}
        >
          + New Book
        </button>
      </div>
    </section>
  );
}
