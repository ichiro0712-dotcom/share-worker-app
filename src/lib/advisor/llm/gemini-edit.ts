/**
 * Gemini API 直叩きでドラフト編集
 *
 * Anthropic ノードアフィニティ問題 (loop=1 TTFB 100 秒級) を構造的に回避するため、
 * `[TOOL:draft_revise]` で来るドラフト修正指示を Anthropic ループに入れず、
 * Gemini Flash で直接 skeleton_markdown を書き換える。
 *
 * orchestrator が冒頭でこのヘルパーを試し、成功すれば return、失敗時は
 * 既存の Anthropic ルートに fall through する設計 (堅牢性優先)。
 */

import { generateWithGemini } from './gemini'

export interface EditDraftRequirements {
  title: string | null
  goal: string | null
  rangeStart: string | null
  rangeEnd: string | null
  metricKeys: string[]
  outline: string | null
  notes: string | null
}

export interface EditDraftParams {
  /** 現在の skeleton_markdown (= ドラフト本体)。これを書き換える */
  currentSkeleton: string
  /** ユーザーの修正指示 ([TOOL:draft_revise] プレフィックスは剥がした本文) */
  userInstruction: string
  /** 編集の文脈として渡す要件メタ */
  requirements: EditDraftRequirements
  /** AbortSignal (クライアント中断時) */
  abortSignal?: AbortSignal
}

export interface EditDraftResult {
  /** 修正後の skeleton_markdown 全体 */
  updatedSkeleton: string
  /** 更新したフィールドのキー一覧 (現状は ['skeleton_markdown'] 固定だが将来拡張用) */
  fieldsUpdated: string[]
  /** 1〜2 行で何を変えたかの説明 (チャット欄に表示する text) */
  summary: string
  /** Gemini 呼び出しの計測値 (audit に流す) */
  metrics: {
    elapsedMs: number
    inputTokens: number
    outputTokens: number
    model: string
  }
}

const SYSTEM_PROMPT = `あなたはレポートドラフトの編集アシスタントです。
ユーザーの修正指示に従って、現在のレポート skeleton_markdown を書き換えてください。

# 出力ルール (絶対遵守)
- skeleton_markdown のみを修正する。要件 (title / goal / range / metric_keys 等) は変更しない
- 0 埋めの表骨格は維持する (実際の数字は本文生成フェーズで Gemini が埋めるので、
  ここでは "0" / "-" / "(コメント)" のままにする)
- グラフ / チャート生成は未対応のため、表で代替する
- レポート本文を完成させない (skeleton 段階を維持)

# 出力フォーマット (必ず JSON のみ、コードブロックや前置き禁止)
{
  "updated_skeleton": "<修正後の markdown 全体>",
  "fields_updated": ["skeleton_markdown"],
  "summary": "<1〜2 行 (50〜120 字) で何を変えたか具体的に>"
}
`

function buildUserPrompt(params: EditDraftParams): string {
  const r = params.requirements
  return `# 現在のレポート要件 (参考、変更しない)
- タイトル: ${r.title ?? '(未設定)'}
- 目的: ${r.goal ?? '(未設定)'}
- 期間: ${r.rangeStart ?? '?'} 〜 ${r.rangeEnd ?? '?'}
- 取得指標 (metric_keys): ${r.metricKeys.length > 0 ? r.metricKeys.join(', ') : '(未指定)'}
- アウトライン: ${r.outline ?? '(未指定)'}
- メモ: ${r.notes ?? '(未指定)'}

# 現在の skeleton_markdown (これを書き換える)
\`\`\`markdown
${params.currentSkeleton}
\`\`\`

# ユーザーの修正指示
${params.userInstruction}

上記の出力フォーマットに従って JSON のみを返してください。`
}

/**
 * Gemini レスポンスから JSON 部分を堅牢に抽出する。
 * jsonMode を使っていても、稀に \`\`\`json ... \`\`\` でラップして返してくることがあるので、
 * その場合の fallback も用意する。
 */
function parseEditResponse(text: string): {
  updated_skeleton: string
  fields_updated: string[]
  summary: string
} {
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini レスポンスが空でした')
  }

  // まずそのまま JSON.parse を試す (jsonMode 成功ケース)
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }

  const direct = tryParse(text.trim())
  if (direct && typeof direct === 'object') {
    return validateShape(direct)
  }

  // フォールバック 1: ```json ... ``` でラップされている
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (fenced) {
    const parsed = tryParse(fenced[1].trim())
    if (parsed) return validateShape(parsed)
  }

  // フォールバック 2: 最初の { から最後の } を抜き出す
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = text.slice(firstBrace, lastBrace + 1)
    const parsed = tryParse(slice)
    if (parsed) return validateShape(parsed)
  }

  throw new Error(`Gemini レスポンスから JSON を抽出できませんでした (length=${text.length})`)
}

function validateShape(obj: unknown): {
  updated_skeleton: string
  fields_updated: string[]
  summary: string
} {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Gemini レスポンスが object ではありません')
  }
  const o = obj as Record<string, unknown>
  const skeleton =
    typeof o.updated_skeleton === 'string'
      ? o.updated_skeleton
      : typeof o.skeleton_markdown === 'string'
        ? o.skeleton_markdown
        : null
  if (skeleton === null || skeleton.length < 10) {
    throw new Error('updated_skeleton フィールドが見つからないか短すぎます')
  }
  const summary =
    typeof o.summary === 'string' && o.summary.length > 0
      ? o.summary
      : 'ドラフトを更新しました'
  const fields =
    Array.isArray(o.fields_updated) && o.fields_updated.every((x) => typeof x === 'string')
      ? (o.fields_updated as string[])
      : ['skeleton_markdown']
  return {
    updated_skeleton: skeleton,
    fields_updated: fields,
    summary,
  }
}

/**
 * Gemini Flash でドラフトを編集する。
 * 失敗時は throw する (orchestrator 側で catch して Anthropic ルートに fall through)。
 */
export async function editDraftWithGemini(params: EditDraftParams): Promise<EditDraftResult> {
  const userPrompt = buildUserPrompt(params)
  const result = await generateWithGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jsonMode: true,
    abortSignal: params.abortSignal,
  })

  const parsed = parseEditResponse(result.text)

  return {
    updatedSkeleton: parsed.updated_skeleton,
    fieldsUpdated: parsed.fields_updated,
    summary: parsed.summary,
    metrics: {
      elapsedMs: result.tookMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    },
  }
}
