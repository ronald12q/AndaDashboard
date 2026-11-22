import { Router, type Router as ExpressRouter } from 'express';
import { createRoleGuard } from '../middleware/requireAuth.js';
import { createLoginLimiter } from '../middleware/rateLimit.js';
import type { AuthStore } from '../lib/authStore.js';
import { bodyObject } from '../lib/validation.js';

export function createChatRouter(store: AuthStore): ExpressRouter {
  const router: ExpressRouter = Router();
  const limit = createLoginLimiter(6, 60_000);
  const ragUrl = process.env.RAG_URL;
  if (ragUrl && !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(ragUrl)) {
    throw new Error('RAG_URL debe ser una URL HTTP local como http://127.0.0.1:8000.');
  }
  router.post('/', limit, createRoleGuard('citizen', store), async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!ragUrl) { res.status(503).json({ error: 'El orientador no está disponible.' }); return; }
    const { pregunta } = bodyObject(req.body);
    if (typeof pregunta !== 'string' || !pregunta.trim() || pregunta.length > 500) {
      res.status(400).json({ error: 'Escribe una consulta de hasta 500 caracteres.' }); return;
    }
    if (/@|\b\d{8}\s*-\s*\d\b|\b\d{7,}\b|\bnis\s*[:#-]?\s*\d/i.test(pregunta)) {
      res.status(400).json({ error: 'Haz una consulta general, sin correo, identificación ni número de cuenta.' }); return;
    }
    try {
      const response = await fetch(`${ragUrl}/pregunta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: pregunta.trim() }),
        redirect: 'error', signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Servicio no disponible');
      const { respuesta: answer } = bodyObject(await response.json());
      if (typeof answer !== 'string' || !answer.trim() || answer.length > 8000) throw new Error('Respuesta inválida');
      res.json({ respuesta: answer.trim() });
    } catch {
      res.status(503).json({ error: 'El orientador no está disponible.' });
    }
  });
  return router;
}
