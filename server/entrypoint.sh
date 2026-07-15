#!/bin/sh

cd /app/server

# Handle shutdown signals
trap 'echo "=== [entrypoint] Shutting down ==="; exit 0' TERM INT

PRISMA="./node_modules/.bin/prisma"

echo "=== [entrypoint] Checking data directory ==="
if [ -w /app/data ]; then
  echo "OK: /app/data is writable"
else
  echo "WARNING: /app/data is not writable! Database will not persist across deploys."
fi

echo "=== [entrypoint] Running prisma generate ==="
if [ -f "$PRISMA" ]; then
  timeout 30 $PRISMA generate && echo "prisma generate OK" || echo "Warning: prisma generate failed"
  
  echo "=== [entrypoint] Running prisma db push ==="
  timeout 30 $PRISMA db push && echo "prisma db push OK" || echo "Warning: prisma db push failed (non-fatal)"
else
  echo "Warning: prisma CLI not found at $PRISMA, skipping db push"
fi

echo "=== [entrypoint] Checking build ==="
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js not found. Build may have failed."
  exit 1
fi

echo "=== [entrypoint] Starting server ==="
exec node dist/index.js
