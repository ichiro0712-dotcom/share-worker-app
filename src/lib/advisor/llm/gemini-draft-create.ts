/**
 * Gemini API 直叩きで初回レポートドラフトを作成するヘルパー
 *
 * Anthropic ノードアフィニティ問題 (loop=1 TTFB 100 秒級) を全工程で回避するため、
 * `[TOOL:report_create]` で来る初回ドラフト作成依頼も Gemini Flash で直接処理する。
 *
 * editDraftWithGemini (修正用) と対をなす。
 * 修正版と違い、ユーザーの自由文要望から要件 (title / goal / range / data_sources /
 * metric_keys / outline / notes) と 0 埋め skeleton_markdown を 1 回の JSON 出力で
 * 全部生成する。
 */

import { generateWithGemini } from './gemini'
import { METRIC_CATALOG } from '../tools/tastas-data/metrics-catalog'
import { formatJST } from '../jst'
import { buildDataSourceCapabilitiesForPrompt } from './data-source-capabilities'

/** Gemini に提示するメトリクス候補一覧 (available のみ、key + label + 説明) */
function buildMetricsCatalogForPrompt(): string {
  const lines: string[] = []
  for (const m of METRIC_CATALOG) {
    if (!m.available) continue
    const groupBy = m.supportedGroupBy.join(' / ')
    lines.push(`- \`${m.key}\` (${m.label}, 単位: ${m.unit}): ${m.description} [group_by: ${groupBy}]`)
  }
  return lines.join('\n')
}

/** 取得不可な指標 (Gemini に「これは作っちゃダメ」と教えるため、ユーザー要望と照合させる) */
function buildUnavailableMetricsForPrompt(): string {
  const lines: string[] = []
  for (const m of METRIC_CATALOG) {
    if (m.available) continue
    lines.push(`- ${m.label} (\`${m.key}\`): ${m.reason ?? '未実装'}`)
  }
  return lines.length > 0 ? lines.join('\n') : '(なし)'
}

/**
 * Gemini に提示するデータソース (toolKey) 候補。
 * ラベルは Canvas の REPORT_DATA_SOURCE_OPTIONS と完全一致させる
 * (出典注釈で同じ表記を使うため)。
 */
const DATA_SOURCE_OPTIONS = [
  { key: 'query_metric', label: '本番 DB 指標集計', note: 'metric_keys を必ず一緒に指定すること' },
  { key: 'query_ga4', label: 'GA4 アクセス解析', note: 'ページビュー / セッション / 流入元' },
  { key: 'query_search_console', label: 'Search Console', note: '検索キーワード / 順位 / CTR' },
  { key: 'get_jobs_summary', label: '求人サマリ', note: '求人テーブルの現状' },
  { key: 'get_users_summary', label: 'ユーザーサマリ', note: 'ワーカー / 管理者の総数' },
  { key: 'get_recent_errors', label: 'エラーログ (DB)', note: '直近のシステムエラー' },
  { key: 'get_supabase_logs', label: 'Supabase ログ', note: 'Auth / Postgres' },
  { key: 'get_vercel_logs', label: 'Vercel ログ', note: 'ランタイムログ' },
  { key: 'get_vercel_deployments', label: 'Vercel デプロイ履歴', note: '直近のデプロイ状況 / 成功失敗' },
  { key: 'get_recent_commits', label: 'GitHub コミット履歴', note: '最近の変更履歴' },
]

function buildDataSourceListForPrompt(): string {
  return DATA_SOURCE_OPTIONS.map((d) => `- \`${d.key}\` (${d.label}): ${d.note}`).join('\n')
}

export interface CreateDraftParams {
  /** ユーザーが書いた要望本文 ([TOOL:report_create] プレフィックスは剥がした) */
  userRequest: string
  /** 「今日」「先週」を解釈するための現在時刻 (JST) */
  nowJst?: Date
  abortSignal?: AbortSignal
}

export interface CreateDraftResult {
  title: string
  goal: string
  rangeStart: string | null
  rangeEnd: string | null
  dataSources: string[]
  metricKeys: string[]
  outline: string
  notes: string
  skeletonMarkdown: string
  /** 1〜2 行 (50〜120 字) のチャット返答テキスト */
  summary: string
  /**
   * ユーザー要望が現状取得不可な指標のみで構成されていた場合 true。
   * true の時は skeleton/metric_keys が空でも妥当 (orchestrator 側でドラフト upsert をスキップする)
   */
  unavailableRequest: boolean
  metrics: {
    elapsedMs: number
    inputTokens: number
    outputTokens: number
    model: string
  }
}

