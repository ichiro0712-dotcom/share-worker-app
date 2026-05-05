/**
 * @spec    docs/04_REPORT_FEATURE.md §3.3 (レポート本文生成)
 * @related knowledge/DESIGN_DECISIONS.md §1.1 (Gemini 2.5 Flash 採用理由)
 * @related knowledge/DATA_COLLECTION_PATTERNS.md §2 (過去バージョン編集の継承)
 *
 * collect → buildUserPrompt → Gemini → AdvisorReportVersion 保存 のパイプライン。
 *
 * 重要:
 * - previousResultMarkdown を Gemini に渡し、前バージョンの編集スタイルを維持
 * - LP 表示は rows[].label を優先 (skeleton で固有名禁止、本文生成時に label で埋める)
 * - JST 基準 / グラフは表で代替 / データに無い数字を捏造しない
 */

/**
 * レポート生成本体
 *
 * 1. ドラフト取得
 * 2. dataSources を並列実行で収集
 * 3. プロンプト組立 → Gemini に投げる
 * 4. Markdown を draft.result_markdown に保存
 *
 * Gemini が落ちたら error をドラフトに記録 + 例外を re-throw (上位 API が 500 に変換)。
 */

import {
  getDraftBySession,
  markDraftGenerating,
  saveDraftError,
  type ReportDraftSnapshot,
} from '../persistence/report-drafts'
import { METRIC_CATALOG } from '../tools/tastas-data/metrics-catalog'
import {
  createReportVersion,
  buildDraftSnapshot,
  getLatestVersion,
} from '../persistence/report-versions'
import { collectReportData, type CollectedItem } from './collect'
import { generateWithGemini, isGeminiAvailable } from '../llm/gemini'
import { recordAudit } from '../persistence/audit'
import { appendMessage } from '../persistence/messages'

