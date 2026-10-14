#!/bin/sh

cd /app/server

# Handle shutdown signals
trap 'echo "=== [entrypoint] Shutting down ==="; exit 0' TERM INT

PRISMA="./node_modules/.bin/prisma"

# ALWAYS force DATABASE_URL to absolute path — Coolify may override with relative path
export DATABASE_URL="file:/app/data/dev.db"
echo "=== [entrypoint] DATABASE_URL forced to $DATABASE_URL"

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

# >>> pre-deploy-backup (no fatal: si falla, el arranque continúa)
echo "=== [entrypoint] Pre-deploy DB backup ==="
(
  DB_FILE="${BACKUP_DB_FILE:-/app/data/dev.db}"
  BK_DIR="${BACKUP_DIR:-/app/data/backups}"
  if [ -s "$DB_FILE" ]; then
    mkdir -p "$BK_DIR" || exit 1
    DEST="$BK_DIR/dev.db.pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)"
    if command -v sqlite3 >/dev/null 2>&1 && sqlite3 "$DB_FILE" ".backup '$DEST'" 2>/dev/null && [ -s "$DEST" ]; then
      echo "Backup OK (sqlite3 .backup): $DEST"
    elif cp "$DB_FILE" "$DEST" && [ -s "$DEST" ]; then
      echo "Backup OK (cp): $DEST"
    else
      rm -f "$DEST"
      echo "WARNING: backup failed (continuing without backup)"
      exit 1
    fi
    # conservar solo las 5 copias más recientes
    ls -1t "$BK_DIR"/dev.db.pre-deploy-* 2>/dev/null | tail -n +6 | while read -r old; do rm -f "$old"; done
  else
    echo "No existing database (or empty): backup skipped"
  fi
) || echo "WARNING: pre-deploy backup step failed (non-fatal)"
# <<< pre-deploy-backup

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
