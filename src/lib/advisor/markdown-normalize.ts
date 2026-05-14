/**
 * Markdown 前処理 (LLM 出力の table 表示崩れ対策)
 *
 * GFM (remark-gfm) は table の直前に空行を必須とするが、LLM が空行を
 * 省くケースが頻発する。空行が無いと table 行の `|` が前段落の続きと
 * 解釈されて文字化けする。
 *
 * このヘルパーは ReactMarkdown に渡す前に table 直前に空行を補完する。
 *
 * 使い方:
 *   <ReactMarkdown ...>{normalizeMarkdown(text)}</ReactMarkdown>
 */
export function normalizeMarkdown(src: string): string {
  if (!src) return src
  const lines = src.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isTable = /^\s*\|/.test(line)
    const prev = out[out.length - 1]
    if (isTable && prev !== undefined && prev !== '' && !/^\s*\|/.test(prev)) {
      // 直前が「表行ではない非空行」なら空行を 1 行補う
      out.push('')
    }
    out.push(line)
  }
  return out.join('\n')
}
