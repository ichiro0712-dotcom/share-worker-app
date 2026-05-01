import type { AdvisorTool } from '../types';
import { METRIC_CATALOG } from './metrics-catalog';

interface Input {
  available_only?: boolean;
}

interface Output {
  metrics: Array<{
    key: string;
    label: string;
    description: string;
    unit: string;
    available: boolean;
    reason?: string;
    plannedFrom?: string;
    calculation: string;
    supportedGroupBy: string[];
  }>;
  total: number;
}

export const listAvailableMetricsTool: AdvisorTool<Input, Output> = {
  name: 'list_available_metrics',
  category: 'tastas-data',
  description:
    'TASTAS で取得可能・不可能な指標 (メトリクス) の一覧を返します。' +
    '\n\n各指標には key, 説明, 取得可否, 計算ロジックが含まれます。' +
    '\n\n質問者から「○○の数値は?」と聞かれたら最初にこのツールを使い、対応する key を確認してから query_metric を呼んでください。' +
    '\n\n取得不可 (available: false) の指標を聞かれた場合は、reason と plannedFrom を必ず一緒に伝えてください。',
  inputSchema: {
    type: 'object',
    properties: {
      available_only: {
        type: 'boolean',
        description: 'true の場合、取得可能な指標のみ返す',
        default: false,
      },
    },
  },
  outputDescription:
    '{ metrics: [{ key, label, description, unit, available, reason?, plannedFrom?, calculation, supportedGroupBy }], total }',
  async execute(input) {
    const start = Date.now();
    const list = input.available_only ? METRIC_CATALOG.filter((m) => m.available) : METRIC_CATALOG;
    return {
      ok: true,
      data: {
        metrics: list.map((m) => ({
          key: m.key,
          label: m.label,
          description: m.description,
          unit: m.unit,
          available: m.available,
          reason: m.reason,
          plannedFrom: m.plannedFrom,
          calculation: m.calculation,
          supportedGroupBy: m.supportedGroupBy,
        })),
        total: list.length,
      },
      metadata: { tookMs: Date.now() - start, rowCount: list.length },
    };
  },
};
