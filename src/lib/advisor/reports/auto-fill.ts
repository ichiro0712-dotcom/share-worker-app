/**
 * レポートの「空き穴」を Claude Tool Use で自動補完する (Phase 1)
 *
 * 設計方針 (2026-05-07 リライト):
 *  - Anthropic (Claude) を「整形係 + クエリ判断係」として使う
 *  - 既存の query_metric ツールをそのまま渡す → ユーザーがチャットで使うときと同じ動き
 *  - JSON 出力強制やブロック区切り命令は使わない (Claude は普通の Markdown 表で返す)
 *  - 戻り値に表が見つかれば置換、見つからなければスキップ
 *
 * シンプルさ優先で 1 ブロック = 1 セッションで完結 (グループ化はしない)。
 */

import { findTool, executeToolByName } from '../tools/registry'
import { getClaudeClient, ADVISOR_MODELS } from '../claude'
import { METRIC_CATALOG } from '../tools/tastas-data/metrics-catalog'
import type { GapBlock, GapGroup } from './gap-detector'

/** auto-fill 用に METRIC_CATALOG から available な指標一覧を動的生成する */
function buildAvailableMetricsList(): string {
  return METRIC_CATALOG.filter((m) => m.available)
    .map((m) => `- \`${m.key}\` (${m.label}, 単位: ${m.unit}): ${m.description}`)
    .join('\n')
}
function buildUnavailableMetricsList(): string {
  const lines = METRIC_CATALOG.filter((m) => !m.available).map(
    (m) => `- \`${m.key}\` (${m.label}): ${m.reason ?? '現在取得不可'}`
  )
  return lines.length > 0 ? lines.join('\n') : '(なし)'
}

export interface AutoFillContext {
  adminId: number
  sessionId: string
  rangeStart: string | null
  rangeEnd: string | null
  originalRequest: string | null
  /**
   * このセッションで作られた表 (advisor_chat_tables) の一覧。
   * auto-fill が `get_table` ツールで再参照できるよう、user prompt に埋め込む。
   * 「T-060 の数値で表を埋めて」のような指示が Sonnet 経由で draft に着いていても、
   * auto-fill には届かないので、ID + 概要を構造的に渡してやる必要がある。
   */
  availableTables?: Array<{ tableId: string; purpose: string; rowCount: number }>
  /** 全体タイムアウト (ms)、デフォルト 60000 */
  totalTimeoutMs?: number
  /** 1 ブロックあたりのタイムアウト (ms)、デフォルト 30000 */
  blockTimeoutMs?: number
}

export interface AutoFillResult {
  filledMarkdown: string
  attempts: Array<{
    chapterTitle: string | null
    blockCount: number
    ok: boolean
    error?: string
    tookMs: number
    inputTokens?: number
    outputTokens?: number
    toolCalls?: Array<{ name: string; argsJson: string }>
  }>
  anySuccess: boolean
  totalMs: number
}

interface FillOneResult {
  filledText: string | null
  inputTokens: number
  outputTokens: number
  toolCalls: Array<{ name: string; argsJson: string }>
  error?: string
}

const DEFAULT_MODEL = ADVISOR_MODELS.haiku // Haiku 4.5 で十分。表整形は単純タスク。
const MAX_TOOL_LOOPS = 8

