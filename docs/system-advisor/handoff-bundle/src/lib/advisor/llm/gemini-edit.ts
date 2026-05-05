/**
 * @spec    docs/04_REPORT_FEATURE.md (Canvas + レポート機能 §3.2)
 * @related knowledge/DESIGN_DECISIONS.md §1.1
 *
 * [TOOL:draft_revise] バイパス処理。
 * Gemini 2.5 Flash 直叩きで 4-10 秒でドラフト修正 (skeleton_markdown 書き換え)。
 */

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
import { METRIC_CATALOG } from '../tools/tastas-data/metrics-catalog'
import { buildDataSourceCapabilitiesForPrompt } from './data-source-capabilities'

/** Gemini に「これは取得不可」と教える指標一覧 (revise でも create と同じルールを徹底するため) */
function buildUnavailableMetricsForRevisePrompt(): string {
  const lines: string[] = []
  for (const m of METRIC_CATALOG) {
    if (m.available) continue
    lines.push(`- ${m.label} (\`${m.key}\`): ${m.reason ?? '未実装'}`)
  }
  return lines.length > 0 ? lines.join('\n') : '(なし)'
}

/** query_metric (DB集計) で取れる指標 (代替提案用に Gemini に見せる) */
function buildDbMetricsForRevisePrompt(): string {
  const lines: string[] = []
  for (const m of METRIC_CATALOG) {
    if (!m.available) continue
    lines.push(`- ${m.label} (\`${m.key}\`, ${m.unit}): ${m.description}`)
  }
  return lines.join('\n')
}

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
  /** 直近のチャット履歴 (Markdown 整形済み)。空文字なら省略される。文脈を Gemini に渡す。 */
  chatHistoryContext?: string
  /** AbortSignal (クライアント中断時) */
  abortSignal?: AbortSignal
}

