/**
 * Gemini バイパス経路 (draft_revise / result_edit) に直近チャット履歴を渡すための
 * 共通ユーティリティ。
 *
 * 各 Gemini 呼び出しは元々 stateless で、現在の skeleton/result + ユーザー最新指示しか
 * 見ていなかった。このため:
 *   - 「さっき言った日本語化の続きで」「今のレポートの○○を」のような文脈依存指示が動かない
 *   - レポート生成イベント (assistant が出した「v1 を生成しました」) を Gemini が見えない
 *
 * 解決として直近 N 件のチャット履歴を Markdown 形式で Gemini に渡す。
 */

import { getRecentMessagesForOrchestrator } from '../persistence/messages'

/**
 * 直近のチャット履歴を Gemini プロンプト用 Markdown に整形する。
 * 「ユーザー」「アシスタント」のラベル付きで、最新メッセージは除く (ユーザー最新指示は
 * 別途 user prompt に展開されるため二重化を避ける)。
 *
 * @param sessionId チャットセッション ID
 * @param recentLimit 取得する最大件数 (DB から). デフォルト 12
 * @param contextCount プロンプトに含める件数 (recentLimit から最後の 1 件を除いた中で末尾 N 件)
 */
export async function buildChatHistoryContext(opts: {
  sessionId: string
  recentLimit?: number
  contextCount?: number
}): Promise<string> {
  const recentLimit = opts.recentLimit ?? 12
  const contextCount = opts.contextCount ?? 8

  const rows = await getRecentMessagesForOrchestrator({
    sessionId: opts.sessionId,
    limit: recentLimit,
  })

  if (rows.length <= 1) {
    // 履歴がほぼ無い (新規セッション or 初回) → 空で返す
    return ''
  }

  // 最新メッセージ (= ユーザーの今の指示) は別途プロンプトで使うので除外
  const historyOnly = rows.slice(0, -1)
  const tail = historyOnly.slice(-contextCount)

  const lines: string[] = []
  for (const r of tail) {
    if (r.role === 'tool') continue // tool ロールは UI に出さない運用なのでスキップ
    const label = r.role === 'user' ? 'ユーザー' : 'アシスタント'
    // 内容を 600 文字に切り詰め (Gemini 入力サイズ抑制)
    const content = r.content.length > 600
      ? r.content.slice(0, 600) + ' …(略)'
      : r.content
    lines.push(`### ${label}`)
    lines.push(content)
    lines.push('')
  }
  return lines.join('\n').trim()
}
