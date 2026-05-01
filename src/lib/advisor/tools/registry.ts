/**
 * Advisor ツールレジストリ
 *
 * 全ツールを 1箇所で集約し、Anthropic API への description 配列を生成する。
 *
 * 新しいツールを追加する場合:
 * 1. tools/<category>/<your-tool>.ts を新規作成
 * 2. tools/<category>/index.ts に export 追加
 * 3. (新カテゴリの場合) 本ファイルに category を1行追加
 */

import type { AdvisorTool } from './types';
import { coreTools } from './core';
import { tastasDataTools } from './tastas-data';
import { externalTools } from './external';
import { futureTools } from './future';
import { reportTools } from './reports';

const allTools: AdvisorTool[] = [
  ...coreTools,
  ...tastasDataTools,
  ...externalTools,
  ...futureTools,
  ...reportTools,
];

export function getAvailableTools(): AdvisorTool[] {
  return allTools;
}

export function findTool(name: string): AdvisorTool | undefined {
  return allTools.find((t) => t.name === name);
}

export interface AnthropicToolDescription {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Anthropic API の tools パラメータに渡す形式に変換する。
 * available() を解決して description にステータス情報を埋め込む。
 */
export async function describeAllToolsForLLM(): Promise<AnthropicToolDescription[]> {
  return Promise.all(
    allTools.map(async (t) => {
      let desc = t.description;
      if (t.available) {
        try {
          const status = await t.available();
          if (!status.ready) {
            desc += `\n\n⚠️ 現在利用不可: ${status.reason ?? '(理由不明)'}`;
            if (status.plannedFrom) {
              desc += `\n対応予定: ${status.plannedFrom}`;
            }
          }
        } catch (e) {
          desc += `\n\n⚠️ 利用可否の確認に失敗: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      if (t.outputDescription) {
        desc += `\n\n出力構造: ${t.outputDescription}`;
      }
      return {
        name: t.name,
        description: desc,
        input_schema: t.inputSchema,
      };
    })
  );
}

/**
 * ツールを実行する (orchestrator から呼ばれる)
 */
export async function executeToolByName(
  name: string,
  input: unknown,
  ctx: { adminId: number; sessionId: string; abortSignal?: AbortSignal }
) {
  const tool = findTool(name);
  if (!tool) {
    return { ok: false, error: `不明なツール: ${name}` } as const;
  }
  return tool.execute(input, ctx);
}
