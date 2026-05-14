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

  // 注: input.abortSignal は意図的に渡さない。
  // route.ts は req.signal を orchestrator に伝播するが、Next.js のストリーミング応答開始前後で
  // req.signal が誤検知的に aborted=true を返すケースがあり、Gemini Flash の数秒の通信を
  // 開始 1〜2 秒で "This operation was aborted" として落としてしまう事象が観測された。
  // Gemini Flash は通常 3〜10 秒で完了するため、ここでの abort 連携は実用上不要。
  // ユーザーが本当に中断したい場合は Anthropic 側 (長時間ループ) のみ反応すれば足りる。
  const response = await ai.models.generateContent({
    model,
    config: {
      systemInstruction: input.systemPrompt,
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
