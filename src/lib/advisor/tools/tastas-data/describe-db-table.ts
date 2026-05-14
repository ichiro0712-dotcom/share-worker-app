import type { AdvisorTool } from '../types';
import { readKnowledgeByKey } from '../../knowledge/store';

interface Input {
  table_name: string;
}

interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
  attributes: string[];
}

interface Output {
  model_name: string;
  table_name?: string;
  fields: FieldInfo[];
  raw_definition: string;
}

export const describeDbTableTool: AdvisorTool<Input, Output> = {
  name: 'describe_db_table',
  category: 'tastas-data',
  description:
    'TASTAS の Prisma スキーマから指定テーブル (model) の構造を返します。' +
    '\n\n知識キャッシュの schema_prisma を参照。' +
    '\n\n使用例: 「Job テーブルにはどんなカラムがある?」「User の関連は?」',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: {
        type: 'string',
        description: 'テーブル名 (model 名 or @@map のスネークケース). 例: "Job", "users"',
      },
    },
    required: ['table_name'],
  },
  outputDescription:
    '{ model_name, table_name?, fields: [{ name, type, optional, attributes }], raw_definition }',
  async execute(input) {
    const start = Date.now();
    const tableName = input.table_name.trim();
    if (!tableName) return { ok: false, error: 'table_name が空です' };

    const schemaCache = await readKnowledgeByKey('schema_prisma');
    if (!schemaCache) {
      return {
        ok: false,
        error: '知識キャッシュに schema_prisma が見つかりません',
        userActionable:
          '管理者に知識同期 cron の動作確認を依頼してください: POST /api/cron/advisor-knowledge-sync',
      };
    }

    const schema = schemaCache.content;
    // model 名 or @@map("table_name") の両方で検索
    const modelMatch =
      findModelByName(schema, tableName) ||
      findModelByMappedTable(schema, tableName) ||
      findModelByName(schema, capitalize(tableName)) ||
      findModelByMappedTable(schema, snakeCase(tableName));

    if (!modelMatch) {
      return {
        ok: false,
        error: `テーブル "${tableName}" が schema.prisma に見つかりません`,
        userActionable: `read_doc('schema_prisma') で全モデル一覧を確認してください`,
      };
    }

    return {
      ok: true,
      data: {
        model_name: modelMatch.modelName,
        table_name: modelMatch.tableName,
        fields: modelMatch.fields,
        raw_definition: modelMatch.raw,
      },
      metadata: { tookMs: Date.now() - start },
    };
  },
};

interface ParseResult {
  modelName: string;
  tableName?: string;
  fields: FieldInfo[];
  raw: string;
}

function findModelByName(schema: string, name: string): ParseResult | null {
  const re = new RegExp(`^model\\s+${escapeRegex(name)}\\s*\\{([\\s\\S]*?)^\\}`, 'm');
  const m = schema.match(re);
  if (!m) return null;
  return parseModel(name, m[1], m[0]);
}

function findModelByMappedTable(schema: string, table: string): ParseResult | null {
  const re = new RegExp(
    `^model\\s+(\\w+)\\s*\\{([\\s\\S]*?@@map\\("${escapeRegex(table)}"\\)[\\s\\S]*?)^\\}`,
    'm'
  );
  const m = schema.match(re);
  if (!m) return null;
  return parseModel(m[1], m[2], m[0]);
}

function parseModel(name: string, body: string, raw: string): ParseResult {
  const fields: FieldInfo[] = [];
  let tableName: string | undefined;

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
      const mapMatch = trimmed.match(/^@@map\("([^"]+)"\)/);
      if (mapMatch) tableName = mapMatch[1];
      continue;
    }
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+(?:\[\])?(?:\?)?)\s*(.*)$/);
    if (!fieldMatch) continue;
    const [, fname, type, rest] = fieldMatch;
    if (fname === 'model' || fname === 'enum') continue;

    const attributes: string[] = [];
    const attrMatches = rest.match(/@\w+(?:\([^)]*\))?/g);
    if (attrMatches) attributes.push(...attrMatches);

    fields.push({
      name: fname,
      type,
      optional: type.endsWith('?'),
      attributes,
    });
  }

  return { modelName: name, tableName, fields, raw };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function snakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
