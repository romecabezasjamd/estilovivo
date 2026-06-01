# Estilo Vivo

**Estilo Vivo** es una aplicación web de moda para gestionar tu armario digital, crear looks, planificar viajes, compartir con la comunidad y chatear con usuarios.

## 🌟 Qué incluye

- Gestión de prendas, looks y planes
- Perfil de usuario con preferencias y notificaciones por email
- Autenticación con JWT y `rememberMe`
- PWA + iconos y manifest
- Backend Express + Prisma + SQLite
- Deploy con Docker Compose

## 🧱 Stack técnico

- Frontend: React 19 + TypeScript + Vite
- Backend: Express + TypeScript
- ORM: Prisma
- Base de datos: SQLite (`DATABASE_URL=file:./data/dev.db`)
- PWA: `manifest.json` + `icon-192.png` / `icon-512.png`
- Build: `npm run build` (frontend) / `npm run build` (servidor)

## 📁 Estructura principal

```
estilovivo/
├── server/                 # Backend Express + Prisma
│   ├── src/                # Código backend
│   ├── prisma/             # Prisma schema y configuración
│   ├── package.json
│   └── tsconfig.json
├── components/             # Componentes React
├── pages/                  # Páginas React
├── public/                 # Archivos estáticos + PWA icons
├── Dockerfile              # Imagen de producción
├── docker-compose.yaml     # Deployment con Docker Compose
├── .env.example            # Variables de entorno de ejemplo
└── README.md
```

## 🚀 Desarrollo local

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Instala dependencias y arranca el frontend:

```bash
npm install
npm run dev
```

3. Arranca el backend desde `server/` si es necesario:

```bash
cd server
npm install
npm run dev
```

> El frontend accede a la API usando los endpoints configurados en `services/api.ts`.

## 🛠️ Preparar producción

### 1. Copia el ejemplo de variables

```bash
cp .env.example .env
```

### 2. Ajusta los valores importantes

En `.env` debes definir al menos:

```env
DATABASE_URL="file:./data/dev.db"
JWT_SECRET="tu_secreto_super_seguro"
PORT=3000
NODE_ENV=production
UPLOADS_DIR="/app/uploads"
GEMINI_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### 3. Construye y despliega con Docker Compose

```bash
docker compose up --build -d
```

La aplicación será accesible en `http://localhost:3000` cuando se despliegue localmente.

### 4. Accede a la aplicación

La app quedará disponible en `http://localhost:3000` si la ejecutas localmente.

## 📦 Docker Compose actual

La configuración de `docker-compose.yaml` usa SQLite y persiste:

- `sqlite_data` → archivo de base de datos `./data/dev.db`
- `uploads_data` → imágenes subidas

Esto evita dependencias externas en producción y permite desplegar con un único contenedor.

## 🧪 Validación

### Frontend

```bash
npm run build
```

### Backend

```bash
cd server
npm run build
npx vitest run
```

## 🌐 API rápida

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/products`
- `POST /api/products`
- `GET /api/looks`
- `POST /api/looks`

## 📌 Notas importantes

- El proyecto actual usa SQLite en producción con Docker Compose.
- Si quieres usar PostgreSQL a futuro, deberás adaptar `server/prisma/schema.prisma` y la inicialización de Prisma.
- El `docker-compose.yaml` ya no requiere un servicio de postgres.