const GEMINI_MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `あなたは TASTAS (タスタス) のシステム運用レポートを書く編集者です。
以下のルールを厳守して Markdown でレポートを書いてください。

## ❗ 最重要ルール (最初に守ること、優先順位順)

### 1. 「前回バージョン」が与えられていたら、その編集スタイルを **絶対に維持** する
ユーザーが過去にレポート編集機能で日付フォーマット (MM/DD など) や見出し表記、
表記統一、追加コメント形式を変更している場合がある。これらは絶対に消さない。
**前回バージョンの該当部分の表記・体裁をそのまま踏襲し、新データのみ書き換える** こと。

### 2. 「ドラフト本体テンプレート」(skeleton_markdown) は構造の正解
- skeleton_markdown が与えられている場合、**章構成・表構成は skeleton に従う**
- skeleton に章が追加されていれば → 追加する (前回バージョンには無くて当然)
- skeleton から章が削除されていれば → 削除する
- それ以外 (文体 / 表記 / 既存セルの体裁) は **前回バージョン優先**

### 3. ルール詳細
- 章 (## 見出し) の追加・削除は skeleton 通り。並び替えは skeleton の順序に従う
- 表の列・行は skeleton 通り (LP1〜LP3 の表があれば LP1〜LP3 のままにする)
- skeleton にない章 (例: 「## 参照データ」を除く) を勝手に追加しない
- skeleton の "0" / "-" / "(コメント)" プレースホルダを実データ・実コメントに置き換える
- skeleton 内のセクション順序を維持する

### 4. レポートヘッダーは型を強制しない (重要)
- ❌ 禁止: タイトル直下に「対象期間: 2026-04-27 〜 2026-05-03 (JST)」のような **固定形式の対象期間表記**
- ❌ 禁止: 「## サマリ」を必ず最初に置く、「## 次のアクション」を必ず最後に置く、のような型固定
- レポートは主要 KPI 集計だけでなく、輪切り分析・ad hoc 調査・障害振り返りなど多様な用途で使う
- 期間情報は **各表の出典注釈 (集計期間: ...)** に書けば十分。ヘッダーに重複表示しない
- 章構成・順序・冒頭の書き方は、**ユーザーが Canvas で作った skeleton のまま**忠実に踏襲する

skeleton_markdown が空 / 与えられていない場合に限り、自由構成を許可する:
  - その場合は outline (## 見出しのみ 3〜6 行) を尊重しつつ各章を肉付け
  - outline も空なら「サマリ → 主要数値 → 気になる点 → 次のアクション」

## その他の厳守ルール

1. 与えられた「収集データ」のみを根拠にする。データに無い数字を推測で埋めない
1.5. **取得不可指標 (下に提示するリスト) が skeleton に残っていた場合は、
    その表のセルを「-」のままにし、章末に「※この指標は現在取得できません (理由)」と明記する。
    数字を勝手に作らない。**
2. データソースが空 (skipped / failed) の章は省略するか、その旨を明記する
3. 数値は単位 (件 / PV / 円 / %) と期間を明記する
4. JST 基準の日付で書く
5. 文字数: 500〜1200 字程度。冗長な前置きは省く
5.5. **「サマリ」「考察」「次のアクション」「ポイント」「気づき」など**
    **すべての文章セクションは原則として箇条書き (\`-\` または番号付き)** で書く:
   - 1 項目につき 1〜2 行 (50 字以内推奨) で簡潔に
   - 散文段落が必要な場合 (輪切り分析・複雑な背景説明など) は許可するが、**冗長にならないよう意識**

5.6. **❌ 表の前置き説明文 (1 行散文) は禁止**:
   - ❌ 例 (これを書かない):
     \`\`\`
     ## ワーカーTOPページPV推移
     今週のワーカーTOPページのPV数推移は以下の通りです。  ← 不要
     | 日付 | PV |
     ...
     \`\`\`
   - ✅ 正しい (見出しの直後に直接表):
     \`\`\`
     ## ワーカーTOPページPV推移

     | 日付 | PV |
     ...
     \`\`\`
   - 表セクションは「## 見出し → 空行 → 表 → 空行 → *集計期間 / 出典*」のみで構成
   - 表の前後に「以下の通りです」「上位5件は次の通りです」のような決まり文句は書かない (情報量ゼロ、冗長)
   - 例:
     ✅ 良い:
     \`\`\`
     ## サマリ
     - 今週の総PVは2,127、前週比+15%
     - LP5が48%を占有、特異
     - 5/3(日)に大幅減 (77 PV)
     \`\`\`
     ❌ 悪い (長文、冗長):
     \`\`\`
     ## サマリ
     今週(2026/04/28〜05/03)のLPアクセス状況について分析しました。LP閲覧数は合計で2127 PVと、前週比+15%の増加を示しました。LP別に見ると、LP5が突出して...
     \`\`\`
6. **数値表は skeleton にあるなら必ずそのまま使い、数字を埋める**。
   skeleton に無い表を勝手に追加しない (最重要ルール参照)
7. **収集データに同じツールの複数バリアントが並んでいることがある**:

   **query_metric** (本番DB集計):
   - group_by=none → 期間合計
   - group_by=day → 日別推移
   - group_by=lp_id → LP別
   - group_by=campaign_code → キャンペーン別

   **query_ga4** (Google Analytics 4):
   - (overview) → サイト全体合計 + 日別推移
   - (traffic) → **流入経路 (source / medium 別)** ← 「流入経路 Top5」はこれ
   - (pages) → **ページ別 PV (URL / タイトル別)** ← 「ページ別 PV Top10」はこれ
   - (lpPerformance) → LP別の GA4 詳細指標 (PV / 直帰率 / セッション)
   - (comparison) → **前期間との比較** ← 「先週比 +○%」「前月比」はこれ

   **query_search_console** (Google Search Console):
   - (query) → 検索キーワード別流入 ← 「検索キーワード Top10」はこれ
   - (page) → **ページ別検索流入** ← 「どの URL に検索流入が来てるか」はこれ
   - (device) → デバイス別 (mobile/desktop/tablet)
   - (country) → 国別

   **get_supabase_logs**:
   - (postgres) → Postgres エラーログ
   - (api) → API ログ
   - (auth) → 認証ログ

   **get_vercel_logs**:
   - (error) → エラーログのみ
   - (warning) → 警告ログのみ
   - (info) → 情報ログのみ

   **get_vercel_deployments**:
   - (production) → 本番デプロイ履歴
   - (preview) → プレビューデプロイ履歴

   skeleton の表が要求している切り口に合わせて対応するバリアントの rows を埋める。
   元の rows を全部出してよい (上位 10 件等の打ち切りは禁止)。
   **❌ 「データが取得できない」と書く前に、必ず該当バリアントが collected に
   入っていないか確認すること。** バリアントが存在するなら、その rows を表に埋める。
8. 出力は Markdown のみ。前置きの会話 ("分かりました、書きます" 等) は禁止
9. **すべての表の直下に「集計期間 + 出典」を 1 行のイタリック注釈で書く** (最重要、必須):
   - フォーマット: \`*集計期間: <期間表記> / 出典: <データソース日本語ラベル> (<取得条件>)*\`
   - **表と注釈行の間に必ず空行を 1 行入れる** (無いと注釈が表の列に取り込まれる)

   **ラベル統一表** (英語キー・ツール名を出さない):

   | データソース | 出典ラベル | 集計期間の書き方 |
   |---|---|---|
   | query_metric (本番DB集計) | 本番 DB 指標集計 | \`YYYY-MM-DD 〜 YYYY-MM-DD (JST)\` (レポート対象期間) |
   | query_ga4 | GA4 アクセス解析 | \`YYYY-MM-DD 〜 YYYY-MM-DD (JST)\` |
   | query_ga4 (comparison) | GA4 アクセス解析 | \`今期: ○ 〜 ○ / 前期: ○ 〜 ○ (JST)\` |
   | query_search_console | Search Console | \`YYYY-MM-DD 〜 YYYY-MM-DD (JST)\` |
   | get_jobs_summary | 求人サマリ | \`現時点スナップショット (取得: YYYY-MM-DD HH:MM JST)\` |
   | get_users_summary | ユーザーサマリ | \`現時点スナップショット (取得: YYYY-MM-DD HH:MM JST)\` |
   | get_recent_errors | エラーログ (DB) | \`直近 N 件\` (limit 値、デフォ 50) |
   | get_supabase_logs | Supabase ログ | \`直近 24 時間\` |
   | get_vercel_logs | Vercel ログ | \`直近 N 件 (level=error/warning/info)\` |
   | get_vercel_deployments | Vercel デプロイ履歴 | \`直近 N 件 (env=production/preview)\` |
   | get_recent_commits | GitHub コミット履歴 | \`直近 30 件\` |

   **例**:
   \`\`\`
   | 順位 | LP | PV数 |
   |---|---|---|
   | 1 | LP 5 (◯◯キャンペーン LP) | 1086 |

   *集計期間: 2026-04-27 〜 2026-05-03 (JST) / 出典: 本番 DB 指標集計 (LP_PV / LP別)*
   \`\`\`

   ⚠️ **LP 表示の必須ルール**:
   - query_metric の group_by="lp_id" の結果は \`rows: [{ key, value, label? }]\` 形式。
   - **必ず label を表示** (例: "LP 5 (◯◯キャンペーン LP)")。
   - label が無い (LandingPage に未登録の lp_id) ときだけ \`LP <key>\` の形式で fallback。
   - **key (数字 ID) だけを表に出してはいけない** (ユーザーから「ID だけで意味が分からない」と指摘あり)。

   \`\`\`
   | 求人タイプ | 件数 |
   |---|---|
   | 親求人 | 25 |

   *集計期間: 現時点スナップショット (取得: 2026-05-04 04:00 JST) / 出典: 求人サマリ*
   \`\`\`

   - 複数ソース組合せ: \`*集計期間: 2026-04-27 〜 2026-05-03 (JST) / 出典: 本番 DB 指標集計 (LP_PV) + GA4 アクセス解析 (ページ別)*\`
   - skeleton に既に注釈が書かれていたらそれを尊重して維持する
   - レポート全体の対象期間とは別に、**表ごとに実際の集計期間を明記する** (スナップショット系・直近N件系はレポート期間と異なる)
10. 最後にデータソース一覧を「## 参照データ」セクションで全ツール網羅的にまとめる
    (各表の出典注釈とは別に、レポート末尾でも俯瞰できるように)
11. **グラフ / チャート / 画像生成は未対応** (Markdown だけで出力)。
    skeleton や outline に「○○グラフ」のような章があっても、章タイトルを変える必要はないが
    中身は **Markdown テーブル + 簡単な文章で代替表示** する。
    例: 章タイトル「日別アクセスグラフ」→ 中身は「日付 / セッション / 前日比」の表 + トレンドコメント。
    画像 URL や Mermaid は使用禁止 (画像出力はサポート外)。`

