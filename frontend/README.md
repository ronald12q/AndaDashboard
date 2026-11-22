# Portal ANDA — prototipo académico

## Modo conectado a la API

El modo predeterminado sigue siendo la demo. Para probar expedientes persistentes,
primero inicia el backend con una base de pruebas migrada (ver `../backend/README.md`).
Por ejemplo, si la API escucha en `127.0.0.1:3002`:

```sh
VITE_PORTAL_MODE=api VITE_API_URL=http://127.0.0.1:3002 pnpm dev --host 127.0.0.1 --port 5175 --strictPort
```

El backend debe incluir `http://127.0.0.1:5175` en `CORS_ORIGIN`. Si la API
se sirve bajo el mismo origen en `/api`, omite `VITE_API_URL`. Para un build conectado,
configura las mismas variables al compilar; no contienen secretos.

Usa cuentas y datos ficticios. El ciudadano se registra por DUI y el administrador
necesita un correo habilitado por CLI en la base local. Este modo guarda el token
en `sessionStorage` y revalida la cuenta al recargar. No lee cuentas ni solicitudes
de la demo. El cierre de sesión elimina el token de la pestaña, no lo revoca en el servidor.

Flujo disponible: catálogo, borrador, envío, revisión, correcciones, especificaciones,
adjuntos privados, pago simulado, comprobante PDF, programación, visita y cierre.
Desconexión puede enviarse tras adjuntar los documentos de prueba. Las fechas
tentativas de visita se introducen en hora de El Salvador. El orientador local
está disponible en ambos modos. Por defecto responde localmente; el modo
conectado puede activar el RAG con `VITE_RAG_ENABLED=true` (ver README raíz).
El orientador no consulta expedientes.

Prueba Chromium (`node e2e/connected.mjs`) con portal conectado local:
define `ANDA_TEST_ADMIN_EMAIL` (dominio `.test`), `ANDA_TEST_ADMIN_PASSWORD`,
`PLAYWRIGHT_MODULE` si Playwright es externo y `BASE_URL` si cambia el puerto.
Usa una base descartable: la prueba crea una cuenta ciudadana ficticia y seis
expedientes. Recorre los seis trámites hasta el cierre, verifica el importe y
contenido de cada PDF, materiales cuando corresponde y los documentos de
desconexión. Medidor incluye corrección de datos y evidencia y reprogramación
por sustitución sin repetir el pago. También comprueba el expediente finalizado
a 390 px y el cierre de sesión. No borra los datos creados.
Define `ANDA_SNAPSHOT_DIR` para guardar las 17 capturas de referencia del flujo
conectado y dos variantes móviles. Son capturas de inspección, no una prueba de
igualdad píxel a píxel.

## Modo demo

React 19, TypeScript, Vite y Tailwind 4. Interfaz basada en las 17 capturas de `../interfaces/`, sin reproducir el contador incorrecto `/18`.