function buildSystemPrompt(): string {
  return `あなたは TASTAS のレポートデータアナリストです。

ユーザーは「全セルが "-" の Markdown 表」または「一部の列だけ空の表」を渡してきます。
あなたの仕事は適切なツールで実データを取得し、表を埋めて返すことだけです。

## 使えるツール (この 4 つだけ)

| ツール | 取れるもの | 主な使いどころ |
|---|---|---|
| \`query_metric\` | TASTAS 本番 DB の事前定義メトリクス | LP_PV / 登録数 / 求人 PV など (下記カタログから選ぶ) |
| \`query_ga4\` | GA4 アクセス解析 | サイト全体PV / 流入経路 / ページ別アクセス / LP別パフォーマンス |
| \`query_search_console\` | Search Console | 検索キーワード / 順位 / CTR |
| \`get_table\` | 過去にチャットで作った表 (T-XXX) | ユーザーが直前のチャットで作った表データを引用 |

### 自前 SQL は使えない (重要)
auto-fill では execute_sql は使えない。
カタログに無いフィルタ条件付き集計 (例: 「直接登録のみ」「LP A だけ」) を要求された場合は、
**新規 SQL を試みず、必要な表 (T-XXX) がセッションに無いことを表下の ※ 1 行で報告して元表は "-" のまま残す**。
(ユーザーは「通常チャットで T-XXX を作ってから再生成する」という別フローで対応する)

### 取得先の選び方 (重要)
表のヘッダや章タイトルからどのソースを当てるか判断する:
- 「LP別PV」「LP_PV」「日別PV」「登録数」「求人PV」→ **query_metric** を優先
- 「流入経路」「流入元」「ページ別アクセス」「サイト全体PV」(GA4 計測)→ **query_ga4**
- 「検索クエリ」「検索キーワード」「順位」「CTR」→ **query_search_console**
- 章本文に「T-XXX」が登場→ **get_table** で取得
- **章タイトル / 元表の構造が user prompt の「## このセッションで利用可能な表」一覧と合致する → 必ず get_table を最初に試す**
  (例: 「週別 UU × 登録経過日数」のような特殊なクロス集計は、query_metric / query_ga4 では取れないが既存 T-XXX 表として作られている場合がある。
   その場合は再集計を試みず、まず get_table を呼んで rows/columns をそのまま使う)

### 表ヘッダのよくある列名と対応 metric (重要)
- 「LINE登録クリック数 / LINE誘導クリック数 / LINEクリック数」→ \`LP_TO_LINE_CONV\`
- 「LINE登録クリック率 / LINEクリック率」→ LP_TO_LINE_CONV / LP_PV を計算
- 「**新規登録クリック数** / 登録ボタンクリック数 / cta_register クリック数」→ \`LP_TO_REGISTER_CONV\`
  (LINE 経由ではなく直接登録ボタンを押した数。LP_TO_LINE_CONV と別の列)
- 「**新規登録クリック率**」→ LP_TO_REGISTER_CONV / LP_PV を計算
- 「登録者数」→ \`LP_REGISTRATIONS\`
- 「PV」→ \`LP_PV\`
- 「応募数」「応募件数」(LP帰属) → \`LP_APPLICATION_COUNT\` (LP帰属、全体は \`NEW_APPLICATIONS\`)
- 「応募率」「CVR」 → \`APPLICATION_CONVERSION_RATE\` (求人詳細閲覧 UU 比) または \`OVERALL_CONVERSION_RATE\` (登録 UU 比)
- 「求人詳細PV」「求人PV」 → \`JOB_DETAIL_PV\` / 「閲覧UU」 → \`JOB_DETAIL_USERS\`
- 「平均応募日数」 → \`AVG_APPLICATION_DAYS\` (= ワーカー1人あたり応募件数)
- 「親求人」「親求人数」 → \`PARENT_JOB_COUNT\` / 「子求人」 → \`CHILD_JOB_COUNT\`
- 「マッチング数」 → \`MATCHING_COUNT\` / 「マッチング期間 (時間)」 → \`AVG_MATCHING_HOURS\`
- 「出勤確認率」 → \`ATTENDANCE_CHECK_RATE\` / 「勤務完了率」 → \`ATTENDANCE_COMPLETION_RATE\`
- 「リピート率」「リピートワーカー率」 → \`REPEAT_WORKER_RATE\`
- 「実績時給平均」 → \`AVG_ATTENDANCE_HOURLY_WAGE\`
- 「離脱率」 → \`WORKER_DROPOUT_RATE\` (応募ゼロワーカーの割合)
- 「平均応答時間」(メッセージ) → \`MESSAGE_RESPONSE_TIME_AVG\`
- 「平均滞在時間」(LP) → \`LP_AVG_DWELL_TIME\`
- 「施設評価分布」「評価分布」 → \`FACILITY_RATING_DISTRIBUTION\` (rows = 1〜5点別件数)
- 「ワーカー評価分布」 → \`WORKER_RATING_DISTRIBUTION\` (rows = 1〜5点別件数)

### 1つで失敗したら別ツールを試す (フォールバック)
- query_metric で取れなかった指標が GA4 系で取れることがある (例: ページ別 PV は query_ga4(pages))
- query_ga4 が空応答なら query_metric の近い指標で代替
- 1 ツールが連続で失敗しても**諦めず、別ツールで 1〜2 回試す**

## query_metric の正しい使い方

### 利用可能な metric_key (この一覧の文字列のみ受け付ける、推測禁止)

${buildAvailableMetricsList()}

### 取得できない指標 (これらは指定しても 0 件 / エラーが返るので無駄)

${buildUnavailableMetricsList()}

❌ "pv" / "page_view" / "page_views" / "sessions" / "line_click" / "line_cta_click" / "line_registration" / "registered" / "APPLICATION_CLICKS" (← 末尾 S 付きは存在しない、正しくは APPLICATION_CLICK) / "JOB_DETAIL_PV" などの**短縮形・推測形は存在しない**。必ず上記の正式 key を使う。一覧に無い key を試すと「不明な metric_key」エラーが返るだけで時間の無駄。

### filter.lp_id について
filter.lp_id は LandingPage テーブルの数字文字列 (例: "5") を指定する。
LP5 のような特定 LP のクロス集計が必要な場合の手順:
  1. group_by="lp_id" を指定して query_metric を 1 回呼ぶ
  2. rows[].label から「LP 5」を含む key (= "5" のような数字文字列) を見つける
  3. その key を filter.lp_id に入れ、group_by="campaign_code" で再集計

## query_ga4 の使い方の要点
- report_type を必ず指定: \`overview\` / \`traffic\` / \`pages\` / \`lpPerformance\` / \`comparison\` / \`pageTraffic\`
- LP 別の PV / 流入経路を見るなら \`lpPerformance\` または \`pageTraffic(page_path_prefix="/lp/<id>")\`
- start_date / end_date は context で渡される対象期間を使う

## ルール (厳守)

1. metric_key は上記の正式リストから選ぶ (推測した key を試さない)
2. **列構成 (列名・列順) は元と一致させる** (列の追加・削除・並び替え禁止)
3. **行数は実データに合わせて自由に増減してよい**:
   - 元の表が「5 行 + 合計行」でも、実データが 13 行なら 13 行 + 合計行で返す
   - 元の表が「3 行」でも、実データが 1 行しかないなら 1 行で返す
   - 元の表のプレースホルダ行数は仮置きであって、実データに合わせて埋めるべき
4. **「合計」「Total」行が元の表にあれば必ず維持**し、表の最後に置く (本文行を全部足した値)
5. **並び順**: 主要指標 (例: PV) の降順を基本にする
6. **取れたデータは「0」も含めて必ず数値として反映する** (重要):
   - query_metric が \`total=0\` / \`rows=[]\` を返した = ツール実行は成功し「期間内に該当データが 0 件」と確定した、という意味
   - この場合は **そのセルに「0」と書く** ("-" にしない)
   - 例: \`LP_TO_REGISTER_CONV\` で \`total=0\` が返ったら、新規登録クリック数の各セルは「0」、合計も「0」と書く
   - 0 は「LP にそのボタンが無い / 期間内に押されなかった」という有用な事実であって、欠損ではない
7. **"-" を残してよいのは「ツール実行自体が失敗した / その指標を計測するデータソースが存在しない」場合のみ**:
   - 例: query_metric が \`{ ok: false, error: "..." }\` を返した
   - 例: 表ヘッダの列に対応する metric_key が catalog に無い
   - この場合のみ、そのセルは "-" のまま残す + 表直下に ※ 1 行で「○○は現在計測していません」と注釈
8. **元の表の "-" を「固定値」として尊重しない**:
   - 元の表に "-" が入っているセルでも、再取得して数値 (0 含む) が取れたら必ず上書きする
   - 元表は単なるプレースホルダで、実データの方が常に優先
   - 例: 元表で 5/15 が "-" でも、LP_PV を取って 17 が返れば「17」と書く
9. **ツール呼び出しが続けて失敗してもあきらめない**: 別ツール / 別 key / 別 report_type を試す

## 出力フォーマット (絶対遵守)

- **Markdown 表のみ** を返す。\`|\` で始まり \`|\` で終わる行と、その上下の区切り行 \`|---|---|\` のみ
- 表の直後に注釈が必要なら **1 行だけ** \`* ...\` または \`※ ...\` を添えて良い (最大 2 行まで)
- ❌ 禁止事項:
  - 「以下が埋めた表です」「データを取得しました」のような前置き
  - 「利用可能なメトリクスを教えてください」のような質問返し
  - "## サマリ" "## 考察" のような新しい章見出しの追加
  - 箇条書き ("- xxx" "* xxx") を表とは別に追加すること
  - 説明文・解説・補足コメントの追加 (取れなかった理由は ※ 注釈 1 行のみ)
- 取れたデータが何も無い / 全ツールでエラーが続く場合は、元の表をそのまま返してよい (= 諦めて次へ)`
}

