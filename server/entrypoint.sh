#!/bin/sh
set -e

PRISMA="./node_modules/.bin/prisma"

# Handle shutdown signals
trap 'echo "=== [entrypoint] Shutting down ==="; exit 0' TERM INT

echo "=== [entrypoint] Running prisma migrate deploy ==="
if [ -f "$PRISMA" ]; then
  timeout 30 $PRISMA migrate deploy || echo "Warning: migration skipped or failed"
else
  echo "Warning: prisma CLI not found, skipping migrations"
fi

echo "=== [entrypoint] Checking build ==="
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js not found. Build may have failed."
  exit 1
fi

echo "=== [entrypoint] Starting server ==="
exec node dist/index.js
