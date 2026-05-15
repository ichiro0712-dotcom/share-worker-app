/**
 * add_tables_to_report ツール
 *
 * チャットで生成された表 (advisor_chat_tables, T-XXX) を、
 * 現在のセッションのレポートドラフト (skeleton_markdown) に章として追記する。
 *
 * 仕様:
 * - 入力は表 ID の配列。同一/別セッションいずれの表も参照可能。
 * - 既にドラフトがあれば末尾に追記、無ければ新規作成。
 * - 各表について LLM 経由ではなく決定論的に「章タイトル + 表 + メタ情報」を生成する
 *   (LLM での章タイトル・考察生成はコスト/レイテンシ的に重いので、
 *    シンプルにテーブルの purpose を見出しに使う。考察は後で edit_report_section で
 *    深掘りできる)
 *
 * 連携:
 * - チャット UI の [📋 レポートに送る] ボタン押下時に、隠しメッセージ
 *   「表 T-XXX をレポートに追加してください」を投げると LLM がこのツールを呼ぶ。
 * - 既存ドラフトがあれば Canvas が既に開いている。無ければ追記後 update_report_draft 同様
 *   Canvas が自動オープンするよう、ツール名を tool-source-labels に登録済み。
 */

import type { AdvisorTool } from '../types';
import { upsertDraft, getDraftBySession } from '../../persistence/report-drafts';
import {
  fetchTablesByStringIds,
  tableToMarkdown,
  type ChatTableData,
} from '../tastas-data/chat-tables';

interface Input {
  /** 追加する表 ID の配列。例: ["T-001", "T-003"] */
  table_ids: string[];
  /** 各章のセクション見出し (任意)。指定が無ければ表の purpose をそのまま使う */
  section_titles?: string[];
  /** 全表追加前に挿入する導入文 (任意) */
  intro?: string;
}

interface Output {
  ok: true;
  draft_id: string;
  added_tables: string[];
  not_found: string[];
  invalid_ids: string[];
}

export const addTablesToReportTool: AdvisorTool<Input, Output> = {
  name: 'add_tables_to_report',
  category: 'core',
  description:
    'チャットで生成された表 (T-XXX) を、現在のセッションのレポートドラフトに章として追記します。' +
    '\n\nユーザーが「T-001 をレポートに入れて」「表 T-002 と T-003 を追加」と言った時や、' +
    'チャット UI の [📋 レポートに送る] ボタンが押された後の隠しメッセージで呼ばれる。' +
    '\n\n挙動:' +
    '\n- ドラフトが無ければ新規作成 (Canvas が自動オープン)' +
    '\n- ドラフトがあれば末尾に追記' +
    '\n- 各表は「## <セクション見出し or purpose>」+ メタ情報 + Markdown テーブルで挿入' +
    '\n\n注意:' +
    '\n- 表 ID はチャット上で表のヘッダに表示されている "T-XXX" 形式の文字列をそのまま渡す' +
    '\n- 過去の (別) セッションで作られた表でも参照可能',
  inputSchema: {
    type: 'object',
    properties: {
      table_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '追加する表 ID の配列。例: ["T-001", "T-003"]',
        minItems: 1,
      },
      section_titles: {
        type: 'array',
        items: { type: 'string' },
        description:
          '(任意) 各章の見出し文字列。table_ids と同じ長さで指定する。省略 / 不足分は表の purpose で代用',
      },
      intro: {
        type: 'string',
        description: '(任意) 追加する章群の前に挿入する導入文 (1〜3 行程度)',
      },
    },
    required: ['table_ids'],
  },
  outputDescription:
    '{ ok, draft_id, added_tables: string[], not_found: string[], invalid_ids: string[] }',
  async execute(input, ctx) {
    if (!Array.isArray(input.table_ids) || input.table_ids.length === 0) {
      return {
        ok: false,
        error: 'table_ids には1つ以上の表 ID (例: "T-001") を指定してください',
      };
    }

    const { found, missing, invalid } = await fetchTablesByStringIds(
      input.table_ids
    );

    if (found.length === 0) {
      return {
        ok: false,
        error: `指定された表 ID は全て見つかりませんでした (invalid: ${invalid.join(
          ', '
        )}, missing: ${missing.join(', ')})`,
        userActionable:
          '表 ID が正しいか確認してください。チャット上で表のヘッダに "T-XXX" 形式で表示されています。',
      };
    }

    // 既存ドラフトを取得
    const existing = await getDraftBySession(ctx.sessionId);
    const existingSkeleton = existing?.skeletonMarkdown ?? '';

    // 各表を Markdown に変換して追記用ブロックを組み立てる
    const blocks: string[] = [];
    if (input.intro && input.intro.trim()) {
      blocks.push(input.intro.trim());
    }
    found.forEach((table, idx) => {
      const sectionTitle =
        input.section_titles?.[idx]?.trim() || defaultSectionTitle(table);
      blocks.push(buildSection(sectionTitle, table));
    });

    const appended = blocks.join('\n\n');
    const newSkeleton = existingSkeleton
      ? `${existingSkeleton.trimEnd()}\n\n${appended}`
      : appended;

    // 新規作成時はタイトルや goal を最低限埋める
    const isFirstCreation = !existing;
    const newTitle =
      existing?.title ??
      (found[0] ? `${defaultSectionTitle(found[0])} レポート` : 'レポート');
    const originalRequestToSave =
      isFirstCreation && ctx.userMessage ? ctx.userMessage : undefined;

    const draft = await upsertDraft({
      sessionId: ctx.sessionId,
      adminId: ctx.adminId,
      title: isFirstCreation ? newTitle : undefined,
      skeletonMarkdown: newSkeleton,
      originalRequest: originalRequestToSave,
    });

    return {
      ok: true,
      data: {
        ok: true as const,
        draft_id: draft.id,
        added_tables: found.map((t) => t.tableId),
        not_found: missing,
        invalid_ids: invalid,
      },
      metadata: { tookMs: 0 },
    };
  },
};

function defaultSectionTitle(table: ChatTableData): string {
  const purpose = table.purpose?.trim();
  if (purpose) return purpose;
  return `表 ${table.tableId}`;
}

function buildSection(title: string, table: ChatTableData): string {
  const meta = [
    `**表 ID:** \`${table.tableId}\``,
    `**行数:** ${table.rowCount.toLocaleString('ja-JP')}${
      table.truncated ? ' (上限到達)' : ''
    }`,
  ].join(' / ');
  return [
    `## ${title}`,
    '',
    meta,
    '',
    tableToMarkdown(table),
    '',
    '_(考察はここに追記してください)_',
  ].join('\n');
}