/**
 * Claude Tool Use ループで 1 つの空き穴ブロックを埋める。
 */
async function fillOneBlock(
  block: GapBlock,
  ctx: AutoFillContext
): Promise<FillOneResult> {
  const DEBUG = process.env.ADVISOR_AUTO_FILL_DEBUG === 'true'
  const client = getClaudeClient()

  // 自動補完で渡すツール (= データ取得系のみ。書き込み系は対象外)。
  // execute_sql は 2026-05-18 セッションで一度許可したが、Haiku がテーブル名を
  // 推測ミスして数値が間違って入る危険があるため再度除外。
  // フィルタ条件付き集計 (例: 「直接登録のみ」) が必要な場合は、ユーザーが
  // 通常チャット (Sonnet) で先に T-XXX を作るフローに統一する。
  // auto-fill 側は get_table で既存表を引くだけに留める。
  const ALLOWED_TOOLS = [
    'query_metric',
    'query_ga4',
    'query_search_console',
    'get_table',
  ] as const
  const toolDefs = ALLOWED_TOOLS.map((n) => findTool(n)).filter(
    (t): t is NonNullable<typeof t> => !!t
  )
  if (toolDefs.length === 0) {
    return {
      filledText: null,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [],
      error: 'no allowed tools registered for auto-fill',
    }
  }
  const tools = toolDefs.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
  const allowedNameSet = new Set<string>(ALLOWED_TOOLS)

  const userPrompt = buildUserPrompt(block, ctx)

  type AnthropicMessage = {
    role: 'user' | 'assistant'
    content: string | Array<Record<string, unknown>>
  }
  const messages: AnthropicMessage[] = [{ role: 'user', content: userPrompt }]
  let inputTokens = 0
  let outputTokens = 0
  const toolCalls: Array<{ name: string; argsJson: string }> = []

  if (DEBUG) {
    console.log('[auto-fill:claude] === START block at', block.start, 'kind:', block.kind, 'chapter:', block.chapterTitle)
    console.log('[auto-fill:claude] user prompt:\n', userPrompt)
  }

  // システムプロンプトは METRIC_CATALOG から動的生成する (1 ブロックあたり 1 回)。
  const systemPrompt = buildSystemPrompt()

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools as never,
      messages: messages as never,
    })
    inputTokens += response.usage.input_tokens
    outputTokens += response.usage.output_tokens

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Array<{
      type: 'tool_use'
      id: string
      name: string
      input: unknown
    }>
    const textBlocks = response.content.filter((b) => b.type === 'text') as Array<{
      type: 'text'
      text: string
    }>

    if (response.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
      // assistant のメッセージ (tool_use 含む) をそのまま messages に積む
      messages.push({
        role: 'assistant',
        content: response.content as unknown as Array<Record<string, unknown>>,
      })

      // 各 tool_use を実行して tool_result で返答
      const toolResults: Array<Record<string, unknown>> = []
      for (const tu of toolUseBlocks) {
        const args = (tu.input ?? {}) as Record<string, unknown>
        toolCalls.push({ name: tu.name, argsJson: JSON.stringify(args) })
        if (!allowedNameSet.has(tu.name)) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            is_error: true,
            content: `tool ${tu.name} is not allowed in auto-fill (allowed: ${ALLOWED_TOOLS.join(', ')})`,
          })
          continue
        }
        try {
          const result = await executeToolByName(tu.name, args, {
            adminId: ctx.adminId,
            sessionId: ctx.sessionId,
          })
          if (DEBUG) {
            console.log(`[auto-fill:claude] tool ${tu.name} args=`, JSON.stringify(args))
            console.log(
              `[auto-fill:claude] tool ${tu.name} result.ok=${result.ok}:`,
              JSON.stringify(result.ok ? result.data : result.error).slice(0, 500)
            )
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            is_error: !result.ok,
            content: JSON.stringify(result.ok ? result.data : { error: result.error }),
          })
        } catch (e) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            is_error: true,
            content: e instanceof Error ? e.message : String(e),
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // 通常応答 (= 最終回答)
    const finalText = textBlocks.map((b) => b.text).join('').trim()
    if (DEBUG) {
      console.log('[auto-fill:claude] final text (first 800):\n', finalText.slice(0, 800))
    }
    if (finalText.length > 0) {
      return { filledText: finalText, inputTokens, outputTokens, toolCalls }
    }

    // 空応答が来たケース: 既にツール呼び出しが走っているなら、結果を踏まえて
    // 「Markdown 表だけ返してくれ」と明示的に頼んで 1 ループ追加。
    // ツール呼び出しがまだ無いケースは打ち切り。
    if (toolCalls.length > 0 && loop < MAX_TOOL_LOOPS - 1) {
      if (DEBUG) console.log('[auto-fill:claude] empty response, retry with explicit table request')
      messages.push({
        role: 'user',
        content:
          '上記のツール結果を踏まえて、元の表を埋めた Markdown 表だけを返してください。' +
          'これ以上ツールは呼ばないでください。前置きや説明は不要、表 (| ... |) と直後の ※ 注釈 1 行だけで OK です。',
      })
      continue
    }

    return {
      filledText: null,
      inputTokens,
      outputTokens,
      toolCalls,
      error: 'Claude が空応答を返しました',
    }
  }

  return {
    filledText: null,
    inputTokens,
    outputTokens,
    toolCalls,
    error: `tool use loop が ${MAX_TOOL_LOOPS} 回上限に達しました`,
  }
}

