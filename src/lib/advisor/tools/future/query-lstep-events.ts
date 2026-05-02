import type { AdvisorTool } from '../types';

const REASON = 'Lstep webhook 連携が未実装のため取得できません';
const PLANNED = 'Lstep 管理画面で webhook 送信機能を有効化し、TASTAS 側に LstepEvent テーブル + 受信エンドポイントを実装すると利用可能になります';

export const queryLstepEventsTool: AdvisorTool<unknown, unknown> = {
  name: 'query_lstep_events',
  category: 'future',
  description:
    'Lステップから受信した友だち追加・配信イベントを検索します (将来実装予定)。' +
    `\n\n⚠️ 現在利用不可: ${REASON}` +
    `\n対応予定: ${PLANNED}`,
  inputSchema: {
    type: 'object',
    properties: {
      since_days: { type: 'integer', default: 30 },
      event_type: { type: 'string' },
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
