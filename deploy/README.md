# Despliegue del prototipo ANDA

Esta plantilla asume Linux con systemd y Nginx, Node.js 24 LTS, pnpm y PostgreSQL.
No requiere Docker. Por ahora es para un entorno académico con **datos y pagos
ficticios**. No es autorización para publicar un servicio institucional.

```text
Navegador ── HTTPS ── Nginx ── /api/* ── Express (127.0.0.1:3000)
                        └── React estático              └── PostgreSQL privado
```

## 1. Preparar base y secretos

- No publicar el puerto de PostgreSQL ni el de Express. Si PostgreSQL está en
  otro servidor, usar red privada, acceso limitado al host de la API y TLS
  verificado. No usar el clúster temporal de `/tmp/opencode` para despliegue.
- Crear una base dedicada. El usuario de ejecución no debe ser superusuario;
  separar permisos de migración y ejecución cuando el entorno lo permita. La
  API necesita acceso a las tablas de cuentas, expedientes y adjuntos y a la
  secuencia de expedientes.
- Copiar `api.env.example` a `/etc/anda/api.env`, propiedad de root y modo `0600`
  (systemd lee el archivo antes de cambiar de usuario). Configurar la URL, el
  dominio público y los dominios administrativos permitidos. Generar un secreto
  único con `openssl rand -hex 32`. No copiar cuentas ni secretos de la demo.
- `TRUST_LOCAL_PROXY=true` solo con Nginx local reemplazando `X-Forwarded-For`
  y Express enlazado a loopback. Si hay un CDN, contenedor o balanceador
  adicional, revisar esa política antes de reutilizar la plantilla.

## 2. Construir y migrar

Preparar la versión bajo `/srv/anda` con el código y lockfiles. Ejecutar como
operador de despliegue, no como el usuario del servicio:

```bash
cd /srv/anda/frontend
pnpm install --frozen-lockfile
VITE_PORTAL_MODE=api VITE_API_URL= pnpm build

cd /srv/anda/backend
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
```

Exportar `DATABASE_URL` de forma segura **antes de generar Prisma y ejecutar
los comandos de migración**; no pasarla en argumentos ni guardarla en el
historial. Para aplicar en la base objetivo:

```bash
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
```

En una base nueva, `migrate status` puede indicar migraciones pendientes y
retornar distinto de cero; si indica divergencia o una migración fallida,
detenerse y revisar. Antes de migrar una base existente, respaldarla, comprobar
que el respaldo se pueda restaurar y revisar el esquema. **No usar `migrate
reset`, `db push` ni la suite E2E contra la base del despliegue.** Si existe una
tabla `Citizen` sin historial Prisma, no aplicar la migración inicial por
fuerza: requiere un plan de adopción del esquema.

## 3. Levantar y comprobar

1. Crear un usuario de sistema `anda` sin shell interactiva, con permisos de
   lectura sobre el backend y sin escritura sobre los artefactos. Nginx necesita
   leer `frontend/dist`.
2. Instalar `anda-api.service` en `/etc/systemd/system/`. Ajustar `ExecStart`
   si la ruta absoluta de Node es distinta. Ejecutar `systemctl daemon-reload`
   y `systemctl enable --now anda-api`. Consultar `journalctl -u anda-api`.
3. Instalar `nginx.conf` en el directorio de sitios de Nginx, sustituir
   `anda.example.org` y proveer certificados válidos antes de habilitar el
   bloque TLS. Ejecutar `nginx -t` antes de recargar.
4. Verificar `/api/health` desde HTTPS y `http://127.0.0.1:3000/api/health/db`
   desde la VPS. Verificar que el health de BD no sea público y que el puerto
   3000 no acepte conexiones remotas.
5. Provisionar una cuenta del dominio permitido con la CLI documentada en
   `backend/README.md`. Iniciar sesión con cada rol en un navegador y comprobar
   un expediente ficticio, descarga privada y PDF simulado.

Conservar la versión anterior de los artefactos para retroceder si la API falla.
No revertir migraciones borrando datos: si hay un problema de esquema, usar un
plan compensatorio o restaurar el respaldo en una instancia aislada antes de
decidir el cambio de tráfico.

## Límites antes de un uso real

MFA administrativo, revocación individual de sesiones, análisis antimalware,
política de privacidad y retención, auditoría, monitorización, copias de
seguridad y tarifas/requisitos institucionales confirmados siguen pendientes.
El limitador actual solo cubre un proceso. Los registros de errores del proxy
también se deben revisar y proteger, aunque su acceso normal a `/api/` no se
registre en esta plantilla.
