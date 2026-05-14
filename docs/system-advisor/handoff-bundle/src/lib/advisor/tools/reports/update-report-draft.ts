import type { AdvisorTool } from '../types'
import { upsertDraft, getDraftBySession } from '../../persistence/report-drafts'

interface Input {
  title?: string
  goal?: string
  data_sources?: string[]
  metric_keys?: string[]
  range_start?: string
  range_end?: string
  outline?: string
  notes?: string
  /** ドラフト本体 (0 埋めの表骨格 + 章立て Markdown)。表構造を変える指示が来たらここを書き換える */
  skeleton_markdown?: string
}

interface Output {
  ok: true
  draft_id: string
  session_id: string
  fields_updated: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * チャットしながら固めていくレポート要件を、右ペインの Canvas に反映する。
 * 1 セッションに 1 ドラフト。部分更新可能 (送ったフィールドだけ書き換わる)。
 *
 * 使用シーン:
 * - ユーザー「先週のKPIをまとめて」 → title/goal/range_start/range_end をセット
 * - ユーザー「GA4 のデータも入れて」 → data_sources に "query_ga4" を追加
 * - ユーザー「考察も入れて」 → outline に章を追加
 *
 * data_sources のキーは src/lib/advisor/tool-source-labels.ts に定義済みのツール名。
 * (例: "query_metric", "query_ga4", "get_recent_errors", "get_supabase_logs",
 *  "get_vercel_logs", "get_jobs_summary", "get_users_summary")
 */
export const updateReportDraftTool: AdvisorTool<Input, Output> = {
  name: 'update_report_draft',
  category: 'core',
  description:
    '右側の Canvas に表示されるレポートドラフトを更新します。' +
    '\n\nユーザーがレポート作成の要件を話したら、このツールで Canvas に反映してください。' +
    '部分更新が可能 (送ったフィールドだけ書き換わる)。' +
    '\n\nフィールド:' +
    '\n- title: レポートタイトル' +
    '\n- goal: 目的・問い (1-2 文)' +
    '\n- data_sources: 集めるデータソースのキー配列。例: ["query_metric", "query_ga4", "get_recent_errors"]' +
    '\n- metric_keys: data_sources に "query_metric" が含まれる場合の取得対象 metric キー配列。' +
    'システムプロンプトの「利用可能なメトリクス一覧」表から key を選ぶ。例: ["LP_PV", "LP_TO_LINE_CONV"]' +
    '\n- range_start / range_end: 対象期間 (YYYY-MM-DD, JST)' +
    '\n- outline: 章立て (短いラフな見出しのみ。3〜6 行で十分)。' +
    '詳細な箇条書きは「レポート作成」ボタン押下後に Gemini が本文と一緒に詳細化するので、ここでは長く書かない。' +
    '例: "## サマリ\\n## 主要KPI\\n## 流入分析\\n## 次のアクション" のような大枠だけ' +
    '\n- notes: 追加メモ・除外条件・考慮事項 (短く)' +
    '\n- skeleton_markdown: ドラフト本体の Markdown (0 埋めの表骨格 + 章立て)。' +
    '右 Canvas に表示される「レポートの完成イメージ」そのもの。' +
    'ユーザーが「LP5 まで」「会員登録数の表を足して」「考察を 3 つに増やして」のような ' +
    '構造変更を指示してきたら必ずここを書き換える。表の値は 0 / "-" / "(コメント)" 等のプレースホルダ。' +
    '完成させて数字を埋めるのは別工程 (「レポート作成」ボタン)。' +
    '\n\n使用例: ユーザーが「先週のKPI」と言ったら data_sources=["query_metric","query_ga4"], range_start/end=過去7日, outline は大枠 4-5 行のみ、' +
    'skeleton_markdown には「期間別 KPI 表 (今期/前期/差分の 0 埋め)」「LP 別実績表 (LP1〜LP3 の 0 埋め)」のような骨格を入れる。' +
    '\n\n初回呼び出し時はユーザーの初回要望が DB に保存されるので、それも踏まえて構造を決めてよい。' +
    '\n\nこのツールはデータを集める処理ではなく、要件メモ + ドラフト本体の更新だけ。実際の集計は「レポート作成」ボタンで別系統で実行される。',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'レポートタイトル' },
      goal: { type: 'string', description: '目的・問い (1-2 文)' },
      data_sources: {
        type: 'array',
        items: { type: 'string' },
        description:
          '集めるデータソースのキー (ツール名)。例: query_metric, query_ga4, query_search_console, get_recent_errors, get_supabase_logs, get_vercel_logs, get_jobs_summary, get_users_summary',
      },
      metric_keys: {
        type: 'array',
        items: { type: 'string' },
        description:
          'data_sources に "query_metric" が含まれる場合の取得対象 metric キー (例: ["LP_PV", "LP_TO_LINE_CONV"])。システムプロンプトの「利用可能なメトリクス一覧」表から選ぶ',
      },
      range_start: { type: 'string', description: 'YYYY-MM-DD (JST)' },
      range_end: { type: 'string', description: 'YYYY-MM-DD (JST)' },
      outline: {
        type: 'string',
        description:
          'ラフな章立て (3〜6 行の見出しのみ)。詳細化は本文生成時に Gemini が行うのでここでは長く書かない',
      },
      notes: { type: 'string', description: '追加メモ・除外条件 (短く)' },
      skeleton_markdown: {
        type: 'string',
        description:
          'ドラフト本体の Markdown (0 埋めの表骨格 + 章立て)。' +
          'ユーザーが構造変更 (表の行数 / 章追加 / 表追加) を指示したら書き換える。' +
          '値はプレースホルダ (0 / "-" / "(コメント)") とし、数字は埋めない',
      },
    },
  },
  outputDescription: '{ ok, draft_id, session_id, fields_updated: string[] }',
  async execute(input, ctx) {
    if (input.range_start && !DATE_RE.test(input.range_start)) {
      return { ok: false, error: 'range_start は YYYY-MM-DD 形式で指定してください' }
    }
    if (input.range_end && !DATE_RE.test(input.range_end)) {
      return { ok: false, error: 'range_end は YYYY-MM-DD 形式で指定してください' }
    }

    const fieldsUpdated: string[] = []
    if (input.title !== undefined) fieldsUpdated.push('title')
    if (input.goal !== undefined) fieldsUpdated.push('goal')
    if (input.data_sources !== undefined) fieldsUpdated.push('data_sources')
    if (input.metric_keys !== undefined) fieldsUpdated.push('metric_keys')
    if (input.range_start !== undefined) fieldsUpdated.push('range_start')
    if (input.range_end !== undefined) fieldsUpdated.push('range_end')
    if (input.outline !== undefined) fieldsUpdated.push('outline')
    if (input.notes !== undefined) fieldsUpdated.push('notes')
    if (input.skeleton_markdown !== undefined) fieldsUpdated.push('skeleton_markdown')

    if (fieldsUpdated.length === 0) {
      // 空入力は no-op として ok を返す (= ループを終了させる)。
      // 以前は ok:false でエラー扱いにしていたが、Claude が
      // 「失敗 → リトライ」ループに入って 14 連続呼び出しになる事象が発生したため緩和。
      // (max_tokens で JSON が切れて空 input になった時に、Claude が無限リトライしていた)
      const existingDraft = await getDraftBySession(ctx.sessionId)
      return {
        ok: true,
        data: {
          ok: true as const,
          draft_id: existingDraft?.id ?? '',
          session_id: ctx.sessionId,
          fields_updated: [],
        },
        metadata: {
          tookMs: 0,
          // Claude に「無効呼び出し」と気付いてもらうため warning は残す
          warning:
            '更新するフィールドが指定されていません。次のリクエストでは title / goal / skeleton_markdown 等を必ず指定してください。',
        },
      }
    }

    // 既存ドラフトを確認 (まだ無ければ初回作成)。original_request は初回のみ書き込む。
    const existing = await getDraftBySession(ctx.sessionId)
    const isFirstCreation = !existing
    const originalRequestToSave =
      isFirstCreation && ctx.userMessage ? ctx.userMessage : undefined

    const draft = await upsertDraft({
      sessionId: ctx.sessionId,
      adminId: ctx.adminId,
      title: input.title,
      goal: input.goal,
      dataSources: input.data_sources,
      metricKeys: input.metric_keys,
      rangeStart: input.range_start,
      rangeEnd: input.range_end,
      outline: input.outline,
      notes: input.notes,
      skeletonMarkdown: input.skeleton_markdown,
      originalRequest: originalRequestToSave,
    })

    return {
      ok: true,
      data: {
        ok: true as const,
        draft_id: draft.id,
        session_id: draft.sessionId,
        fields_updated: fieldsUpdated,
      },
      metadata: { tookMs: 0 },
    }
  },
}
