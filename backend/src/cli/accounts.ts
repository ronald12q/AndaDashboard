import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { validName, validEmail, validPassword, normalizeEmail, isInstitutionalEmail } from '../lib/validation.js';

// Secrets are accepted through the environment only, never argv or logs.
const run = async (): Promise<void> => {
  const command = process.argv[2];
  if (process.argv.length !== 3 || !['create-admin', 'disable'].includes(command)) {
    throw new Error('Uso: pnpm account:create-admin o pnpm account:disable. Configure las variables documentadas.');
  }
  if (command === 'create-admin') {
    const { ADMIN_NAME: name, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
    delete process.env.ADMIN_PASSWORD;
    if (!validName(name) || !validEmail(email) || !validPassword(password, 12)) {
      throw new Error('Defina ADMIN_NAME (3–150), ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres, máximo 72 bytes UTF-8).');
    }
    if (!isInstitutionalEmail(email)) throw new Error('Correo fuera de los dominios institucionales autorizados.');
    await prisma.administrator.create({ data: {
      name: name.trim(), email: normalizeEmail(email), passwordHash: await hashPassword(password),
    } });
    console.log('Administrador creado. No se modificaron cuentas existentes.');
    return;
  }
  const { ACCOUNT_ROLE: role, ACCOUNT_ID: id, ACCOUNT_CONFIRM_DISABLE: confirmation } = process.env;
  if (!id || !['citizen', 'admin'].includes(role ?? '') || confirmation !== id) {
    throw new Error('Defina ACCOUNT_ROLE (citizen/admin), ACCOUNT_ID y ACCOUNT_CONFIRM_DISABLE igual al ID para confirmar.');
  }
  if (role === 'admin') await prisma.administrator.update({ where: { id }, data: { active: false } });
  else await prisma.citizen.update({ where: { id }, data: { active: false } });
  console.log('Cuenta desactivada. Sus tokens ya no autorizan nuevas peticiones.');
};

try { await run(); }
catch (error) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    console.error(error.code === 'P2002' ? 'La cuenta ya existe; no se modificó.' :
      error.code === 'P2025' ? 'Cuenta no encontrada.' : 'Operación de base de datos fallida.');
  } else {
    // Only our own configuration/validation errors may be displayed.
    const message = error instanceof Error ? error.message : '';
    console.error(/^(Uso:|Defina |Correo fuera)/.test(message) ? message : 'No se pudo completar la operación.');
  }
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
