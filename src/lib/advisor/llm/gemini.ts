/**
 * Gemini API の薄い wrapper (レポート生成用)
 *
 * Anthropic が高度な対話 / ツール選択を担当し、最終のレポート文章生成は
 * 安価で高速な Gemini に投げる。Streaming は不要 (1 回で全文取得)。
 *
 * 環境変数: `GEMINI_API_KEY` 必須。
 */

const DEFAULT_MODEL = 'gemini-2.5-flash'

export interface GeminiGenerateInput {
  systemPrompt: string
  userPrompt: string
  /** 省略時は gemini-2.5-flash */
  model?: string
  /** 呼び出しの中断シグナル (クライアント側のみ。サーバー側課金は継続することに注意) */
  abortSignal?: AbortSignal
  /**
   * Gemini に JSON 出力を強制する (responseMimeType: 'application/json')。
   * true の時はプロンプトでも「JSON で返せ」と指示する必要がある (構造化出力強化のため)。
   */
  jsonMode?: boolean
}

export interface GeminiGenerateOutput {
  text: string
  model: string
  inputTokens: number
  outputTokens: number
  tookMs: number
}

/**
 * 1 回呼び出しでまとめてテキストを返す。
 * ストリーミング不要なケース (レポート生成、要約) で使う。
 */
export async function generateWithGemini(
  input: GeminiGenerateInput
): Promise<GeminiGenerateOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません')
  }
  const model = input.model ?? DEFAULT_MODEL
  const start = Date.now()

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model,
    config: {
      systemInstruction: input.systemPrompt,
      abortSignal: input.abortSignal,
      // JSON モード: Gemini にレスポンスを application/json として返させる。
      // ドラフト編集など構造化出力が必要なケースで使う。
      ...(input.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
    contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
  })

  const text = response.text ?? ''
  const usage = response.usageMetadata as
    | { promptTokenCount?: number; candidatesTokenCount?: number }
    | undefined

  return {
    text,
    model,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    tookMs: Date.now() - start,
  }
}

export function isGeminiAvailable(): { ready: boolean; reason?: string } {
  if (!process.env.GEMINI_API_KEY) {
    return { ready: false, reason: 'GEMINI_API_KEY 未設定' }
  }
  return { ready: true }
}
