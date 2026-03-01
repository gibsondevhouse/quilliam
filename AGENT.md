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
5. All AI-proposed mutations land as `pending` patches — never auto-apply without `autoCommit: true` explicitly set.

## 2) Repository Topology

- Web app: `src/` (Next.js 16.1.6, React 19, TS strict)
- Local inference: Ollama (`http://localhost:11434`)

### Critical entry points

| Path | Purpose |
|---|---|
| `src/app/ClientShell.tsx` | App shell and global state |
| `src/app/library/[libraryId]/layout.tsx` | Library workspace orchestration |
| `src/components/Chat/index.tsx` | Chat UI and AI mode routing |
| `src/lib/types.ts` | Domain types — Entry supertype, all universe engine records |
| `src/lib/rag/db/schema.ts` | IndexedDB schema and full migration history |
| `src/lib/rag/store.ts` | Persisted record shapes shared between IDB and workers |
| `src/lib/rag/hierarchy.ts` | RAG node types and 7-level manuscript tree |
| `src/lib/cloud/` | Cloud vault and Anthropic/Tavily provider clients |
| `src/lib/research/` | Deep research engine (phases, budget enforcement, citations) |
| `src/lib/domain/` | Domain-layer utilities for universe engine operations |
| `src/lib/context/` | React context providers for library/universe state |
| `src/workers/rag-indexer.ts` | Service worker for SHA-256 fragment hashing and embedding |

### API routes (`src/app/api/*/route.ts`)

**Local — always available:**
- `POST /api/chat` — Ollama streaming proxy
- `POST /api/embeddings` — Ollama embeddings proxy
- `GET  /api/status` — Ollama + model health
- `GET  /api/system` — Platform/model metadata
- `POST /api/extract-canonical` — Extract `EntryPatch` records from prose

**Cloud — require unlocked vault session:**
- `POST /api/cloud/assist`
- `GET|POST|DELETE /api/cloud/vault/*`

**Research:**
- `GET|POST /api/research/runs`
- `GET /api/research/runs/[id]`
- `POST /api/research/runs/[id]/cancel`
- `GET /api/research/runs/[id]/events` (SSE)

### Library sub-routes

`universe/`, `books/`, `chapters/`, `scenes/`, `characters/`, `locations/`, `cultures/`, `organizations/`, `factions/`, `magic-systems/`, `items/`, `languages/`, `religions/`, `lineages/`, `economics/`, `rules/`, `cosmology/`, `master-timeline/`, `maps/`, `media/`, `relationship-web/`, `continuity-issues/`, `conflicts/`, `analytics/`, `branches/`, `suggestions/`, `change-log/`, `threads/[id]/`, `settings/`

### Component inventory (`src/components/`)

| Component | Purpose |
|---|---|
| `AnalyticsPage/` | Deep analytics dashboard — entry counts by type/canon status, orphaned entries, unanchored characters, unused orgs, uncited rules, manuscript stats |
| `AppNav/` | Sidebar navigation tree + context menu |
| `BookTimelinePage/` | Per-book timeline view |
| `BranchDiffPage/` | Branch comparison UI — groups `alternate-branch` entries by `branch:Name` tag, side-by-side field diff vs canon counterpart, promote-to-canon action with optional retcon |
| `BuildFeed/` | AI suggestion feed with patch cards and continuity issues |
| `CanonicalDocDashboard/` | Entry editor + relations panel |
| `ChangeLogPage.tsx` | Revision history view |
| `ChapterEditorPage.tsx` | Monaco-based chapter editor |
| `Chat/` | Multi-mode AI chat (local / cloud / research) |
| `CultureVersionPanel/` | Era-aware culture snapshot management |
| `EntityVersionPanel/` | Era-aware org/religion snapshot panels (generic, parameterized by `entityKind`) |
| `Editor/` | Shared prose editor primitives |
| `BulkImportPanel/` | CSV bulk import for encyclopedia entries |
| `LibraryDashboard/` | Library landing page |
| `MapsPage/` | Interactive map + pin management |
| `MasterTimelinePage/` | Universe-level timeline + eras |
| `MediaLibraryPage/` | Media asset library (images, audio, video, documents) |
| `ProvenancePanel/` | Per-entry provenance panel — scene mentions resolved to Book/Chapter/Scene labels, source citations by kind (scene/manual/chat/research), add/remove manual citations |
| `RelationshipWeb/` | Visual entity relationship graph |
| `SceneMetaPanel.tsx` | Scene metadata (POV, location, time anchor) |
| `SystemStatus.tsx` | AI provider health indicator |

