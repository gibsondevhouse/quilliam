# AGENT.md — Quilliam Agent Execution Guide

This file is the primary instruction set for coding agents working inside the
Quilliam repository. Read it fully before acting. The rules here override any
generic defaults you may carry.

---

## 1. Project Summary

Quilliam is a **local-first, privacy-focused IDE for authors and journalists**.
It is a Next.js 16 / React 19 Progressive Web App. All AI inference runs
locally via **Ollama** (`http://localhost:11434`) using **Gemma 3** models
selected at runtime based on detected system RAM. No manuscript text or user
data ever leaves the machine. There are no external AI or analytics API calls
anywhere in the codebase.

Primary UX metaphor: a VS Code-like IDE layout (activity bar + sidebar +
editor area + bottom AI-chat panel + status bar), implemented entirely in
React state with no Redux, Zustand, or other external state library.

---

## 2. Dev Environment Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Ollama installed and runnable (`brew install ollama` on macOS)

### First-time installation

```bash
npm install
```

### Running the project

Open two terminals:

```bash
# Terminal 1 — Ollama inference server
ollama serve

# Terminal 2 — Next.js dev server
npm run dev
```

The app starts at `http://localhost:3000`. On load, `SystemStatus` fetches
`/api/status`, auto-detects RAM, selects a Gemma 3 model, and verifies Ollama
health before rendering the editor.

### Model selection by RAM (auto-detected server-side)

| RAM      | Model       | Context | Mode                |
|----------|-------------|---------|---------------------|
| < 12 GB  | gemma3:1b   | 32K     | Drafting/Grammar    |
| < 24 GB  | gemma3:4b   | 128K    | Multimodal/Research |
| < 48 GB  | gemma3:12b  | 128K    | Structural Editing  |
| >= 48 GB | gemma3:27b  | 128K    | World-Building      |

The selected model is surfaced at runtime via `GET /api/system` and
`GET /api/status`. Never hard-code a model name in client code.

### Pull the model for your machine

```bash
ollama pull gemma3:4b   # adjust based on your RAM
```

---

## 3. Coding Conventions

### Language and Compilation

- All files are TypeScript (`.ts` or `.tsx`). No plain JavaScript files.
- TypeScript is in strict mode (`"strict": true` in `tsconfig.json`).
- Path alias: `@/*` resolves to `./src/*`. Always use `@/` imports, never
  relative `../../` chains that cross the `src/` boundary.
- Target: ES2017. Use Web Crypto API (`crypto.subtle`) for hashing, which is
  available natively in Node 15+ and all modern browsers.

### File and Directory Naming

- Directories: `kebab-case` (e.g., `src/lib/rag/`, `src/components/Editor/`)
- Component files: `PascalCase.tsx` (e.g., `EditorArea.tsx`, `Chat.tsx`)
- Library/utility files: `camelCase.ts` (e.g., `ollama.ts`, `hasher.ts`, `system.ts`)
- API routes: `src/app/api/<route-name>/route.ts` (Next.js App Router convention)
- Barrel exports: `src/components/Editor/index.ts` re-exports everything from
  the Editor folder. Maintain this pattern for any new sub-directory.

### React Component Conventions

- Every React component file must begin with `"use client";` if it uses
  hooks, browser APIs, or event handlers. Pure server components are the
  exception — currently only API route handlers run server-side.
- Components are functional only. No class components.
- Use `useCallback` for all event handlers passed as props to prevent
  unnecessary re-renders.
- Use `useMemo` for derived state (e.g., dirty-tracking sets in `page.tsx`).
- Use `useRef` for DOM references (editor textarea, chat scroll anchor).
- Top-level application state lives in `src/app/page.tsx`. Component files
  receive data and callbacks via typed props. Do not introduce a global state
  library without explicit architectural approval.
- Prop interfaces are declared at the top of each component file, immediately
  after imports, using the `interface ComponentNameProps` naming pattern.

### TypeScript Specifics

