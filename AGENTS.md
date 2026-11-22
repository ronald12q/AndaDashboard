# AGENTS.md — Memoria del proyecto ANDA_Project

Full stack: `frontend/` (React + TS + Tailwind) y `backend/` (Node + Express + TS + Prisma + PostgreSQL).
Raíz con Git (`main`). Package manager: **pnpm** (backend pinnea `pnpm@12.15.0` en `devEngines`).
`Rag-project/` es una copia local con Git propio, excluida del repositorio ANDA.
RAG opcional: React conectado con `VITE_RAG_ENABLED=true` → `POST /api/chat` (solo ciudadano) → FastAPI local `POST /pregunta` mediante `RAG_URL`. No se envían datos de cuenta; solo consultas generales. Proveedores externos no verificados en esta integración; ver `README.md`. GitHub de ANDA aún sin remoto.

## Frontend (`frontend/`)
- React 19 + Vite 8 + TS + TailwindCSS 4 (vía `@tailwindcss/vite`).
- Scripts: `dev` (vite), `build` (`tsc -b && vite build`), `lint`, `preview`.
- CORS del backend apunta a `http://localhost:5173` por defecto.

### Alcance acordado de interfaces (noviembre 2026)
- Referencia visual: **17 capturas** en `interfaces/1.png` a `interfaces/17.png`. Aunque el pie original dice `/18`, no falta una pantalla por implementar. Reproducir el diseño ANDA, corrigiendo textos superpuestos y adaptándolo a móvil.
- Primera fase: **interfaces React navegables con datos simulados**, sin integrar todavía el backend. Solo ciudadano y administrador, sin invitado.
- Seis trámites: instalación de medidor, caja de medidor, válvula de control, reconexión, desconexión a solicitud y detección de fuga interna.
- Medidor y válvula limitados inicialmente a residencial de **½ y ¾ de pulgada**. El administrador determina las especificaciones tras revisar la solicitud; no se exige que el ciudadano conozca el diámetro. No inventar dimensiones para cajas.
- Para medidor/caja/válvula: solicitud → revisión → especificaciones → compra → evidencia → revisión preliminar → pago simulado → visita. Entrega del material al técnico **en el domicilio**, como propuesta académica, no procedimiento institucional autorizado.
- Reconexión/desconexión/fuga: revisión de datos/documentos → pago simulado → visita, sin compra de materiales.
- Toda la demostración usa datos, documentos y pagos ficticios. Las fotografías no sustituyen la comprobación física. No almacenar datos de tarjetas.
- `informacion.md` describe el flujo y `source.csv` reúne fuentes y decisiones. Distinguir procedimiento institucional, antecedentes históricos y propuesta académica; tarifas y requisitos no deben presentarse como vigentes confirmados.
- Implementado: navegación hash, sesiones demo por rol, registro, catálogo, solicitudes, revisiones, materiales, comprobantes PDF simulados, seguimiento, visitas y orientador local. Instrucciones en `frontend/README.md`.
- Accesos ficticios: ciudadano DUI `00000001-0`, administrador correo `admin@example.com`, clave común `DemoANDA2026`. Registro solo ciudadano y clave demo publicada; no es autenticación segura de producción.
- Solicitudes/usuarios demo en `localStorage`, sesión en `sessionStorage`; adjuntos solo metadatos, no contenido original. No hay conexión con backend.
- Verificado: `pnpm build`, `pnpm lint`, `pnpm test` (7 pruebas, acceso por rol y edición de solicitudes). Smoke real con Chromium/Playwright: login ciudadano/admin, seis trámites, catálogo móvil 390px sin desbordamiento, bloqueo de ruta por rol y corrección administrativa → aprobación bloqueada → reenvío ciudadano, sin errores JS. Capturas de inicio escritorio y catálogo móvil en `/tmp/opencode/anda-desktop.png` y `/tmp/opencode/anda-mobile.png`; script temporal `/tmp/opencode/anda-browser-check.mjs`. Falta cubrir todos los recorridos y comparar las 17 referencias.
- Correcciones de QA: administrador solo aprueba datos en `En revisión`, no cuando espera corrección del ciudadano. Guardado ciudadano compara historial/estado vigente, relee almacenamiento y limita campos editables para no sustituir pago/especificaciones desde un formulario antiguo. La persistencia local sigue sin transacciones: no sustituye control de concurrencia del backend.
- Autenticación demo actualizada: ciudadanos con DUI + contraseña; administradores con correo + contraseña. Misma pantalla con opciones ciudadano/personal administrativo, comprobación de credencial y rol en la simulación. El backend real deberá validar el rol y usar correo institucional, nunca confiar en la opción visual. Administradores sin registro público. Segundo factor recomendado para autenticación administrativa real.
- QA adicional: 10 pruebas unitarias aprobadas. `frontend/e2e/services.mjs` recorre en Chromium los **seis trámites completos**, todos aprobados sin errores JS: creación/documentos, revisión, materiales y corrección cuando aplica, pago único, PDF, visita, comprobación física/sustitución pendiente sin repetir pago, cierre y seguimiento. Requiere Playwright externo indicado mediante `PLAYWRIGHT_MODULE`; instrucciones en README. Evidencias en `/tmp/opencode/anda-e2e/`. Corregido `pattern` telefónico para compatibilidad con expresiones regulares Unicode `v` de HTML.
- Visitas solo editables tras pago en estados `Pago registrado`, `Visita programada`, `En ejecución`; cierre requiere fecha válida, coordinación, resultado y compatibilidad física para materiales. Expediente finalizado no editable. Sustitución se coordina presencialmente en la demo; no se define política institucional de devoluciones.
- Comprobación de entorno: puerto PostgreSQL local 5432 no accesible al preparar la siguiente fase. Falta habilitar/configurar la BD antes de validar integración real.
- PostgreSQL **18.6** auxiliar ya arrancado y consulta real verificada en `127.0.0.1:55432`, base `anda_auth_test`, sin Docker ni privilegios de sistema. Runtime `embedded-postgres` instalado solo en `/tmp/opencode/anda-db-check/`; conexión y secreto de pruebas en `connection.json` con permisos 0600 (no imprimir). Datos en clúster separado dentro de esa carpeta. No depende de la VPS; usuario confirma desarrollar/probar en este entorno hasta desplegar PostgreSQL allí. `backend/.env` no modificado.
- `compose.yaml` y `DESARROLLO.md` ofrecen PostgreSQL con Docker como alternativa futura, no requisito ni servicio ejecutado.

