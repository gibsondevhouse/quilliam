# Quilliam

Local-first, privacy-focused IDE for writers, powered by **Gemma 3** via **Ollama**.

## Development

```bash
npm install
npm run dev
```

Run Ollama in a separate terminal:

```bash
ollama serve
```

## Architecture & Tech Stack

- **Web app:** Next.js 16 / React 19 (App Router)
- **Desktop app:** SwiftUI + SwiftData (`Quilliam/`)
- **Local Inference:** Ollama REST API
- **Model:** Gemma 3
- **Storage:** IndexedDB (Local-only)
- **RAG:** Hierarchical nodes + SHA-256 fragment hashing + local vector retrieval

Built for Apple Silicon with Unified Memory awareness.