function buildUserPrompt(block: GapBlock, ctx: AutoFillContext): string {
  const lines: string[] = []
  lines.push('以下の Markdown ブロックを query_metric ツールで実データを取って埋め直し、Markdown だけ返してください。')
  lines.push('')

  // 今日の JST 日付を常にヒントとして渡す。
  // ドラフトに range_start/range_end が無いケースで、Claude が知識カットオフの古い年
  // (例: 2024 年) を埋めて空応答になる事故を防ぐ。
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayIso = nowJst.toISOString().split('T')[0]
  lines.push(`## 現在の JST 日付 (重要)\n${todayIso}`)
  lines.push(
    '※ start_date / end_date は必ずこの「現在日付」と整合する年月で指定すること。' +
      '推測や知識カットオフ年は使わない (例: "2024-05-01" のような古い年で query すると 0 件になる)。'
  )

  if (block.chapterTitle) lines.push(`## 章タイトル\n${block.chapterTitle}`)
  if (ctx.rangeStart && ctx.rangeEnd) {
    lines.push(`## 集計期間 (このまま start_date / end_date に使うこと)\n${ctx.rangeStart} 〜 ${ctx.rangeEnd}`)
  } else {
    // range が無いときは「埋めたいブロック」内の日付セルから期間を推定する指示を出す。
    lines.push(
      '## 集計期間\n' +
        '集計期間は明示指定されていません。下の「埋めたいブロック」のヘッダや日付セルから期間を推定し、' +
        '**現在の JST 日付と整合する年月** で start_date / end_date を組み立ててください。' +
        '例: 表に "5/1" 〜 "5/16" の行があり、現在が 2026-05-17 なら start_date="2026-05-01", end_date="2026-05-16" を使う。'
    )
  }
  if (ctx.originalRequest) {
    lines.push(`## ユーザーの当初の要望\n${ctx.originalRequest}`)
  }

  // セッション内の既存表 (advisor_chat_tables)。
  // Sonnet がドラフトに「T-060 の数値で埋めて」と書いていても、その情報が
  // auto-fill には届かない (originalRequest は最初のユーザー発言だけ) ため、
  // セッションで作られた表を構造的に渡して get_table 呼び出しを後押しする。
  if (ctx.availableTables && ctx.availableTables.length > 0) {
    lines.push('')
    lines.push('## このセッションで利用可能な表 (get_table ツールで取得可能)')
    for (const t of ctx.availableTables) {
      const purpose = t.purpose ? ` — ${t.purpose}` : ''
      lines.push(`- ${t.tableId} (${t.rowCount} 行)${purpose}`)
    }
    lines.push(
      '※ 「埋めたいブロック」のヘッダや章タイトルに既存表の概要と合致するものがあれば、' +
        '`get_table({ table_ids: ["T-XXX"] })` で取得して、その rows/columns を直接使うこと。' +
        'query_metric / query_ga4 で同じデータを再集計しようとしないこと。'
    )
  }

  lines.push('')
  lines.push('## 埋めたいブロック (kind: ' + block.kind + ')')
  lines.push('```markdown')
  lines.push(block.rawText.trimEnd())
  lines.push('```')
  lines.push('')
  lines.push('期待する応答: 埋めた Markdown ブロックの本文のみ (コードフェンス不要、前置き不要)。')
  lines.push(
    '※ ツール呼び出しが 0 件を返したら、年を変えるのではなく、まずは別 metric_key / 別ツール (query_ga4 / get_table) を試すこと。' +
      '年を勝手に変更すると意図しない期間のデータになるため、上記「現在の JST 日付」と整合する年だけを使う。'
  )
  return lines.join('\n')
}

