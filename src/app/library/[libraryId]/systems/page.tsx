"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLibraryContext } from "@/lib/context/LibraryContext";
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

export default function SystemsPage() {
  const lib = useLibraryContext();

  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [providerConfigDraft, setProviderConfigDraft] = useState<CloudProviderConfig>(lib.cloudProviderConfig);
  const [budgetDraft, setBudgetDraft] = useState<RunBudget>(lib.defaultRunBudget);

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

  return (
    <div className="library-page systems-page">
      <div className="library-page-header">
        <h2>Systems</h2>
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
    </div>
  );
}