export interface EditDraftResult {
  /** 修正後の skeleton_markdown 全体 */
  updatedSkeleton: string
  /** 更新したフィールドのキー一覧 (例: ['skeleton_markdown', 'data_sources', 'metric_keys']) */
  fieldsUpdated: string[]
  /** 1〜2 行で何を変えたかの説明 (チャット欄に表示する text) */
  summary: string
  /**
   * ユーザー指示が取得不可指標を skeleton に追加する内容で、Gemini が
   * 拒否した場合 true。true の時は updatedSkeleton は現状維持される想定で、
   * orchestrator 側で skeleton 更新を skip する。
   */
  refused: boolean
  /**
   * skeleton 変更に伴って必要になった data_sources の更新 (例: 流入経路の表を追加 → query_ga4 を追加)。
   * null = 変更なし。配列 = この値で置き換える (追加分だけでなく完全な新リスト)。
   */
  updatedDataSources: string[] | null
  /**
   * skeleton 変更に伴って必要になった metric_keys の更新。null = 変更なし。
   */
  updatedMetricKeys: string[] | null
  /** skeleton と整合する outline (## 見出しのみ)。null = 変更なし。 */
  updatedOutline: string | null
  /** 編集により目的が変わった場合の goal 更新。null = 変更なし。 */
  updatedGoal: string | null
  /** 編集により主題が変わった場合の title 更新。null = 変更なし。 */
  updatedTitle: string | null
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
**さらに skeleton 変更に応じて要件メタ (data_sources / metric_keys / outline / goal) も同期更新する**。

# 出力ルール (絶対遵守)
- skeleton_markdown を修正する
- **要件メタも skeleton と整合するよう必ず同期更新する** (詳細は下記「要件メタ同期ルール」)
- 0 埋めの表骨格は維持する (実際の数字は本文生成フェーズで Gemini が埋めるので、
  ここでは "0" / "-" / "(コメント)" のままにする)
- グラフ / チャート生成は未対応のため、表で代替する
- レポート本文を完成させない (skeleton 段階を維持)

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

# 📑 各表の直下に「出典」注釈を必ず書く (必須)

**新しく表を追加するときも、既存の表を編集するときも、表の直下に出典注釈 1 行を必ず付ける**:

フォーマット: \`*出典: <ツール名> (<取得条件>)*\`

# ⚠️ 重要 1: 表と注釈行の間に **必ず空行を 1 行** 入れる
空行が無いと Markdown パーサーが注釈行を「表の続き」と誤認して、列に入ってしまう。

# ⚠️ 重要 2: 注釈行は **「集計期間 + 出典」を 1 行で書く**
フォーマット: \`*集計期間: <期間表記> / 出典: <データソース日本語ラベル> (<取得条件>)*\`

期間の書き方:
- 期間集計系 (本番 DB / GA4 / Search Console): \`YYYY-MM-DD 〜 YYYY-MM-DD (JST)\` (skeleton 段階では \`(集計期間)\` プレースホルダで OK)
- スナップショット系 (求人サマリ等): \`現時点スナップショット\`
- 直近N時間系 (Supabase ログ): \`直近 24 時間\`
- 直近N件系 (Vercel ログ / GitHub コミット): \`直近 N 件\`

✅ 正しい:
\`\`\`markdown
| 順位 | LP | PV数 |
|---|---|---|
| 1 | - | 0 |

*集計期間: (集計期間) / 出典: 本番 DB 指標集計 (LP_PV / LP別)*

(※ LP 列は \`-\` プレースホルダ。本文生成時に query_metric の rows[].label から
 「LP 5 (◯◯キャンペーン LP)」が埋まる。skeleton 段階では具体名を書かない。)
\`\`\`

❌ 壊れる: 空行なしで注釈行を書くと表の行に取り込まれる

**ラベルは UI のデータソース表記と完全一致させる** (英語キー・ツール名は出さない):

| データソース key | ✅ 出典ラベル |
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

例:
- LP 別 PV:        \`*出典: 本番 DB 指標集計 (LP_PV / LP別)*\`
- ページ別 PV:      \`*出典: GA4 アクセス解析 (ページ別)*\`
- 流入元:           \`*出典: GA4 アクセス解析 (流入元)*\`
- 検索キーワード:   \`*出典: Search Console (クエリ別)*\`

**既に出典が書かれている表を編集する時は、出典行 + その上の空行を消さない**
(データソースが変わってないなら出典も変わらない)。

skeleton に表があるのに出典行が無かったら、追加で書くこと (表との間に空行を入れる)。

# 🔁 要件メタ同期ルール (重要、これを怠るとレポート生成で数字が出ない)

skeleton に章 / 表を追加・削除・変更したら、対応する要件メタも更新する:

**updated_data_sources** (skeleton で使うデータソース全体の新リスト):
- skeleton に「サイト全体PV」「流入経路」など GA4 系の表を追加 → \`query_ga4\` を含める
- skeleton に「検索キーワード」を追加 → \`query_search_console\` を含める
- skeleton に「LP別PV」「DB集計指標」を追加 → \`query_metric\` を含める
- 削除した表に対応するソースが他に使われていないなら、そのソースは外す
- **変更が無いなら null** を返す (現状維持)
- 変更があるなら **完全な新リスト** を配列で返す (差分ではない)

# 🎯 ユーザーが明示的にデータソースを指定したら絶対に尊重する (最重要)

ユーザーの指示文に以下の表記があったら、**その指定したデータソースを必ず使う**。
他で取れるからといって勝手に置き換えない:

- 「**GA4 から / GAから / GTAから / アナリティクスから**」 (GTA は GA4 の typo) → \`query_ga4\` を使う
  - 例: 「GA4 から取れる LP の PV ランキング」→ query_ga4 (LP_PV を query_metric で取らない)
- 「**サチコから / Search Console から / 検索コンソールから**」 → \`query_search_console\`
- 「**DB から / データベースから / 本番 DB から / DB集計で**」 → \`query_metric\`
- 「**GitHubから**」 → \`get_recent_commits\`
- 「**Vercelから**」 → \`get_vercel_logs\`
- 「**Supabaseから**」 → \`get_supabase_logs\`

ユーザーが指定していないデータソースを **勝手に補完してはいけない** (例: 「LP別PV出して」だけなら
DB / GA4 どちらでも良いので「LP別PV は DB の query_metric (LP_PV) で取れます」と判断してよいが、
「**GA4 から** LP別PV出して」と書かれたら、絶対に query_ga4 を使い、LP_PV (query_metric) は使わない)。

**この優先順位**: 「ユーザーの明示指定 > Gemini の判断」を絶対に守る。

**updated_metric_keys** (query_metric を使うなら必須):
- skeleton に追加した DB集計表の metric_key を含める (LP_PV / LP_TO_LINE_CONV / ...)
- query_metric を data_sources から外したなら []
- **変更が無いなら null**

**updated_outline** (## 見出しのみ、3〜6 行):
- skeleton の章構造に合わせる (## 見出しを抽出して "\\n" で繋ぐ)
- **skeleton の章を 1 つでも追加 / 削除 / リネームしたら必ず更新する** (消極判定禁止)
- ユーザー指示が「文言修正だけ (例: 日本語にして / 順位の表記変えて)」で章は変わらない場合のみ null

**updated_title** (タイトル、1 行):
- skeleton の主題が変わったら必ず更新する (例: 「LP別PV」しか無かったところに
  「サイト全体PV」「流入経路」が加わって LP の表が消えた → 「サイト全体アクセス分析」)
- skeleton の章をひとつでも追加・削除したら、現在の title が依然 skeleton 全体を
  説明できているか必ず確認する。説明できないなら新しい title を返す
- 文言修正だけなら null

**updated_goal** (1 文の目的):
- skeleton の主題が変わったら必ず更新する (title と同じタイミングで判定)
- 例: 元 goal「LPごとの閲覧状況を把握」 → 流入経路とサイト全体PVが追加されたら
  「サイト全体のアクセス傾向と主要な流入経路を把握する」など、現状を反映した文に書き換える
- 文言修正だけなら null

# ⚠️ 同期判定の鉄則
- 「変更ないかも」と迷ったら **更新する側に倒す**。要件メタが skeleton と乖離する事故が最大の問題
- skeleton から **章 / 表が 1 つでも消えた or 増えた** → outline は必ず更新、title/goal も主題に
  影響していないか必ずチェック (影響あれば更新)
- **null を返してよいのは「ユーザー指示が文言レベル (日本語化 / リネーム / 表記統一) で章構成は不変」のときだけ**

例:
- ユーザー指示: 「流入経路 top5 の表を追加」
  → skeleton に流入経路セクション追加
  → updated_data_sources: ['query_metric', 'query_ga4'] (元に query_ga4 を追加)
  → updated_metric_keys: null (DB指標は変わらない)
  → updated_outline: '## サマリ\\n## LP別PV\\n## 流入経路 Top5\\n## 考察\\n## 次のアクション'
  → updated_title: '今週のLP別PVと流入経路レポート' (主題が拡張されたので更新)
  → updated_goal: 'LPごとの閲覧状況に加え、主要な流入経路を把握する'
- ユーザー指示: 「LP別の表を消して、サイト全体PVだけにして」
  → skeleton から LP表削除、サイト全体PVのみ
  → updated_data_sources: ['query_ga4']
  → updated_metric_keys: [] (query_metric 不要)
  → updated_outline: 削除後の章構成
  → updated_title: 'サイト全体アクセスPVレポート' (LPの話が消えた)
  → updated_goal: 'サイト全体のページビュー傾向を把握する'
- ユーザー指示: 「流入経路の表記を日本語にして」
  → skeleton 内の "Direct" などを「直接流入」に変えるだけ、章は不変
  → updated_outline / updated_title / updated_goal: 全部 null
  → updated_data_sources / updated_metric_keys: 変更なし → null

# ❗ refused 判定のルール (誤検知厳禁)

**取得可能性は「データソース全体」で判定する**:
- query_metric (本番 DB の指標カタログ) **だけ**で判定してはいけない
- query_ga4 (Google Analytics 4): サイト全体の PV、ページ別 PV (URL 別)、流入経路、デバイス別、
  滞在時間、直帰率など、**LP 単位ではない GA4 で取れるアクセス解析**は取得可能
- query_search_console: 検索クエリ、順位、CTR は取得可能
- get_jobs_summary / get_users_summary: 求人 / ユーザーの現状スナップショットは取得可能
- 詳細は下に「データソース能力一覧」を提示するので、必ずそれと照合してから判定する

**refused=true にしてよいのは、明示的に「取得不可リスト」に該当する場合のみ**:
- 例: 「LINE登録数の表を追加して」→ LINE_FRIEND_ADDS は available=false (LINE Webhook 未実装)
  → refused=true、summary で「LINE 友だち追加数は現在取得できません。代替として
  LP_TO_LINE_CONV (LINE 誘導クリック数) があります」と返す

**❌ refused にしてはいけない例 (誤検知パターン)**:
- 「サイト全体の PV top10」→ query_ga4 (GA4) で取得可能。普通に skeleton に追加する
- 「流入経路 top5」「流入元別アクセス」→ query_ga4 で取得可能。普通に skeleton に追加する
- 「ページ別 PV」「URL 別アクセス」→ query_ga4 で取得可能
- 「検索キーワード top10」→ query_search_console で取得可能
- 「デバイス別 PV」「モバイル / PC 比率」→ query_ga4 で取得可能
- METRIC_CATALOG にキーが無い = 即取得不可、と判断してはいけない (DB 以外のソースを忘れない)

ユーザーが取得不可指標を「取りやめる」「削除する」のは OK (制限なく実施)。

# 出力フォーマット (必ず JSON のみ、コードブロックや前置き禁止)
{
  "updated_skeleton": "<修正後の markdown 全体。refused=true なら現状維持>",
  "fields_updated": ["skeleton_markdown", "data_sources", "metric_keys", "outline", "title", "goal"],
  "summary": "<1〜2 行 (50〜120 字) で何を変えたか / なぜ断ったか。❌ ボタン操作案内禁止 (例: 『レポート再生成してください』『○○ボタンを押してください』は書かない)>",
  "refused": false,
  "updated_data_sources": ["query_metric", "query_ga4"] or null,
  "updated_metric_keys": ["LP_PV"] or null,
  "updated_outline": "## サマリ\\n## LP別PV\\n## 流入経路\\n## 考察" or null,
  "updated_title": "<新しいタイトル 1 行>" or null,
  "updated_goal": "<新しい目的 1 文>" or null
}

# JSON 出力の絶対ルール (これを破ると壊れる)
- 文字列値の中の改行は **必ず \\n** にエスケープする (生の改行を入れない)
- 文字列値の中の \" (二重引用符) は **必ず \\"** にエスケープする
- 末尾カンマ禁止
- updated_skeleton は長くなるが、すべて 1 行の文字列値として \\n を使って改行を表現する
`

function buildUserPrompt(params: EditDraftParams): string {
  const r = params.requirements
  const historyBlock = params.chatHistoryContext && params.chatHistoryContext.trim().length > 0
    ? `# 直近のチャット履歴 (このセッションでの過去のやり取り、参考用)
${params.chatHistoryContext}

`
    : ''
  return `${historyBlock}# 現在のレポート要件 (参考、変更しない)
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

# 📊 データソース能力一覧 (refused 判定はこの全体で判定すること)
${buildDataSourceCapabilitiesForPrompt()}

# 📋 query_metric (DB集計) で取れる指標一覧 (代替提案用)
${buildDbMetricsForRevisePrompt()}

# ❌ 明示的に「取得不可」な指標 (これを追加する指示が来た時だけ refused=true)
${buildUnavailableMetricsForRevisePrompt()}

上記の出力フォーマットに従って JSON のみを返してください。`
}

/**
 * Gemini レスポンスから JSON 部分を堅牢に抽出する。
 * jsonMode を使っていても、Gemini は時々:
 *   - \`\`\`json ... \`\`\` でラップして返す
 *   - 文字列値 (skeleton_markdown 等) の中で生改行を出してしまう
 *   - 末尾カンマを残す
 * これらを段階的に救う。
 */
function parseEditResponse(text: string): {
  updated_skeleton: string
  fields_updated: string[]
  summary: string
  refused: boolean
  updated_data_sources: string[] | null
  updated_metric_keys: string[] | null
  updated_outline: string | null
  updated_goal: string | null
  updated_title: string | null
} {
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini レスポンスが空でした')
  }

  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
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

