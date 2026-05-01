/**
 * Advisor ツール (Function Calling) の共通型定義
 *
 * 詳細仕様: docs/system-advisor/tools-spec.md
 */

export type ToolCategory = 'core' | 'tastas-data' | 'external' | 'future';

export interface ToolContext {
  adminId: number;
  sessionId: string;
  abortSignal?: AbortSignal;
}

export type ToolResult<T = unknown> =
  | {
      ok: true;
      data: T;
      metadata?: { tookMs: number; truncated?: boolean; rowCount?: number };
    }
  | {
      ok: false;
      error: string;
      userActionable?: string;
    };

export interface AdvisorTool<TInput = unknown, TOutput = unknown> {
  /** Anthropic に渡すツール名 (snake_case) */
  name: string;
  /** LLM がツール選択判断に使う説明文 (重要) */
  description: string;
  /** 分類 (UI 表示・統計用) */
  category: ToolCategory;
  /** Anthropic Tool Use の input_schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** 結果の構造説明 (LLM 向け補助、optional) */
  outputDescription?: string;
  /** ツールの利用可否を動的に判定 */
  available?: () => Promise<{ ready: boolean; reason?: string; plannedFrom?: string }>;
  /** 実行関数。エラーは throw せず、結果オブジェクトで返す */
  execute: (input: TInput, ctx: ToolContext) => Promise<ToolResult<TOutput>>;
}
