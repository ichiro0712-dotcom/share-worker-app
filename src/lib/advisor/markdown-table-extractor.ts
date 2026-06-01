/**
 * assistant メッセージ本文から Markdown 表を抽出し、
 * advisor_chat_tables に登録して T-XXX を採番する。
 *
 * 設計:
 * - LLM が GA4 や query_metric の結果を受けて Markdown 表で応答することが多い。
 *   これらにも T-XXX を振って、後から get_table で再参照可能にする。
 * - 採番した T-XXX は表の直前 (見出し行の上) にプレフィックス行として挿入する。
 *   例: `**表 T-005** (3 行)`
 *
 * 制約 / 注意:
 * - LLM の表は手書きなので「column の型」「単位」が一意に取れない。
 *   columns[].type は基本 string にして、必要なら呼び出し側で再パースする方針。
 * - 1 メッセージ内に複数表があれば全部採番する。
 * - 既に「表 T-XXX」と書かれた表 (= execute_sql 由来) は重複採番しない。
 */

import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { formatTableId } from './tools/tastas-data/chat-tables';

interface ExtractedTable {
  /** マッチした Markdown 表の元テキスト */
  raw: string;
  /** メッセージ本文内の開始位置 (character offset) */
  start: number;
  /** メッセージ本文内の終了位置 (exclusive) */
  end: number;
  /** ヘッダラベル */
  headerLabels: string[];
  /** 本文行 (各セルは文字列) */
  rows: string[][];
}

const TABLE_REGEX = /(^\|[^\n]+\|[ \t]*\n\|[ \t]*[-: ]+\|[^\n]*\n(?:\|[^\n]+\|[ \t]*\n?)+)/gm;
const ALREADY_NUMBERED_REGEX = /(?:\*\*)?表[ \t]*(T-\d+)(?:\*\*)?/;

/**
 * メッセージ本文から Markdown 表を全て抽出する。
 */
export function extractMarkdownTables(content: string): ExtractedTable[] {
  const out: ExtractedTable[] = [];
  let m: RegExpExecArray | null;
  TABLE_REGEX.lastIndex = 0;
  while ((m = TABLE_REGEX.exec(content)) !== null) {
    const raw = m[1];
    const start = m.index;
    const end = start + raw.length;

    const lines = raw.trim().split('\n');
    if (lines.length < 2) continue;
    const headerLabels = parseRow(lines[0]);
    const bodyLines = lines.slice(2); // [0]=header, [1]=separator
    const rows = bodyLines.map(parseRow);
    if (headerLabels.length === 0 || rows.length === 0) continue;

    out.push({ raw, start, end, headerLabels, rows });
  }
  return out;
}

function parseRow(line: string): string[] {
  // 先頭と末尾の "|" を取り除き、`\|` (エスケープされた pipe) を一旦置換
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const PLACEHOLDER = '';
  const replaced = trimmed.replace(/\\\|/g, PLACEHOLDER);
  return replaced.split('|').map((c) => c.trim().replace(new RegExp(PLACEHOLDER, 'g'), '|'));
}

/**
 * LLM が書いた Markdown 表のヘッダ + 行数から重複判定 fingerprint を作る。
 * 同じセッションで execute_sql が既に同じ列構成・同じ行数で登録した表があれば、
 * その T-XXX を再利用して新規採番をスキップするために使う。
 */
function tableFingerprint(headerLabels: string[], rowCount: number): string {
  // ヘッダは順序保持で小文字化・空白圧縮して比較に使う
  const normalizedHeader = headerLabels
    .map((h) => h.toLowerCase().replace(/\s+/g, '').replace(/[*_]/g, ''))
    .join('|');
  return `${normalizedHeader}#${rowCount}`;
}

/**
 * advisor_chat_tables の columns (jsonb) から fingerprint を再構築する。
 * columns は `[{key, label}, ...]` 形式で保存されている前提。
 */
function fingerprintFromStoredTable(
  columns: unknown,
  rowCount: number
): string | null {
  if (!Array.isArray(columns)) return null;
  const labels: string[] = [];
  for (const c of columns) {
    if (c && typeof c === 'object' && 'label' in c) {
      const label = (c as { label: unknown }).label;
      if (typeof label === 'string') labels.push(label);
      else return null;
    } else {
      return null;
    }
  }
  return tableFingerprint(labels, rowCount);
}

