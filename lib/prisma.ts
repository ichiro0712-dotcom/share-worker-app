import { PrismaClient } from '@prisma/client';

// PrismaClient設定
// Vercel Postgres (PgBouncer) 環境でのprepared statementエラー対策:
// DATABASE_URLに ?pgbouncer=true&connection_limit=1 を追加する必要あり
// または DIRECT_URL を使用（マイグレーション用）
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export { prisma };
export default prisma;