const SYSTEM_PROMPT = `あなたは TASTAS (看護師・介護士向け求人マッチング) のレポート作成アシスタントです。
ユーザーの自由文要望から、レポートドラフトの要件と 0 埋め skeleton_markdown を JSON で生成してください。

# 役割分担 (重要)
- あなたの仕事 = 要件確定 + skeleton (0 埋め骨格) 作成
- 数字を集めて本文を書く仕事 = 別系統で自動的に走る (ユーザーは何もボタンを押す必要なし)
- データ収集ツール (query_metric / query_ga4 等) を呼ぶ必要は無い (呼べない)
- summary には「○○のボタンを押してください」のような操作指示を **絶対に書かない** (自動化済み)

# 📋 Markdown テーブル記法 (絶対遵守、これを破ると表が壊れる)

GFM テーブルの **セパレーター行は列数分の \`---\` を必ず書く**:

✅ 正しい (3列):
\`\`\`
| 列1 | 列2 | 列3 |
|---|---|---|
| a | b | c |
\`\`\`

❌ 壊れる (セパレーターが列数分ない):
\`\`\`
| 列1 | 列2 | 列3 |
|---|              ← これだと 1 列分しかなく、表として認識されない
| a | b | c |
\`\`\`

ヘッダ行の \`|\` の数とセパレーター行の \`|\` の数は **必ず一致** させること。

# 出力ルール (絶対遵守)
- skeleton_markdown は **0 埋めの表骨格 + 章立てのみ**。実数字は入れない (0 / "-")
- **❌ 数字に対するコメント / ポイント / 考察 / 仮説 / 解釈を一切書かない**
  (まだ数字が 0 なので意味が無い。本文生成フェーズで Gemini が数字を埋めた後にコメントを書く)
  例: ❌「LP1 の PV は 0 で大幅減」 ❌「考察: 流入が下がった可能性」
       ✅ 表のセルは 0 / - のみ、見出しと表構造のみ提示
- **❌ skeleton 段階で具体的な LP 名 / キャンペーン名 / 求人名を書かない** (重要)
  skeleton 段階では LandingPage / 求人 / キャンペーンの正式名称が分からないため、
  「LP 5 (キラキラ介護転職 LP)」のような固有名は決して書かない。
  代わりに "LP" のような汎用列ヘッダだけにし、行は \`-\` (本文生成時に解決される)。
  例: ❌「| LP 5 (◯◯キャンペーン) | 0 |」 ✅「| - | 0 |」
  本文生成フェーズで query_metric の rows[].label (LandingPage.name から解決される)
  を使って Gemini が「LP 5 (実際の LP 名)」を埋める。
- 「## 考察」「## 次のアクション」など **章タイトルは作って良い**が、
  中身は空 (1 行の placeholder「(本文生成時に記入)」程度) にとどめる
- 章数は 3〜6 個 (## 見出し)
- グラフ / チャート未対応のため、グラフ要望が来ても表で代替する
- 期間が曖昧な要望 ("先週" 等) は今日の日付から JST で解釈する
- データソースに query_metric を選ぶなら metric_keys 必須

# 📑 各表の直下に「出典」注釈を必ず書く (必須)

skeleton 内の **すべての Markdown 表の直下に、その表のデータをどこから引いたかを 1 行で書く**。
レポート生成時にそのまま踏襲されるので、最終レポートでも各表に出典が表示される。

フォーマット: \`*出典: <ツール名> (<取得条件>)*\`

# ⚠️ 重要 1: 表と注釈行の間に **必ず空行を 1 行** 入れる
空行が無いと Markdown パーサーが注釈行を「表の続き」と誤認して、列に入ってしまう。

# ⚠️ 重要 2: 注釈行は **「集計期間 + 出典」を 1 行で書く**
フォーマット: \`*集計期間: <期間表記> / 出典: <データソース日本語ラベル> (<取得条件>)*\`

期間の書き方 (データソース別):
- 期間集計系 (本番 DB 指標集計 / GA4 / Search Console): \`YYYY-MM-DD 〜 YYYY-MM-DD (JST)\`
- スナップショット系 (求人サマリ / ユーザーサマリ): \`現時点スナップショット\` (実値が出る本文生成時に取得時刻が補完される)
- 直近N時間系 (Supabase ログ): \`直近 24 時間\`
- 直近N件系 (エラーログ / Vercel ログ / GitHub コミット): \`直近 N 件\`

✅ 正しい (表 → 空行 → 集計期間+出典):
\`\`\`markdown
| 順位 | LP | PV数 |
|---|---|---|
| 1 | 0 | 0 |
| 2 | 0 | 0 |

*集計期間: (期間プレースホルダ) / 出典: 本番 DB 指標集計 (LP_PV / LP別)*
\`\`\`

期間プレースホルダは skeleton 段階では \`(集計期間)\` でも OK (本文生成時に Gemini が実値を埋める)。

❌ 壊れる (空行が無い → 注釈が列扱い):
\`\`\`markdown
| 順位 | LP | PV数 |
|---|---|---|
| 1 | 0 | 0 |
*集計期間: ... / 出典: ...*  ← これだと表の行として解釈される
\`\`\`

**ラベルは UI のデータソース表記と完全一致させる** (英語キーや tool 名は出さない、日本語ラベル統一):

| データソース key | ✅ 出典に書くラベル (日本語) |
|---|---|
| query_metric | 本番 DB 指標集計 |
| query_ga4 | GA4 アクセス解析 |
| query_search_console | Search Console |
| get_jobs_summary | 求人サマリ |
| get_users_summary | ユーザーサマリ |
| get_recent_errors | エラーログ (DB) |
| get_supabase_logs | Supabase ログ |
| get_vercel_logs | Vercel ログ |
| get_vercel_deployments | Vercel デプロイ履歴 |
| get_recent_commits | GitHub コミット履歴 |

例 (上記ラベルを使用):
- LP 別 PV:           \`*出典: 本番 DB 指標集計 (LP_PV / LP別)*\`
- LP 別登録数:         \`*出典: 本番 DB 指標集計 (LP_REGISTRATIONS / LP別)*\`
- 日別 PV 推移:        \`*出典: 本番 DB 指標集計 (LP_PV / 日別)*\`
- ページ別 PV (GA4):   \`*出典: GA4 アクセス解析 (ページ別)*\`
- 流入元 (GA4):        \`*出典: GA4 アクセス解析 (流入元)*\`
- 検索キーワード:      \`*出典: Search Console (クエリ別)*\`
- 求人スナップショット: \`*出典: 求人サマリ*\`

**❌ 避ける書き方** (英語キーやツール名を露出させない):
- ❌ \`*出典: query_metric / LP_PV / group_by=lp_id*\` (英語キー)
- ❌ \`*出典: 本番DB (query_metric / LP_PV)*\` (ツール名露出)

# 🎯 ユーザーが明示的にデータソースを指定したら絶対に尊重する (最重要)

ユーザー要望に以下の表記があったら、**その指定したデータソースを必ず使う**。
他で取れるからといって勝手に置き換えない:

- 「**GA4 から / GAから / GTAから / アナリティクスから**」 (GTA は GA4 の typo) → \`query_ga4\`
  - 例: 「GA4 から取れる LP の PV ランキング」→ data_sources=['query_ga4'] (query_metric は使わない)
- 「**サチコから / Search Console から / 検索コンソールから**」 → \`query_search_console\`
- 「**DB から / データベースから / 本番 DB から / DB集計で**」 → \`query_metric\`
- 「**GitHubから**」 → \`get_recent_commits\`
- 「**Vercelから**」 → \`get_vercel_logs\`
- 「**Supabaseから**」 → \`get_supabase_logs\`

**この優先順位**: 「ユーザーの明示指定 > 自動判断」を絶対に守る。
ユーザーが指定していないなら自動判断で OK。

# ❗ 取得可能性の判定 (最重要、誤検知厳禁)

**取得可能性は「データソース全体」で判定する**:
- query_metric (本番 DB の指標カタログ) **だけ**で判定してはいけない
- query_ga4 (GA4): サイト全体の PV、ページ別 PV、流入経路、デバイス別 — 全て取得可能
- query_search_console: 検索クエリ、順位、CTR — 取得可能
- get_jobs_summary / get_users_summary: 求人 / ユーザーの現状 — 取得可能
- 詳細は user prompt の「データソース能力一覧」を参照

**unavailable_request=true にしてよいのは、ユーザー要望が「取得不可リスト」のみで構成された場合**:
- 例: 「LINE登録率を出して」→ LINE_FRIEND_ADDS は available=false → 取得不可
  - skeleton に「LINE 登録率」表を入れない
  - unavailable_request=true、summary で「LINE 友だち追加数は現在取得できません
    (LINE Webhook 未実装)。代替として LP_TO_LINE_CONV (LINE 誘導クリック) があります」と返す

**❌ unavailable_request にしてはいけない例 (誤検知パターン)**:
- 「サイト全体の PV top10」「ページ別 PV」「URL 別アクセス」→ query_ga4 で取得可能
- 「流入経路 top5」「流入元別」→ query_ga4 で取得可能
- 「検索キーワード top10」→ query_search_console で取得可能
- 「デバイス別 PV」→ query_ga4 で取得可能
- METRIC_CATALOG にキーが無い = 即取得不可、と判断してはいけない

ユーザー要望に取得不可指標と取得可能指標が混在する場合は、
**取得可能な部分だけで skeleton を作り、summary で取得不可な部分を明示する** (unavailable_request=false)。

# 出力フォーマット (必ず JSON のみ、コードブロックや前置き禁止)
{
  "title": "<レポートタイトル (1 行)>",
  "goal": "<目的 1 文>",
  "range_start": "YYYY-MM-DD or null",
  "range_end": "YYYY-MM-DD or null",
  "data_sources": ["query_metric", "query_ga4", ...],
  "metric_keys": ["LP_PV", "LP_TO_LINE_CONV", ...],
  "outline": "## サマリ\\n## 主要 KPI\\n## 流入分析\\n## 次のアクション",
  "notes": "<除外条件 / 補足 1〜3 行>",
  "skeleton_markdown": "<0 埋めの表骨格 Markdown 全体、または取得不可なら空文字>",
  "summary": "<1〜2 行 (50〜120 字) で何を作ったか。取得不可指標があれば必ず明示。❌ ボタン操作案内は禁止 (例: 『レポート作成ボタンを押してください』『準備が整いました』等は書かない、自動で進む)>",
  "unavailable_request": false
}

# JSON 出力の絶対ルール (これを破ると壊れる)
- 文字列値の中の改行は **必ず \\n** にエスケープする (生の改行を入れない)
- 文字列値の中の \` (バッククォート) はそのまま OK だが、\" (二重引用符) は **必ず \\"** にエスケープする
- 末尾カンマ禁止
- skeleton_markdown は長くなるが、すべて 1 行の文字列値として \\n を使って改行を表現する
`

