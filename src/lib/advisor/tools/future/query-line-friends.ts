import type { AdvisorTool } from '../types';

const REASON = 'LINE Webhook (/api/line/webhook) が未実装のため取得できません';
const PLANNED = 'LINE Messaging API のチャネルを開設し、TASTAS 側に webhook 受信エンドポイントを実装すると利用可能になります (Phase 1 別途)';

export const queryLineFriendsTool: AdvisorTool<unknown, unknown> = {
  name: 'query_line_friends',
  category: 'future',
  description:
    'LINE 友だち追加履歴を流入元LP別等で検索します (将来実装予定)。' +
    `\n\n⚠️ 現在利用不可: ${REASON}` +
    `\n対応予定: ${PLANNED}` +
    '\n\n代替案: 現時点では LpClickEvent の line_button_id クリック数で近似可能です。' +
    '質問された場合は query_metric (LP_PV) や read_doc で詳細を確認してください。',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      group_by: { type: 'string', enum: ['lp_id', 'campaign_code', 'day'] },
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
