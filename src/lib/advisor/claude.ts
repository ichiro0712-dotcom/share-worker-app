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

/** モデルごとの料金 (1M トークンあたり USD)、コスト計算用 */
export const MODEL_COSTS_PER_M_TOKENS: Record<
  AdvisorModelId,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  [ADVISOR_MODELS.opus]: {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },
  [ADVISOR_MODELS.sonnet]: {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  [ADVISOR_MODELS.haiku]: {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },
};

/** モデル ID の妥当性チェック */
export function isValidModelId(id: string): id is AdvisorModelId {
  return Object.values(ADVISOR_MODELS).includes(id as AdvisorModelId);
}

/** 概算コスト計算 (USD) */
export function estimateCostUsd(params: {
  modelId: AdvisorModelId;
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