function buildUserPrompt(params: CreateDraftParams): string {
  const now = params.nowJst ?? new Date()
  const todayStr = formatJST(now).slice(0, 10) // YYYY-MM-DD
  return `# 現在の日時 (JST)
${formatJST(now)} (今日 = ${todayStr})

# ユーザーの要望
${params.userRequest}

# 📊 データソース能力一覧 (取得可能性はこの全体で判定する。query_metric だけで判定しない)
${buildDataSourceCapabilitiesForPrompt()}

# 📋 query_metric (DB集計) で取れる指標一覧 (metric_keys に入れる候補)
${buildMetricsCatalogForPrompt()}

# ❌ 明示的に「取得不可」な指標 (この指標**だけ**を要求されたら unavailable_request=true)
${buildUnavailableMetricsForPrompt()}

# 利用可能なデータソース (data_sources フィールドに入れる toolKey 候補)
${buildDataSourceListForPrompt()}

上記の出力フォーマットに従って JSON のみを返してください。`
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/**
 * Gemini が返した「JSON のつもり」だが構造が壊れているテキストを救う。
 * よくある事故:
 *   1. 文字列値の中で生改行 (\n が \\n になっていない) — JSON.parse が落ちる
 *   2. 文字列値の中で `"` が未エスケープ
 *   3. 末尾カンマ
 * ここでは保守的に、文字列リテラル内 (= キー文字列ではなく値の "" の中)
 * のみを対象に「生改行 → \n」「素の \r → 削除」を行う。
 */
function repairJsonString(raw: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escape) {
      out += ch
      escape = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString) {
      if (ch === '\n') {
        out += '\\n'
        continue
      }
      if (ch === '\r') {
        // 削除 (\r\n の \r をスキップ。次が \n ならそれが \n に変換される)
        continue
      }
      if (ch === '\t') {
        out += '\\t'
        continue
      }
    }
    out += ch
  }
  return out
}

