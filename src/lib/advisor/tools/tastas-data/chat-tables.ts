/**
 * チャット表 (advisor_chat_tables) のヘルパー
 *
 * - 表 ID 整形 (T-001 形式)
 * - 表 ID → DB ID の解析
 * - 表データの取得
 */

import prisma from '@/lib/prisma';

/** DB の id (autoincrement) → "T-001" 形式 */
export function formatTableId(id: number): string {
  return `T-${String(id).padStart(3, '0')}`;
}

/** "T-001" / "t-1" / "T1" 等 → DB id (parse 失敗時は null) */
export function parseTableId(input: string): number | null {
  const m = String(input).trim().match(/^t[-_ ]?(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export interface ChatTableData {
  id: number;
  tableId: string;
  sessionId: string;
  purpose: string;
  sqlText: string;
  columns: Array<{ key: string; label: string; type?: string }>;
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  createdAt: Date;
}

/**
 * 複数の表 ID をまとめて取得する。
 * 存在しないものは結果に含まれない (呼び出し元で差分検出する)。
 */
export async function fetchTablesByIds(
  ids: number[]
): Promise<ChatTableData[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.advisorChatTable.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    tableId: formatTableId(r.id),
    sessionId: r.session_id,
    purpose: r.purpose,
    sqlText: r.sql_text,
    columns: (r.columns as unknown) as ChatTableData['columns'],
    rows: (r.rows as unknown) as unknown[][],
    rowCount: r.row_count,
    truncated: r.truncated,
    createdAt: r.created_at,
  }));
}

/**
 * 入力文字列の配列 (T-001, T-002, ...) から表を取得する。
 * 戻り値の order は入力順。見つからなかった ID は missing に含まれる。
 */
export async function fetchTablesByStringIds(
  inputs: string[]
): Promise<{ found: ChatTableData[]; missing: string[]; invalid: string[] }> {
  const invalid: string[] = [];
  const parsed: number[] = [];
  for (const s of inputs) {
    const n = parseTableId(s);
    if (n === null) {
      invalid.push(s);
    } else {
      parsed.push(n);
    }
  }
  const tables = await fetchTablesByIds(parsed);
  const tableByDbId = new Map(tables.map((t) => [t.id, t]));
  const found: ChatTableData[] = [];
  const missing: string[] = [];
  for (const s of inputs) {
    const n = parseTableId(s);
    if (n === null) continue;
    const t = tableByDbId.get(n);
    if (t) {
      found.push(t);
    } else {
      missing.push(s);
    }
  }
  return { found, missing, invalid };
}

/**
 * 表データを Markdown テーブル文字列に変換する。
 * レポート (skeleton_markdown) に埋め込むときに使う。
 */
export function tableToMarkdown(table: ChatTableData): string {
  if (table.columns.length === 0 || table.rows.length === 0) {
    return '_(データなし)_';
  }
  const header = `| ${table.columns.map((c) => c.label).join(' | ')} |`;
  const separator = `| ${table.columns.map(() => '---').join(' | ')} |`;
  const body = table.rows
    .map((row) => `| ${row.map((v) => formatCell(v)).join(' | ')} |`)
    .join('\n');
  return `${header}\n${separator}\n${body}`;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString('ja-JP');
    return v.toLocaleString('ja-JP', { maximumFractionDigits: 4 });
  }
  if (typeof v === 'boolean') return v ? '○' : '×';
  const s = String(v);
  // パイプはエスケープ
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
