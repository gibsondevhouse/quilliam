# CLAUDE.md

This file provides repository guidance for coding agents.

## Project Snapshot

Quilliam is a local-first writing IDE with two clients in one repo:

- Web app: Next.js 16 + React 19 (`src/`)
- Native app: SwiftUI + SwiftData (`Quilliam/`)
- Local inference: Ollama at `http://localhost:11434`

No manuscript data should leave the local machine.

## Development Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

Run Ollama in a separate terminal:

```bash
ollama serve
```

## Web App Architecture (`src/`)

- Root shell: `src/app/layout.tsx` + `src/app/ClientShell.tsx`
- Library workspace state: `src/app/library/[libraryId]/layout.tsx`
- Chat API proxy: `src/app/api/chat/route.ts`
- Embeddings/status APIs: `src/app/api/embeddings/route.ts`, `src/app/api/status/route.ts`, `src/app/api/system/route.ts`
- RAG persistence + retrieval: `src/lib/rag/*`
- Worker hashing: `src/workers/rag-indexer.ts`

## Native App Architecture (`Quilliam/`)

- App entry: `Quilliam/QuilliamApp.swift`
- State orchestration: `Quilliam/ViewModels/ChatViewModel.swift`
- Streaming + edit parsing: `Quilliam/Services/OllamaService.swift`, `Quilliam/Services/EditParser.swift`
- Editor/chat views: `Quilliam/Views/*`

## Non-Negotiables

1. Keep inference local through Ollama only.
2. Do not call external AI APIs.
3. Preserve streaming behavior for chat responses.
4. Keep TypeScript strict-mode clean and lint/build green.
