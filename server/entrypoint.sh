#!/bin/sh
set -e

PRISMA="node ./node_modules/prisma/build/index.js"

# Handle shutdown signals
trap 'echo "=== [entrypoint] Shutting down ==="; exit 0' TERM INT

echo "=== [entrypoint] Running prisma db push ==="
if [ -f "./node_modules/prisma/build/index.js" ]; then
  timeout 30 $PRISMA db push --accept-data-loss || echo "Warning: prisma db push skipped or failed"
else
  echo "Warning: prisma CLI not found, skipping db push"
fi

echo "=== [entrypoint] Checking build ==="
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js not found. Build may have failed."
  exit 1
fi

echo "=== [entrypoint] Starting server ==="
exec node dist/index.js
