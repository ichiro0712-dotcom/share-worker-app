/**
 * Anthropic SDK の薄いラッパー
 *
 * - シングルトン化してインスタンス再生成を避ける
 * - モデル ID は本ファイルに集約
 * - 環境変数 ANTHROPIC_API_KEY が必要
 */

import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** 利用可能なモデルの定義 */
export const ADVISOR_MODELS = {
  /** 最上位: 高度な推論・長文タスク向け */
  opus: 'claude-opus-4-7' as const,
  /** メイン: tool use と長い推論に強い、コスパ良好 */
  sonnet: 'claude-sonnet-4-20250514' as const,
  /** 軽量: 高速・低コスト */
  haiku: 'claude-haiku-4-5-20251001' as const,
} as const;

export type AdvisorModelId = (typeof ADVISOR_MODELS)[keyof typeof ADVISOR_MODELS];

/** UI 表示用ラベル */
export const MODEL_LABELS: Record<AdvisorModelId, string> = {
  [ADVISOR_MODELS.opus]: 'Claude Opus 4.7',
  [ADVISOR_MODELS.sonnet]: 'Claude Sonnet 4',
  [ADVISOR_MODELS.haiku]: 'Claude Haiku 4.5',
};

/** UI 表示用 短いタグ */
export const MODEL_BADGES: Record<AdvisorModelId, string> = {
  [ADVISOR_MODELS.opus]: '最高精度・高コスト',
  [ADVISOR_MODELS.sonnet]: 'バランス (推奨)',
  [ADVISOR_MODELS.haiku]: '高速・低コスト',
};

/**
 * モデルごとの料金 (1M トークンあたり USD)、コスト計算用。
 *
 * ADVISOR_MODELS 列挙のキーだけでなく、設定 DB から渡される alias / 後継モデル ID
 * (claude-sonnet-4-6 など) も同じ料金で見積もれるよう、文字列キーで拡張可能にする。
 * 未登録の ID が来たら estimateCostUsd 側で 0 を返す。
 *
 * 注: ADVISOR_MODELS.opus は 'claude-opus-4-7' と同値、ADVISOR_MODELS.haiku は
 * 'claude-haiku-4-5-20251001' と同値なので、重複を避けるため文字列キーのみで列挙する。
 *
 * 公式価格表: https://docs.claude.com/en/docs/about-claude/pricing
 */
export const MODEL_COSTS_PER_M_TOKENS: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  // Opus 系: 4.7/4.6 は $5/$25、レガシー Opus 4 は $15/$75
  'claude-opus-4-7': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-6': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-5-20251101': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-1-20250805': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  // Sonnet 系: $3 / $15 (4 / 4.5 / 4.6 すべて同価格)
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  // Haiku 系: $1 / $5
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
};

/** モデル ID の妥当性チェック */
export function isValidModelId(id: string): id is AdvisorModelId {
  return Object.values(ADVISOR_MODELS).includes(id as AdvisorModelId);
}

/**
 * 概算コスト計算 (USD)。
 * modelId は alias / snapshot どちらでも受ける。未登録 ID なら 0 を返す
 * (= 集計上 0 円扱い、ログには記録される)。
 */
export function estimateCostUsd(params: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): number {
  const rate = MODEL_COSTS_PER_M_TOKENS[params.modelId];
  if (!rate) return 0;
  const cost =
    (params.inputTokens / 1_000_000) * rate.input +
    (params.outputTokens / 1_000_000) * rate.output +
    ((params.cacheReadTokens ?? 0) / 1_000_000) * rate.cacheRead +
    ((params.cacheWriteTokens ?? 0) / 1_000_000) * rate.cacheWrite;
  return Math.round(cost * 10000) / 10000;
}
