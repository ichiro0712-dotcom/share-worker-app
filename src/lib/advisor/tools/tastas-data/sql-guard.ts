/**
 * execute_sql ツールの SQL 文を検証・サニタイズする関数群
 *
 * 多層防御の中間層:
 * 1. (この層) SQL 文の構造検証 → 怪しい文を実行前に弾く
 * 2. SET TRANSACTION READ ONLY (db.ts の runReadOnly)
 * 3. DB ロール権限 (advisor_readonly / postgres_readonly_advisor)
 */

import {
  detectSensitiveColumns,
  type SensitiveColumnHit,
} from './sensitive-columns';

export interface SqlGuardOk {
  ok: true;
  /** LIMIT を自動付与した最終 SQL */
  sanitizedSql: string;
  /** 自動付与した LIMIT 値 (元から付いていれば null) */
  injectedLimit: number | null;
}

export interface SqlGuardBlocked {
  ok: false;
  /** "FORBIDDEN_KEYWORD" | "NOT_SELECT" | "MULTIPLE_STATEMENTS" | "SENSITIVE_COLUMN" | "EMPTY_SQL" */
  code: SqlGuardErrorCode;
  /** ユーザー向けの説明文 (LLM が応答メッセージに使う) */
  message: string;
  /** デバッグ用: 検出された箇所 */
  details?: string[];
}

export type SqlGuardErrorCode =
  | 'EMPTY_SQL'
  | 'NOT_SELECT'
  | 'FORBIDDEN_KEYWORD'
  | 'MULTIPLE_STATEMENTS'
  | 'SENSITIVE_COLUMN';

export type SqlGuardResult = SqlGuardOk | SqlGuardBlocked;

/** 1クエリあたりの最大取得行数 (LIMIT 未指定なら自動付与) */
export const DEFAULT_MAX_ROWS = 1000;

/** 危険キーワード (大文字小文字無視、ワード境界で照合) */
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'CALL',
  'COPY',
  'VACUUM',
  'REINDEX',
  'COMMENT',
  'LISTEN',
  'NOTIFY',
  'LOCK',
  'SET', // SET セッション変数の改変を防ぐ (READ ONLY 解除等)
  'RESET',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
];

/**
 * SQL 文を検証し、安全であれば LIMIT を付与した最終 SQL を返す。
 */
export function guardSql(
  sql: string,
  options: { maxRows?: number } = {}
): SqlGuardResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  const trimmed = sql.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: 'EMPTY_SQL',
      message: 'SQL が空です。',
    };
  }

  // 末尾のセミコロンは1つだけ許容して削除
  const withoutTrailingSemi = trimmed.replace(/;+\s*$/, '');

  // 複文 (途中にセミコロン) は禁止
  if (withoutTrailingSemi.includes(';')) {
    return {
      ok: false,
      code: 'MULTIPLE_STATEMENTS',
      message: '複数の SQL 文を1度に実行することは禁止されています。',
    };
  }

  // コメントの除去 (キーワード検出を欺かれないように)
  //   -- 行コメント / /* ... */ ブロックコメント
  const stripped = stripSqlComments(withoutTrailingSemi);

  // 先頭が SELECT または WITH のみ許可
  if (!/^(select|with)\b/i.test(stripped)) {
    return {
      ok: false,
      code: 'NOT_SELECT',
      message:
        'SELECT 文 (または WITH 句から始まる SELECT) のみ実行可能です。',
    };
  }

  // 禁止キーワード検出 (ワード境界で照合)
  const hits: string[] = [];
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(stripped)) {
      hits.push(kw);
    }
  }
  if (hits.length > 0) {
    return {
      ok: false,
      code: 'FORBIDDEN_KEYWORD',
      message: `禁止されたキーワードを含んでいます: ${hits.join(', ')}`,
      details: hits,
    };
  }

  // センシティブカラム検出
  const sensitiveHits = detectSensitiveColumns(stripped);
  if (sensitiveHits.length > 0) {
    return {
      ok: false,
      code: 'SENSITIVE_COLUMN',
      message: buildSensitiveColumnMessage(sensitiveHits),
      details: sensitiveHits.map((h) => `${h.matched} (rule: ${h.rule})`),
    };
  }

  // LIMIT 付与判定
  const { sql: finalSql, injectedLimit } = ensureLimit(
    withoutTrailingSemi,
    maxRows
  );

  return {
    ok: true,
    sanitizedSql: finalSql,
    injectedLimit,
  };
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ') // 行コメント
    .replace(/\/\*[\s\S]*?\*\//g, ' '); // ブロックコメント
}

function buildSensitiveColumnMessage(hits: SensitiveColumnHit[]): string {
  const cols = Array.from(new Set(hits.map((h) => h.rule))).slice(0, 5);
  const list = cols.join(', ');
  return `個人情報・センシティブ情報を含むカラム (${list}) にはアクセスできません。`;
}

function ensureLimit(
  sql: string,
  maxRows: number
): { sql: string; injectedLimit: number | null } {
  // すでに LIMIT 句がある場合は触らない (ユーザーが小さい LIMIT を指定している可能性を尊重)
  // ただし「LIMIT 一万」のように max を超える場合は警告対象だが、現状は付与のみ。
  if (/\blimit\b/i.test(sql)) {
    return { sql, injectedLimit: null };
  }
  return {
    sql: `${sql} LIMIT ${maxRows}`,
    injectedLimit: maxRows,
  };
}