## 3) Local Development

```bash
npm install
npm run dev       # http://localhost:3000 (auto-bumps to 3001+ if port busy)
npm run lint
npm run build
```

Additional lint targets:

```bash
npm run lint:css-size        # Fails if any partials/_*.css exceeds 400 lines
npm run lint:component-size  # Fails if any component .tsx exceeds 400 lines
```

Run Ollama separately (with Apple Silicon GPU tuning):

```bash
./scripts/start-ollama.sh
```

The script sets `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_KEEP_ALIVE=24h`, `OLLAMA_MAX_LOADED_MODELS=2` — keeping both the generative and embedding models resident in GPU memory.

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_API_URL` | `http://localhost:11434` | Ollama server base URL |
| `QUILLIAM_CLOUD_VAULT_FILE` | — | Path to encrypted cloud vault file |
| `QUILLIAM_RESEARCH_RUNS_FILE` | — | Path to deep research run persistence file |

## 4) Implementation Guardrails

1. Keep provider calls server-side via `/api/*`. Never call Anthropic or Tavily from browser code.
2. Keep local mode behavior intact and fast; do not regress local streaming UX.
3. Enforce deep-research hard caps: USD / tokens / time / sources (see `RunBudget` in `src/lib/types.ts`).
4. Enforce per-claim citations in deep-research outputs (`Citation.claimRef`).
5. Preserve deterministic state transitions — no mode auto-switches or hidden side effects.
6. Keep review-first edit lifecycle for chapter/entity targets (`pending → accepted | rejected`).
7. Prefer pure transformation utilities in `src/lib/` and avoid `any`.
8. TypeScript strict-mode must stay clean; `npm run lint` and `npm run build` must pass.
9. Component files must stay ≤ 400 lines; CSS partials must stay ≤ 400 lines.

## 5) Persistence Contracts

### IndexedDB `quilliam-rag` — current version: **v11**

Full store inventory by version added:

| Version | Stores added |
|---|---|
| v1–v2 | `nodes`, `embeddings`, `metadata`, `chatSessions`, `chatMessages` |
| v3 | `characters`, `locations`, `worldEntries` |
| v4 | `stories` |
| v5 | `aiSettings`, `researchRuns`, `researchArtifacts` |
| v6 | `usageLedgers` |
| v7 | `canonicalDocs`, `relationships`, `patches` |
| v8 | `relationIndexByDoc`, `patchByDoc` (compound-key index rebuilds) |
| v9 | `universes`, `entries`, `series`, `books`, `chapters`, `scenes`, `entryRelations`, `timelines`, `eras`, `events`, `calendars`, `timeAnchors`, `memberships`, `cultureMemberships`, `itemOwnerships`, `mentions`, `media`, `maps`, `mapPins` |
| v10 | `cultureVersions`, `organizationVersions`, `religionVersions`, `continuityIssues`, `suggestions`, `revisions` |
| v11 | `entryPatches`, `entryPatchByEntry` |

Schema definition: `src/lib/rag/db/schema.ts`  
Store access helpers: `src/lib/rag/db/` (decomposed per domain — entries, manuscript, relations, patches, timeline, chat, research, media, nodes)

### Yjs CRDT document stores (`quilliam-yjs-<chapterId>`)

Each open chapter/scene gets its own `IndexeddbPersistence` database (`quilliam-yjs-<nodeId>`).
The Y.Doc holds a single `Y.Text` at key `"content"` that is the authoritative source of truth for
the editor while open. Changes are also written to the main `quilliam-rag` `nodes` store via the
existing `quilliam:save` / `handleContentChange` pipeline.

