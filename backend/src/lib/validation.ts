export const bodyObject = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
export const validName = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= 150;
export const validEmail = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const validDui = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{8}-\d$/.test(v.trim());
export const validPassword = (v: unknown, minimum = 8): v is string =>
  typeof v === 'string' && v.length >= minimum && Buffer.byteLength(v, 'utf8') <= 72;
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const institutionalDomains = (): string[] => {
  const domains = (process.env.ADMIN_EMAIL_DOMAINS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!domains.length || domains.some(v => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(v))) {
    throw new Error('Configure ADMIN_EMAIL_DOMAINS con dominios institucionales autorizados, separados por comas.');
  }
  return domains;
};
export const isInstitutionalEmail = (email: string): boolean =>
  institutionalDomains().includes(normalizeEmail(email).split('@')[1]);
