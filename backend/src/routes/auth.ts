import { Router } from 'express';
import { createAuthControllers } from '../controllers/auth.controller.js';
import { createRoleGuard } from '../middleware/requireAuth.js';
import { createLoginLimiter } from '../middleware/rateLimit.js';
import type { AuthStore } from '../lib/authStore.js';
import { prisma } from '../lib/prisma.js';

export const createAuthRouter = (store: AuthStore): Router => {
  const router: Router = Router();
  const handlers = createAuthControllers(store);
  const limiter = createLoginLimiter();
  router.post('/register', limiter, handlers.register);
  router.post('/login', limiter, handlers.login);
  router.get('/me', createRoleGuard('citizen', store), handlers.getMe);
  router.post('/admin/login', limiter, handlers.adminLogin);
  router.get('/admin/me', createRoleGuard('admin', store), handlers.adminMe);
  return router;
};
export const authRouter: Router = createAuthRouter(prisma);
