# API ANDA

Node/Express/TypeScript, Prisma 7/PostgreSQL. `pnpm install`, `pnpm prisma:generate`,
`pnpm build`, `pnpm test`. `pnpm dev` inicia la API de autenticación y solicitudes.

## Configuración

Copie `.env.example` a su configuración local; no publique secretos.
`DATABASE_URL`, `CORS_ORIGIN`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`.
Opcionalmente usa `HOST=127.0.0.1` para limitar el servidor a conexiones locales.
Genere JWT_SECRET con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
El arranque rechaza secretos cortos/placeholders. Defina `ADMIN_EMAIL_DOMAINS`
con dominios institucionales aprobados separados por comas (coincidencia exacta,
sin subdominios implícitos). No hay dominio ni cuenta administrativa predeterminados.

## Migración

La migración inicial crea Citizen y Administrator con `active=true`, índices únicos
y sin seeds. Se generó sin conectar a PostgreSQL y luego se aplicó y verificó
en la base local aislada `anda_auth_test` (PostgreSQL 18.6, puerto 55432).
En una base nueva revisada:
`pnpm exec prisma migrate deploy`. No ejecutar sobre una base existente sin analizarla.
Si Citizen ya existe, requiere comparación y baseline planificado antes del deploy;
no resetear ni borrar datos. Esto no implica que la base configurada en `.env` ni la VPS
estén migradas. Reversión: planificar
backup y cambios compensatorios; eliminar tablas destruiría cuentas y no está autorizado.

## Administración local (operador autorizado)

`pnpm account:create-admin` requiere `ADMIN_NAME`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD` y `ADMIN_EMAIL_DOMAINS` en el entorno. Contraseña mínima 12 caracteres,
máximo 72 bytes UTF-8; bcrypt 10 rounds. No acepta secretos en argumentos, no imprime
credenciales, no hace upsert ni cambia claves existentes. Por ejemplo, en bash:

```sh
read -r -p 'Nombre: ' ADMIN_NAME; export ADMIN_NAME
read -r -p 'Correo institucional: ' ADMIN_EMAIL; export ADMIN_EMAIL
read -r -s -p 'Contraseña: ' ADMIN_PASSWORD; echo; export ADMIN_PASSWORD
pnpm account:create-admin
unset ADMIN_PASSWORD
```

Desactivar cuenta: establecer `ACCOUNT_ROLE=citizen` o `admin`, `ACCOUNT_ID` y
`ACCOUNT_CONFIRM_DISABLE` con el mismo ID; ejecutar `pnpm account:disable`.
Requiere acceso privilegiado a la BD; no existe endpoint público de provisioning
ni de desactivación. No se reactiva ni se cambia ninguna contraseña automáticamente.

## Contratos

- `POST /api/auth/register` `{name,email,dui,password}` → 201 `{citizen,token}`.
  Cualquier `role` enviado se ignora; siempre ciudadano.
- `POST /api/auth/login` `{dui,password}` → `{citizen,token}`.
- `GET /api/auth/me` Bearer ciudadano → `{citizen}`.
- `POST /api/auth/admin/login` `{email,password}` → `{administrator,token}`.
- `GET /api/auth/admin/me` Bearer admin → `{administrator}`.

Citizen público: id/name/email/dui/createdAt; administrator: id/name/email/createdAt.
Nunca se devuelven hash ni flags internos. JWT HS256 con `sub`, `role`, `iat`, `exp`,
sin DUI/correo. **Los tokens legacy sin rol se rechazan**: iniciar sesión nuevamente.
No se acepta un rol enviado por el cliente para autorizar; se valida token y cuenta
activa en BD en cada petición protegida. Desactivación afecta peticiones posteriores,
no revierte operaciones que ya estaban en curso.