/**
 * Claude が返してきた最終応答テキストから「Markdown 表」だけを抽出する (2026-05-07 厳格化)。
 *
 * 戦略:
 *  - コードフェンスがあれば中身を取り出す
 *  - 中身から最初の "|...|" 行 (= 表のヘッダ行) を見つけて、そこから連続する "|...|" 行 + 注釈行 (* or ※) のみを返す
 *  - 表が見つからない / 不完全 (区切り行欠落) なら null を返す → 呼び出し側で「失敗」扱いにする
 *
 * ※「以下が埋めた表です:」「query_metric の利用可能なメトリクスを教えてください」のような
 *   メタ文 / ユーザーへの質問返しを混ぜさせないため、表以外の行は完全に捨てる。
 */
export function extractTableFromResponse(text: string): string | null {
  let stripped = text.trim()
  // コードフェンスを剥がす
  const fenceMatch = stripped.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/i)
  if (fenceMatch) stripped = fenceMatch[1].trim()

  const lines = stripped.split('\n')

  // 最初の "|...|" 行を探す (= 表のヘッダ候補)
  const headerIdx = lines.findIndex(
    (l) => l.trim().startsWith('|') && l.trim().endsWith('|')
  )
  if (headerIdx === -1) return null

  // 区切り行が headerIdx+1 にあるか? (Markdown 表の必須要素)
  const sepLine = lines[headerIdx + 1]?.trim() ?? ''
  const isSeparator =
    sepLine.startsWith('|') &&
    sepLine.endsWith('|') &&
    sepLine.slice(1, -1).split('|').every((c) => /^:?-+:?$/.test(c.trim()))
  if (!isSeparator) return null

  // 表本体を集める
  const tableLines: string[] = [lines[headerIdx], lines[headerIdx + 1]]
  let endIdx = headerIdx + 2
  while (
    endIdx < lines.length &&
    lines[endIdx].trim().startsWith('|') &&
    lines[endIdx].trim().endsWith('|')
  ) {
    tableLines.push(lines[endIdx])
    endIdx++
  }

  // 表直後の注釈行 (* 集計期間: ... / ※ 〇〇は取得できませんでした) を 1〜数行だけ取り込む。
  // ただし長文や箇条書き (- や ## 見出し) は含めない (元の文脈を破壊するため)。
  while (endIdx < lines.length) {
    const t = lines[endIdx].trim()
    if (t === '') {
      endIdx++
      break
    }
    if (t.startsWith('*') || t.startsWith('※')) {
      tableLines.push(lines[endIdx])
      endIdx++
      continue
    }
    break
  }

  return tableLines.join('\n').trim()
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/**
 * メインエントリ: レポート Markdown 中の空き穴を Claude Tool Use で自動補完する。
 * シンプル方針: 1 ブロック = 1 Claude セッションで完結 (グループ化はしない)。
 * 並列で実行することでスループットを稼ぐ。
 */
