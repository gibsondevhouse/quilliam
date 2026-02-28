# AGENT.md — Quilliam Agent Guide

## 1) Product Model And Trust Boundaries

Quilliam is a local-first writing IDE with a three-tier AI model:

- `local` (default): Ollama-only, on-device processing.
- `assisted_cloud`: Anthropic BYO key, explicit opt-in per action, review-first patches.
- `deep_research`: Anthropic + Tavily BYO keys, explicit opt-in per action, durable runs with hard budgets and mandatory citations.

Non-negotiables:

1. Local manuscript/library files remain the source of truth.
2. Cloud/research outputs are suggestions and must remain pending until user approval.
3. No silent cloud calls. Cloud actions always require explicit user confirmation.
4. Never store plaintext provider keys in UI state, logs, or browser local storage.

## 2) Repository Topology

- Web app: `src/` (Next.js 16, React 19, TS strict)
- Local inference: Ollama (`http://localhost:11434`)

Critical web entry points:

- App shell and global state: `src/app/ClientShell.tsx`
- Library workspace orchestration: `src/app/library/[libraryId]/layout.tsx`
- Library sub-routes: `universe/`, `books/`, `chapters/`, `scenes/`, `characters/`, `locations/`, `cultures/`, `organizations/`, `factions/`, `magic-systems/`, `items/`, `languages/`, `religions/`, `lineages/`, `economics/`, `rules/`, `cosmology/`, `master-timeline/`, `maps/`, `media/`, `relationship-web/`, `continuity-issues/`, `conflicts/`, `suggestions/`, `change-log/`, `threads/[id]/`, `settings/`
- Chat UI and mode routing: `src/components/Chat.tsx`
- Cloud vault + provider clients: `src/lib/cloud/*`
- Deep research engine: `src/lib/research/*`
- Domain types (entry-centric universe engine): `src/lib/types.ts`
- API routes: `src/app/api/*/route.ts`
  - Local: `/api/chat`, `/api/embeddings`, `/api/status`, `/api/system`, `/api/extract-canonical`
  - Cloud: `/api/cloud/assist`, `/api/cloud/vault/*`
  - Research: `/api/research/runs` (GET/POST), `/api/research/runs/[id]` (GET), `/api/research/runs/[id]/cancel` (POST), `/api/research/runs/[id]/events` (SSE)
- RAG + IDB contracts: `src/lib/rag/*`
- RAG indexer worker: `src/workers/rag-indexer.ts`

## 3) Local Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

Run Ollama separately:

```bash
ollama serve
```

Optional web runtime knobs:

- `QUILLIAM_CLOUD_VAULT_FILE` (encrypted cloud vault file path)
- `QUILLIAM_RESEARCH_RUNS_FILE` (deep research run persistence path)
- `OLLAMA_API_URL` (default `http://localhost:11434`)

## 4) Implementation Guardrails

1. Keep provider calls server-side via `/api/*` in web flows.
2. Keep local mode behavior intact and fast; do not regress local streaming UX.
3. Enforce deep-research hard caps: USD/tokens/time/sources.
4. Enforce per-claim citations in deep-research outputs.
5. Preserve deterministic state transitions (no mode auto-switches or hidden side effects).
6. Keep review-first edit lifecycle for chapter/entity targets (`pending -> accepted|rejected`).
7. Prefer pure transformation utilities in `src/lib/` and avoid `any`.

## 5) Persistence Contracts

Web:

- IndexedDB `quilliam-rag` is at **DB v11**. Store inventory:
  - v1–v2: `nodes`, `embeddings`, `metadata`, `chatSessions`, `chatMessages`
  - v3: `characters`, `locations`, `worldEntries`
  - v4: `stories`
  - v5: `aiSettings`, `researchRuns`, `researchArtifacts`
  - v6: `usageLedgers`
  - v7: `canonicalDocs`, `relationships`, `patches`
  - v8: `relationIndexByDoc`, `patchByDoc` (compound-key rebuilds)
  - v9: `universes`, `entries`, `series`, `books`, `chapters`, `scenes`, `entryRelations`, `timelines`, `eras`, `events`, `calendars`, `timeAnchors`, `memberships`, `cultureMemberships`, `itemOwnerships`, `mentions`, `media`, `maps`, `mapPins`
  - v10: `cultureVersions`, `organizationVersions`, `religionVersions`, `continuityIssues`, `suggestions`, `revisions`
  - v11: `entryPatches`, `entryPatchByEntry`
- `RAGNode` hierarchy: `library > series > book > section > chapter > scene > fragment` (7 levels).
- `RAGNode.sceneDocId?: string` links a scene tree-node to its canonical scene doc in the `canonicalDocs` store.
- **Universe engine entity model** (`Entry` supertype): entries carry `entryType` ∈ `{ character, location, culture, organization, system, item, language, religion, lineage, economy, rule }` plus legacy aliases. Each entry tracks `canonStatus` ∈ `{ draft, proposed, canon, deprecated, retconned, alternate-branch }`.
- **Entity patch lifecycle**: model-proposed mutations land as `EntryPatch { status: "pending" }` records in `entryPatches`; user accepts/rejects from the suggestions or change-log views. Patches are never auto-committed unless `autoCommit: true` is explicitly set.
- **Legacy canonical patch lifecycle**: `CanonicalPatch` records in `patches` remain valid; `EntryPatch` supersedes for Plan-002 universe-engine targets.
- Cloud vault is encrypted at rest and unlocked per session.
- Deep research runs/artifacts/usage are durably persisted and resumable after reload.

## 6) Verification Checklist

Before finalizing:

1. `npm run lint` passes.
2. `npm run build` passes.
3. Core pages resolve:
   - `/`
   - `/library/[libraryId]` (dashboard redirect)
   - `/library/[libraryId]/universe`
   - `/library/[libraryId]/books`
   - `/library/[libraryId]/chapters`
   - `/library/[libraryId]/scenes`
   - `/library/[libraryId]/characters`
   - `/library/[libraryId]/locations`
   - `/library/[libraryId]/cultures`
   - `/library/[libraryId]/organizations`
   - `/library/[libraryId]/master-timeline`
   - `/library/[libraryId]/maps`
   - `/library/[libraryId]/continuity-issues`
   - `/library/[libraryId]/suggestions`
   - `/library/[libraryId]/change-log`
   - `/library/[libraryId]/settings`
   - `/library/[libraryId]/threads/[threadId]`
4. Core APIs resolve:
   - `/api/chat`
   - `/api/embeddings`
   - `/api/status`
   - `/api/system`
   - `/api/extract-canonical`
   - `/api/cloud/vault/*`
   - `/api/cloud/assist`
   - `/api/research/runs` (GET + POST)
   - `/api/research/runs/[id]` (GET)
   - `/api/research/runs/[id]/cancel` (POST)
   - `/api/research/runs/[id]/events` (SSE stream)
5. Local mode still streams and applies edit fences correctly.
6. Assisted cloud applies suggestions as pending changes (never auto-commits).
7. Deep research run lifecycle works: create, progress, complete/cancel/budget_exceeded.
8. Missing/locked keys produce explicit user-facing errors and safe fallback.


