/**
 * Advisor が利用する LLM モデル定義
 *
 * Advisor は Anthropic Claude のみを使う前提。
 * Anthropic 実 ID は src/lib/advisor/claude.ts の ADVISOR_MODELS と対応する。
 */

export interface ModelDef {
  /** UI/送信用 ID (短い識別子) */
  id: string;
  /** 表示名 */
  name: string;
  /** プロバイダ (Advisor は anthropic のみ) */
  provider: 'anthropic';
  /** Anthropic 実モデル ID */
  modelId: string;
  /** 1行説明 */
  description: string;
  /** 詳細 (ツールチップ用) */
  detail: string;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'low' | 'medium' | 'high';
  recommended?: boolean;
}

export const AVAILABLE_MODELS: ModelDef[] = [
  {
    id: 'claude-sonnet',
    name: 'Sonnet 4',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    description: 'バランス・推奨',
    detail: 'コストと精度のバランスが最良。日常の質問・調査・指標集計の大半はこれで十分です。',
    speed: 'medium',
    cost: 'medium',
    recommended: true,
  },
  {
    id: 'claude-opus',
    name: 'Opus 4.7',
    provider: 'anthropic',
    modelId: 'claude-opus-4-7',
    description: '最高精度・高コスト',
    detail:
      '最も高度な推論・長文タスクに強い最上位モデル。コストは Sonnet の約5倍。複雑な調査や難しい設計判断のときに。',
    speed: 'slow',
    cost: 'high',
  },
  {
    id: 'claude-haiku',
    name: 'Haiku 4.5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    description: '高速・低コスト',
    detail:
      '軽量で高速。短い質問やコスト重視の場面向き。複雑な推論では Sonnet/Opus に劣ります。',
    speed: 'fast',
    cost: 'low',
  },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet';

export function getModel(modelId: string): ModelDef {
  return AVAILABLE_MODELS.find((m) => m.id === modelId) ?? AVAILABLE_MODELS[0];
}
