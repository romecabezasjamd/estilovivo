#!/bin/sh
set -e

# Handle SIGTERM gracefully for fast Docker shutdown
trap 'echo "=== [entrypoint] Shutting down ==="; exit 0' SIGTERM SIGINT

echo "=== [entrypoint] Running prisma migrate deploy ==="
timeout 30 npx prisma migrate deploy || true

echo "=== [entrypoint] Ensuring gamification columns exist (idempotent) ==="
timeout 10 npx prisma db execute --url "$DATABASE_URL" --stdin << 'SQL'
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "experiencePoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullBodyAvatar" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "relatedId" TEXT;
SQL

echo "=== [entrypoint] Starting server ==="
exec node dist/index.js
