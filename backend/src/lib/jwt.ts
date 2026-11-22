import jwt from 'jsonwebtoken';

export type Role = 'citizen' | 'admin';
export interface AuthTokenPayload { sub: string; role: Role }

export const validateJwtConfiguration = (): string => {
  const secret = process.env.JWT_SECRET ?? '';
  if (Buffer.byteLength(secret) < 32 || /placeholder|change|replace|secret|demo|example/i.test(secret)
      || new Set(secret).size < 10) {
    throw new Error('JWT_SECRET debe ser aleatoria, de al menos 32 bytes y no un placeholder; genere 32 bytes con crypto.randomBytes.');
  }
  const expiry = process.env.JWT_EXPIRES_IN ?? '7d';
  if (!/^[1-9]\d*(s|m|h|d)$/.test(expiry)) {
    throw new Error('JWT_EXPIRES_IN debe ser una duración positiva con unidad s, m, h o d.');
  }
  return secret;
};

export const signAuthToken = (payload: AuthTokenPayload): string =>
  jwt.sign({ role: payload.role }, validateJwtConfiguration(), {
    subject: payload.sub, algorithm: 'HS256',
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const payload = jwt.verify(token, validateJwtConfiguration(), { algorithms: ['HS256'] });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub.trim()
      || payload.sub.length > 128 || (payload.role !== 'citizen' && payload.role !== 'admin')
      || typeof payload.exp !== 'number') throw new Error('Token inválido');
  return { sub: payload.sub, role: payload.role };
};
