import type { PrismaClient } from '@prisma/client';
export type AuthStore = Pick<PrismaClient, 'citizen' | 'administrator'>;
