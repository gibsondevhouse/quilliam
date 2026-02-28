"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useStore } from "@/lib/context/useStore";
import {
  finalizeImp002Migration,
  getImp002MigrationState,
  migrateImp002Library,
  type Imp002MigrationReport,
} from "@/lib/rag/migrate-imp002";
import type { CloudProviderConfig, RunBudget } from "@/lib/types";

interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  providers: {
    anthropic: boolean;
    tavily: boolean;
  };
  updatedAt?: number;
}

const BUDGET_FIELDS: Array<keyof RunBudget> = [
  "maxUsd",
  "maxInputTokens",
  "maxOutputTokens",
  "maxMinutes",
  "maxSources",
];

export default function SettingsPage() {
  const lib = useLibraryContext();
  const store = useStore();

  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providerConfigDraft, setProviderConfigDraft] = useState<CloudProviderConfig>(lib.cloudProviderConfig);
  const [budgetDraft, setBudgetDraft] = useState<RunBudget>(lib.defaultRunBudget);

  // Migration wizard state
  type WizardStep = "idle" | "previewing" | "preview" | "running" | "review" | "confirming" | "done" | "error";
  const [wizardStep, setWizardStep] = useState<WizardStep>("idle");
  const [previewCounts, setPreviewCounts] = useState<{
    characters: number; locations: number; worldEntries: number; scenes: number; partNodes: number;
  } | null>(null);
  const [migrationReport, setMigrationReport] = useState<Imp002MigrationReport | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<{ step: string; pct: number } | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);


  const loadVaultStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/cloud/vault/init");
      const payload = (await response.json()) as VaultStatus;
      setVaultStatus(payload);
    } catch {
      setVaultStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadVaultStatus();
  }, [loadVaultStatus]);

  useEffect(() => {
    setProviderConfigDraft(lib.cloudProviderConfig);
  }, [lib.cloudProviderConfig]);

  useEffect(() => {
    setBudgetDraft(lib.defaultRunBudget);
  }, [lib.defaultRunBudget]);

  useEffect(() => {
    void (async () => {
      const state = await getImp002MigrationState(store, lib.libraryId);
      const report = await store.getMetadata<Imp002MigrationReport>(
        `imp002:migration:${lib.libraryId}:report`,
      );
      if (report) setMigrationReport(report);
      if (state?.status === "staged_complete") {
        setWizardStep("review");
      } else if (state?.status === "finalized") {
        setWizardStep("done");
      }
    })();
  }, [lib.libraryId, store]);

  const sortedRuns = useMemo(
    () => [...lib.researchRuns].sort((a, b) => b.updatedAt - a.updatedAt),
    [lib.researchRuns],
  );

  const withPending = useCallback(async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }, []);

  const initVault = useCallback(() => {
    void withPending(async () => {
      const response = await fetch("/api/cloud/vault/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to initialize vault.");
      setPassphrase("");
      await loadVaultStatus();
    });
  }, [loadVaultStatus, passphrase, withPending]);

  const unlockVault = useCallback(() => {
    void withPending(async () => {
      const response = await fetch("/api/cloud/vault/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to unlock vault.");
      setPassphrase("");
      await loadVaultStatus();
    });
  }, [loadVaultStatus, passphrase, withPending]);

  const lockVault = useCallback(() => {
    void withPending(async () => {
      const response = await fetch("/api/cloud/vault/lock", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to lock vault." }));
        throw new Error(payload.error);
      }
      await loadVaultStatus();
    });
  }, [loadVaultStatus, withPending]);

  const saveProviderKey = useCallback(
    (provider: "anthropic" | "tavily", value: string) => {
      void withPending(async () => {
        const response = await fetch("/api/cloud/vault/keys", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey: value }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to save provider key.");
        if (provider === "anthropic") setAnthropicKey("");
        if (provider === "tavily") setTavilyKey("");
        await loadVaultStatus();
      });
    },
    [loadVaultStatus, withPending],
  );

  const removeProviderKey = useCallback(
    (provider: "anthropic" | "tavily") => {
      void withPending(async () => {
        const response = await fetch("/api/cloud/vault/keys", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to remove provider key.");
        await loadVaultStatus();
      });
    },
    [loadVaultStatus, withPending],
  );

  const cancelRun = useCallback(
    (id: string) => {
      void withPending(async () => {
        const response = await fetch(`/api/research/runs/${id}/cancel`, { method: "POST" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Failed to cancel run.");
        await lib.refreshResearchRuns();
      });
    },
    [lib, withPending],
  );

  const applyProviderSettings = useCallback(() => {
    lib.setCloudProviderConfig(providerConfigDraft);
  }, [lib, providerConfigDraft]);

  const applyBudgetSettings = useCallback(() => {
    lib.setDefaultRunBudget(budgetDraft);
  }, [budgetDraft, lib]);

  const handleMigratePreview = useCallback(async () => {
    setWizardStep("previewing");
    try {
      const [characters, locations, worldEntries, scenes, allNodes] = await Promise.all([
        store.getCharactersByLibrary(lib.libraryId),
        store.getLocationsByLibrary(lib.libraryId),
        store.getWorldEntriesByLibrary(lib.libraryId),
        store.queryEntriesByType("scene"),
        store.listAllNodes(),
      ]);
      const partNodes = allNodes.filter((n) => (n.type as string) === "part");
      const counts = {
        characters: characters.length,
        locations: locations.length,
        worldEntries: worldEntries.length,
        scenes: scenes.length,
        partNodes: partNodes.length,
      };
      setPreviewCounts(counts);
      setWizardStep("preview");
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : String(err));
      setWizardStep("error");
    }
  }, [lib.libraryId, store]);

  const handleMigrateRun = useCallback(async () => {
    setWizardStep("running");
    setMigrationProgress({ step: "snapshot", pct: 5 });
    setMigrationError(null);
    try {
      setMigrationProgress({ step: "staging migration", pct: 45 });
      const report = await migrateImp002Library(store, lib.libraryId);
      setMigrationProgress({ step: "staged_complete", pct: 100 });
      setMigrationReport(report);
      setWizardStep("review");
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : String(err));
      setWizardStep("error");
    }
  }, [lib.libraryId, store]);

  const handleMigrateConfirm = useCallback(async () => {
    setWizardStep("confirming");
    try {
      await finalizeImp002Migration(store, lib.libraryId);
      setWizardStep("done");
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : String(err));
      setWizardStep("error");
    }
  }, [lib.libraryId, store]);

  const handleMigrateRollback = useCallback(() => {
    // Non-destructive: migration is staged but not finalized.
    setMigrationReport(null);
    setMigrationProgress(null);
    setWizardStep("idle");
  }, []);

  return (
    <div className="library-page settings-page">
      <div className="library-page-header">
        <h2>Settings</h2>
        <button className="library-page-action" onClick={() => void lib.refreshResearchRuns()} disabled={pending}>
          Refresh Runs
        </button>
      </div>

      {error && (
        <div className="startup-error-box" style={{ marginBottom: 16 }}>
          <p>{error}</p>
        </div>
      )}

      <section className="library-card" style={{ marginBottom: 16, padding: 16 }}>
        <h3>Execution Mode</h3>
        <p>Local mode is default. Assisted Cloud and Deep Research require explicit confirmation per action.</p>
        <select
          value={lib.aiMode}
          onChange={(e) => lib.setAiMode(e.target.value as typeof lib.aiMode)}
          style={{ marginTop: 8 }}
        >
          <option value="local">Local</option>
          <option value="assisted_cloud">Assisted Cloud</option>
          <option value="deep_research">Deep Research</option>
        </select>
      </section>

      <section className="library-card" style={{ marginBottom: 16, padding: 16 }}>
        <h3>Cloud Vault</h3>
        <p>
          Status: {vaultStatus?.initialized ? "Initialized" : "Not initialized"} · {vaultStatus?.unlocked ? "Unlocked" : "Locked"}
        </p>
        <label style={{ display: "block", marginTop: 8 }}>
          Vault passphrase
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter passphrase"
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="library-page-action" onClick={initVault} disabled={pending || !passphrase.trim()}>
            Initialize Vault
          </button>
          <button className="library-page-action" onClick={unlockVault} disabled={pending || !passphrase.trim()}>
            Unlock Vault
          </button>
          <button className="library-page-action" onClick={lockVault} disabled={pending || !vaultStatus?.unlocked}>
            Lock Vault
          </button>
        </div>
      </section>

      <section className="library-card" style={{ marginBottom: 16, padding: 16 }}>
        <h3>Provider Keys</h3>
        <p>
          Anthropic: {vaultStatus?.providers.anthropic ? "Configured" : "Missing"} · Tavily: {vaultStatus?.providers.tavily ? "Configured" : "Missing"}
        </p>

        <label style={{ display: "block", marginTop: 10 }}>
          Anthropic API key
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            className="library-page-action"
            onClick={() => saveProviderKey("anthropic", anthropicKey)}
            disabled={pending || !vaultStatus?.unlocked || !anthropicKey.trim()}
          >
            Save Anthropic Key
          </button>
          <button
            className="library-page-action"
            onClick={() => removeProviderKey("anthropic")}
            disabled={pending || !vaultStatus?.unlocked || !vaultStatus?.providers.anthropic}
          >
            Remove
          </button>
        </div>

        <label style={{ display: "block", marginTop: 14 }}>
          Tavily API key
          <input
            type="password"
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            placeholder="tvly-..."
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            className="library-page-action"
            onClick={() => saveProviderKey("tavily", tavilyKey)}
            disabled={pending || !vaultStatus?.unlocked || !tavilyKey.trim()}
          >
            Save Tavily Key
          </button>
          <button
            className="library-page-action"
            onClick={() => removeProviderKey("tavily")}
            disabled={pending || !vaultStatus?.unlocked || !vaultStatus?.providers.tavily}
          >
            Remove
          </button>
        </div>
      </section>

      <section className="library-card" style={{ marginBottom: 16, padding: 16 }}>
        <h3>Cloud Provider Config</h3>
        <label style={{ display: "block", marginTop: 8 }}>
          Anthropic model
          <input
            value={providerConfigDraft.anthropicModel}
            onChange={(e) =>
              setProviderConfigDraft((prev) => ({ ...prev, anthropicModel: e.target.value }))
            }
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input
            type="checkbox"
            checked={providerConfigDraft.tavilyEnabled}
            onChange={(e) =>
              setProviderConfigDraft((prev) => ({ ...prev, tavilyEnabled: e.target.checked }))
            }
          />
          Enable Tavily in Deep Research
        </label>
        <button className="library-page-action" style={{ marginTop: 10 }} onClick={applyProviderSettings}>
          Save Provider Config
        </button>
      </section>

      <section className="library-card" style={{ marginBottom: 16, padding: 16 }}>
        <h3>Default Research Budget</h3>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {BUDGET_FIELDS.map((field) => (
            <label key={field}>
              {field}
              <input
                type="number"
                min={0}
                value={budgetDraft[field]}
                onChange={(e) =>
                  setBudgetDraft((prev) => ({
                    ...prev,
                    [field]: Number(e.target.value),
                  }))
                }
                style={{ width: "100%", marginTop: 6 }}
              />
            </label>
          ))}
        </div>
        <button className="library-page-action" style={{ marginTop: 12 }} onClick={applyBudgetSettings}>
          Save Budget Defaults
        </button>
      </section>

      <section className="library-card" style={{ padding: 16 }}>
        <h3>Deep Research Runs</h3>
        {sortedRuns.length === 0 ? (
          <p>No runs yet.</p>
        ) : (
          <ul className="library-list">
            {sortedRuns.map((run) => (
              <li key={run.id} className="library-item-row" style={{ alignItems: "flex-start" }}>
                <div>
                  <strong>{run.status.replace(/_/g, " ")}</strong> · {run.phase}
                  <div style={{ marginTop: 4 }}>{run.query}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                    ${run.usage.spentUsd.toFixed(2)} · in {run.usage.inputTokens} tok · out {run.usage.outputTokens} tok · sources {run.usage.sourcesFetched}
                  </div>
                </div>
                {(run.status === "queued" || run.status === "running") && (
                  <button className="library-page-action" onClick={() => cancelRun(run.id)} disabled={pending}>
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="library-card" id="migration" style={{ marginTop: 16, padding: 16 }}>
        <h3>Data Migration</h3>
        <p className="systems-description">
          Stage the imp-plan-002 migration from legacy/canonical records into the new
          universe-entry stores. Migration is non-destructive until you explicitly finalize.
        </p>

        {/* Step 1 — Intro */}
        {wizardStep === "idle" && (
          <div>
            <p style={{ marginBottom: 12 }}>
              This wizard snapshots legacy state, creates/updates the universe, migrates entries,
              seeds timeline/revisions/suggestions, and marks the library as <code>staged_complete</code>.
            </p>
            <button
              className="library-page-action primary"
              onClick={() => void handleMigratePreview()}
            >
              Preview migration
            </button>
          </div>
        )}

        {/* Step 2 — Previewing (loading) */}
        {wizardStep === "previewing" && (
          <p className="systems-status">Counting entities…</p>
        )}

        {/* Step 3 — Preview counts */}
        {wizardStep === "preview" && previewCounts && (
          <div className="migration-preview">
            <p>The following will be converted:</p>
            <ul>
              <li>{previewCounts.characters} character{previewCounts.characters !== 1 ? "s" : ""}</li>
              <li>{previewCounts.locations} location{previewCounts.locations !== 1 ? "s" : ""}</li>
              <li>{previewCounts.worldEntries} world entr{previewCounts.worldEntries !== 1 ? "ies" : "y"}</li>
              <li>{previewCounts.scenes} scene node{previewCounts.scenes !== 1 ? "s" : ""}</li>
              {previewCounts.partNodes > 0 && (
                <li>{previewCounts.partNodes} &quot;part&quot; node{previewCounts.partNodes !== 1 ? "s" : ""} renamed to &quot;section&quot;</li>
              )}
            </ul>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="library-page-action primary"
                onClick={() => void handleMigrateRun()}
              >
                Run migration
              </button>
              <button
                className="library-page-action"
                onClick={() => setWizardStep("idle")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Running (progress bar) */}
        {wizardStep === "running" && (
          <div className="migration-running">
            <p className="systems-status">
              Migrating{migrationProgress ? ` — ${migrationProgress.step}` : ""}…
            </p>
            {migrationProgress && (
              <div
                style={{
                  background: "var(--border-subtle, #e0e0e0)",
                  borderRadius: 4,
                  height: 8,
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "var(--accent, #0070f3)",
                    height: "100%",
                    width: `${migrationProgress.pct}%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 5 — Review report */}
        {wizardStep === "review" && migrationReport && (
          <div className="migration-review">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Migration complete — review results</p>
            <ul>
              <li>{migrationReport.entryCount} entr{migrationReport.entryCount !== 1 ? "ies" : "y"} migrated</li>
              <li>{migrationReport.relationCount} relation{migrationReport.relationCount !== 1 ? "s" : ""} migrated</li>
              <li>{migrationReport.timelineCount} timeline{migrationReport.timelineCount !== 1 ? "s" : ""} seeded</li>
              <li>{migrationReport.eventCount} event{migrationReport.eventCount !== 1 ? "s" : ""} seeded</li>
              <li>{migrationReport.revisionCount} revision{migrationReport.revisionCount !== 1 ? "s" : ""} seeded</li>
              <li>{migrationReport.seededSuggestions} suggestion{migrationReport.seededSuggestions !== 1 ? "s" : ""} created</li>
            </ul>
            {migrationReport.warnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontWeight: 600, color: "var(--warning, #d97706)" }}>
                  Warnings ({migrationReport.warnings.length})
                </p>
                <ul style={{ marginTop: 4 }}>
                  {migrationReport.warnings.map((w, i) => (
                    <li key={i} style={{ fontSize: 13, opacity: 0.85 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
              Finalize marks legacy rows as migrated and closes the staged migration for this
              library. Legacy stores are still preserved until explicit cleanup.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="library-page-action primary"
                onClick={() => void handleMigrateConfirm()}
              >
                Finalize migration
              </button>
              <button
                className="library-page-action"
                onClick={handleMigrateRollback}
              >
                Rollback
              </button>
            </div>
          </div>
        )}

        {/* Step 6 — Confirming */}
        {wizardStep === "confirming" && (
          <p className="systems-status">Confirming…</p>
        )}

        {/* Step 7 — Done */}
        {wizardStep === "done" && (
          <div className="migration-done">
            <p>✓ Migration finalized — staged imp-plan-002 migration is complete for this library.</p>
            <button
              className="library-page-action"
              onClick={() => {
                setWizardStep("idle");
                setMigrationReport(null);
                setPreviewCounts(null);
                setMigrationProgress(null);
              }}
            >
              Run again
            </button>
          </div>
        )}

        {/* Error state */}
        {wizardStep === "error" && (
          <div className="migration-error">
            <p>Migration failed: {migrationError}</p>
            <button
              className="library-page-action"
              onClick={() => {
                setWizardStep("idle");
                setMigrationError(null);
              }}
            >
              Retry
            </button>
          </div>
        )}

      </section>
    </div>
  );
}
