# Portal ANDA

Prototipo académico de seis trámites técnicos, con React, Express y PostgreSQL.
Usa únicamente cuentas, documentos y pagos ficticios.

- [Entorno de desarrollo](DESARROLLO.md)
- [Frontend y pruebas de navegador](frontend/README.md)
- [API, migraciones y pruebas](backend/README.md)
- [Despliegue sin Docker](deploy/README.md)

## Orientador RAG

El código de FastAPI ya tiene [su propio repositorio](https://github.com/ronald12q/Rag_project).
`Rag-project/` es una copia de trabajo opcional, ignorada por Git en ANDA.
También puede vivir fuera de esta carpeta: Express se conecta por HTTP, no por
rutas de archivos. Si necesitas clonar ambos:

```sh
git clone https://github.com/ronald12q/Rag_project.git Rag-project
```

Sigue su guía para instalar dependencias y configurar sus claves de forma
privada. Desde ese repositorio, inicia FastAPI en `127.0.0.1`:

```sh
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Configura `RAG_URL=http://127.0.0.1:8000` en Express y activa el frontend
con `VITE_PORTAL_MODE=api VITE_RAG_ENABLED=true` (y `VITE_API_URL` si usa otro
origen). El navegador llama a `POST /api/chat`; Express valida la sesión
ciudadana, limita consultas y envía solo `{pregunta}` a `POST /pregunta`.
El README del RAG menciona `/chat`, pero su código actual expone `/pregunta`.
El chat demo sigue siendo local por defecto.

No exponer FastAPI ni sus claves al navegador. El RAG usa proveedores externos;
solo se permiten consultas generales, sin documentos ni datos personales.
El filtro de identificadores comunes no sustituye esa regla. El RAG no consulta
expedientes ni ejecuta trámites. No es necesario reindexar en cada arranque:
confirma el índice y su contenido antes de usar scripts de indexación. Al
momento de integrar, ambos `source.csv` coincidían; si se editan, coordina
la actualización del corpus en el repositorio RAG.
