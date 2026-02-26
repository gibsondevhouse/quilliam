"use client";

import { useRAGContext } from "@/lib/context/RAGContext";

export default function Home() {
  const { tree } = useRAGContext();
  const hasLibraries = tree.length > 0;

  return (
    <div className="ide-welcome">
      <div className="ide-welcome-inner">
        <div className="ide-welcome-brand">Q</div>
        <h1 className="ide-welcome-title">Quilliam</h1>
        <p className="ide-welcome-subtitle">Author &amp; Journalist IDE</p>

        {hasLibraries ? (
          <div className="ide-welcome-actions">
            <p className="ide-welcome-hint">Select a library from the Explorer, or jump to one below.</p>
            <div className="ide-welcome-libraries">
              {tree.map((lib) => (
                <a
                  key={lib.id}
                  href={`/library/${lib.id}/dashboard`}
                  className="ide-welcome-action"
                >
                  <span className="ide-welcome-key">📚 {lib.title}</span>
                  <span className="ide-welcome-desc">Open library dashboard</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="ide-welcome-actions">
            <p className="ide-welcome-hint">
              Create a library to get started. Use the Explorer panel on the left.
            </p>
            <div className="ide-welcome-action-hint">
              Click <strong>+</strong> in the Explorer sidebar to create your first Library.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
