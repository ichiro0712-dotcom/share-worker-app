/**
 * get_table ツール
 *
 * 過去に execute_sql で作られた表 (T-XXX) を ID で取り出して LLM に渡す。
 * 別セッションで作られた表でも DB に残っていれば参照可能。
 *
 * 用途:
 * - 「T-001 の数値を集計して」と聞かれた時、LLM がこれを呼んで表の中身を読む
 * - 「T-005 と T-007 をクロス集計して」のような複数表参照
 * - レポート作成中に「T-XXX の数値を引用して考察したい」
 *
 * 戻り値は表の columns/rows をそのまま JSON で返す。LLM はこれを見て計算や考察を行える。
 * (ツール結果は履歴に残るので、続く loop でも LLM が参照可能)
 */

import type { AdvisorTool } from '../types';
import { fetchTablesByStringIds, type ChatTableData } from './chat-tables';

interface Input {
  /** 取り出したい表 ID の配列 (例: ["T-001", "T-005"]) */
  table_ids: string[];
  /** 行数が多い時の最大返却数。デフォルト 100。表全体が必要なら明示的に上げる */
  max_rows?: number;
}

interface Output {
  tables: Array<{
    table_id: string;
    purpose: string;
    columns: Array<{ key: string; label: string; type?: string }>;
    rows: unknown[][];
    row_count: number;
    truncated_in_output: boolean;
    created_at: string;
    same_session: boolean;
  }>;
  not_found: string[];
  invalid_ids: string[];
}

const DEFAULT_MAX_ROWS = 100;
const HARD_MAX_ROWS = 1000;

export const getTableTool: AdvisorTool<Input, Output> = {
  name: 'get_table',
  category: 'tastas-data',
  description:
    '過去に execute_sql で生成された表 (T-XXX) を ID で取り出します。' +
    '\n\n用途:' +
    '\n- ユーザーが「T-001 のデータを使って」「T-005 を集計して」と過去表を参照した時' +
    '\n- 同セッション内の表は会話履歴に残っているはずだが、要約圧縮で失われていたら本ツールで再取得' +
    '\n- **別セッションで作られた表でも DB に残っていれば取得可能** (お気に入り保存セッションなら永続)' +
    '\n\n複数 ID を一度に渡せる。例: ["T-001", "T-005"]' +
    '\n\nツール結果には columns/rows がそのまま含まれるので、続く応答で集計・考察・クロス分析が可能。' +
    '\n取得後は数値を読み取って「合計」「平均」「ソート」「比較」など自由に計算してよい。',
  inputSchema: {
    type: 'object',
    properties: {
      table_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '取り出したい表 ID の配列 (例: ["T-001", "T-005"])',
        minItems: 1,
      },
      max_rows: {
        type: 'integer',
        description: `1表あたり返却する最大行数 (デフォルト ${DEFAULT_MAX_ROWS}, 上限 ${HARD_MAX_ROWS})。集計用途なら全行欲しい場合 ${HARD_MAX_ROWS} を指定`,
        minimum: 1,
        maximum: HARD_MAX_ROWS,
      },
    },
    required: ['table_ids'],
  },
  outputDescription:
    '{ tables: [{ table_id, purpose, columns, rows, row_count, truncated_in_output, created_at, same_session }], not_found, invalid_ids }',
  async execute(input, ctx) {
    if (!Array.isArray(input.table_ids) || input.table_ids.length === 0) {
      return {
        ok: false,
        error: 'table_ids には1つ以上の表 ID (例: "T-001") を指定してください',
      };
    }

    const maxRows = Math.min(input.max_rows ?? DEFAULT_MAX_ROWS, HARD_MAX_ROWS);
    const { found, missing, invalid } = await fetchTablesByStringIds(input.table_ids);

    if (found.length === 0) {
      return {
        ok: false,
        error: `指定された表 ID は全て見つかりませんでした (invalid: ${invalid.join(
          ', '
        )}, missing: ${missing.join(', ')})`,
        userActionable:
          '表 ID が正しいか確認してください。お気に入り保存していない表は 30 日経過で削除されます。',
      };
    }

    const tables = found.map((t: ChatTableData) => {
      const limited = t.rows.slice(0, maxRows);
      return {
        table_id: t.tableId,
        purpose: t.purpose,
        columns: t.columns,
        rows: limited,
        row_count: t.rowCount,
        truncated_in_output: t.rows.length > limited.length,
        created_at: t.createdAt.toISOString(),
        same_session: t.sessionId === ctx.sessionId,
      };
    });

    return {
      ok: true,
      data: {
        tables,
        not_found: missing,
        invalid_ids: invalid,
      },
      metadata: {
        tookMs: 0,
        rowCount: tables.reduce((s, t) => s + t.rows.length, 0),
      },
    };
  },
};
