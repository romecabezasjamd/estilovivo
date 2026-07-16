#!/bin/sh

cd /app/server

# Handle shutdown signals
trap 'echo "=== [entrypoint] Shutting down ==="; exit 0' TERM INT

PRISMA="./node_modules/.bin/prisma"

# Force DATABASE_URL to absolute path if not set correctly
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/dev.db"
  echo "=== [entrypoint] DATABASE_URL was empty, set to $DATABASE_URL"
fi

# Ensure data directory exists and is writable
mkdir -p /app/data
chmod 755 /app/data 2>/dev/null || true

echo "=== [entrypoint] Environment ==="
echo "DATABASE_URL=${DATABASE_URL}"
echo "NODE_ENV=${NODE_ENV:-NOT SET}"

echo "=== [entrypoint] Checking data directory ==="
if [ -w /app/data ]; then
  echo "OK: /app/data is writable"
  ls -la /app/data/ 2>/dev/null || echo "(empty)"
else
  echo "WARNING: /app/data is not writable!"
fi

# Check if database exists and has data
echo "=== [entrypoint] Database check ==="
if [ -f /app/data/dev.db ]; then
  echo "Database file exists: $(ls -la /app/data/dev.db)"
  if command -v sqlite3 >/dev/null 2>&1; then
    echo "User count: $(sqlite3 /app/data/dev.db 'SELECT COUNT(*) FROM User;')"
  fi
else
  echo "WARNING: /app/data/dev.db does NOT exist!"
fi

echo "=== [entrypoint] Running prisma generate ==="
if [ -f "$PRISMA" ]; then
  timeout 30 $PRISMA generate && echo "prisma generate OK" || echo "Warning: prisma generate failed"
  
  echo "=== [entrypoint] Running prisma db push ==="
  timeout 60 $PRISMA db push && echo "prisma db push OK" || echo "Warning: prisma db push failed (non-fatal)"
else
  echo "Warning: prisma CLI not found at $PRISMA, skipping db push"
fi

# Post-push check
echo "=== [entrypoint] Post-push database check ==="
if [ -f /app/data/dev.db ]; then
  echo "Database file after push: $(ls -la /app/data/dev.db)"
  if command -v sqlite3 >/dev/null 2>&1; then
    echo "User count after push: $(sqlite3 /app/data/dev.db 'SELECT COUNT(*) FROM User;')"
  fi
fi

echo "=== [entrypoint] Checking build ==="
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js not found. Build may have failed."
  exit 1
fi

echo "=== [entrypoint] Starting server ==="
exec node dist/index.js
