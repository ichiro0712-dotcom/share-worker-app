/**
 * LLMストリーミング共通ユーティリティ
 * Gemini / Claude 両対応
 */

import { getModel } from '@/src/lib/advisor/models'

export interface LLMFileAttachment {
  name: string
  mimeType: string
  base64: string
}

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
  files?: LLMFileAttachment[]
}

export interface LLMUsageInfo {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface StreamCallbacks {
  onText: (text: string) => void
  onDone: (fullContent: string) => void
  onError: (error: string) => void
  onUsage?: (usage: LLMUsageInfo) => void
}

/** GeminiまたはClaudeでストリーミング生成 */
export async function streamLLM(
  modelId: string,
  systemPrompt: string,
  messages: LLMMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const model = getModel(modelId)

  if (model.provider === 'anthropic') {
    await streamClaude(model.modelId, systemPrompt, messages, callbacks)
  } else {
    await streamGemini(model.modelId, systemPrompt, messages, callbacks)
  }
}

async function streamGemini(
  modelId: string,
  systemPrompt: string,
  messages: LLMMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  if (messages.length === 0) {
    callbacks.onError('メッセージが空です')
    return
  }

  function buildParts(m: LLMMessage): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
    if (m.content) parts.push({ text: m.content })
    if (m.files) {
      for (const f of m.files) {
        parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } })
      }
    }
    return parts.length > 0 ? parts : [{ text: '' }]
  }

  const geminiHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' as const : 'model' as const,
    parts: buildParts(m),
  }))

  const lastMessage = messages[messages.length - 1]

  const response = await ai.models.generateContentStream({
    model: modelId,
    config: { systemInstruction: systemPrompt },
    contents: [...geminiHistory, { role: 'user', parts: buildParts(lastMessage) }],
  })

  let fullContent = ''
  let lastUsage: LLMUsageInfo | undefined
  for await (const chunk of response) {
    const text = chunk.text ?? ''
    if (text) {
      fullContent += text
      callbacks.onText(text)
    }
    // Geminiのusage情報は最後のchunkに含まれる
    const u = chunk.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number } | undefined
    if (u) {
      lastUsage = {
        inputTokens: u.promptTokenCount ?? 0,
        outputTokens: u.candidatesTokenCount ?? 0,
        cacheReadTokens: u.cachedContentTokenCount ?? 0,
        cacheWriteTokens: 0,
      }
    }
  }
  if (lastUsage) callbacks.onUsage?.(lastUsage)
  callbacks.onDone(fullContent)
}

async function streamClaude(
  modelId: string,
  systemPrompt: string,
  messages: LLMMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const { getClaudeClient } = await import('@/src/lib/advisor/claude')
  const { buildCachedSystem } = await import('@/src/lib/advisor/prompt-cache')
  const client = getClaudeClient()
  const cachedSystem = await buildCachedSystem(systemPrompt)

  const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> = messages.map(m => {
    if (m.files && m.files.length > 0 && m.role === 'user') {
      const content: Array<Record<string, unknown>> = []
      if (m.content) content.push({ type: 'text', text: m.content })
      for (const f of m.files) {
        if (f.mimeType.startsWith('image/')) {
          content.push({ type: 'image', source: { type: 'base64', media_type: f.mimeType, data: f.base64 } })
        } else if (f.mimeType === 'application/pdf') {
          content.push({ type: 'document', source: { type: 'base64', media_type: f.mimeType, data: f.base64 } })
        } else {
          try {
            const decoded = Buffer.from(f.base64, 'base64').toString('utf-8')
            content.push({ type: 'text', text: `--- ${f.name} ---\n${decoded}` })
          } catch {
            content.push({ type: 'text', text: `[添付ファイル: ${f.name} (${f.mimeType})]` })
          }
        }
      }
      return { role: m.role as 'user' | 'assistant', content }
    }
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })

  const stream = client.messages.stream({
    model: modelId,
    max_tokens: 8192,
    system: cachedSystem as unknown as string,
    messages: claudeMessages as unknown as Array<{ role: 'user' | 'assistant'; content: string }>,
  })

  let fullContent = ''
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const text = event.delta.text
      fullContent += text
      callbacks.onText(text)
    }
  }
  // usage は finalMessage から1回だけ取得（二重計上防止）
  const final = await stream.finalMessage()
  if (final.usage) {
    callbacks.onUsage?.({
      inputTokens: final.usage.input_tokens ?? 0,
      outputTokens: final.usage.output_tokens ?? 0,
      cacheReadTokens: (final.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0,
      cacheWriteTokens: (final.usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0,
    })
  }
  callbacks.onDone(fullContent)
}

/** 非ストリーミング生成（ルーティング等の短い応答用） */
export async function generateLLM(
  modelId: string,
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; usage?: LLMUsageInfo }> {
  const model = getModel(modelId)

  if (model.provider === 'anthropic') {
    const { getClaudeClient } = await import('@/src/lib/advisor/claude')
    const { buildCachedSystem } = await import('@/src/lib/advisor/prompt-cache')
    const client = getClaudeClient()
    const cachedSystem = await buildCachedSystem(systemPrompt)
    const response = await client.messages.create({
      model: model.modelId,
      max_tokens: 4096,
      system: cachedSystem as unknown as string,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = response.content[0]
    const text = block.type === 'text' ? block.text : ''
    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0,
        cacheWriteTokens: (response.usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0,
      },
    }
  } else {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await ai.models.generateContent({
      model: model.modelId,
      config: { systemInstruction: systemPrompt },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    })
    const u = response.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number } | undefined
    return {
      text: response.text ?? '',
      usage: u ? {
        inputTokens: u.promptTokenCount ?? 0,
        outputTokens: u.candidatesTokenCount ?? 0,
        cacheReadTokens: u.cachedContentTokenCount ?? 0,
        cacheWriteTokens: 0,
      } : undefined,
    }
  }
}