function buildUserPrompt(input: {
  draft: ReportDraftSnapshot
  collected: CollectedItem[]
  /**
   * 前回バージョンの result_markdown。あればこれを「過去の編集スタイル参考」として渡す。
   * Gemini に「日付フォーマットや見出しの言い回しを変更している場合、その変更を維持せよ」と指示する。
   */
  previousResultMarkdown?: string | null
}): string {
  const { draft, collected, previousResultMarkdown } = input
  const lines: string[] = []

  // ❗ 前バージョンがあれば、それを「過去の編集スタイル参照」として最初に提示する。
  // ユーザーが「日付を MM/DD にして」「見出しを変えて」など編集していた場合、
  // 再生成時にそれを維持するため (新規データと skeleton の章追加だけ取り込む)。
  if (previousResultMarkdown && previousResultMarkdown.trim().length > 0) {
    lines.push('# ❗ 前回バージョンのレポート本文 (編集スタイルを継承する)')
    lines.push('')
    lines.push('以下はユーザーがレポート編集機能で手作業修正したかもしれない最新版です。')
    lines.push('**日付フォーマット (例: MM/DD)、見出しの言い回し、表記スタイル、コメント形式は')
    lines.push('そのまま維持して、新しいデータ / 章だけを追加・更新する**。')
    lines.push('skeleton で要求されている新しい表 / 章があれば、それは追加する。')
    lines.push('skeleton から削除されている章があれば、それは削除する。')
    lines.push('それ以外の文体・表記・既存の数字フォーマットは前回の体裁を踏襲する。')
    lines.push('')
    lines.push('```markdown')
    lines.push(previousResultMarkdown)
    lines.push('```')
    lines.push('')
  }

  // ❗ skeleton_markdown を主要セクションとして提示する。
  // システムプロンプトの最重要ルールが「skeleton をそのまま下敷きにする」なので、
  // ここでも目立つ位置に置く。
  if (draft.skeletonMarkdown) {
    lines.push('# ❗ ドラフト本体テンプレート (この構造をそのまま踏襲して数字を埋める)')
    lines.push('')
    lines.push('以下はユーザーが Canvas で確認・調整した skeleton です。')
    lines.push('章の追加 / 削除 / 並び替え禁止。表の列・行の追加 / 削除 / 並び替え禁止。')
    lines.push('プレースホルダ (0 / "-" / "(コメント)") を実データ・実コメントで埋めるだけ。')
    lines.push('skeleton に無い章 (「## 参照データ」を除く) を勝手に作らない。')
    lines.push('')
    lines.push('```markdown')
    lines.push(draft.skeletonMarkdown)
    lines.push('```')
    lines.push('')
  }

  lines.push('# レポート要件 (補助情報)')
  if (draft.title) lines.push(`- タイトル: ${draft.title}`)
  if (draft.goal) lines.push(`- 目的: ${draft.goal}`)
  if (draft.rangeStart && draft.rangeEnd) {
    lines.push(
      `- 集計対象期間 (各表の出典に書く用): ${draft.rangeStart} 〜 ${draft.rangeEnd} (JST)`
    )
    lines.push(
      `  ※ この期間は「query_metric / query_ga4 / query_search_console」の集計レンジです。`
    )
    lines.push(
      `  ※ レポート本文のヘッダーやサブタイトルに「対象期間: ...」を固定で書かない (各表の集計期間注釈で十分)。`
    )
  }
  if (draft.outline) {
    lines.push('')
    lines.push('## アウトライン (skeleton と矛盾するなら skeleton を優先)')
    lines.push(draft.outline)
  }
  if (draft.originalRequest) {
    lines.push('')
    lines.push('## ユーザー初回要望 (発端の文脈、参考用)')
    lines.push(draft.originalRequest)
  }
  if (draft.notes) {
    lines.push('')
    lines.push('## 追加メモ・除外条件')
    lines.push(draft.notes)
  }

  lines.push('')
  lines.push('# 収集データ')
  lines.push('')

  for (const item of collected) {
    lines.push(`## ${item.label} (\`${item.toolName}\`)`)
    if (item.ok) {
      // 1ツールあたり最大 50KB に制限 (Gemini への入力サイズ抑制)
      const json = JSON.stringify(item.data, null, 2)
      const truncated = json.length > 50_000 ? json.slice(0, 50_000) + '\n... (truncated)' : json
      lines.push('```json')
      lines.push(truncated)
      lines.push('```')
    } else {
      lines.push(`> ⚠️ 取得失敗: ${item.error ?? '原因不明'}`)
    }
    lines.push('')
  }

  // 取得不可指標を Gemini に教える (skeleton に残っていた場合の安全策)
  const unavailable = METRIC_CATALOG.filter((m) => !m.available)
  if (unavailable.length > 0) {
    lines.push('# ❌ 取得不可な指標 (skeleton に残っていてもセルは "-" のままにする)')
    for (const m of unavailable) {
      lines.push(`- ${m.label} (${m.key}): ${m.reason ?? '未実装'}`)
    }
  }

  return lines.join('\n')
}

