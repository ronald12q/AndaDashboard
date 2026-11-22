# Entorno local ANDA

## Interfaz de demostración

Desde `frontend/`, ejecuta `pnpm dev`. Esta versión sigue usando datos ficticios
locales; iniciar la API no la conecta automáticamente. Accesos y pruebas en
`frontend/README.md`.

## PostgreSQL persistente (Docker opcional)

`compose.yaml` prepara una base local sin publicar PostgreSQL en la red externa.
Requiere instalar Docker y su complemento Compose; no los instala ni modifica
servicios del sistema.

Desde la raíz, define una contraseña local sin guardarla en archivos versionados:

```bash
read -rsp 'Contraseña PostgreSQL local: ' ANDA_DB_PASSWORD
export ANDA_DB_PASSWORD
docker compose up -d postgres
```

Valores predeterminados: usuario `postgres`, base `anda_db`, puerto local `5432`.
Puedes cambiarlos con `ANDA_DB_USER`, `ANDA_DB_NAME` y `ANDA_DB_PORT`.
Configura `backend/.env` para que `DATABASE_URL` coincida con estos valores.
Los caracteres especiales de usuario/contraseña deben codificarse para una URL.
Genera un `JWT_SECRET` aleatorio; nunca uses credenciales de la demo para producción.

Las migraciones y el alta controlada de administradores se documentan en
`backend/README.md`. Antes de aplicar migraciones, confirma que la URL apunta a la
base de desarrollo correcta, no a datos de producción.

Para detener la base conservando sus datos:

```bash
docker compose stop postgres
```

El volumen mantiene los datos y las credenciales iniciales. Cambiar
`ANDA_DB_PASSWORD` después de inicializarlo **no cambia** la contraseña interna.
No elimines el volumen para resolver un error de conexión.

## Verificación aislada

Durante el desarrollo también se utiliza PostgreSQL temporal en `127.0.0.1:55432`
para probar migraciones y autenticación sin modificar `backend/.env`. Esa instancia
es auxiliar, no la configuración persistente del proyecto.

## Despliegue académico

Consulta [`deploy/README.md`](deploy/README.md) para preparar la VPS sin Docker:
API en systemd, frontend y API bajo el mismo dominio con Nginx y HTTPS,
PostgreSQL privado y migraciones revisadas.
