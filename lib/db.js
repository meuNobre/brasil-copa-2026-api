const { PrismaClient } = require('@prisma/client');

// Evita criar múltiplas instâncias do Prisma Client em ambiente serverless
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
