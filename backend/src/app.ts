import cors from 'cors';
import express, { type Express, type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { prisma } from './lib/prisma.js';
import type { AuthStore } from './lib/authStore.js';
import { adminRequests, citizenRequests } from './routes/requests.js';
import { RequestError } from './lib/requestRules.js';
import { createChatRouter } from './routes/chat.js';

// Query parameters may contain a NIS or a filename; keep them out of access logs.
morgan.token('url', req => {
  const url = 'originalUrl' in req && typeof req.originalUrl === 'string' ? req.originalUrl : req.url;
  return url?.split('?')[0];
});

export const createApp = (store: AuthStore = prisma): Express => {
  const app = express();

  // Only for a single, local reverse proxy that overwrites X-Forwarded-For.
  if (process.env.TRUST_LOCAL_PROXY === 'true') app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173' }));
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter(store));
  app.use('/api/chat', createChatRouter(store));
  app.use('/api/requests', citizenRequests);
  app.use('/api/admin/requests', adminRequests);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado' });
  });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof RequestError) {
      res.status(error.status).json({ error: error.message }); return;
    }
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'JSON inválido' }); return;
    }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Solicitud demasiado grande' }); return;
    }
    if (error?.type === 'encoding.unsupported') {
      res.status(415).json({ error: 'Codificación del cuerpo no admitida' }); return;
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  };
  app.use(errors);

  return app;
}
