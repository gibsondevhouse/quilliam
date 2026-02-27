#!/usr/bin/env bash
# start-ollama.sh — Launch Ollama with Metal/GPU tuning for Apple Silicon
#
# Settings are tuned for M-series chips with 16 GB unified memory.
# See perpl-rsrch-runs/run001/01-ollama-tuning.md for rationale.
#
# Usage:
#   ./scripts/start-ollama.sh          # foreground (Ctrl-C to stop)
#   ./scripts/start-ollama.sh &        # background

set -euo pipefail

# Flash Attention: reduces KV cache VRAM ~40-50%, highest single impact.
export OLLAMA_FLASH_ATTENTION=1

# q8_0 KV cache quantisation: halves KV cache footprint vs f16.
# q4_0 is avoided — noticeable quality loss on long-form prose.
export OLLAMA_KV_CACHE_TYPE=q8_0

# Single request slot: each additional slot doubles the KV cache allocation.
# 16 GB cannot afford slot 2.
export OLLAMA_NUM_PARALLEL=1

# Keep model resident for 24 h. Eliminates the 3-5 s load cost on every
# chat open. NOTE: Ollama <=0.13.5 has a scheduler bug that ignores this
# env var; the API routes also pass keep_alive per-request as a workaround.
export OLLAMA_KEEP_ALIVE=24h

# Hold both the generative model (~6.5 GB) and embed model (~274 MB) in
# memory simultaneously — ~6.8 GB total, leaving ~9 GB for OS + browser.
export OLLAMA_MAX_LOADED_MODELS=2

echo "Starting Ollama with Metal GPU tuning:"
echo "  OLLAMA_FLASH_ATTENTION=${OLLAMA_FLASH_ATTENTION}"
echo "  OLLAMA_KV_CACHE_TYPE=${OLLAMA_KV_CACHE_TYPE}"
echo "  OLLAMA_NUM_PARALLEL=${OLLAMA_NUM_PARALLEL}"
echo "  OLLAMA_KEEP_ALIVE=${OLLAMA_KEEP_ALIVE}"
echo "  OLLAMA_MAX_LOADED_MODELS=${OLLAMA_MAX_LOADED_MODELS}"
echo ""

exec ollama serve