Errores JSON en español: 400 validación/JSON, 401 credenciales/token/cuenta inactiva,
403 rol incorrecto, 409 duplicado, 413 tamaño, 429 intentos, 500 genérico.
Límite compartido registro/login/admin: 10 peticiones/IP/15 minutos, memoria acotada.
No se confía en X-Forwarded-For por defecto. `TRUST_LOCAL_PROXY=true` permite
un proxy local que sustituya ese encabezado y sea la única vía a Express.
Para múltiples réplicas usar un almacén compartido
y política de proxy explícita; reiniciar borra contadores. HTTPS, MFA administrativo,
gestión de sesiones/revocación individual y auditoría operativa quedan pendientes.

`pnpm test` usa repositorio simulado explícito y servidor HTTP efímero local; no conecta
con PostgreSQL.

### Prueba de integración con PostgreSQL real

Primero `pnpm build`. Selecciona explícitamente una base **local de pruebas** cuyo
nombre termine en `_test`, con `ANDA_TEST_DATABASE_URL`. Ejecuta:

```sh
node e2e/auth.postgres.mjs
```

La prueba aplica migraciones, crea cuentas ficticias mediante API/CLI, verifica
duplicados, JWT, perfiles, separación de roles y desactivación inmediata.
También prueba creación, permisos, controles de concurrencia, historial, revisión
y cierre. Reinicia la API y verifica que se conservan el expediente cerrado,
su historial, el PDF simulado y los bytes de un adjunto.
No borra tablas ni cuentas existentes: deja los expedientes y sus cuentas de prueba desactivadas.
Levanta la API compilada en el puerto 3001 y la detiene al finalizar; ese puerto debe
estar libre. Genera claves aleatorias y solo habilita `institution.test` en ese proceso.
No cambia `.env` ni configura un dominio institucional real.

Verificado con PostgreSQL 18.6: recorrido completo aprobado. La instancia auxiliar
es de pruebas, no un servicio persistente de VPS.

## Solicitudes persistentes

Todas las rutas requieren Bearer del rol indicado:

| Rol | Endpoint | Operación |
|---|---|---|
| Ciudadano | `POST /api/requests` | Crear borrador. `service` obligatorio, campos del expediente opcionales. |
| Ciudadano | `GET /api/requests` / `GET /api/requests/:id` | Consultar sus propios expedientes. |
| Ciudadano | `PATCH /api/requests/:id` | Editar borrador o corregir datos. |
| Ciudadano | `POST /api/requests/:id/submit` | Enviar o reenviar a revisión. |
| Administrador | `GET /api/admin/requests` / `GET /api/admin/requests/:id` | Consultar expedientes enviados, sin acceso a borradores. |
| Administrador | `POST /api/admin/requests/:id/correct` | Pedir corrección con `note` obligatorio. |
| Administrador | `POST /api/admin/requests/:id/approve` | Aprobar datos, con `note` opcional. |

`service`: `MEDIDOR`, `CAJA`, `VALVULA`, `RECONEXION`, `DESCONEXION` o `FUGA`.
Campos editables: `nis`, `phone`, `address`, `reference`, `reason` y `mode` solo
para desconexión (`TEMPORAL` o `DEFINITIVA`). El servidor asigna propietario,
número y estado. El NIS no se valida contra sistemas institucionales.

Listas: `{items,nextBefore}`, hasta 25 por página; enviar `?before=` con
`nextBefore` para continuar. Filtros opcionales `query` (NIS o `SOL-000001`),
`service`, `status` y `date` (día de El Salvador); administración admite
`queue=reviews` o `queue=visits`. `GET /overview` bajo la colección de cada
rol devuelve `{counts,recent}` con recuentos del ámbito autorizado. El inicio
ciudadano muestra hasta tres expedientes enviados recientes. Detalle y mutaciones: `{request}`, con historial
en orden de versión. Excepto la creación, todas las escrituras requieren `version`
vigente: si no coincide o el estado no permite la acción, devuelven 409.
Cambio de expediente e historial se guardan en una sola transacción.