## Backend (`backend/`)
- ESM: `"type": "module"`, `tsconfig` con `module/moduleResolution: NodeNext`. **Imports internos con sufijo `.js`** (`./routes/health.js`).
- Express 5 + `helmet` (headers de seguridad) + `cors` + `morgan` (log de peticiones) + `express.json()`.
- Auth: `bcryptjs` (hash, 10 rounds, máximo 72 bytes UTF-8) + `jsonwebtoken` (Bearer HS256, expira `JWT_EXPIRES_IN`, default `7d`). Tokens `{sub, role}`, sin DUI/correo; legacy sin rol rechazados. Guards comprueban cuenta activa en BD.
- TS: `declaration: true` + `@types/express` v5 exige **anotaciones explícitas** (`: Express`, `: Router`) o falla con TS2883.

### Estructura
```
backend/
├── prisma/schema.prisma        # Citizen + Administrator, ambos con active
├── prisma.config.ts            # Config Prisma 7 (datasource fuera del schema)
├── src/index.ts                # entry, PORT (default 3000)
├── src/app.ts                  # createApp(): Express — middlewares + rutas + 404 JSON
├── src/routes/health.ts        # GET /api/health, GET /api/health/db
├── src/routes/auth.ts          # POST /register, POST /login, GET /me (requireAuth)
├── src/controllers/auth.controller.ts
├── src/middleware/requireAuth.ts  # Guards citizen/admin; AuthRequest con id de cuenta
├── src/lib/prisma.ts           # singleton PrismaClient + PrismaPg adapter
├── src/lib/password.ts         # hashPassword / verifyPassword
├── src/lib/jwt.ts              # signAuthToken / verifyAuthToken (payload { sub, role })
├── .env / .env.example
```

