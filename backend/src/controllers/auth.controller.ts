import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/requireAuth.js';
import type { AuthStore } from '../lib/authStore.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAuthToken } from '../lib/jwt.js';
import { bodyObject, validName, validEmail, validDui, validPassword, normalizeEmail, isInstitutionalEmail } from '../lib/validation.js';

const citizenSelect = { id: true, name: true, email: true, dui: true, createdAt: true } as const;
const adminSelect = { id: true, name: true, email: true, createdAt: true } as const;
const publicCitizen = (c: { id: string; name: string; email: string; dui: string; createdAt: Date }) =>
  ({ id: c.id, name: c.name, email: c.email, dui: c.dui, createdAt: c.createdAt });
const publicAdmin = (a: { id: string; name: string; email: string; createdAt: Date }) =>
  ({ id: a.id, name: a.name, email: a.email, createdAt: a.createdAt });
// Equal bcrypt work for missing accounts; this is not a usable account or seeded credential.
const dummyHash = hashPassword('not-an-account-' + 'x'.repeat(32));

export const createAuthControllers = (store: AuthStore) => ({
  register: async (req: Request, res: Response): Promise<void> => {
    const { name, email, dui, password } = bodyObject(req.body);
    if (!validName(name) || !validEmail(email) || !validDui(dui) || !validPassword(password)) {
      res.status(400).json({ error: 'Datos inválidos: nombre de 3 a 150 caracteres, correo válido (máximo 254), DUI 12345678-9 y contraseña de mínimo 8 caracteres y máximo 72 bytes UTF-8.' }); return;
    }
    try {
      const citizen = await store.citizen.create({ data: {
        name: name.trim(), email: normalizeEmail(email), dui: dui.trim(), passwordHash: await hashPassword(password),
      } });
      res.status(201).json({ citizen: publicCitizen(citizen), token: signAuthToken({ sub: citizen.id, role: 'citizen' }) });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        res.status(409).json({ error: 'DUI o correo ya registrados' }); return;
      }
      throw error;
    }
  },
  login: async (req: Request, res: Response): Promise<void> => {
    const { dui, password } = bodyObject(req.body);
    if (!validDui(dui) || !validPassword(password, 1)) {
      res.status(400).json({ error: 'DUI o contraseña inválidos (máximo 72 bytes UTF-8)' }); return;
    }
    const citizen = await store.citizen.findUnique({ where: { dui: dui.trim() } });
    const ok = await verifyPassword(password, citizen?.passwordHash ?? await dummyHash);
    if (!citizen?.active || !ok) {
      res.status(401).json({ error: 'Credenciales inválidas' }); return;
    }
    res.json({ citizen: publicCitizen(citizen), token: signAuthToken({ sub: citizen.id, role: 'citizen' }) });
  },
  adminLogin: async (req: Request, res: Response): Promise<void> => {
    const { email, password } = bodyObject(req.body);
    if (!validEmail(email) || !validPassword(password, 1)) {
      res.status(400).json({ error: 'Correo o contraseña inválidos (máximo 72 bytes UTF-8)' }); return;
    }
    const administrator = isInstitutionalEmail(email)
      ? await store.administrator.findUnique({ where: { email: normalizeEmail(email) } }) : null;
    const ok = await verifyPassword(password, administrator?.passwordHash ?? await dummyHash);
    if (!administrator?.active || !ok) {
      res.status(401).json({ error: 'Credenciales inválidas' }); return;
    }
    res.json({ administrator: publicAdmin(administrator), token: signAuthToken({ sub: administrator.id, role: 'admin' }) });
  },
  getMe: async (req: AuthRequest, res: Response): Promise<void> => {
    const citizen = await store.citizen.findUnique({ where: { id: req.citizen!.id }, select: citizenSelect });
    if (!citizen) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }
    res.json({ citizen: publicCitizen(citizen) });
  },
  adminMe: async (req: AuthRequest, res: Response): Promise<void> => {
    const administrator = await store.administrator.findUnique({ where: { id: req.administrator!.id }, select: adminSelect });
    if (!administrator) { res.status(404).json({ error: 'Cuenta no encontrada' }); return; }
    res.json({ administrator: publicAdmin(administrator) });
  },
});
