/**
 * 知識同期のロジック本体
 *
 * 呼び出し元:
 * - app/api/cron/advisor-knowledge-sync/route.ts (定期実行)
 * - 手動トリガー (テスト用 / 緊急更新用)
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { fetchGithubFile, isGithubAvailable } from './github-source';
import { upsertKnowledge } from './store';
import { KNOWLEDGE_SOURCES } from './types';

/**
 * GitHub から取得を試みて、失敗したらローカルファイルから読む。
 * 開発時、まだ main に push していないファイルでもキャッシュできる。
 */
async function fetchFileWithFallback(
  filePath: string,
  signal?: AbortSignal
): Promise<{ content: string; sha?: string; size: number; source: 'github' | 'local' }> {
  // 1. GitHub を試す
  if (isGithubAvailable()) {
    try {
      const file = await fetchGithubFile({ path: filePath, signal });
      return { content: file.content, sha: file.sha, size: file.size, source: 'github' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 404 の場合のみローカルにフォールバック (それ以外は環境問題なので throw)
      if (!message.includes('404')) {
        throw err;
      }
    }
  }

  // 2. ローカルファイルから読む (NODE_ENV !== production の時のみ)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`ファイル ${filePath} は GitHub に存在せず、本番環境ではローカル fallback できません`);
  }
  const absPath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(absPath, 'utf-8');
  const size = Buffer.byteLength(content, 'utf-8');
  return { content, size, source: 'local' };
}

export interface SyncResult {
  status: 'success' | 'partial' | 'failed';
  filesTotal: number;
  filesChanged: number;
  filesUnchanged: number;
  errors: Array<{ key: string; path: string; error: string }>;
  durationMs: number;
}

export async function runKnowledgeSync(opts: {
  trigger: 'scheduled' | 'manual' | 'startup';
  signal?: AbortSignal;
}): Promise<SyncResult> {
  const startedAt = Date.now();

  // GitHub が使えない & 本番環境の場合のみ早期 return
  // 開発環境ではローカルファイルから読めるので続行
  if (!isGithubAvailable() && process.env.NODE_ENV === 'production') {
    const result: SyncResult = {
      status: 'failed',
      filesTotal: KNOWLEDGE_SOURCES.length,
      filesChanged: 0,
      filesUnchanged: 0,
      errors: [
        {
          key: '_env',
          path: '',
          error:
            'GITHUB_TOKEN_FOR_ADVISOR / ADVISOR_GITHUB_OWNER / ADVISOR_GITHUB_REPO の少なくとも1つが設定されていません',
        },
      ],
      durationMs: 0,
    };
    await recordSyncLog(opts.trigger, result, startedAt);
    return result;
  }

  let filesChanged = 0;
  let filesUnchanged = 0;
  const errors: SyncResult['errors'] = [];

  // 並列取得 (GitHub レート制限内)
  await Promise.allSettled(
    KNOWLEDGE_SOURCES.map(async (source) => {
      try {
        const file = await fetchFileWithFallback(source.path, opts.signal);
        const limited =
          source.maxBytes && file.content.length > source.maxBytes
            ? file.content.slice(0, source.maxBytes) + '\n\n... (truncated)'
            : file.content;

        const contentHash = crypto.createHash('sha256').update(limited).digest('hex');

        const { changed } = await upsertKnowledge({
          key: source.key,
          label: source.label,
          path: source.path,
          content: limited,
          contentHash,
          sourceSha: file.sha,
        });

        if (changed) {
          filesChanged += 1;
        } else {
          filesUnchanged += 1;
        }
      } catch (err) {
        errors.push({
          key: source.key,
          path: source.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  const status: SyncResult['status'] =
    errors.length === 0 ? 'success' : errors.length === KNOWLEDGE_SOURCES.length ? 'failed' : 'partial';

  const result: SyncResult = {
    status,
    filesTotal: KNOWLEDGE_SOURCES.length,
    filesChanged,
    filesUnchanged,
    errors,
    durationMs: Date.now() - startedAt,
  };

  await recordSyncLog(opts.trigger, result, startedAt);
  return result;
}

async function recordSyncLog(
  trigger: SyncResult extends infer R ? string : never | 'scheduled' | 'manual' | 'startup',
  result: SyncResult,
  startedAt: number
): Promise<void> {
  try {
    await prisma.advisorKnowledgeSyncLog.create({
      data: {
        trigger: String(trigger),
        files_total: result.filesTotal,
        files_changed: result.filesChanged,
        status: result.status,
        errors: result.errors.length ? (result.errors as unknown as object) : undefined,
        duration_ms: result.durationMs,
        started_at: new Date(startedAt),
        finished_at: new Date(),
      },
    });
  } catch (e) {
    // ログ記録失敗は致命ではないので console のみ
    console.error('[advisor] failed to record sync log:', e);
  }
}