Key files:
- `src/lib/yjs/yjsDoc.ts` — singleton registry (`getYjsDoc`, `destroyYjsDoc`)
- `src/components/Editor/EditorArea/hooks/useYjsBinding.ts` — React hook
- `src/components/Editor/EditorArea/index.tsx` — `chapterId` prop activates Yjs path

### Yjs CRDT document stores (`quilliam-yjs-<chapterId>`)

Each open chapter/scene gets its own `IndexeddbPersistence` database (`quilliam-yjs-<nodeId>`).
The Y.Doc holds a single `Y.Text` at key `"content"` that is the authoritative source of truth for
the editor while open. Changes are also persisted to the main `quilliam-rag` `nodes` store via the
existing `quilliam:save` event / `handleContentChange` pipeline.

Key files:
- `src/lib/yjs/yjsDoc.ts` — singleton registry (`getYjsDoc`, `destroyYjsDoc`)
- `src/components/Editor/EditorArea/hooks/useYjsBinding.ts` — React hook (`useYjsBinding`)
- `src/components/Editor/EditorArea/index.tsx` — `chapterId` prop activates Yjs path

### RAG node hierarchy (7 levels)

```
library → series → book → section → chapter → scene → fragment
```

- `library`: root; holds global settings and voice profiles
- `series`: optional grouping of books within a universe
- `book`: individual novel/volume manuscript container
- `section`: named structural division within a book (formerly "part")
- `chapter`: active writing buffer (in-focus editing unit)
- `scene`: writing unit linked to a canonical `Scene` domain record; `RAGNode.sceneDocId` bridges to the `scenes` IDB store
- `fragment` (leaf): semantic chunk (~500 tokens) produced by the chunker for vectorisation; never shown in tree UI

### Universe engine entity model

**`Entry` supertype** — all encyclopedia objects share:
- `entryType` ∈ `{ character, location, culture, organization, system, item, language, religion, lineage, economy, rule }` (core) + legacy aliases `{ faction, magic_system, lore_entry, scene, timeline_event }`
- `canonStatus` ∈ `{ draft, proposed, canon, deprecated, retconned, alternate-branch }`
- `relationships: RelationshipRef[]` — denormalised outbound edges for fast single-entry reads
- `sources: SourceRef[]` — per-entry provenance

**Bi-temporal versioned entities:**
- `CultureVersion` — era-aware culture snapshots (valid-time + system-time)
- `OrganizationVersion`, `ReligionVersion` — same bitemporal pattern

**Entity patch lifecycle (`EntryPatch`):**
- Model-proposed mutations land as `EntryPatch { status: "pending" }` in the `entryPatches` store.
- Users accept/reject from the suggestions or change-log views.
- Patches are **never auto-committed** unless `autoCommit: true` is explicitly set.
- `EntryPatch` supersedes legacy `CanonicalPatch` for all Plan-002 universe-engine targets; `CanonicalPatch` records in `patches` remain valid for backward compatibility.

**Other key contracts:**
- Cloud vault is encrypted at rest and unlocked per session only.
- Deep research runs/artifacts/usage are durably persisted and resumable across page reloads.
- `migrate-imp002.ts` (`src/lib/rag/migrate-imp002.ts`) handles data migration from Plan-001 structures to Plan-002 universe-engine stores.

## 6) Domain Type Quick Reference

Key types defined in `src/lib/types.ts`:

| Type | Description |
|---|---|
| `Entry` | Universal encyclopedia supertype |
| `EntryType` | `CoreEntryType \| LegacyEntryType` |
| `CanonStatus` | `draft \| proposed \| canon \| deprecated \| retconned \| alternate-branch` |
| `EntryPatch` | AI-proposed mutation batch, defaults to `pending` |
| `EntryPatchOperation` | Union of typed operations (create-entry, update-entry, add-relation, …) |
| `CultureVersion` | Bitemporal culture snapshot |
| `OrganizationVersion` | Bitemporal organization snapshot |
| `ReligionVersion` | Bitemporal religion snapshot |
| `Universe`, `Series`, `Book`, `Chapter`, `Scene` | Manuscript hierarchy |
| `Timeline`, `Era`, `Event`, `TimeAnchor`, `Calendar` | Timeline layer |
| `Relationship` / `Relation` | Entry↔Entry edges (transitional dual-shape) |
| `Membership` | Character↔Organization join |
| `CultureMembership` | Character↔Culture join (supports mixed heritage) |
| `ItemOwnership` | Item↔Owner provenance |
| `Mention` | Scene↔Entry mention index |
| `ContinuityIssue` | Detected contradiction or gap |
| `Suggestion` | AI or human proposed change |
| `ResearchRunRecord` | Deep research run state + artifacts |
| `AiExecutionMode` | `local \| assisted_cloud \| deep_research` |
| `RunBudget` | Hard caps: USD, tokens, time, sources |

