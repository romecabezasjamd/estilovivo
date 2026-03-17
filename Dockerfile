# Dockerfile - Builder único para Frontend + Backend
# Soporta dev y production automáticamente

# ============= STAGE 1: Dependencies =============
FROM node:20-alpine AS dependencies

RUN apk add --no-cache openssl curl

# Ensure we install ALL dependencies (including devDependencies) for building
ENV NODE_ENV=development

WORKDIR /app

# Copiar package.json de ambos lados
COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma

# Instalar frontend deps (including devDependencies needed for build)
RUN npm install --prefer-offline --no-audit

# Instalar backend deps (including devDependencies needed for build)
WORKDIR /app/server
RUN npm install --prefer-offline --no-audit

WORKDIR /app

# ============= STAGE 2: Build Frontend =============
FROM dependencies AS frontend-build

WORKDIR /app

# Copiar todo lo necesario para el frontend
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY index.html ./
COPY index.tsx ./
COPY App.tsx ./
COPY types.ts ./
COPY components ./components
COPY pages ./pages
COPY services ./services
COPY hooks ./hooks
COPY src ./src

# Build React
RUN npm run build

# ============= STAGE 3: Build Backend =============
FROM dependencies AS backend-build

WORKDIR /app/server

# Copiar código backend
COPY server/src ./src
COPY server/tsconfig.json ./
COPY server/prisma ./prisma

# Build TypeScript
RUN npm run build

# ============= STAGE 4: Production Runtime =============
FROM node:20-alpine AS production

RUN apk add --no-cache openssl curl

WORKDIR /app

ENV NODE_ENV=production

# Copy Prisma schema BEFORE installing dependencies (needed for postinstall script)
COPY --from=backend-build /app/server/prisma ./prisma

# Instalar solo runtime deps
COPY server/package*.json ./
RUN npm install --omit=dev --prefer-offline --no-audit

# Copiar backend compilado
COPY --from=backend-build /app/server/dist ./dist

# Copiar frontend compilado a carpeta pública del backend
COPY --from=frontend-build /app/dist ./public

# Crear directorio para uploads
RUN mkdir -p /app/uploads && chmod 755 /app/uploads

# Resolve any failed migrations and capture output to prevent crashing
# Node will start even if migrate deploy fails, helping us avoid 503s
CMD ["sh", "-c", "npx prisma migrate resolve --applied 20260303220000_add_gamification_fields > prisma_resolve.log 2>&1 || true; npx prisma migrate deploy > prisma_migrate.log 2>&1; cat prisma_migrate.log; node dist/index.js"]

# ============= STAGE 5: Development Runtime =============
FROM dependencies AS development

WORKDIR /app

ENV NODE_ENV=development

# Para desarrollo con hot reload
# Instalar herramienta para watch
RUN npm install -g concurrently

EXPOSE 3000
EXPOSE 5173

# En desarrollo, ejecutar backend y frontend
CMD ["sh", "-c", "cd server && npm run dev"]
