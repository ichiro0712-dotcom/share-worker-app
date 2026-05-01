import type { AdvisorTool } from '../types';

const REASON = 'Google Search Console API が未統合のため取得できません';
const PLANNED = 'Search Console API の認証情報を環境変数に追加し、ラッパーを実装すると利用可能になります (Phase 2 別途)';

export const querySearchConsoleTool: AdvisorTool<unknown, unknown> = {
  name: 'query_search_console',
  category: 'future',
  description:
    'Google Search Console (GSC) から検索クエリ別の流入データを取得します (将来実装予定)。' +
    `\n\n⚠️ 現在利用不可: ${REASON}` +
    `\n対応予定: ${PLANNED}` +
    '\n\n質問例: 「どんな検索ワードで来てる?」「直近の検索流入トップ10」' +
    '\n\n備考: GA4 では検索クエリ別の流入は取得できません (個人情報保護のため)。GSC 連携が唯一の方法です。',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      dimensions: {
        type: 'array',
        items: { type: 'string', enum: ['query', 'page', 'country', 'device'] },
      },
    },
  },
  async available() {
    return { ready: false, reason: REASON, plannedFrom: PLANNED };
  },
  async execute() {
    return {
      ok: false,
      error: 'このツールは未実装です',
      userActionable: REASON + '。' + PLANNED,
    };
  },
};