- Export named types alongside implementations: `export interface`, `export type`, `export function`.
- Use `type` for union/alias types, `interface` for object shapes.
- Avoid `any`. Use `unknown` with type narrowing, or define precise types.
- Prefer optional chaining (`?.`) and nullish coalescing (`??`) over imperative null checks.
- When typing event handlers, use React's event types:
  `React.ChangeEvent<HTMLTextAreaElement>`, `React.KeyboardEvent<HTMLTextAreaElement>`, etc.

### CSS and Styling

- CSS framework: **Tailwind CSS 4** imported via `@import "tailwindcss";` at
  the top of `src/app/globals.css`.
- Custom component styles live as plain CSS classes in `globals.css`. No
  CSS Modules, no Styled Components, no `styled-jsx`.
- CSS class names use `kebab-case` with a prefix that identifies the component context:
  - IDE shell: `ide-root`, `ide-body`, `ide-main`, `ide-editor-area`, etc.
  - Chat component: `chat-container`, `chat-messages`, `chat-msg`, etc.
  - Question workspace: `qw-container`, `qw-card`, `qw-header`, etc.
  - Startup screen: `startup-screen`, `startup-content`, etc.
  - When adding a new component, pick a short 2–4 character prefix and be
    consistent within that component's section in `globals.css`.
- All color, spacing, and typography reference CSS custom properties defined
  in `:root` in `globals.css`. Never hard-code hex values in component JSX or
  inline `style` props. Always use a CSS variable.
- The dark theme is the only supported theme. Do not add light-mode variants.

### Key CSS Variables (design tokens)

```css
--bg-primary:    #1a1a1f   /* main background */
--bg-secondary:  #16161b   /* sidebar/panel background */
--bg-surface:    #222228   /* cards, inputs */
--bg-hover:      #26262e
--bg-active:     #2e2e38
--border:        #2a2a35
--border-active: #7c6fef   /* accent color, focus rings */
--text-primary:  #d4d4d8
--text-secondary:#8888a0
--text-muted:    #53536a
--accent:        #7c6fef   /* purple */
--accent-dim:    #5a4fc4
--green:         #4ade80
--red:           #f87171
--yellow:        #fbbf24

/* Layout dimensions */
--activity-bar-width:  48px
--sidebar-width:       240px
--tab-bar-height:      36px
--statusbar-height:    24px
--bottom-panel-height: 300px
```

---

## 4. Architecture Notes

### Zero-Knowledge Rule (Non-Negotiable)

No user text, manuscript content, chat messages, or any user-generated data
may be sent to any external server, third-party API, or remote endpoint.
Ollama runs at `localhost:11434`. The Next.js API routes at `/api/chat`,
`/api/status`, and `/api/system` communicate only with Ollama on the same
machine. If you add a new API route, it must follow the same constraint.
Violating this rule is a blocking defect.

### Ollama Communication Is Always Server-Side

The browser never calls `http://localhost:11434` directly. All Ollama API
calls are proxied through Next.js API route handlers in `src/app/api/`. The
client calls `/api/chat`, `/api/status`, or `/api/system`.

The utility functions in `src/lib/ollama.ts` (`pingOllama`, `isModelAvailable`,
`pullModel`, `checkOllamaHealth`) are **server-only** and may only be imported
from API route files. Never import them in a component file.

Similarly, `src/lib/system.ts` uses Node's `os` module and is server-only.

### Streaming Chat

`/api/chat/route.ts` (POST) forwards the body to Ollama's `/api/chat`
endpoint with `stream: true`, then pipes the raw `ReadableStream` body
directly to the client with `Content-Type: text/event-stream`.

`src/components/Chat.tsx` reads the stream using `response.body?.getReader()`,
decodes each chunk, and accumulates the tokens into `streamingContent` state.

When adding new inference endpoints, follow this same streaming proxy pattern.
Never buffer the full response in the route handler — this defeats streaming
and will freeze the UI. Always use `return new Response(response.body, ...)`.

### Modular Architect Pattern (Chat Response Parsing)

The Chat component enforces a structured response format from the model via
the `SYSTEM_PROMPT` constant in `Chat.tsx`. Responses must contain:

