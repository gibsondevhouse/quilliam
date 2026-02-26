# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Quilliam: Author/Journalist IDE

**Quilliam** is a local-first, privacy-focused IDE for writers, powered by **Gemma 3** via **Ollama** for inference, and optimized for **Apple Silicon** (Unified Memory Architecture).

### Core Tech Stack

- **Framework:** Next.js 15+ / React (PWA)
- **Local Inference:** Ollama REST API (`http://localhost:11434/api`)
- **Model Target:** Gemma 3 (4-bit QAT) with hardware-aware selection
- **Storage:** IndexedDB for manuscripts + Vector DB (local)
- **RAG Engine:** Recursive 6-level hierarchy with SHA-256 fragment hashing

---

## Development Commands

```bash
# Install dependencies
npm install

# Run local dev server
npm run dev

# Start Ollama (run in separate terminal)
ollama serve

# Pull the default model for your RAM
ollama pull gemma3:4b  # or gemma3:1b, gemma3:12b, gemma3:27b based on system
```

---

## Hardware-Aware Model Selection

The system detects total RAM via `os.totalmem()` (server-side) and assigns the appropriate Gemma 3 model:

| Detected RAM | Default Model  | Context | Mode |
|---|---|---|---|
| < 12 GB | `gemma3:1b` | 32K | Drafting/Grammar |
| < 24 GB | `gemma3:4b` | 128K | Multimodal/Research |
| < 48 GB | `gemma3:12b` | 128K | Structural Editing |
| ≥ 48 GB | `gemma3:27b` | 128K | World-Building |

Detection happens server-side at `/api/system` to support hardware beyond the 8GB cap of `navigator.deviceMemory`.

---

## Architecture: RAG Hierarchy

Quilliam organizes manuscripts as a **6-level recursive tree** (Parent-Pointer Graph):

1. **Library (Root)** — Global settings, user voice/style profiles, document themes
2. **Universe/Beat** — High-level world rules or investigative themes
3. **Series/Investigation** — Character arc continuity or multi-part reports
4. **Volume/Edition** — Individual books or long-form publication drafts
5. **Chapter/Article** — Active writing buffer (in-focus)
6. **Fragment (Leaf)** — Semantic chunks (~500 tokens) for vectorization

Each level can have multiple children. Fragments are immutable; edits create new fragments with recalculated hashes.

---

## Optimization Rules for Gemma 3

### KV Cache Optimization
Gemma 3 uses a **5:1 interleaved local/global attention** mechanism — only 1/6th of layers are global, reducing VRAM pressure significantly.

### Prompt Prefixing (Prefix Caching)
Static context (Universe/Series metadata) **must be placed at the start** of the prompt to trigger Ollama's prefix caching optimization. This minimizes redundant computations across multi-turn exchanges.

### Fragment Hashing
- Use **SHA-256** to hash each Chapter Fragment content
- Only re-vectorize a fragment if its hash **changes**
- Prevents RAG-processing bloat from unchanged content

---

## Coding Standards & Constraints

### Zero-Knowledge Privacy
- **No user data or manuscript text should ever be sent to an external server.**
- All inference happens locally via Ollama.
- All storage is client-side (IndexedDB).

### Zero File Bloat
- Models are **never bundled** in the app.
- The app must programmatically pull them from Ollama on startup.
- Use `/api/status` to verify availability and prompt download if missing.

### Performance
- **UI must remain responsive** during inference.
- Use **Web Workers** for RAG indexing and vectorization.
- Debounce fragment hashing to avoid excessive SHA-256 calls during rapid edits.

---

## Key Files & Directories

```
src/
├── app/
│   ├── api/
│   │   ├── system/route.ts        # RAM detection + model selection
│   │   ├── status/route.ts        # Combined startup check (RAM + Ollama)
│   │   └── ollama/route.ts        # (future) Proxy to Ollama API
│   ├── layout.tsx                  # PWA manifest link, system status wrapper
│   └── page.tsx                    # Main editor
├── lib/
│   ├── ollama.ts                   # Ollama REST client (pingOllama, pullModel)
│   ├── system.ts                   # System utilities (getRAM, selectModel)
│   └── rag/
│       ├── hierarchy.ts            # RAG node types (Library, Universe, Series, ...)
│       └── hasher.ts               # SHA-256 fragment hashing
├── components/
│   ├── SystemStatus.tsx            # Startup status UI (RAM, model, Ollama health)
│   └── Editor/                     # (future) Main editor components
└── workers/
    └── rag-indexer.ts              # (future) Web Worker for vectorization

public/
├── manifest.json                   # PWA manifest
└── icon.png                        # App icon (512x512)
```

---

## Startup Flow

1. Browser loads `/` (Next.js PWA)
2. `layout.tsx` mounts `<SystemStatus>`
3. `SystemStatus` fetches `/api/status` which:
   - Gets system RAM via `os.totalmem()`
   - Maps RAM → Gemma 3 model
   - Pings Ollama at `http://localhost:11434/api/tags`
   - Checks if selected model is available
4. If model is missing, prompt user to run `ollama pull gemma3:X`
5. If Ollama is down, show helpful error with `ollama serve` instructions
6. On success, show assigned model + context window + mode

---

## Next Steps (Future)

- **Vector DB:** Implement IndexedDB schema for fragment storage + embeddings
- **Web Workers:** Move RAG indexing off main thread
- **Ollama Proxy:** Add `/api/ollama/*` to handle inference requests with proper error handling
- **Editor UI:** Build the main writing interface with split-pane hierarchy navigator
- **Theme System:** Implement user voice profiles and manuscript themes
