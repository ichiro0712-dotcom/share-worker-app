/**
 * Advisor 専用の DB クライアント。
 *
 * 設計:
 * - Advisor が "TASTAS の本番データ" を読みに行くための専用 Prisma クライアント。
 * - 既存の `lib/prisma` (ローカル開発用 / メタデータ用) とは独立。
 *
 * 接続先の優先順位:
 *   1. ADVISOR_DATA_DATABASE_URL (Supabase 読み取り専用ロールの DSN)
 *   2. 未設定なら、開発用 DATABASE_URL にフォールバック (ローカル Docker)
 *
 * 安全策 (多層防御):
 * - Supabase 側: read-only ロール (postgres_readonly_advisor) で接続
 * - アプリ側: クエリ実行時に BEGIN READ ONLY トランザクションでラップ
 * - スキーマ: Prisma Client は Schema 全体を共有するが、ツール実装は SELECT 系のみ
 *
 * 注意:
 * - Advisor の Session/Message/Audit テーブルは メインの `prisma` (`@/lib/prisma`) で扱う。
 *   本クライアントは TASTAS の業務データ (Job/User/Application/...) を読むためだけに使う。
 */

import { PrismaClient } from '@prisma/client';

const advisorDataDsn = process.env.ADVISOR_DATA_DATABASE_URL;

const advisorDataPrismaSingleton = () => {
  if (!advisorDataDsn) {
    // フォールバック: ADVISOR_DATA_DATABASE_URL が未設定なら DATABASE_URL を使う。
    // これにより本番 Supabase 接続前のローカル開発で挙動が壊れない。
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: advisorDataDsn } },
  });
};

declare const globalThis: {
  advisorDataPrismaGlobal: ReturnType<typeof advisorDataPrismaSingleton>;
} & typeof global;

const advisorDataPrisma =
  globalThis.advisorDataPrismaGlobal ?? advisorDataPrismaSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.advisorDataPrismaGlobal = advisorDataPrisma;
}

/**
 * READ ONLY トランザクションで関数を実行する。
 *
 * Postgres の `SET TRANSACTION READ ONLY` を使い、INSERT/UPDATE/DELETE を
 * トランザクションレベルで失敗させる。万一ツール実装に書き込みクエリが
 * 紛れ込んでも、このラッパー越しなら絶対に書けない。
 *
 * 使い方:
 *   const data = await runReadOnly(async (tx) => {
 *     return tx.job.count({ where: { is_published: true } });
 *   });
 */
export async function runReadOnly<T>(
  fn: (
    tx: Omit<
      PrismaClient,
      | '$connect'
      | '$disconnect'
      | '$on'
      | '$transaction'
      | '$use'
      | '$extends'
    >
  ) => Promise<T>
): Promise<T> {
  return advisorDataPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return fn(tx);
  });
}

/**
 * 接続先の説明を返す (ログ・デバッグ用)。
 * パスワード等を含まない安全な要約のみ。
 */
export function describeAdvisorDataConnection(): {
  source: 'production_supabase' | 'local_fallback';
  host: string;
} {
  if (!advisorDataDsn) {
    return { source: 'local_fallback', host: 'DATABASE_URL fallback' };
  }
  try {
    const u = new URL(advisorDataDsn);
    return { source: 'production_supabase', host: u.host };
  } catch {
    return { source: 'production_supabase', host: '(invalid url)' };
  }
}

export { advisorDataPrisma };