```sh
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## Acceso de demostración

| Cuenta | Identificador ficticio | Clave |
|---|---|---|
| Ciudadano | `00000001-0` | `DemoANDA2026` |
| Administrador (correo) | `admin@example.com` | `DemoANDA2026` |

En la misma pantalla se elige Ciudadano (DUI) o Personal administrativo (correo). La credencial debe corresponder al tipo de cuenta seleccionado; cambiar la opción no concede permisos. No hay acceso invitado ni registro público administrativo. El registro crea únicamente ciudadanos con la misma clave demo publicada; no guarda contraseñas. No introducir datos personales reales. La autenticación es una simulación local, **no una barrera de seguridad para producción**. El correo administrativo de ejemplo es ficticio: en producción se usará correo institucional y validación del rol en el servidor.

## Recorrido

1. Ciudadano: catálogo → requisitos → solicitud → revisión.
2. Cerrar sesión e ingresar como administrador. En revisiones, registrar resultado manual **simulado** de cuenta y documentos.
3. Medidor/caja/válvula: continuar a especificaciones y enviarlas; ciudadano descarga la ficha y envía evidencia ficticia.
4. Administrador: revisión de evidencia → corrección con observación o habilitar pago. Reconexión/desconexión/fuga omiten compra y evidencia de material.
5. Ciudadano: pago simulado → comprobante PDF descargable sin validez fiscal.
6. Administrador: visitas → coordinación y fecha → guardar avance → resultado y comprobación física → finalizar.
7. El ciudadano consulta los cambios en seguimiento e historial.

Las listas «Mis solicitudes», «Revisiones» y «Visitas» son navegables; filtros por NIS/solicitud, trámite, estado y fecha. El botón flotante abre un orientador local de respuestas predefinidas con estado «no disponible», documentos y reintento. No utiliza IA externa.

## Persistencia y límites

- Datos compartidos entre ambos roles en `localStorage` (`anda-demo-requests-v1`, `anda-demo-users-v1`); sesión por pestaña en `sessionStorage`. La primera cuenta contiene ejemplos en varios estados.
- Se almacenan únicamente metadatos de archivos, no documentos ni fotografías originales; las referencias descargadas explican este límite.
- El formulario de pago tiene datos ficticios de solo lectura. No se capturan ni guardan tarjetas.
- No se llama al backend, no se verifican NIS, no hay pagos, citas ni trámites reales.
- Tarifas de referencia demo con IVA, no vigentes confirmadas. La entrega de material en el domicilio es una propuesta académica, no un procedimiento autorizado.
- Restricción residencial ½/¾ para medidor y válvula. El administrador determina el diámetro; no se inventan dimensiones de cajas. Las fotografías no sustituyen aceptación física.
- Para reiniciar, eliminar las claves `anda-demo-*` del almacenamiento local del navegador y recargar.
- Sin dependencias agregadas. `pnpm test` verifica catálogo, coherencia de datos demo, fallback de persistencia, estructura de PDF, acceso por rol y protección de edición obsoleta (7 pruebas).
- Revisión de datos: mientras el ciudadano tiene una corrección pendiente, el administrador no puede aprobarla. El reenvío devuelve el expediente a «En revisión». Los formularios antiguos no pueden sobrescribir pagos/especificaciones ni guardar si el historial ya cambió.
- Smoke de navegador ejecutado con Chromium/Playwright externo al proyecto: accesos, catálogo escritorio/móvil, bloqueo por rol y recorrido de corrección/reenvío. Aún falta cobertura E2E de todos los trámites.

## Pruebas E2E

`e2e/services.mjs` utiliza Node `assert` y Chromium real mediante Playwright, sin añadir dependencias al proyecto. Requiere un servidor Vite y Playwright con Chromium instalado.

```sh
# Terminal 1
pnpm dev --host 127.0.0.1 --port 5175
# Terminal 2, desde frontend/
BASE_URL=http://127.0.0.1:5175 node e2e/services.mjs
# Si Playwright está instalado externamente:
PLAYWRIGHT_MODULE=/ruta/absoluta/playwright/index.mjs node e2e/services.mjs
```

`BASE_URL` predeterminado: `http://127.0.0.1:5175`. `PLAYWRIGHT_MODULE` predeterminado: `playwright`. Artefactos en `/tmp/opencode/anda-e2e` (configurable mediante `E2E_ARTIFACTS`): PDFs descargados y capturas de fallos. El proceso termina con código 1 si falla cualquier recorrido.

Cada uno de los seis servicios dispone de un contexto limpio y se crea exclusivamente mediante UI, alternando sesiones ciudadano/administrador con las credenciales demo. No se inyectan solicitudes, sesiones ni almacenamiento. Incluye revisión, tres documentos requeridos de desconexión, especificaciones y corrección de evidencia PNG/PDF para materiales, bloqueo de pago prematuro, pago único, descarga/verificación de PDF, coordinación de visita, cierre bloqueado sin resultado/compatibilidad, sustitución presencial sin nuevo cobro, cierre inmutable y seguimiento final. También comprueba errores JavaScript y de consola.

Última ejecución (16/11/2026): los seis recorridos completaron sus comprobaciones funcionales, pero los seis fallaron en la comprobación final de consola: el patrón telefónico `[0-9+() -]{8,20}` es inválido bajo la bandera `v` de Chromium. No se considera la suite aprobada hasta corregir producción y volver a ejecutarla. Pendiente: comparación visual de las 17 referencias, otros navegadores y concurrencia entre pestañas.
