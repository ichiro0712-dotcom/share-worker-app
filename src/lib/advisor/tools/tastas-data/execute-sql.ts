/**
 * execute_sql ツール
 *
 * LLM が任意の SELECT 文を実行できるツール。
 * セキュリティは多層防御:
 *   1. sql-guard.ts で SQL 構造検証 (SELECT 限定、危険キーワード拒否、複文禁止)
 *   2. sensitive-columns.ts で個人情報カラム参照を検出
 *   3. runReadOnly() で READ ONLY トランザクション
 *   4. statement_timeout で長時間クエリを強制中断
 *   5. LIMIT 自動付与で過剰取得防止
 *   6. DB ロール権限 (postgres_readonly_advisor) で物理的に書き込み不可
 *
 * ユーザー承認 (UI 層):
 *   このツールは orchestrator 側で「承認待ち」状態を経由してから実行される。
 *   ツール自体は承認後に呼ばれる前提なので、ここでは承認ロジックは持たない。
 *
 * 監査:
 *   実行 / ブロック / エラーいずれも advisor_sql_audit_logs に記録される。
 */

import type { AdvisorTool } from '../types';
import { runReadOnly } from '@/src/lib/advisor/db';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { guardSql, DEFAULT_MAX_ROWS } from './sql-guard';
import { formatTableId } from './chat-tables';

interface Input {
  /** 実行する SELECT 文 (1つだけ) */
  sql: string;
  /** UI と監査ログに表示する自然言語の意図 */
  purpose: string;
  /** 期待する取得行数 (UI 表示のヒント、オプショナル) */
  expected_rows?: number;
}

interface OutputColumn {
  key: string;
  label: string;
  type?: string;
}

interface Output {
  /** "T-001" 形式の表 ID (チャットや add_tables_to_report で参照される) */
  table_id: string;
  /** DB 上の数値 ID (内部参照用) */
  table_db_id: number;
  columns: OutputColumn[];
  /** 行データ。各行は columns の順序に沿った配列 */
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
  duration_ms: number;
  /** purpose をそのまま返す (LLM が後続の応答に使う) */
  purpose: string;
  /** 実行された SELECT 文 (sanitized = LIMIT 自動付与済み)。UI で折りたたみ表示するのに使う */
  sql_text: string;
}

const STATEMENT_TIMEOUT_MS = 10_000;

