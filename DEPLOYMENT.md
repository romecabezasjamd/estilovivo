# Despliegue en producción

Este proyecto se despliega como una sola aplicación monolítica que sirve la SPA y la API desde el mismo contenedor.

## Requisitos

- Docker 24+ instalado
- Docker Compose
- Crear un archivo `.env` en la raíz del proyecto

## Variables de entorno necesarias

Usa `.env.example` como base. Debes definir al menos:

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

## Despliegue con Docker Compose

Construye y levanta el servicio:

```bash
docker compose up --build -d
```

La aplicación será accesible en `http://localhost:3000` cuando se despliegue localmente.

El contenedor creará y persistirá:

- `sqlite_data` → base de datos SQLite `./data/dev.db`
- `uploads_data` → archivos subidos

## Verificar

```bash
docker compose ps
docker compose logs -f
```

Una vez levantado, comprueba la salud:

```bash
curl -f http://localhost:3000/api/health
```

## Notas sobre producción

- El backend actual usa SQLite para el deploy actual.
- Si quieres usar PostgreSQL más adelante, hay que cambiar `server/prisma/schema.prisma` y la inicialización de Prisma.
- En este estado, no necesitas un servicio de base de datos adicional.

## Opciones adicionales

- Si necesitas SMTP funcional, completa `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS`.
- Si no configuras SMTP, la app auto-verifica cuentas y sigue funcionando.
