# syntax=docker/dockerfile:1.4
# Dockerfile - Builder único para Frontend + Backend
# Optimizado: cache mounts, prisma split, sin python3 en build

# ============= STAGE 1: Dependencies =============
FROM node:22-bookworm-slim AS dependencies

RUN apt-get update && apt-get install -y openssl curl python3 build-essential && rm -rf /var/lib/apt/lists/*

# Ensure we install ALL dependencies (including devDependencies) for building
ENV NODE_ENV=development

# Prisma schema needs DATABASE_URL at build time
ARG DATABASE_URL=file:./data/dev.db
ENV DATABASE_URL=$DATABASE_URL

WORKDIR /app

# Copiar solo package.json y schema.prisma (migrations después del install)
COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma/schema.prisma ./server/prisma/schema.prisma
COPY server/prisma.config.ts ./server/prisma.config.ts

# Instalar frontend deps con cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --legacy-peer-deps

# Instalar backend deps con cache mount
WORKDIR /app/server
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --legacy-peer-deps

# Copiar migrations después del install (no invalidan caché)
COPY server/prisma/migrations ./prisma/migrations

WORKDIR /app

# ============= STAGE 2: Build Frontend =============
FROM dependencies AS frontend-build

WORKDIR /app

# Force production mode so import.meta.env.DEV is false in built output
ENV NODE_ENV=production

# Cache bust: copy build version file first — changes every commit
COPY server/.build-version .build-version

# Copiar todo lo necesario para el frontend
COPY tsconfig.json vite.config.ts postcss.config.js tailwind.config.js index.html index.tsx App.tsx types.ts ./
COPY components ./components
COPY pages ./pages
COPY services ./services
COPY hooks ./hooks
COPY src ./src
COPY public ./public

# Build-time environment variables for Vite
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Build React
RUN npm run build

# ============= STAGE 3: Build Backend =============
FROM dependencies AS backend-build

WORKDIR /app/server

# Cache bust: copy build version file first — changes every commit
COPY server/.build-version .build-version

# Copiar código backend
COPY server/src ./src
COPY server/tsconfig.json ./

# Build TypeScript
RUN npm run build

# ============= STAGE 4: Production Runtime =============
FROM node:22-bookworm-slim AS production

RUN apt-get update && apt-get install -y openssl curl ca-certificates python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Expose the backend port so platforms like Coolify can detect it
EXPOSE 3000

# Prisma schema needs DATABASE_URL at build+install time
# Database stored at /app/data to match Coolify's persistent volume
ARG DATABASE_URL=file:/app/data/dev.db
ENV DATABASE_URL=$DATABASE_URL

# Cache bust: forces all subsequent layers to rebuild when code changes
COPY server/.build-version .build-version

# Copy Prisma schema + config + migrations from backend-build
COPY --from=backend-build /app/server/prisma ./server/prisma
# Overwrite schema.prisma from build context to ensure latest version (backend-build may be cached)
COPY server/prisma/schema.prisma ./server/prisma/schema.prisma
COPY server/prisma.config.ts ./server/prisma.config.ts

# Install production deps (prisma is now in dependencies, postinstall runs prisma generate)
COPY server/package*.json ./server/
RUN --mount=type=cache,target=/root/.npm \
    cd server && npm install --omit=dev --prefer-offline --no-audit --legacy-peer-deps

# Copy backend compiled
COPY --from=backend-build /app/server/dist ./server/dist

# Copy frontend compiled to public folder
COPY --from=frontend-build /app/dist ./server/public

# Create uploads and data directories
RUN mkdir -p /app/uploads /app/data && chmod 755 /app/uploads /app/data

# Copy entrypoint
COPY server/entrypoint.sh ./entrypoint.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]

# ============= STAGE 5: Development Runtime =============
FROM dependencies AS development

WORKDIR /app

ENV NODE_ENV=development

EXPOSE 3000
EXPOSE 5173

# En desarrollo, ejecutar backend y frontend
CMD ["sh", "-c", "cd server && npm run dev"]
