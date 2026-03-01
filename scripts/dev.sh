#!/usr/bin/env bash
# dev.sh — Start Ollama + Next.js dev server together.
#
# Ollama is launched in the background (if not already running).
# When this script exits (Ctrl-C or terminal close), Ollama is stopped.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OLLAMA_PID=""
OLLAMA_STARTED_BY_US=false

# ── Ollama environment (from start-ollama.sh) ────────────────────────────────
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_KEEP_ALIVE=24h
export OLLAMA_MAX_LOADED_MODELS=2

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  if $OLLAMA_STARTED_BY_US && [ -n "$OLLAMA_PID" ]; then
    echo "Stopping Ollama (pid $OLLAMA_PID)..."
    kill "$OLLAMA_PID" 2>/dev/null || true
    # Give it a moment to release the port
    sleep 1
  fi
  echo "Done."
}
trap cleanup EXIT INT TERM

# ── Start Ollama if not already running ──────────────────────────────────────
if curl -sf http://localhost:11434/ > /dev/null 2>&1; then
  echo "Ollama already running — skipping start."
else
  echo "Starting Ollama..."
  ollama serve &
  OLLAMA_PID=$!
  OLLAMA_STARTED_BY_US=true

  # Wait up to 10 s for Ollama to become ready
  for i in $(seq 1 20); do
    if curl -sf http://localhost:11434/ > /dev/null 2>&1; then
      echo "Ollama ready."
      break
    fi
    sleep 0.5
  done

  if ! curl -sf http://localhost:11434/ > /dev/null 2>&1; then
    echo "Warning: Ollama did not respond after 10 s — continuing anyway."
  fi
fi

# ── Start Next.js (foreground — this is what keeps the script alive) ─────────
echo "Starting Next.js dev server..."
npx next dev
