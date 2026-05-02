/**
 * Advisor 知識同期 cron エンドポイント
 *
 * Vercel Cron もしくは外部ジョブから定期的に呼び出される。
 * GitHub から CLAUDE.md / docs / Prisma schema を取得し、advisor_knowledge_cache を更新する。
 *
 * 認証:
 *   Authorization: Bearer ${ADVISOR_CRON_SECRET}
 *
 * 想定スケジュール:
 *   毎時 0分 (vercel.json で設定)
 */

import { NextResponse } from 'next/server';
import { runKnowledgeSync } from '@/src/lib/advisor/knowledge/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const expected = process.env.ADVISOR_CRON_SECRET;
  if (!expected) {
    // 開発環境で env 未設定なら制限しない
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runKnowledgeSync({ trigger: 'scheduled' });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET も同じ処理 (Vercel Cron は GET でも POST でも呼べる)
export async function GET(req: Request) {
  return POST(req);
}
