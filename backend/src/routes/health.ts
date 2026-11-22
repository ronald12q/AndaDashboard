import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

healthRouter.get('/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ database: 'connected' });
  } catch {
    res.status(503).json({
      database: 'disconnected',
      error: 'Base de datos no disponible',
    });
  }
});