La aprobación deja medidor/caja/válvula `PENDIENTE_ESPECIFICACIONES` y los
servicios sin material `HABILITADA_PAGO`. Medidor y válvula requieren diámetro
`MEDIA_PULGADA` o `TRES_CUARTOS`; la caja requiere especificación de compatibilidad,
sin diámetro. El modo conectado de React consume estas rutas.

### Materiales y archivos

| Rol | Endpoint | Datos |
|---|---|---|
| Administrador | `POST /api/admin/requests/:id/specifications` | `version`, `specification`, `diameter` (nulo para caja). |
| Ciudadano | `POST /api/requests/:id/attachments` | Cuerpo binario `application/octet-stream`; parámetros `version`, `filename`, `category`. |
| Ciudadano | `DELETE /api/requests/:id/attachments/:attachmentId` | `version` en JSON; solo en estados editables. |
| Ambos | `GET /api/requests/:id/attachments/:attachmentId` (admin: prefijo `/api/admin/requests`) | Descarga autenticada, no expandida en JSON. |
| Ciudadano | `POST /api/requests/:id/submit-evidence` | `version`; tras una corrección debe haber al menos un archivo agregado después de esa corrección. |
| Administrador | `POST /api/admin/requests/:id/correct-evidence` / `approve-evidence` | `version`; `note` obligatorio al pedir corrección. |

Para desconexión se exige modalidad e `IDENTIFICACION`, `ESCRITURA` y `CARTA`;
`REPRESENTACION` se agrega si corresponde. Los servicios de material usan `EVIDENCIA`.
Los adjuntos ficticios se guardan en PostgreSQL (`bytea`), hasta ocho por expediente
y 5 MiB por archivo. Se comprueba extensión y firma inicial, **no** integridad o
ausencia de malware. Solo el titular y la administración de expedientes enviados
pueden descargarlos. El contenido se entrega como adjunto, no se previsualiza
en el portal y no se publica en rutas estáticas. Para usar documentos reales
faltan análisis de archivos, políticas de conservación y revisión de privacidad.

La aprobación preliminar de evidencia habilita el pago, pero **no** implica
aceptación física de la pieza.

### Pago simulado y visitas

| Rol | Endpoint | Datos |
|---|---|---|
| Ciudadano | `POST /api/requests/:id/simulate-payment` | Solo `version`. No se aceptan importes ni datos financieros del cliente. |
| Ambos | `GET /api/requests/:id/receipt` (admin: `/api/admin/requests/:id/receipt`) | PDF privado, disponible tras el registro simulado. |
| Administrador | `POST /api/admin/requests/:id/schedule-visit` | `version`, `visitDate` (UTC, formato `2026-12-15T15:00:00.000Z`), `coordination`. |
| Administrador | `POST /api/admin/requests/:id/visit-progress` | `version`, `result`, `physical` para instalaciones (`PENDIENTE`, `COMPATIBLE`, `REQUIERE_SUSTITUCION`). |
| Administrador | `POST /api/admin/requests/:id/close-visit` | `version`. Usa los resultados ya guardados; no acepta cambios de estado por el cliente. |

El servidor aplica un importe fijo de referencia por servicio, en centavos de USD,
y guarda fecha e importe con la transición a `PAGO_REGISTRADO`. El control de
versión impide duplicados simultáneos. No hay pasarela, cargos, ni factura oficial.
El comprobante se genera con los datos persistidos y no tiene validez fiscal.

Una visita requiere pago simulado, fecha tentativa y coordinación. Primero se
programa, luego se guarda el avance (`EN_EJECUCION`). Para cerrar se exige el
resultado y, en medidor, caja y válvula, compatibilidad física confirmada.
Si requiere sustitución, se conserva el pago y se puede reprogramar la visita;
la observación permanece en el historial. Esta simulación no define devoluciones.
Un expediente `FINALIZADA` no se puede editar.