/**
 * メッセージ本文中の Markdown 表ごとに advisor_chat_tables へ登録し、
 * 表の直前にプレフィックス行を挿入した content を返す。
 *
 * 重複防止 (2 段階):
 * 1. 表の直前 200 文字以内に「表 T-XXX」が既にあれば skip (execute_sql 由来の言及)
 * 2. fingerprint (ヘッダラベル + 行数) が同じセッションの直近 1 時間以内の
 *    既存テーブルと一致するなら、新規採番せずに既存 T-XXX を本文に挿入する。
 *    → 「execute_sql で出た表と同じ内容を LLM が本文中に再掲載する」典型ケースを抑止
 */
export async function annotateAndPersistTables(args: {
  content: string;
  sessionId: string;
  messageId: string | null;
  adminId: number;
}): Promise<{ content: string; createdIds: number[] }> {
  const { content, sessionId, messageId, adminId } = args;
  const tables = extractMarkdownTables(content);
  if (tables.length === 0) return { content, createdIds: [] };

  // 同セッションの直近 1 時間の表を fingerprint 化して引き当て用 Map を作る
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTables = await prisma.advisorChatTable.findMany({
    where: {
      session_id: sessionId,
      created_at: { gte: oneHourAgo },
    },
    select: { id: true, columns: true, row_count: true },
    orderBy: { id: 'desc' },
    take: 50,
  });
  const fpToId = new Map<string, number>();
  for (const r of recentTables) {
    const fp = fingerprintFromStoredTable(r.columns, r.row_count);
    if (fp && !fpToId.has(fp)) fpToId.set(fp, r.id);
  }

  // 末尾から処理することで、挿入によるオフセットずれを回避する
  let out = content;
  const createdIds: number[] = [];

  for (let i = tables.length - 1; i >= 0; i--) {
    const t = tables[i];

    // 1. 直前 200 文字以内に「表 T-XXX」が既にあれば skip
    const lookbackStart = Math.max(0, t.start - 200);
    const lookback = out.slice(lookbackStart, t.start);
    if (ALREADY_NUMBERED_REGEX.test(lookback)) continue;

    // 2. fingerprint で直近の既存テーブルと一致するなら、新規採番せず既存 T-XXX を再利用
    const fp = tableFingerprint(t.headerLabels, t.rows.length);
    const existingId = fpToId.get(fp);
    if (existingId !== undefined) {
      // 既存 T-XXX を参照するプレフィックスに置換 + 表本体を削除
      // (表本体は既に UI 上で T-XXX として表示されているため、本文に重複表示しない)
      const tableIdLabel = formatTableId(existingId);
      const replacement = `\n**表 ${tableIdLabel}** (${t.rows.length} 行、既出)\n\n`;
      out = out.slice(0, t.start) + replacement + out.slice(t.end);
      continue;
    }

    // 3. 新規採番 + 永続化
    const columns = t.headerLabels.map((label) => ({ key: label, label }));
    const rowsAsJson: string[][] = t.rows;
    let created: { id: number };
    try {
      created = await prisma.advisorChatTable.create({
        data: {
          session_id: sessionId,
          message_id: messageId,
          purpose: derivePurposeFromContext(out, t.start),
          sql_text: '(LLM 応答内の Markdown 表から自動採番)',
          columns: columns as unknown as Prisma.InputJsonValue,
          rows: rowsAsJson as unknown as Prisma.InputJsonValue,
          row_count: t.rows.length,
          truncated: false,
          duration_ms: null,
          created_by_id: adminId,
        },
        select: { id: true },
      });
    } catch (e) {
      // 失敗しても本処理は止めない
      console.error('[markdown-table-extractor] persist failed:', e);
      continue;
    }
    createdIds.unshift(created.id);
    // 採番済みとして fingerprint Map にも追加 (同メッセージ内で 2 度書かれた場合の対策)
    fpToId.set(fp, created.id);
    const tableIdLabel = formatTableId(created.id);

    // 表の直前にプレフィックス行を挿入
    const prefix = `\n**表 ${tableIdLabel}** (${t.rows.length} 行)\n\n`;
    out = out.slice(0, t.start) + prefix + out.slice(t.start);
  }

  return { content: out, createdIds };
}

/**
 * 表の直前 300 文字程度を見て、最も近い見出し or 強調行を purpose として取り出す。
 */
function derivePurposeFromContext(content: string, tableStart: number): string {
  const lookbackStart = Math.max(0, tableStart - 300);
  const ctx = content.slice(lookbackStart, tableStart);
  // 直前の "## XXX" / "### XXX" / "**XXX**" を採用
  const re = /^(?:#{1,6}\s+|\*\*)([^\n*]+?)(?:\*\*)?\s*$/gm;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx)) !== null) {
    last = m[1].trim();
  }
  if (last) return last.slice(0, 200);
  return '(LLM 応答内の表)';
}
