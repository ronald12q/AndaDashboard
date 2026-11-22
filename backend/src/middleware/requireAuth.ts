import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { verifyAuthToken, type Role } from '../lib/jwt.js';
import type { AuthStore } from '../lib/authStore.js';
import { prisma } from '../lib/prisma.js';

export interface AuthRequest extends Request {
  citizen?: { id: string };
  administrator?: { id: string };
}

export const createRoleGuard = (role: Role, store: AuthStore): RequestHandler =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token requerido. Usa Authorization: Bearer <token>' });
      return;
    }
    let payload;
    try { payload = verifyAuthToken(header.slice(7).trim()); }
    catch { res.status(401).json({ error: 'Token inválido o expirado' }); return; }
    if (payload.role !== role) {
      res.status(403).json({ error: 'No tienes permiso para este recurso' }); return;
    }
    try {
      const account = role === 'citizen'
        ? await store.citizen.findUnique({ where: { id: payload.sub }, select: { id: true, active: true } })
        : await store.administrator.findUnique({ where: { id: payload.sub }, select: { id: true, active: true } });
      if (!account?.active) {
        res.status(401).json({ error: 'Cuenta no disponible' }); return;
      }
      if (role === 'citizen') req.citizen = { id: account.id };
      else req.administrator = { id: account.id };
      next();
    } catch (error) { next(error); }
  };

export const requireAuth: RequestHandler = createRoleGuard('citizen', prisma);
export const requireAdmin: RequestHandler = createRoleGuard('admin', prisma);