- A `VIBE` section: 1–3 sentences, no questions.
- An optional `WORKSPACE` section: lines beginning with `[Q]`, one per line.

The `parseAssistantMessage()` function in `Chat.tsx` splits the raw response
into `vibe` and `questions` fields. The `QuestionWorkspace` sub-component
renders interactive question cards. When modifying the chat experience,
preserve this two-section contract.

### RAG Hierarchy

The manuscript tree is a 5-level typed hierarchy:

```
library → book → part → chapter → scene
```

Types and validation are defined in `src/lib/rag/hierarchy.ts`. The
`VALID_CHILDREN` record governs which node types may be children of which
parent type. The `EDITABLE_TYPES` array (`["chapter", "scene"]`) specifies
which node types open a writing editor tab.

In `page.tsx`, the tree is stored as `SidebarNode[]` (a UI-focused recursive
structure). The `RAGNode` type in `hierarchy.ts` is the canonical persistence
type, used when writing to IndexedDB in the future. These are **not
interchangeable** — `SidebarNode` is display-only; `RAGNode` holds content
hashes, embeddings, timestamps, and ancestry pointers.

Fragment hashing uses `crypto.subtle.digest("SHA-256", ...)` via the Web
Crypto API (`src/lib/rag/hasher.ts`). Use `createDebouncedHasher(500)` during
active editing to avoid excessive hashing on every keystroke.

### Prompt Prefixing for Gemma 3 KV Cache

When constructing prompts for Ollama, place static context (Universe/Series
metadata, voice profiles) at the very beginning of the message array, before
dynamic user content. Ollama's prefix caching only activates when the static
prefix is identical across turns — this is a hard optimization requirement for
Gemma 3's 5:1 interleaved local/global attention architecture.

### State Architecture

All application state is co-located in `src/app/page.tsx`. This is intentional.
Before refactoring state out of `page.tsx` into a context or external store,
evaluate whether the feature genuinely needs cross-tree state sharing. The
current handler-callback prop-drilling pattern is explicit and traceable.

### Web Workers (Planned)

Heavy operations (RAG indexing, vectorization, batch hashing) must not run on
the main thread. The planned location for web workers is `src/workers/`. When
implementing these, use the standard `Worker` constructor with a URL import,
and communicate via `postMessage` / `onmessage`.

---

## 5. Agent Workflow

### Phase 1 — Planning

Before writing any code:

1. Re-read `CLAUDE.md` and this file to confirm architectural constraints.
2. Identify every file that the task touches: API routes, components, lib utilities, CSS classes, type exports.
3. Determine which existing types, hooks, or utilities can be reused.
4. Flag any ambiguity in the requirements before proceeding.
5. Produce a checklist: files to create, files to modify, new types to define,
   new CSS classes to add, and any new API endpoints.

### Phase 2 — Prototyping / Scaffolding

1. If adding a new component, create the file with a minimal, correctly-typed
   empty functional component that compiles. Verify `npm run build` passes at
   this stub stage before filling in logic.
2. If adding an API route, create `src/app/api/<name>/route.ts` with a stub
   handler that returns `{ ok: true }`. Verify the route is reachable before
   adding business logic.
3. If extending the RAG library, first add the new types and exported function
   signatures with `throw new Error("not implemented")` bodies. This anchors
   the public API before implementation.

### Phase 3 — Implementation

Work in this order:

1. **Types first.** Add TypeScript interfaces and type exports. Fix all type errors before moving to logic.
2. **Library utilities next.** Implement pure functions in `src/lib/` with no side effects.
3. **API routes.** Implement or extend route handlers (they depend on lib utilities).
4. **Components last.** Components depend on both types and API endpoints.
5. **CSS after component structure.** Add CSS class definitions to the correct section of `globals.css` only after the component renders correctly without styling.
6. **Wire up state in page.tsx.** Connect new components to application state last.

After every logical unit of work, run:

```bash
npm run build
```

Do not proceed to the next unit if the build fails.

### Phase 4 — Testing

Quilliam has no automated test framework. Verification is manual.

