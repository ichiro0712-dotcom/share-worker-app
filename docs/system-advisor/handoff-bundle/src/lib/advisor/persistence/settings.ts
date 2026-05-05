/**
 * Advisor 設定 (シングルトン) の永続化レイヤー
 *
 * - 設定は `AdvisorSettings` テーブルに 1 行 (id="default") のみ存在する。
 * - 初回呼び出し時に行が無ければデフォルト値で自動作成する (upsert)。
 * - サーバー側のキャッシュは持たない (毎リクエスト DB に問い合わせ)。
 *   理由: 編集後すぐ反映してほしいので、キャッシュ無効化の手間を避ける。
 *   コスト: 設定取得は単純な findUnique なので無視できる。
 */

import { prisma } from '@/lib/prisma';

/** Advisor 設定の現在値 */
export interface AdvisorSettingsValues {
  maxToolLoops: number;
  /** null の場合は code 内のデフォルトプロンプトを使う */
  systemPromptOverride: string | null;
  /**
   * メインモデル ID (alias 推奨: claude-sonnet-4-6 等)。
   * null の場合は code 内のデフォルト (`ADVISOR_MODELS.sonnet`) を使う。
   */
  primaryModelId: string | null;
  /**
   * ツール実行後の loop > 0 で使うモデル ID。
   * null の場合は `primaryModelId` (またはそれも null なら code 内デフォルト) と同じ。
   */
  loop1ModelId: string | null;
  updatedByAdminId: number | null;
  updatedAt: Date;
}

const DEFAULT_MAX_TOOL_LOOPS = 20;

/**
 * 現在の設定を取得する。行が無ければデフォルト値で初期化して返す。
 */
export async function getAdvisorSettings(): Promise<AdvisorSettingsValues> {
  const row = await prisma.advisorSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
  return {
    maxToolLoops: row.max_tool_loops,
    systemPromptOverride: row.system_prompt_override,
    primaryModelId: row.primary_model_id,
    loop1ModelId: row.loop1_model_id,
    updatedByAdminId: row.updated_by_admin_id,
    updatedAt: row.updated_at,
  };
}

/**
 * 設定を更新する。Server Actions / API Route から呼ぶ。
 * undefined のフィールドは更新しない (部分更新)。
 * model ID は null を渡すことで「デフォルトに戻す」操作になる。
 */
export async function updateAdvisorSettings(opts: {
  adminId: number;
  maxToolLoops?: number;
  systemPromptOverride?: string | null;
  primaryModelId?: string | null;
  loop1ModelId?: string | null;
}): Promise<AdvisorSettingsValues> {
  if (opts.maxToolLoops !== undefined) {
    if (!Number.isInteger(opts.maxToolLoops) || opts.maxToolLoops < 1 || opts.maxToolLoops > 100) {
      throw new Error('max_tool_loops は 1〜100 の整数で指定してください');
    }
  }
  if (opts.systemPromptOverride !== undefined) {
    if (opts.systemPromptOverride !== null && opts.systemPromptOverride.length > 50_000) {
      throw new Error('システムプロンプトが長すぎます (最大 50,000 文字)');
    }
  }
  // モデル ID は緩めに validation: 空白を許さない、長すぎを弾く程度。
  // 不正な値を入れても Anthropic が 404 を返すので最終防衛は API 側に任せる。
  const validateModelId = (v: string | null | undefined, fieldName: string) => {
    if (v === undefined || v === null) return;
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new Error(`${fieldName} は非空文字列で指定してください (デフォルトに戻すには null を渡す)`);
    }
    if (v.length > 100) {
      throw new Error(`${fieldName} が長すぎます (最大 100 文字)`);
    }
  };
  validateModelId(opts.primaryModelId, 'primary_model_id');
  validateModelId(opts.loop1ModelId, 'loop1_model_id');

  const data: Record<string, unknown> = { updated_by_admin_id: opts.adminId };
  if (opts.maxToolLoops !== undefined) data.max_tool_loops = opts.maxToolLoops;
  if (opts.systemPromptOverride !== undefined) data.system_prompt_override = opts.systemPromptOverride;
  if (opts.primaryModelId !== undefined) data.primary_model_id = opts.primaryModelId;
  if (opts.loop1ModelId !== undefined) data.loop1_model_id = opts.loop1ModelId;

  const row = await prisma.advisorSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  });
  return {
    maxToolLoops: row.max_tool_loops,
    systemPromptOverride: row.system_prompt_override,
    primaryModelId: row.primary_model_id,
    loop1ModelId: row.loop1_model_id,
    updatedByAdminId: row.updated_by_admin_id,
    updatedAt: row.updated_at,
  };
}

export { DEFAULT_MAX_TOOL_LOOPS };
