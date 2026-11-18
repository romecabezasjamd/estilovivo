# Copias de seguridad de Estilo Vivo

Repositorio **privado**. Cada día, GitHub Actions descarga del servidor una copia completa de Estilo Vivo (base de datos y fotos) y la guarda aquí como una **Release**. Las copias se ven en *Releases*, a la derecha.

- Las copias van **cifradas** (AES-256-GCM). Sin `BACKUP_PASSWORD` nadie puede abrirlas, tampoco GitHub.
- Se conservan las **30 más recientes**. Las anteriores se borran del todo, sin quedar en el historial, tal como dice la política de privacidad.
- Si una copia falla, GitHub te envía un correo.
- Para hacer una copia ahora: *Actions › Copia diaria › Run workflow*.

## Configuración

En *Settings › Secrets and variables › Actions*:

| Nombre | Tipo | Valor |
|---|---|---|
| `BACKUP_TOKEN` | Secret | El mismo que en Coolify |
| `BACKUP_URL` | Variable (opcional) | Solo si cambias de servidor o de dominio. Por defecto: `https://estilovivo.xyoncloud.win/api/admin/backup` |

**Nunca** subas aquí `BACKUP_PASSWORD` ni copias sin cifrar.

## Abrir una copia

1. Descarga el archivo `.evbk` de la Release.
2. En el repositorio de la app, ejecuta:

```
node server/scripts/restaurar-copia.mjs estilovivo-copia-AAAAMMDD-HHMMSS.evbk C:\EstiloVivo-restaurado
```

Te pide la contraseña y deja `dev.db` (base de datos) y `uploads/` (fotos). Los pasos para ponerla en un servidor están en `COPIAS-DE-SEGURIDAD.txt`, en la raíz del repositorio de la app.

El origen de este proceso está en el repositorio de la app: `scripts/copias/github/`.
