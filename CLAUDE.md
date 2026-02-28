# CLAUDE.md

This file provides repository guidance for coding agents.

## Project Snapshot

Quilliam is a local-first writing IDE (web app):

- Web app: Next.js 16 + React 19 (`src/`)
- Local inference: Ollama at `http://localhost:11434`
- Optional cloud tiers: Anthropic (assist/refactor) + Tavily (deep research), opt-in only

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
- Library workspace state: `src/app/library/[libraryId]/layout.tsx`
- Chat API proxy: `src/app/api/chat/route.ts`
- Embeddings/status APIs: `src/app/api/embeddings/route.ts`, `src/app/api/status/route.ts`, `src/app/api/system/route.ts`
- RAG persistence + retrieval: `src/lib/rag/*`
- Worker hashing: `src/workers/rag-indexer.ts`

## Non-Negotiables

1. Local mode must remain fully local through Ollama.
2. Cloud/deep-research calls must require explicit user consent and run via server API routes.
3. Preserve streaming behavior for local chat responses.
4. Keep TypeScript strict-mode clean and lint/build green.