export async function autoFillReportGaps(
  markdown: string,
  groups: GapGroup[],
  ctx: AutoFillContext
): Promise<AutoFillResult> {
  const start = Date.now()
  const blockTimeoutMs = ctx.blockTimeoutMs ?? 30_000

  // groups から block を全部取り出して並列実行
  const allBlocks = groups.flatMap((g) => g.blocks)
  if (allBlocks.length === 0) {
    return { filledMarkdown: markdown, attempts: [], anySuccess: false, totalMs: 0 }
  }

  const blockResults = await Promise.all(
    allBlocks.map(async (block) => {
      const blockStart = Date.now()
      try {
        const r = await withTimeout(
          fillOneBlock(block, ctx),
          blockTimeoutMs,
          `auto-fill block (${block.kind})`
        )
        return { block, ...r, tookMs: Date.now() - blockStart }
      } catch (e) {
        return {
          block,
          filledText: null as string | null,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: [] as Array<{ name: string; argsJson: string }>,
          error: e instanceof Error ? e.message : String(e),
          tookMs: Date.now() - blockStart,
        }
      }
    })
  )

  // 後ろから順に Markdown に差し込む (offset がずれないように)
  let filledMarkdown = markdown
  const attempts: AutoFillResult['attempts'] = []
  let anySuccess = false

  const sortedResults = blockResults
    .map((r) => ({
      ...r,
      extracted: r.filledText ? extractTableFromResponse(r.filledText) : null,
    }))
    .sort((a, b) => b.block.start - a.block.start)

  for (const r of sortedResults) {
    const ok =
      r.extracted != null &&
      r.extracted.length > 0 &&
      r.extracted.trim() !== r.block.rawText.trim()

    if (ok && r.extracted) {
      const fill = r.extracted
      filledMarkdown =
        filledMarkdown.slice(0, r.block.start) +
        fill +
        (fill.endsWith('\n') ? '' : '\n') +
        filledMarkdown.slice(r.block.end)
      anySuccess = true
    }

    attempts.push({
      chapterTitle: r.block.chapterTitle,
      blockCount: 1,
      ok,
      tookMs: r.tookMs,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      toolCalls: r.toolCalls,
      ...(ok
        ? {}
        : {
            error: r.error ?? '埋めた内容が元と同一だったためスキップ',
          }),
    })
  }

  return {
    filledMarkdown,
    attempts,
    anySuccess,
    totalMs: Date.now() - start,
  }
}
