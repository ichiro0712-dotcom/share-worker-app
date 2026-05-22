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

/**
 * 文字列群から「T-XXX」形式のテーブル ID を抽出する (重複排除)。
 *
 * 用途: ユーザーの修正指示 / draft.skeleton_markdown / previousResultMarkdown 等を
 * スキャンして「このレポートが参照する T-XXX」を炙り出す。
 *
 * 検出対象: `T-001` / `T-001` (全角ハイフン) / `T1` / `t-1` / `T_1` 等のバリアント。
 * 半角・全角・大文字・小文字を吸収する。"T-XXX" のような大文字 X 連続 (プレースホルダ) は除外。
 */
export function extractTableIdsFromText(...sources: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  // 半角/全角ハイフン・アンダースコア・空白を許容、桁数は 1〜5 桁を想定
  const re = /\bT[-_ ‐−–—]?(\d{1,5})\b/gi;
  for (const src of sources) {
    if (!src) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n <= 0) continue;
      ids.add(`T-${String(n).padStart(3, '0')}`);
    }
  }
  return Array.from(ids);
}

/**
 * テキストから T-XXX を抽出して DB から取得し、Markdown 表として整形する。
 *
 * 戻り値: 「## 表 T-XXX (purpose)\n\nMarkdown 表」を結合した 1 つの文字列、
 * および取得失敗した ID リスト。
 *
 * Gemini の draft_revise / generate プロンプトに「参照される T-XXX の中身」を
 * 添付するために使う。Gemini はツール呼び出しができないので、サーバー側で
 * 解決してプロンプトに混ぜる必要がある。
 *
 * 1表あたり最大 maxRowsPerTable 行に切り詰める (Gemini 入力サイズ制御)。
 */
export async function fetchReferencedTablesAsMarkdown(
  text: string | null | undefined,
  options: { extraSources?: Array<string | null | undefined>; maxRowsPerTable?: number } = {}
): Promise<{ markdown: string; foundIds: string[]; missingIds: string[] }> {
  const ids = extractTableIdsFromText(text, ...(options.extraSources ?? []));
  if (ids.length === 0) {
    return { markdown: '', foundIds: [], missingIds: [] };
  }
  const maxRows = options.maxRowsPerTable ?? 200;
  const { found, missing } = await fetchTablesByStringIds(ids);
  if (found.length === 0) {
    return { markdown: '', foundIds: [], missingIds: missing };
  }
  const sections: string[] = [];
  for (const t of found) {
    const limited: ChatTableData = {
      ...t,
      rows: t.rows.slice(0, maxRows),
    };
    const truncated = t.rows.length > limited.rows.length;
    const truncNote = truncated
      ? `\n_(全 ${t.rowCount.toLocaleString('ja-JP')} 行のうち最初の ${limited.rows.length.toLocaleString('ja-JP')} 行のみ表示)_`
      : '';
    sections.push(
      `### 表 ${t.tableId} — ${t.purpose || '(目的未指定)'}\n\n` +
        tableToMarkdown(limited) +
        truncNote
    );
  }
  return {
    markdown: sections.join('\n\n'),
    foundIds: found.map((t) => t.tableId),
    missingIds: missing,
  };
}
