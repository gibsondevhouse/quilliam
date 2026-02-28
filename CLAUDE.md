# CLAUDE.md

This file provides repository guidance for coding agents.

## Project Snapshot

Quilliam is a local-first writing IDE (web app):

- Web app: Next.js 16.1.6 + React 19 (`src/`)
- Local inference: Ollama at `http://localhost:11434`
- Optional cloud tiers: Anthropic (assist/refactor) + Tavily (deep research), opt-in only
- Storage: IndexedDB `quilliam-rag` (DB v11, fully browser-local)

By default manuscript data stays local. Cloud/deep-research requests require explicit user opt-in before any external API call.

## Development Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

Run Ollama in a separate terminal (with Metal/GPU tuning):

```bash
./scripts/start-ollama.sh
```

## Web App Architecture (`src/`)

- Root shell: `src/app/layout.tsx` + `src/app/ClientShell.tsx`
- Library workspace: `src/app/library/[libraryId]/layout.tsx`
- Chat API proxy: `src/app/api/chat/route.ts`
- Embeddings/status APIs: `src/app/api/embeddings/route.ts`, `src/app/api/status/route.ts`, `src/app/api/system/route.ts`
- Canonical extraction: `src/app/api/extract-canonical/route.ts`
- Cloud assist: `src/app/api/cloud/assist/route.ts`
- Research runs: `src/app/api/research/runs/`
- RAG persistence + retrieval: `src/lib/rag/*` (DB v11 — see AGENT.md §5 for full store inventory)
- Domain types (universe engine): `src/lib/types.ts`
- Worker hashing: `src/workers/rag-indexer.ts`

## Domain Model Summary

Entry-centric universe engine (Plan 002):

- **Entry** supertype covers: `character`, `location`, `culture`, `organization`, `system`, `item`, `language`, `religion`, `lineage`, `economy`, `rule`
- Each entry has `canonStatus` (`draft` → `proposed` → `canon`) and `relationships: RelationshipRef[]`
- **EntryPatch** (`status: "pending" | "accepted" | "rejected"`) replaces `CanonicalPatch` for Plan-002 targets
- Manuscript hierarchy: `Universe > Series > Book > Chapter > Scene`; `TimeAnchor` / `Era` / `Event` for the timeline layer
- Bi-temporal patterns: `CultureVersion`, `OrganizationVersion`, `ReligionVersion` (in-universe validity + system-time)

## Non-Negotiables

1. Local mode must remain fully local through Ollama.
2. Cloud/deep-research calls must require explicit user consent and run via server API routes.
3. Preserve streaming behavior for local chat responses.
4. Keep TypeScript strict-mode clean and lint/build green.
5. All AI-proposed mutations land as `pending` patches — never auto-apply without `autoCommit: true` explicitly set.
6. Never store plaintext provider keys in UI state, logs, or `localStorage`.
