/**
 * Advisor チャット表示用ユーティリティ
 *
 * `[TOOL:xxx] ...` の hidden hint プレフィックスは Claude にだけ届けばよく、
 * ユーザーには絶対に見せない。サーバー側の永続化前剥がし (orchestrator) と、
 * 過去データ救済のためのクライアント側剥がしの両方が存在し、こちらは後者向け。
 *
 * 過去 (修正前) に DB へ書き込まれた content には prefix が残っているため、
 * 履歴表示や conversation list のタイトル表示時に必ず通すこと。
 */

const TOOL_HINT_RE = /^\s*\[TOOL:[a-zA-Z0-9_]+\]\s*/

export function stripToolHintPrefix(message: string | null | undefined): string {
  if (!message) return ''
  return message.replace(TOOL_HINT_RE, '')
}
