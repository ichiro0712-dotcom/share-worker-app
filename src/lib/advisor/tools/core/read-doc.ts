import type { AdvisorTool } from '../types';
import { readKnowledgeByKey } from '../../knowledge/store';
import { KNOWLEDGE_SOURCES } from '../../knowledge/types';

interface Input {
  doc_key: string;
}

interface Output {
  key: string;
  label: string;
  content: string;
  byte_size: number;
  last_synced_at: string;
}

const validKeys = KNOWLEDGE_SOURCES.map((s) => s.key);

export const readDocTool: AdvisorTool<Input, Output> = {
  name: 'read_doc',
  category: 'core',
  description:
    'プロジェクト知識キャッシュ (CLAUDE.md, docs/, schema 等) からドキュメントを取得します。' +
    '\n\nGitHub から定期的に同期されているローカルキャッシュ経由なので高速。' +
    `\n\n利用可能な doc_key: ${validKeys.join(', ')}`,
  inputSchema: {
    type: 'object',
    properties: {
      doc_key: {
        type: 'string',
        description: 'ドキュメント識別子',
        enum: validKeys,
      },
    },
    required: ['doc_key'],
  },
  outputDescription: '{ key, label, content (全文), byte_size, last_synced_at }',
  async execute(input) {
    const start = Date.now();
    if (!validKeys.includes(input.doc_key)) {
      return {
        ok: false,
        error: `無効な doc_key: ${input.doc_key}. 有効なキー: ${validKeys.join(', ')}`,
      };
    }
    const record = await readKnowledgeByKey(input.doc_key);
    if (!record) {
      return {
        ok: false,
        error: `知識キャッシュに ${input.doc_key} が存在しません`,
        userActionable:
          '管理者に知識同期 cron の動作確認を依頼してください: POST /api/cron/advisor-knowledge-sync',
      };
    }
    return {
      ok: true,
      data: {
        key: record.key,
        label: record.label,
        content: record.content,
        byte_size: record.byteSize,
        last_synced_at: record.lastSyncedAt.toISOString(),
      },
      metadata: { tookMs: Date.now() - start },
    };
  },
};