export interface GenerateReportInput {
  sessionId: string
  adminId: number
  /** クライアントからの中断シグナル (P1-7 キャンセルボタン用) */
  abortSignal?: AbortSignal
}

export interface GenerateReportOutput {
  draftId: string
  resultMarkdown: string
  model: string
  collectedCount: number
  collectedFailedCount: number
  inputTokens: number
  outputTokens: number
  totalMs: number
}

export async function generateReport(input: GenerateReportInput): Promise<GenerateReportOutput> {
  const start = Date.now()
  const draft = await getDraftBySession(input.sessionId)
  if (!draft) {
    throw new Error('このセッションにはレポートドラフトが存在しません')
  }
  if (draft.adminId !== input.adminId) {
    throw new Error('このドラフトを操作する権限がありません')
  }
  const gemini = isGeminiAvailable()
  if (!gemini.ready) {
    await saveDraftError({ id: draft.id, errorMessage: gemini.reason ?? 'Gemini 利用不可' })
    throw new Error(gemini.reason ?? 'Gemini 利用不可')
  }
  if (draft.dataSources.length === 0) {
    await saveDraftError({
      id: draft.id,
      errorMessage: 'データソースが 1 つも指定されていません',
    })
    throw new Error('データソースが 1 つも指定されていません')
  }

  await markDraftGenerating(draft.id)

  // 0. 直前バージョン (= ユーザーが手作業で日付フォーマット変更などをした最新版) を取得。
  //    再生成時にそのスタイル / 表記 / 加工内容を継承させるため Gemini に渡す。
  //    (これが無いと「日付を MM/DD にして」と編集した内容が再生成で消える事故が起きる)
  const previous = await getLatestVersion(draft.id)

  // 1. データ収集 (並列)
  const collected = await collectReportData({
    adminId: input.adminId,
    sessionId: input.sessionId,
    rangeStart: draft.rangeStart,
    rangeEnd: draft.rangeEnd,
    toolKeys: draft.dataSources,
    metricKeys: draft.metricKeys,
  })

  // 2. Gemini に投げる
  let geminiOut
  try {
    geminiOut = await generateWithGemini({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({
        draft,
        collected: collected.items,
        previousResultMarkdown: previous?.resultMarkdown ?? null,
      }),
      model: GEMINI_MODEL,
      abortSignal: input.abortSignal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // ユーザーが中断した場合は "cancelled by user" として残し、上位で 499 相当を返す
    const aborted =
      input.abortSignal?.aborted ||
      (e instanceof Error && (e.name === 'AbortError' || msg.toLowerCase().includes('abort')))
    if (aborted) {
      await saveDraftError({ id: draft.id, errorMessage: 'cancelled by user' })
      const err = new Error('cancelled by user')
      err.name = 'AbortError'
      throw err
    }
    await saveDraftError({ id: draft.id, errorMessage: `Gemini 呼び出し失敗: ${msg}` })
    throw e
  }

  // 3. バージョン作成 (= 最新版キャッシュも同時更新する)
  //    previous は冒頭で取得済 (Gemini に渡す用 + parent_version_id の両用)
  const version = await createReportVersion({
    draftId: draft.id,
    resultMarkdown: geminiOut.text,
    resultModel: geminiOut.model,
    draftSnapshot: buildDraftSnapshot(draft),
    source: 'generated',
    parentVersionId: previous?.id ?? null,
    generatedMs: geminiOut.tookMs,
    inputTokens: geminiOut.inputTokens,
    outputTokens: geminiOut.outputTokens,
  })

  // 3.5 チャット履歴に「📊 レポート v1 を生成しました」を assistant メッセージとして残す。
  //     これにより:
  //     - ユーザーが履歴で見返した時に「ここで生成された」と分かる
  //     - 次回 Gemini が draft_revise / result_edit する際に履歴 (= context) として使える
  //       (例: ユーザーが「さっき生成したレポートに○○を足して」のような文脈依存指示で効く)
  const failedCount = collected.items.filter((i) => !i.ok).length
  const eventLabel =
    `📊 **レポート v${version.versionNumber} を生成しました**\n` +
    `- 期間: ${draft.rangeStart ?? '?'} 〜 ${draft.rangeEnd ?? '?'}\n` +
    `- 使用データ: ${draft.dataSources.join(', ')}\n` +
    (draft.metricKeys.length > 0 ? `- 指標: ${draft.metricKeys.join(', ')}\n` : '') +
    `- 収集: 成功 ${collected.items.length - failedCount} / 失敗 ${failedCount}\n` +
    `- 文字数: ${geminiOut.text.length.toLocaleString()} 文字`
  await appendMessage({
    sessionId: input.sessionId,
    role: 'assistant',
    content: eventLabel,
    inputTokens: geminiOut.inputTokens,
    outputTokens: geminiOut.outputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    model: geminiOut.model,
  }).catch((e) => {
    // 履歴保存失敗は致命ではないので throw しない (本体はレポート生成成功)
    console.error('[advisor:report-generate] event message append failed', e)
  })

  // 4. 監査ログ
  await recordAudit({
    adminId: input.adminId,
    sessionId: input.sessionId,
    eventType: 'chat_response',
    payload: {
      kind: 'report_generated',
      draftId: draft.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
      model: geminiOut.model,
      inputTokens: geminiOut.inputTokens,
      outputTokens: geminiOut.outputTokens,
      collectedCount: collected.items.length,
      collectedFailedCount: collected.items.filter((i) => !i.ok).length,
      collectMs: collected.totalMs,
      geminiMs: geminiOut.tookMs,
    },
  })

  const failed = collected.items.filter((i) => !i.ok).length
  return {
    draftId: draft.id,
    resultMarkdown: geminiOut.text,
    model: geminiOut.model,
    collectedCount: collected.items.length,
    collectedFailedCount: failed,
    inputTokens: geminiOut.inputTokens,
    outputTokens: geminiOut.outputTokens,
    totalMs: Date.now() - start,
  }
}