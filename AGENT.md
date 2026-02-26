# AGENT.md — Quilliam Agent Guide

## 1) Project Overview

Quilliam is a local-first writing IDE with:

- Web app in `src/` (Next.js 16, React 19, TypeScript strict)
- Native app in `Quilliam/` (SwiftUI + SwiftData)
- Local inference via Ollama (`http://localhost:11434`)

Zero-knowledge rule: user manuscript/chat content must not be sent to any external service.

## 2) Local Development

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

## 3) Web App Structure

- Root shell/state boundary: `src/app/ClientShell.tsx`
- Library-scoped workspace state: `src/app/library/[libraryId]/layout.tsx`
- API routes: `src/app/api/*/route.ts`
- RAG modules and IndexedDB contracts: `src/lib/rag/*`
- Shared app entities: `src/lib/types.ts`
- Shared nav types: `src/lib/navigation.ts`
- Background hashing worker: `src/workers/rag-indexer.ts`

## 4) Coding Rules

1. Keep Ollama calls server-side (`/api/*`) for web client flows.
2. Do not import Node-only modules (`os`, server utils) into client components.
3. Maintain TypeScript strictness; avoid `any`.
4. Keep route/state behavior deterministic (no effect loops that keep pushing navigation).
5. Preserve streaming chat behavior (`/api/chat` passthrough + incremental UI updates).
6. Prefer pure functions in `src/lib/` for data transforms.

## 5) Verification Checklist

Before finalizing changes:

1. `npm run lint` passes.
2. `npm run build` passes.
3. Core routes resolve:
   - `/`
   - `/library/[libraryId]` (redirects to dashboard)
   - `/library/[libraryId]/stories/[storyId]`
   - `/library/[libraryId]/threads/[threadId]`
4. AI edit lifecycle works for chapter and entity targets (pending, accept, reject).
5. Tree operations reject invalid drag/drop parent-child moves.

## 6) Native App Notes

- View model: `Quilliam/ViewModels/ChatViewModel.swift`
- Edit parser: `Quilliam/Services/EditParser.swift`
- Sidebar/editor/chat UI: `Quilliam/Views/*`

Keep parser behavior aligned with the TypeScript parser where practical (edit fences, recovery rules).
