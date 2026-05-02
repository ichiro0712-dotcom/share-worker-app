/**
 * Gemini Canvas 連携ブリッジ (クライアント専用ヘルパー)
 *
 * Anthropic ノードアフィニティ問題で loop=1 TTFB 100 秒級になる事象の構造的回避。
 * 重いレポート編集処理を、ブラウザの Gemini Canvas (gemini.google.com) に外出しする。
 *
 * フロー:
 *   1. TASTAS Canvas で「Gemini Canvas で編集」ボタン押下
 *   2. openGeminiCanvas() がプロンプト + 雛形 + 収集データをクリップボードに自動コピー
 *   3. Gemini を別タブで開く (ユーザーが Cmd+V で貼り付け)
 *   4. Gemini Canvas で編集 → コピー → TASTAS タブに戻る
 *   5. focus イベント検知 → looksLikeReportMarkdown() で markdown らしさ判定
 *   6. 確定 → AdvisorReportVersion に新バージョン保存 (sourceType='gemini_canvas')
 *
 * 注意:
 * - navigator.clipboard は HTTPS or localhost でしか動かない (どちらも本番でカバー)
 * - Gemini API は呼ばない (ブラウザの Gemini に飛ばすだけ、コスト無料)
 * - 既存の Anthropic 経由 update_report_draft はハイブリッドで残す (このフローは追加導線)
 */

export interface GeminiBridgePayload {
  draft: {
    title: string | null
    goal: string | null
    skeleton_markdown: string | null
    range_start: string | null
    range_end: string | null
  }
  /** dataSources を全部叩いた結果 (reports/collect.ts の出力) */
  collectedData: Record<string, unknown>
  /** 取得対象の metric キー一覧 (UI 表示や Gemini への文脈付与に使う) */
  metricKeys: string[]
}

/**
 * Gemini Canvas に貼り付けるプロンプトを組み立てる。
 * 雛形 (skeleton_markdown) を踏襲してデータを埋める指示を含む。
 */
export function buildGeminiPrompt(payload: GeminiBridgePayload): string {
  const { draft, collectedData } = payload
  return `以下の雛形と収集データを使って、レポートを作成してください。
Canvas で編集可能な長文ドキュメントとして詳細にまとめてください。

# レポート要件
- タイトル: ${draft.title ?? '(未設定)'}
- 目的: ${draft.goal ?? '(未設定)'}
- 期間: ${draft.range_start ?? '?'} 〜 ${draft.range_end ?? '?'}

# 雛形 (この構成を踏襲してください)
\`\`\`markdown
${draft.skeleton_markdown ?? ''}
\`\`\`

# 収集データ
\`\`\`json
${JSON.stringify(collectedData, null, 2)}
\`\`\`

# 注意点
- データに無い数字は捏造しないでください
- グラフは未対応のため表で代替してください
- 文字数は 500〜2000 字程度
- 完成したらコピーして元のシステムに貼り付けます
`
}

/**
 * クリップボードにプロンプトをコピーして Gemini を別タブで開く。
 * クリップボード書き込みが失敗してもタブは開く (ユーザーが手動で再コピーできるよう)。
 */
export async function openGeminiCanvas(payload: GeminiBridgePayload): Promise<void> {
  const fullPrompt = buildGeminiPrompt(payload)
  try {
    await navigator.clipboard.writeText(fullPrompt)
  } catch (err) {
    // 権限なし or 古いブラウザ: タブは開く、ユーザーに「もう一度コピーしてください」と促す UI 側で対応
    console.warn('[gemini-bridge] clipboard.writeText failed:', err)
  }

  // Gemini Canvas へ誘導。?text= でテキストフィールドにヒント文を入れる
  // (実際の本文はクリップボードにあるので Cmd+V で貼り付けてもらう)
  const guidance = encodeURIComponent('クリップボードの内容を貼り付けてください (Cmd+V / Ctrl+V)')
  window.open(`https://gemini.google.com/app?text=${guidance}`, '_blank', 'noopener,noreferrer')
}

/**
 * クリップボードから戻ってきた文字列がレポート markdown らしいかを判定。
 * 過剰検知より過小検知優先 (誤って取り込まないことを重視)。
 *
 * 条件: 100 文字以上、かつ markdown 構造 (見出し / 箇条書き / 表) のいずれかを含む。
 */
export function looksLikeReportMarkdown(text: string): boolean {
  if (!text || text.length < 100) return false
  // 見出し (#) / 箇条書き (- *) / 表 (|) のいずれかが行頭に来ていれば markdown とみなす
  return /(?:^|\n)(?:#\s|[-*]\s|\|)/.test(text)
}