  // 4. 文字列内の生改行を \n にエスケープして parse
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
  return validateShape(parsed)
}

/**
 * Gemini が返した「JSON のつもり」だが構造が壊れているテキストを救う。
 * 文字列リテラル内 (= 値の "" の中) のみを対象に、生改行を \n にエスケープする。
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
      if (ch === '\r') continue
      if (ch === '\t') {
        out += '\\t'
        continue
      }
    }
    out += ch
  }
  return out
}

function validateShape(obj: unknown): {
  updated_skeleton: string
  fields_updated: string[]
  summary: string
  refused: boolean
  updated_data_sources: string[] | null
  updated_metric_keys: string[] | null
  updated_outline: string | null
  updated_goal: string | null
  updated_title: string | null
} {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Gemini レスポンスが object ではありません')
  }
  const o = obj as Record<string, unknown>
  const refused = o.refused === true
  const skeleton =
    typeof o.updated_skeleton === 'string'
      ? o.updated_skeleton
      : typeof o.skeleton_markdown === 'string'
        ? o.skeleton_markdown
        : null
  if (!refused) {
    if (skeleton === null || skeleton.length < 10) {
      throw new Error('updated_skeleton フィールドが見つからないか短すぎます')
    }
  }
  const summary =
    typeof o.summary === 'string' && o.summary.length > 0
      ? o.summary
      : (refused
          ? '取得不可な指標が含まれていたため、ドラフトを更新しませんでした'
          : 'ドラフトを更新しました')
  const fields =
    Array.isArray(o.fields_updated) && o.fields_updated.every((x) => typeof x === 'string')
      ? (o.fields_updated as string[])
      : ['skeleton_markdown']

  const arrOrNull = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null
    const arr = v.filter((x): x is string => typeof x === 'string' && x.length > 0)
    return arr // 空配列も意味がある (= 全削除) ため null とは区別
  }
  const strOrNull = (v: unknown): string | null => {
    if (typeof v !== 'string') return null
    const trimmed = v.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return {
    updated_skeleton: skeleton ?? '',
    fields_updated: fields,
    summary,
    refused,
    updated_data_sources: arrOrNull(o.updated_data_sources),
    updated_metric_keys: arrOrNull(o.updated_metric_keys),
    updated_outline: strOrNull(o.updated_outline),
    updated_goal: strOrNull(o.updated_goal),
    updated_title: strOrNull(o.updated_title),
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
    refused: parsed.refused,
    updatedDataSources: parsed.updated_data_sources,
    updatedMetricKeys: parsed.updated_metric_keys,
    updatedOutline: parsed.updated_outline,
    updatedGoal: parsed.updated_goal,
    updatedTitle: parsed.updated_title,
    metrics: {
      elapsedMs: result.tookMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    },
  }
}