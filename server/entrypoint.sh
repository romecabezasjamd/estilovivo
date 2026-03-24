#!/bin/sh
set -e

echo "=== [entrypoint] Resolving blocked migrations ==="
npx prisma migrate resolve --applied 20260224220000_add_realtime_features 2>/dev/null || true

echo "=== [entrypoint] Running prisma migrate deploy ==="
npx prisma migrate deploy || true

echo "=== [entrypoint] Ensuring gamification columns exist (idempotent) ==="
npx prisma db execute --url "$DATABASE_URL" --stdin << 'SQL'
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "experiencePoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;
SQL

echo "=== [entrypoint] Starting server ==="
exec node dist/index.js
