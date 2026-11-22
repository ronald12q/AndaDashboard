import type { RequestHandler } from 'express';

// Per-process, fixed window and bounded memory. req.ip respects Express's proxy policy.
export const createLoginLimiter = (max = 10, windowMs = 15 * 60_000): RequestHandler => {
  const attempts = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip ?? 'unknown';
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10_000) {
        res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' }); return;
      }
      entry = { count: 0, until: now + windowMs }; attempts.set(key, entry);
    }
    if (++entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' }); return;
    }
    next();
  };
};
