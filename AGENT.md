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
- Native app: `Quilliam/` (SwiftUI + SwiftData)
- Local inference: Ollama (`http://localhost:11434`)

Critical web entry points:

- App shell and global state: `src/app/ClientShell.tsx`
- Library workspace orchestration: `src/app/library/[libraryId]/layout.tsx`
- Library sub-routes: `dashboard/`, `stories/`, `chapters/`, `beats/`, `characters/`, `locations/`, `world/`, `threads/[id]/`, `systems/`
- Chat UI and mode routing: `src/components/Chat.tsx`
- Cloud vault + provider clients: `src/lib/cloud/*`
- Deep research engine: `src/lib/research/*`
- Shared entity types: `src/lib/types.ts`
- API routes: `src/app/api/*/route.ts`
  - Local: `/api/chat`, `/api/embeddings`, `/api/status`, `/api/system`
  - Cloud: `/api/cloud/assist`, `/api/cloud/vault/*`
  - Research: `/api/research/runs` (GET/POST), `/api/research/runs/[id]` (GET), `/api/research/runs/[id]/cancel` (POST), `/api/research/runs/[id]/events` (SSE)
- RAG + IDB contracts: `src/lib/rag/*`
- RAG indexer worker: `src/workers/rag-indexer.ts`

Critical native entry points:

- App entry: `Quilliam/QuilliamApp.swift`
- AI orchestration: `Quilliam/ViewModels/ChatViewModel.swift`
- Ollama streaming: `Quilliam/Services/OllamaService.swift`
- Edit-fence parsing: `Quilliam/Services/EditParser.swift`
- Domain models: `Quilliam/Models/` (`Document.swift`, `Message.swift`, `OllamaModels.swift`, `LineEdit.swift`, `EditableEntity.swift`)
- Chat UX controls (mode, keys, run monitor): `Quilliam/Views/ChatView.swift`

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

- IndexedDB `quilliam-rag` is at **DB v6**. Store inventory:
  - v1–v2: `nodes`, `embeddings`, `metadata`, `chatSessions`, `chatMessages`
  - v3: `characters`, `locations`, `worldEntries`
  - v4: `stories`
  - v5: `aiSettings`, `researchRuns`, `researchArtifacts`
  - v6: `usageLedgers`
- Cloud vault is encrypted at rest and unlocked per session.
- Deep research runs/artifacts/usage are durably persisted and resumable after reload.

Native:

- Provider keys use Keychain (`CloudSecretsStore`).
- Deep research runs persist in app-support JSON managed by `DeepResearchRunActor`.

## 6) Verification Checklist

Before finalizing:

1. `npm run lint` passes.
2. `npm run build` passes.
3. Core pages resolve:
   - `/`
   - `/library/[libraryId]` (dashboard redirect)
   - `/library/[libraryId]/dashboard`
   - `/library/[libraryId]/stories`
   - `/library/[libraryId]/chapters`
   - `/library/[libraryId]/beats`
   - `/library/[libraryId]/characters`
   - `/library/[libraryId]/locations`
   - `/library/[libraryId]/world`
   - `/library/[libraryId]/systems`
   - `/library/[libraryId]/threads/[threadId]`
4. Core APIs resolve:
   - `/api/chat`
   - `/api/embeddings`
   - `/api/status`
   - `/api/system`
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

## 7) Cross-Platform Parser Consistency

Keep Swift and TypeScript edit-fence parsing behavior aligned where practical:

- Header grammar (`line=`, `line=N+`, ranges, `delete`, `file=` target)
- 1-based to 0-based conversion
- Unclosed fence recovery behavior
- File target key mapping (`__active__`, `character:*`, `location:*`, `world:*`)