**For API route changes:**
- `npm run build` and `npm run lint` must pass.
- Use `curl` or DevTools Network tab to call the endpoint and verify the response shape.

**For component changes:**
- `npm run build` and `npm run lint` must pass.
- Manually exercise the component: click every interactive element, verify no console errors, no layout breakage.

**For RAG library changes:**
- `npm run build` must pass (validates exports and types).
- If hashing is affected, open the browser console and manually invoke hash functions to verify hex output format.

**For CSS changes:**
- Visual inspection at `http://localhost:3000`.
- Verify: startup screen, welcome screen, editor area, sidebar, AI chat panel, status bar.
- Check for overflow, z-index layering issues, and font fallbacks.

### Phase 5 — Review

Before declaring a task complete:

1. `npm run build` — must exit with code 0.
2. `npm run lint` — must produce zero errors.
3. Confirm zero-knowledge invariant: search changed files for `fetch(` in client components. Every such call must target a `/api/*` route, never `localhost:11434` or any external URL.
4. Confirm no model names are hard-coded in client code.
5. Confirm every new CSS class is defined in `globals.css`, not in inline `style` props.
6. Confirm all new exported functions and types have JSDoc comments.

---

## 6. File-Specific Guidance

### Adding a New API Route

1. Create `src/app/api/<route-name>/route.ts`.
2. Export named handler functions: `export async function GET(...)` or `export async function POST(request: NextRequest)`.
3. Import `NextResponse` from `"next/server"` for JSON responses; `NextRequest` for POST body parsing.
4. Use `process.env.OLLAMA_API_URL || "http://localhost:11434"` for the Ollama base URL — never hard-code it.
5. If the route reads system RAM or selects a model, import from `@/lib/system`. Do not call `os.totalmem()` directly.
6. If the route calls Ollama, import from `@/lib/ollama`. Never `fetch("http://localhost:11434/...")` directly.
7. Always wrap the handler in `try/catch` and return structured error responses (`502` for Ollama errors, `500` for internal errors).

