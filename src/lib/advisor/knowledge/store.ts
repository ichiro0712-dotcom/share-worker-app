/**
 * 知識キャッシュストア
 *
 * advisor_knowledge_cache テーブルへの読み書きを担当する。
 * チャット起動時はここから最新を取得してシステムプロンプトに注入する。
 */

import { prisma } from '@/lib/prisma';
import { KNOWLEDGE_SOURCES, type KnowledgeRecord } from './types';

/** 指定キーの知識を取得 */
export async function readKnowledgeByKey(key: string): Promise<KnowledgeRecord | null> {
  const row = await prisma.advisorKnowledgeCache.findUnique({
    where: { source_key: key },
  });
  if (!row) return null;
  return {
    key: row.source_key,
    label: row.label,
    path: row.source_path,
    contentHash: row.content_hash,
    content: row.content,
    byteSize: row.byte_size,
    lastSyncedAt: row.last_synced_at,
    sourceSha: row.source_sha ?? undefined,
  };
}

/** 複数キーをまとめて取得 (取得できなかったものはスキップ) */
export async function readKnowledge(keys: string[]): Promise<KnowledgeRecord[]> {
  const rows = await prisma.advisorKnowledgeCache.findMany({
    where: { source_key: { in: keys } },
  });
  // 引数の順序を保つ
  const map = new Map(rows.map((r) => [r.source_key, r]));
  return keys
    .map((k) => {
      const row = map.get(k);
      if (!row) return null;
      return {
        key: row.source_key,
        label: row.label,
        path: row.source_path,
        contentHash: row.content_hash,
        content: row.content,
        byteSize: row.byte_size,
        lastSyncedAt: row.last_synced_at,
        sourceSha: row.source_sha ?? undefined,
      } as KnowledgeRecord;
    })
    .filter((r): r is KnowledgeRecord => r !== null);
}

/** 全件取得 (一覧表示用) */
export async function listAllKnowledge(): Promise<KnowledgeRecord[]> {
  const rows = await prisma.advisorKnowledgeCache.findMany({
    orderBy: { source_key: 'asc' },
  });
  return rows.map((row) => ({
    key: row.source_key,
    label: row.label,
    path: row.source_path,
    contentHash: row.content_hash,
    content: row.content,
    byteSize: row.byte_size,
    lastSyncedAt: row.last_synced_at,
    sourceSha: row.source_sha ?? undefined,
  }));
}

/** 1ファイル分の upsert (ハッシュ一致なら更新スキップ) */
export async function upsertKnowledge(input: {
  key: string;
  label: string;
  path: string;
  content: string;
  contentHash: string;
  sourceSha?: string;
}): Promise<{ created: boolean; changed: boolean }> {
  const existing = await prisma.advisorKnowledgeCache.findUnique({
    where: { source_key: input.key },
  });

  if (existing && existing.content_hash === input.contentHash) {
    // 変更なし: last_synced_at だけ更新
    await prisma.advisorKnowledgeCache.update({
      where: { source_key: input.key },
      data: { last_synced_at: new Date() },
    });
    return { created: false, changed: false };
  }

  await prisma.advisorKnowledgeCache.upsert({
    where: { source_key: input.key },
    create: {
      source_key: input.key,
      label: input.label,
      source_path: input.path,
      content: input.content,
      content_hash: input.contentHash,
      byte_size: Buffer.byteLength(input.content, 'utf-8'),
      source_sha: input.sourceSha,
    },
    update: {
      label: input.label,
      source_path: input.path,
      content: input.content,
      content_hash: input.contentHash,
      byte_size: Buffer.byteLength(input.content, 'utf-8'),
      source_sha: input.sourceSha,
      last_synced_at: new Date(),
    },
  });

  return { created: !existing, changed: true };
}

/** 同期対象の定義を返す (テスト/UI 用) */
export function getKnowledgeSources() {
  return KNOWLEDGE_SOURCES;
}
