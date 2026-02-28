# Quilliam

Local-first, privacy-focused IDE for writers. Local AI via **Ollama** (always on). **Anthropic** (assisted edits) and **Tavily** (deep research) are strictly opt-in — no cloud calls without explicit user confirmation.

Built for Apple Silicon with Unified Memory awareness.

## Architecture

| Layer | Tech |
|---|---|
| Web app | Next.js 16.1.6 / React 19 (App Router, `src/`) |
| Local inference | Ollama REST API (`http://localhost:11434`) |
| Cloud — assist | Anthropic, BYO key, opt-in per action |
| Cloud — research | Anthropic + Tavily, BYO keys, opt-in per action |
| Storage | IndexedDB `quilliam-rag` (DB v11) + encrypted cloud vault |
| RAG | Hierarchical nodes + SHA-256 fragment hashing + local vector retrieval |

## Development

```bash
npm install
npm run dev       # http://localhost:3000 (bumps to 3001+ if port is taken)
npm run lint
npm run build
```

Run Ollama in a separate terminal (Apple Silicon GPU tuning):

```bash
./scripts/start-ollama.sh
```

The script sets `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_KEEP_ALIVE=24h`, and `OLLAMA_MAX_LOADED_MODELS=2` — keeping both the generative and embedding models resident in GPU memory. See [scripts/start-ollama.sh](scripts/start-ollama.sh) for details.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_API_URL` | `http://localhost:11434` | Ollama server base URL |
| `QUILLIAM_CLOUD_VAULT_FILE` | — | Path to encrypted cloud vault file |
| `QUILLIAM_RESEARCH_RUNS_FILE` | — | Path to deep research run persistence file |

## API Routes

### Local (always available)

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/chat` | Proxy to Ollama streaming chat |
| `POST` | `/api/embeddings` | Proxy to Ollama embeddings |
| `GET` | `/api/status` | Ollama + model health check |
| `GET` | `/api/system` | System info (model, platform) |
| `POST` | `/api/extract-canonical` | Extract canonical entity patches from prose |

### Cloud — opt-in, require unlocked vault session

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/cloud/assist` | Anthropic-powered assisted edit (review-first patches) |
| `GET/POST/DELETE` | `/api/cloud/vault/*` | Encrypted provider key vault management |
| `GET` | `/api/research/runs` | List deep research runs (filter by `?libraryId=`) |
| `POST` | `/api/research/runs` | Create and start a new research run |
| `GET` | `/api/research/runs/[id]` | Fetch a single run record |
| `POST` | `/api/research/runs/[id]/cancel` | Cancel a running or queued run |
| `GET` | `/api/research/runs/[id]/events` | SSE stream of run progress events |

## Library Workspace Routes

```
/library/[libraryId]                    → dashboard redirect
/library/[libraryId]/universe           → universe overview
/library/[libraryId]/books              → book/series list
/library/[libraryId]/chapters           → chapter editor
/library/[libraryId]/scenes             → scene list
/library/[libraryId]/characters         → character encyclopedia
/library/[libraryId]/locations          → location encyclopedia
/library/[libraryId]/cultures           → culture encyclopedia
/library/[libraryId]/organizations      → organization list
/library/[libraryId]/factions           → faction list (legacy alias)
/library/[libraryId]/magic-systems      → magic/system encyclopedia
/library/[libraryId]/items              → item encyclopedia
/library/[libraryId]/languages          → language encyclopedia
/library/[libraryId]/religions          → religion encyclopedia
/library/[libraryId]/lineages           → lineage encyclopedia
/library/[libraryId]/economics          → economy encyclopedia
/library/[libraryId]/rules              → rules encyclopedia
/library/[libraryId]/cosmology          → cosmological lore
/library/[libraryId]/master-timeline    → master timeline + eras
/library/[libraryId]/maps               → maps + pins
/library/[libraryId]/media              → media library
/library/[libraryId]/relationship-web   → visual relationship graph
/library/[libraryId]/continuity-issues  → continuity checker
/library/[libraryId]/conflicts          → conflict tracker
/library/[libraryId]/suggestions        → AI suggestion queue
/library/[libraryId]/change-log         → revision history
/library/[libraryId]/threads/[id]       → chat thread
/library/[libraryId]/settings           → AI settings & provider config
```

## Key Source Paths

- App shell: `src/app/ClientShell.tsx`
- Library workspace orchestration: `src/app/library/[libraryId]/layout.tsx`
- Chat UI: `src/components/Chat.tsx`
- RAG persistence + retrieval: `src/lib/rag/`
- Cloud vault + provider clients: `src/lib/cloud/`
- Deep research engine: `src/lib/research/`
- Domain types (entry-centric universe engine): `src/lib/types.ts`
- RAG indexer worker: `src/workers/rag-indexer.ts`

## Guardrails

1. **Local mode stays local.** No external calls in `local` execution mode.
2. **Cloud always requires explicit user opt-in.** No silent background requests.
3. **Provider keys never leave the server.** Keys are vault-encrypted at rest; never stored in UI state, logs, or `localStorage`.
4. **All AI edits are review-first.** Patches (`EntryPatch` / `CanonicalPatch`) land as `pending` and require user acceptance before being applied.
