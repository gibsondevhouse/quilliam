# Quilliam

Local-first, privacy-focused IDE for writers, powered by **Gemma 3** via **Ollama**.

## Development

```bash
npm install
npm run dev
```

## Architecture & Tech Stack

- **Framework:** Next.js 15+ / React (PWA)
- **Local Inference:** Ollama REST API
- **Model:** Gemma 3
- **Storage:** IndexedDB (Local-only)
- **RAG:** 6-level hierarchy with SHA-256 fragment hashing and vector search.

Built for Apple Silicon with Unified Memory awareness.
