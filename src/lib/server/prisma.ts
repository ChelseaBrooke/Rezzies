import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

const devLog = ['error', 'warn'];
if (process.env.PRISMA_LOG_QUERIES === 'true') devLog.push('query');

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? devLog : ['error']
	});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