## 7) Implementation Status

### V1 — complete
All core encyclopedia CRUD, manuscript hierarchy (Series/Book/Chapter/Scene), relationships/memberships/mentions, calendar/timeline/era, map+pins, revision changelog, library dashboard, command palette.

### V1.5 — complete
- `CultureVersionPanel` — era-aware culture snapshots ✅
- `EntityVersionPanel` — era-aware org/religion snapshots wired into `CanonicalDocDashboard` ✅
- `MediaLibraryPage` — media asset grid (`/media` route) ✅
- `BulkImportPanel` — CSV bulk import embedded in `CanonicalDocDashboard` ✅
- Conflicts & Treaties page (`/conflicts`) — full relationship-based implementation ✅
- Beats & Outline page (`/books/[id]/beats`) — chapter+scene beats per book ✅

### Legacy holdovers (pre-Plan-002 manuscript model)
These sub-routes still read from `useLibraryContext().stories` / `useWorkspaceContext().ragNodes` instead of IDB store.
The Book dashboard (`/books/[storyId]`) has been migrated. Remaining legacy files:
- `src/app/library/[libraryId]/books/[storyId]/chapters/page.tsx` — reads `ragNodes`
- `src/app/library/[libraryId]/books/[storyId]/chapters/[chapterId]/page.tsx` — uses `ragNodes`

### V2 — in progress
- **Deep analytics** (`/analytics` route, `AnalyticsPage` component) — entry type breakdown with canon-rate bars, orphaned entries, unanchored characters, unused organizations, uncited rules, manuscript stats (books/chapters/scenes/POV coverage) ✅
- **Rich provenance** (`ProvenancePanel` in `CanonicalDocDashboard`) — scene mentions resolved to Book/Chapter/Scene, source citations by kind (scene/manual/chat/research), add/remove manual `SourceRef` citations ✅
- **Branching timeline diff** (`/branches` route, `BranchDiffPage` component) — groups `alternate-branch` entries by `branch:Name` tag, side-by-side field diff vs canon counterpart, promote-to-canon with optional retcon of existing canon entry ✅
- **CRDT real-time co-editing (Yjs)** — `yjs` + `y-indexeddb` + `y-monaco` wired into `EditorArea`; `chapterId` prop activates a `Y.Doc` backed by `IndexeddbPersistence` (`quilliam-yjs-<id>` IDB store); `MonacoBinding` syncs Y.Text ↔ Monaco model; external content (AI patches) applied via Yjs transactions; falls back to legacy `setValue` path when `chapterId` is absent ✅

## 8) Verification Checklist

Before finalizing any change:

1. `npm run lint` passes (ESLint + css-size + component-size).
2. `npm run build` passes (TypeScript strict, no type errors).
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
   - `POST /api/chat`
   - `POST /api/embeddings`
   - `GET  /api/status`
   - `GET  /api/system`
   - `POST /api/extract-canonical`
   - `/api/cloud/vault/*`
   - `POST /api/cloud/assist`
   - `GET|POST /api/research/runs`
   - `GET /api/research/runs/[id]`
   - `POST /api/research/runs/[id]/cancel`
   - `GET /api/research/runs/[id]/events` (SSE)
5. Local mode streams chat and applies edit fences correctly.
6. Assisted cloud applies suggestions as `pending` patches (never auto-commits).
7. Deep research run lifecycle works: `queued → running → completed | cancelled | budget_exceeded | failed`.
8. Missing/locked provider keys produce explicit user-facing errors and safe fallback (no silent failures).