### Dominio: ciudadano ANDA
- Registro **una sola vez** con `name` (min 3), `email` (único, se guarda lowercased), `dui` (único, formato salvadoreño `12345678-9`, regex `/^\d{8}-\d$/`), `password` (min 8, se guarda `passwordHash`).
- Login con **DUI + contraseña**. Respuestas nunca exponen el hash (`publicCitizen`: id, name, email, dui, createdAt).
- Errores en español: 400 validación, 401 credenciales/token, 409 duplicado (incluye manejo de race P2002), 404 cuenta no encontrada.
- Rutas: `POST /api/auth/register` → 201 `{ citizen, token }`; `POST /api/auth/login` → 200 `{ citizen, token }`; `GET /api/auth/me` (Bearer) → `{ citizen }`.
- Administrador: modelo separado, sin DUI; `POST /api/auth/admin/login` → `{administrator, token}`, `GET /api/auth/admin/me` → `{administrator}`. Correo normalizado y dominio exacto permitido por `ADMIN_EMAIL_DOMAINS`. Registro público nunca permite crear administradores.
- CLI `pnpm account:create-admin` con `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` en entorno; mínimo 12 caracteres, sin clave predeterminada ni upsert. `pnpm account:disable` requiere rol/id y confirmación de id. Desactivación invalida acceso posterior incluso con JWT vigente.
- Arranque exige JWT aleatorio robusto y `ADMIN_EMAIL_DOMAINS` explícito. Rate limit compartido registro/login/admin de 10 intentos/IP/15 minutos por proceso; errores JSON sanitizados. MFA, revocación individual y límites compartidos entre réplicas pendientes.

### Env (`backend/.env`)
`PORT=3000`, `NODE_ENV=development`, `CORS_ORIGIN=http://localhost:5173`,
`DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anda_db?schema=public"`,
`JWT_SECRET`, `JWT_EXPIRES_IN=7d`.

### Prisma 7 (importante, ya mordió)
- `schema.prisma`: `datasource db { provider = "postgresql" }` **sin `url`**. La URL vive en `prisma.config.ts` (`defineConfig({ schema, migrations.path, datasource: { url: env('DATABASE_URL') } })`).
- Cliente **requiere driver adapter**: `new PrismaPg({ connectionString })` → `new PrismaClient({ adapter })` (`src/lib/prisma.ts`). Sin esto: `PrismaClientConstructorValidationError`.
- `prisma generate` necesita `DATABASE_URL` en el entorno (el auto-load del `.env` falló una vez; funcionó con `set -a; source .env; set +a`).
- Prisma solo soporta Node 20.19+/22.12+/24 — el entorno tiene **Node 26.11.1**: funciona pero muestra warning en cada install.
- Tras instalar `prisma`/`@prisma/engines`/`esbuild` con pnpm hay que correr `pnpm approve-builds ...`.

### Scripts backend
`dev` (tsx watch), `build` (tsc → `dist/`), `start` (node dist), `prisma:generate`, `prisma:migrate` (`migrate dev`), `prisma:studio`.

