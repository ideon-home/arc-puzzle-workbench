#!/usr/bin/env bash
# Serve the workbench locally. Browsers block ESM imports over file://,
# so the page needs an http:// origin to load engine.js and puzzle.js.
# Usage: ./serve.sh [port]   (default port 8000)
set -e
PORT="${1:-8000}"
cd "$(dirname "$0")"
echo "Serving on http://localhost:${PORT}/  —  Ctrl-C to stop"
exec python3 -m http.server "${PORT}"