Example skeleton:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSystemInfo } from "@/lib/system";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const systemInfo = getSystemInfo();
    // ... logic using systemInfo.model
    return NextResponse.json({ result: "..." });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json(
      { error: "Description of failure" },
      { status: 500 }
    );
  }
}
```

### Adding a New Component

1. Create `src/components/<ComponentName>.tsx` for top-level components, or
   `src/components/Editor/<ComponentName>.tsx` for editor sub-components.
2. Begin with `"use client";`.
3. Define `interface ComponentNameProps` immediately after imports.
4. Export as a named export: `export function ComponentName(...)`.
5. If inside `src/components/Editor/`, add to `src/components/Editor/index.ts`.
6. All CSS classes used in JSX must be defined in `globals.css`. Use a consistent prefix derived from the component name.
7. If the component needs to call an API route, use `fetch("/api/route-name")` inside a `useEffect` or `useCallback`. Never call Ollama directly.

### Extending the RAG Library

**Adding a utility to `src/lib/rag/hierarchy.ts`:**
- Add after existing functions with a JSDoc block.
- Keep functions pure (no side effects, no I/O).
- Follow the `Map<string, RAGNode>` parameter pattern of `getAncestryChain` and `getDescendants`.

**Adding a new node type:**
- Add it to the `NodeType` union.
- Update `NODE_TYPE_HIERARCHY`, `VALID_CHILDREN`, and optionally `EDITABLE_TYPES`.
- Add it to `DEFAULT_TITLES`, `TYPE_LABELS`, and `TYPE_ICONS` in `page.tsx` and `Sidebar.tsx`.

**Adding hashing utilities to `src/lib/rag/hasher.ts`:**
- Use `crypto.subtle.digest("SHA-256", data)` for all hashing.
- Follow the `hashFragment(content: string): Promise<string>` signature for async functions.
- Provide a debounced variant using `createDebouncedHasher(500)` for anything triggered by user edits.

### Updating CSS Design Tokens

- To change a color universally: update the value in `:root`. Never patch it in a specific class.
- To add a new token: add it to `:root` with a name following the `--category-descriptor` pattern.
- To add a new layout dimension: add it to `:root`, then reference via `var(--token-name)`.
- Do not add breakpoints or media queries. This is a fixed-layout desktop application.

### Adding a New Sidebar Panel Tab

1. Add the new tab identifier to the `SidebarTab` type union in `Sidebar.tsx`.
2. Add a title entry to `PANEL_TITLES` in `Sidebar.tsx`.
3. Add an icon/button to `ActivityBar.tsx` for the new tab.
4. Add a `case` branch to the panel rendering logic in `Sidebar.tsx`.
5. If the panel manages a new entity type, add its state and handlers in `page.tsx`,
   then pass them down via `Sidebar`'s props.

---

## 7. Security Constraints

### Zero-Knowledge (Enforced)

- Manuscript text, chat history, character data, location data, and world entries
  must never appear in a `fetch()` call to any URL other than `/api/*` routes.
- `/api/*` routes may only communicate outbound to `http://localhost:11434` (Ollama).
  They must not call any external API, CDN, telemetry, or analytics endpoint.
- Before adding any npm package, verify it does not make outbound network calls with user data.

### No Bundled Models

- Model weights are never included in the repository or build output.
- Models are fetched programmatically from Ollama using `pullModel()` in `src/lib/ollama.ts`
  only when the user initiates a pull.
- The app verifies model availability at startup via `/api/status` and shows a
  user-facing instruction to run `ollama pull gemma3:X` if missing.

### Local Storage Only

- All persistence is to IndexedDB (planned) or React in-memory state (current).
- No `localStorage`, `sessionStorage`, or cookies are used for manuscript content.
- The server is stateless — it only proxies Ollama.

---

## 8. Common Pitfalls to Avoid

**1. Importing server-only modules in client components.**
`src/lib/system.ts` uses Node's `os` module. `src/lib/ollama.ts` fetches
`localhost:11434`. Both are server-only. Importing either in a `"use client"` file
causes a build failure. Only import them from `src/app/api/*/route.ts` files.

**2. Hard-coding model names.**
The model is selected at runtime in `selectModel()`. Never write `"gemma3:4b"` as
a literal string in a component or route. Always read it from `systemInfo.model`.

**3. Skipping `npm run build`.**
Next.js 16 + React 19 + TypeScript strict mode surfaces type errors that a
language server may miss. Run `npm run build` after each logical changeset.

**4. Adding CSS in inline `style` props.**
All styling goes through `globals.css` classes. The only acceptable inline style is
for truly dynamic values (e.g., a computed `height` on the auto-resize textarea).

**5. Mutating state directly.**
React state must be updated immutably. The tree helpers in `page.tsx`
(`insertChild`, `deleteFromTree`, `renameInTree`) demonstrate the correct pattern:
create new arrays/objects at each level, never mutate in place.

**6. Placing business logic in components.**
Components render UI and handle user events. Domain logic belongs in `src/lib/`.
Components call API routes for I/O, not Ollama directly.

**7. Breaking the streaming pipeline.**
Never buffer the full Ollama response in `/api/chat`. Always forward the raw
`ReadableStream` body with `return new Response(response.body, ...)`.

**8. Breaking the Chat VIBE/WORKSPACE contract.**
The `SYSTEM_PROMPT` in `Chat.tsx` enforces VIBE (no questions) + WORKSPACE
(`[Q]` prefixed questions). The `parseAssistantMessage()` parser depends on this
exact structure. Any modification to the system prompt must preserve it.

**9. Missing barrel exports.**
Every new file added to `src/components/Editor/` must be exported from
`src/components/Editor/index.ts`. Missing this causes import resolution failures.

**10. Treating `SidebarNode` and `RAGNode` as interchangeable.**
`SidebarNode` is the UI tree representation — display-only, in-memory.
`RAGNode` is the canonical data model with content hashes, embeddings, timestamps,
and ancestry pointers. When implementing IndexedDB persistence, store `RAGNode`
records, not `SidebarNode` records.