## Estado verificado / pendiente
- ✅ API inicial de solicitudes persistentes: `backend/src/routes/requests.ts`, reglas en `backend/src/lib/requestRules.ts`, migración `20261118000000_service_requests`. Borrador, envío, correcciones, reenvío y aprobación auditados; propietario y rol comprobados, versión optimista y cambio/historial transaccionales. Admin no ve borradores. Contratos en `backend/README.md`.
- ✅ E2E de autenticación y solicitudes aprobado contra PostgreSQL 18.6 local aislado `anda_requests_test` en `127.0.0.1:55432`, restaurado tras el reinicio con clúster nuevo en `/tmp/opencode/anda-db-next/`. No cambiar `.env` ni reutilizar una BD de producción para E2E.
- ✅ React: demo por defecto; `VITE_PORTAL_MODE=api` activa `frontend/src/connected/` con `VITE_API_URL` (o `/api` del mismo origen). Sesión por pestaña, validación `/me` al recargar, catálogo, expedientes con historial y flujo de revisión conectado.
- ✅ Materiales y adjuntos: migración `20261118010000_request_materials`; API y UI conectadas soportan especificaciones, subida/descarga/retiro privado, corrección y aprobación preliminar de evidencia. Desconexión puede enviarse con modalidad y tres documentos. Adjuntos `bytea`, 5 MiB/archivo, 8/expediente; firma y extensión, no análisis antimalware.
- ✅ Pago y visitas: migración `20261118020000_simulated_payment_visits`. Pago único simulado con tarifa del servidor en centavos, PDF privado sin valor fiscal, visitas con horario de El Salvador, resultado y comprobación física según servicio. Sustitución permite reprogramar sin nuevo pago y queda en historial; cierre no editable.
- ✅ QA conectado: `frontend/e2e/connected.mjs` aprobó los seis trámites completos en Chromium con PostgreSQL local. Comprueba PDF e importe de cada trámite, documentos de desconexión, caja sin selector de diámetro, comprobación física solo cuando aplica, sustitución sin volver a pagar y expediente finalizado a 390 px. `backend/e2e/auth.postgres.mjs` aprobó concurrencia de pago y persistencia de expediente, historial, adjunto y comprobante tras reiniciar la API.
- ✅ Comparación visual de las 17 referencias y capturas conectadas, sin afirmar igualdad píxel a píxel. Inicio ciudadano, orientador local, resumen/colas/filtros administrativos y vistas separadas de evidencia, material, pago, seguimiento y visita. API `/overview` y filtros con paginación y permisos; ver `backend/README.md`. Los seis recorridos volvieron a pasar en Chromium después de estos cambios; capturas opcionales vía `ANDA_SNAPSHOT_DIR`.
- ✅ Plantillas académicas sin Docker en `deploy/` (Nginx/HTTPS, systemd, entorno y guía); ningún cambio en la VPS. Build conectado de mismo origen, lint, 10 pruebas frontend, 7 pruebas backend y sintaxis de unit verificados. `TRUST_LOCAL_PROXY=true` optativo y solo con API en loopback y proxy local que sobrescribe `X-Forwarded-For`; queda validar Nginx, TLS y PostgreSQL en VPS. La instancia temporal anterior no sobrevivió al reinicio.
- ✅ `tsc --noEmit` y `tsc` (build → `dist/`) limpios. Servidor bootea y `GET /api/health` → `{"status":"ok"}`; 404 JSON OK.
- ✅ Migración `20261116000000_initial_auth` creada y aplicada en PostgreSQL aislado `anda_auth_test` (55432). Build y 6 pruebas backend aprobadas. E2E `backend/e2e/auth.postgres.mjs` aprobado con BD real: boot, health/db, register → login → me, duplicados, administrador por CLI, roles y desactivación. No se migró la BD apuntada por `.env` ni la VPS.
- `.env` local no modificado; inspección sin divulgar valores mostró JWT de 64 caracteres no placeholder. Para arrancar la nueva API falta configurar dominio(s) administrativo(s) explícitos y URL de BD accesible. Las pruebas usaron configuración aleatoria por proceso y dominio ficticio `institution.test`.

## Convenciones para agentes
- Usar `pnpm` (no npm). Comandos desde `backend/`: `pnpm dev`, `pnpm exec tsc --noEmit` para verificar.
- Respetar ESM + sufijo `.js` en imports relativos y anotaciones de tipos Express/Router.
- Mensajes de API y validaciones en español. No devolver `passwordHash` en ninguna respuesta.
- Verificar con ejecución real (boot + curl a `/api/health`) tras cambios en el backend.