function parseCreateResponse(text: string): {
  title: string
  goal: string
  range_start: string | null
  range_end: string | null
  data_sources: string[]
  metric_keys: string[]
  outline: string
  notes: string
  skeleton_markdown: string
  summary: string
  unavailable_request: boolean
} {
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini レスポンスが空でした')
  }

  // 1. そのまま parse
  let parsed: unknown = tryParse(text.trim())

  // 2. ```json fence の中だけ取り出して parse
  if (!parsed) {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (fenced) parsed = tryParse(fenced[1].trim())
  }

  // 3. 最初の `{` から最後の `}` までスライスして parse
  let sliced: string | null = null
  if (!parsed) {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      sliced = text.slice(firstBrace, lastBrace + 1)
      parsed = tryParse(sliced)
    }
  }

  // 4. 文字列内の生改行を \n にエスケープして parse (Gemini がよく壊す)
  if (!parsed && sliced) {
    parsed = tryParse(repairJsonString(sliced))
  }

  // 5. 末尾カンマを除去して parse
  if (!parsed && sliced) {
    const noTrailingComma = sliced.replace(/,(\s*[}\]])/g, '$1')
    parsed = tryParse(repairJsonString(noTrailingComma))
  }

  if (!parsed || typeof parsed !== 'object') {
    const preview = text.slice(0, 800).replace(/\n/g, '\\n')
    throw new Error(
      `Gemini レスポンスから JSON を抽出できませんでした (length=${text.length}, head=${preview})`
    )
  }

  const o = parsed as Record<string, unknown>
  const unavailable_request = o.unavailable_request === true

  const skeletonRaw =
    typeof o.skeleton_markdown === 'string' ? o.skeleton_markdown :
    typeof o.updated_skeleton === 'string' ? o.updated_skeleton : null
  // unavailable_request の場合は skeleton 空でも OK (ドラフト作成しない)
  if (!unavailable_request) {
    if (!skeletonRaw || skeletonRaw.length < 30) {
      throw new Error('skeleton_markdown が見つからないか短すぎます')
    }
  }
  const skeleton = skeletonRaw ?? ''
  const title = typeof o.title === 'string' ? o.title : '(タイトル未設定)'
  const goal = typeof o.goal === 'string' ? o.goal : ''
  const range_start = typeof o.range_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.range_start) ? o.range_start : null
  const range_end = typeof o.range_end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.range_end) ? o.range_end : null
  const data_sources = Array.isArray(o.data_sources) ? o.data_sources.filter((x): x is string => typeof x === 'string') : []
  const metric_keys = Array.isArray(o.metric_keys) ? o.metric_keys.filter((x): x is string => typeof x === 'string') : []
  const outline = typeof o.outline === 'string' ? o.outline : ''
  const notes = typeof o.notes === 'string' ? o.notes : ''
  const summary = typeof o.summary === 'string' && o.summary.length > 0
    ? o.summary
    : (unavailable_request
        ? 'ご要望の指標は現在取得できないため、レポートを作成できません。'
        : 'Canvas にレポートドラフトを作成しました。修正があればご指示ください。')

  return {
    title, goal, range_start, range_end, data_sources, metric_keys,
    outline, notes, skeleton_markdown: skeleton, summary, unavailable_request,
  }
}

/**
 * Gemini Flash で初回レポートドラフトを作成する。
 * 失敗時は throw する (orchestrator 側で catch して Anthropic ルートに fall through)。
 */
export async function createDraftWithGemini(params: CreateDraftParams): Promise<CreateDraftResult> {
  const userPrompt = buildUserPrompt(params)
  const result = await generateWithGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    jsonMode: true,
    abortSignal: params.abortSignal,
  })

  const parsed = parseCreateResponse(result.text)

  return {
    title: parsed.title,
    goal: parsed.goal,
    rangeStart: parsed.range_start,
    rangeEnd: parsed.range_end,
    dataSources: parsed.data_sources,
    metricKeys: parsed.metric_keys,
    outline: parsed.outline,
    notes: parsed.notes,
    skeletonMarkdown: parsed.skeleton_markdown,
    summary: parsed.summary,
    unavailableRequest: parsed.unavailable_request,
    metrics: {
      elapsedMs: result.tookMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    },
  }
}