export const executeSqlTool: AdvisorTool<Input, Output> = {
  name: 'execute_sql',
  category: 'tastas-data',
  description:
    '読み取り専用の SELECT 文を実行して結果を表として返します。' +
    '\n\n用途: 事前定義メトリクス (query_metric) では取れないクロス集計や、' +
    '\nPV と登録経過週の組み合わせなど、自由な切り口の集計に使う。' +
    '\n\n制約:' +
    `\n- SELECT 文または WITH ... SELECT のみ (INSERT/UPDATE/DELETE 等は禁止)` +
    '\n- セミコロンで区切った複数文は禁止' +
    `\n- 結果は最大 ${DEFAULT_MAX_ROWS} 行 (LIMIT 未指定なら自動付与)` +
    '\n- クエリは 10秒でタイムアウト' +
    '\n- 個人情報カラム (users.email, users.phone 等) にはアクセスできない' +
    '\n  ブロックされた場合は「個人情報保護の観点から出力が禁止されています」と' +
    '  代替案を添えてユーザーに伝えること。' +
    '\n\n返り値の table_id (T-XXX 形式) はチャット上で表に表示され、' +
    'ユーザーや LLM が後続で add_tables_to_report ツールに渡してレポートに追加できる。' +
    '\n\nユーザー承認:' +
    '\nこのツールの呼び出しは UI 層で「SQL 実行します。よろしいですか？」モーダルを' +
    '経由する。LLM は承認が必要であることを意識せず通常通り呼んでよい。',
  inputSchema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'PostgreSQL の SELECT 文。1つだけ。スキーマは Prisma 定義に従う (テーブル名は snake_case)',
      },
      purpose: {
        type: 'string',
        description:
          'この SQL で何を調べるかの自然言語サマリ (1〜2文)。例: "5月の求人TOP PVを登録経過週で集計"',
      },
      expected_rows: {
        type: 'integer',
        description: '期待する取得行数 (UI 表示のヒント)',
        minimum: 0,
      },
    },
    required: ['sql', 'purpose'],
  },
  outputDescription:
    '{ table_id: "T-XXX", columns: [{key,label,type?}], rows: [[...]], row_count, truncated, duration_ms, purpose }' +
    '\n- ブロック / エラー時は ok=false で error と userActionable が返る' +
    '\n- 個人情報カラムブロック時はメッセージに「個人情報保護の観点から出力が禁止されています」と入れて応答する',
  execute: async (input, ctx) => {
    const started = Date.now();

    // 1. SQL 構造検証
    const guard = guardSql(input.sql);
    if (!guard.ok) {
      // 監査ログ (blocked)
      await writeAuditLog({
        sessionId: ctx.sessionId,
        adminId: ctx.adminId,
        purpose: input.purpose,
        sqlText: input.sql,
        status: 'blocked',
        blockReason: `${guard.code}: ${(guard.details ?? []).join(', ')}`,
      });

      const userMessage = buildUserMessageForBlock(guard.code, guard.message);

      return {
        ok: false,
        error: guard.message,
        userActionable: userMessage,
      };
    }

    // 2. 実行 (READ ONLY + statement_timeout)
    let rawRows: Record<string, unknown>[];
    try {
      rawRows = await runReadOnly(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`
        );
        return tx.$queryRawUnsafe<Record<string, unknown>[]>(guard.sanitizedSql);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await writeAuditLog({
        sessionId: ctx.sessionId,
        adminId: ctx.adminId,
        purpose: input.purpose,
        sqlText: guard.sanitizedSql,
        status: 'error',
        errorMessage: message,
        durationMs: Date.now() - started,
      });
      return {
        ok: false,
        error: `SQL 実行に失敗しました: ${message}`,
        userActionable:
          'SQL に文法エラーがあるか、参照先のテーブル/カラム名が存在しない可能性があります。SQL を見直してから再試行してください。',
      };
    }

    // 3. 結果整形
    const { columns, rows, normalizedRows } = normalizeRows(rawRows);
    const truncated =
      guard.injectedLimit !== null && rows.length >= guard.injectedLimit;

    // 4. advisor_chat_tables に保存して T-XXX を採番
    const created = await prisma.advisorChatTable.create({
      data: {
        session_id: ctx.sessionId,
        message_id: null, // メッセージ ID は orchestrator 側で紐付け
        purpose: input.purpose,
        sql_text: guard.sanitizedSql,
        columns: columns as unknown as Prisma.InputJsonValue,
        rows: normalizedRows as unknown as Prisma.InputJsonValue,
        row_count: rows.length,
        truncated,
        duration_ms: Date.now() - started,
        created_by_id: ctx.adminId,
      },
      select: { id: true },
    });

    const tableId = formatTableId(created.id);
    const durationMs = Date.now() - started;

    // 5. 監査ログ (ok)
    await writeAuditLog({
      sessionId: ctx.sessionId,
      adminId: ctx.adminId,
      purpose: input.purpose,
      sqlText: guard.sanitizedSql,
      status: 'ok',
      rowCount: rows.length,
      durationMs,
      chatTableId: created.id,
    });

    return {
      ok: true,
      data: {
        table_id: tableId,
        table_db_id: created.id,
        columns,
        rows,
        row_count: rows.length,
        truncated,
        duration_ms: durationMs,
        purpose: input.purpose,
        sql_text: guard.sanitizedSql,
      },
      metadata: {
        tookMs: durationMs,
        rowCount: rows.length,
        truncated,
      },
    };
  },
};

function buildUserMessageForBlock(
  code: string,
  defaultMessage: string
): string {
  switch (code) {
    case 'SENSITIVE_COLUMN':
      return (
        '個人情報保護の観点から、出力が禁止されているカラムを含むためこの SQL は実行できません。' +
        '集計値 (件数・割合) のみを返す形に書き換えるか、別の方法での提供を検討してください。'
      );
    case 'NOT_SELECT':
      return '読み取り専用ツールのため、SELECT 文以外は実行できません。';
    case 'FORBIDDEN_KEYWORD':
      return '書き込み・スキーマ変更系のキーワードは含められません。集計目的の SELECT 文に書き直してください。';
    case 'MULTIPLE_STATEMENTS':
      return '1度に複数の SQL を実行することはできません。1つの SELECT 文にまとめてください。';
    default:
      return defaultMessage;
  }
}

/**
 * Prisma の $queryRawUnsafe が返す結果 (Record<string, unknown>[]) を、
 * UI / 保存用の columns + rows 配列に整形する。
 */
function normalizeRows(rawRows: Record<string, unknown>[]): {
  columns: OutputColumn[];
  rows: unknown[][];
  /** JSON シリアライズ可能な行データ (BigInt → string 等の変換済み) */
  normalizedRows: unknown[][];
} {
  if (rawRows.length === 0) {
    return { columns: [], rows: [], normalizedRows: [] };
  }
  const keys = Object.keys(rawRows[0]);
  const columns: OutputColumn[] = keys.map((k) => {
    const sample = rawRows[0][k];
    return {
      key: k,
      label: k,
      type: detectType(sample),
    };
  });
  const rows: unknown[][] = rawRows.map((r) =>
    keys.map((k) => toPlainValue(r[k]))
  );
  return { columns, rows, normalizedRows: rows };
}

function detectType(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return 'number';
  if (typeof v === 'bigint') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof Date) return 'date';
  if (typeof v === 'object') return 'json';
  return 'string';
}

function toPlainValue(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

async function writeAuditLog(args: {
  sessionId: string;
  adminId: number;
  purpose: string;
  sqlText: string;
  status: 'ok' | 'blocked' | 'error';
  blockReason?: string;
  errorMessage?: string;
  rowCount?: number;
  durationMs?: number;
  chatTableId?: number;
}) {
  try {
    await prisma.advisorSqlAuditLog.create({
      data: {
        session_id: args.sessionId,
        admin_id: args.adminId,
        purpose: args.purpose,
        sql_text: args.sqlText,
        status: args.status,
        block_reason: args.blockReason ?? null,
        error_message: args.errorMessage ?? null,
        row_count: args.rowCount ?? null,
        duration_ms: args.durationMs ?? null,
        chat_table_id: args.chatTableId ?? null,
      },
    });
  } catch (e) {
    // 監査ログ書き込み失敗は本処理を止めない (best effort)
    console.error('[execute_sql] audit log write failed:', e);
  }
}
