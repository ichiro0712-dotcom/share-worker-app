/**
 * Anthropic prompt caching ヘルパー
 *
 * 静的なシステムプロンプトに cache_control: { type: 'ephemeral' } を付けて送ることで、
 * 5分間の ephemeral キャッシュを使う。2回目以降は大幅に高速化&コスト減 (10倍安)。
 *
 * - 文字数が短すぎる場合 (< 4000 chars) はキャッシュしない (オーバーヘッドの方が大きい)
 * - キャッシュ統計を usage レスポンスから抽出するヘルパーも同梱
 */

const MIN_CACHE_CHARS = 4000;

export type CachedSystemMessage =
  | string
  | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;

/**
 * システムプロンプトを cache_control 付きの形式に変換する
 *
 * @param staticPart 内容が変わらない部分 (cache 対象)
 * @param dynamicPart 毎リクエストで変わる部分 (cache しない)
 */
export function buildCachedSystem(
  staticPart: string,
  dynamicPart?: string
): CachedSystemMessage {
  if (staticPart.length < MIN_CACHE_CHARS) {
    // 短すぎるのでキャッシュ非対象、結合して返す
    return dynamicPart ? `${staticPart}\n\n${dynamicPart}` : staticPart;
  }

  const blocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
    {
      type: 'text',
      text: staticPart,
      cache_control: { type: 'ephemeral' },
    },
  ];

  if (dynamicPart) {
    blocks.push({ type: 'text', text: dynamicPart });
  }

  return blocks;
}

export interface CacheStats {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cacheHit: boolean;
}

/** Anthropic usage レスポンスからキャッシュ情報を抽出 */
export function extractCacheStats(usage: Record<string, unknown> | undefined): CacheStats {
  if (!usage) return { cacheReadTokens: 0, cacheWriteTokens: 0, cacheHit: false };
  const read = Number(usage.cache_read_input_tokens ?? 0);
  const write = Number(usage.cache_creation_input_tokens ?? 0);
  return {
    cacheReadTokens: read,
    cacheWriteTokens: write,
    cacheHit: read > 0,
  };
}
