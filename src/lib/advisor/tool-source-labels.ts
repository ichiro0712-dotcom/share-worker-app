/**
 * Advisor ツール名 → ユーザー向けデータソース表示名 / カテゴリ。
 * 回答末尾の「参照したデータソース」セクションを描画するために使う。
 *
 * 新規ツールを追加したら、必ずここにもエントリを追加すること。
 * 未登録ツールは `その他` カテゴリでツール名のまま表示される。
 */

export type AdvisorSourceCategory =
  | 'tastas-db'
  | 'codebase'
  | 'github'
  | 'docs'
  | 'vercel'
  | 'supabase'
  | 'ga4'
  | 'search-console'
  | 'line'
  | 'lstep'
  | 'other'

export interface ToolSourceLabel {
  /** UI 表示名 (例: "本番DB (求人テーブル)") */
  label: string
  /** カテゴリ (グルーピング・色分け用) */
  category: AdvisorSourceCategory
}

/**
 * ツール名 → 表示名 / カテゴリ。
 * registry.ts のツールと 1:1 対応。
 */
export const TOOL_SOURCE_LABELS: Record<string, ToolSourceLabel> = {
  // core (リポジトリ / コード / ドキュメント)
  read_repo_file: { label: 'リポジトリ内ソースコード', category: 'codebase' },
  search_codebase: { label: 'コードベース全文検索', category: 'codebase' },
  list_directory: { label: 'リポジトリ ディレクトリ', category: 'codebase' },
  read_doc: { label: '社内ドキュメント (docs/)', category: 'docs' },
  get_recent_commits: { label: 'GitHub コミット履歴', category: 'github' },

  // tastas-data (本番 DB / 指標カタログ)
  describe_db_table: { label: 'DB スキーマ定義 (Prisma)', category: 'tastas-db' },
  query_metric: { label: '本番 DB (指標集計)', category: 'tastas-db' },
  list_available_metrics: { label: '指標カタログ', category: 'tastas-db' },
  get_jobs_summary: { label: '本番 DB (求人サマリ)', category: 'tastas-db' },
  get_users_summary: { label: '本番 DB (ユーザーサマリ)', category: 'tastas-db' },
  get_recent_errors: { label: '本番 DB (エラーログ)', category: 'tastas-db' },

  // external
  get_vercel_deployments: { label: 'Vercel デプロイ履歴', category: 'vercel' },
  get_vercel_logs: { label: 'Vercel ランタイムログ', category: 'vercel' },
  get_supabase_logs: { label: 'Supabase ログ (Management API)', category: 'supabase' },
  query_ga4: { label: 'Google Analytics 4 (Data API)', category: 'ga4' },

  // future (現状はモック / 未接続)
  query_search_console: { label: 'Google Search Console', category: 'search-console' },
  query_line_friends: { label: 'LINE 公式アカウント連携', category: 'line' },
  query_lstep_events: { label: 'Lstep イベントログ', category: 'lstep' },

  // reports (レポートドラフト操作)
  update_report_draft: { label: 'レポートドラフト更新 (Canvas)', category: 'other' },
  edit_report_section: { label: 'レポート部分修正 (Gemini)', category: 'other' },
  add_tables_to_report: { label: '表をレポートに追加', category: 'other' },

  // tastas-data 追加 (任意SQL)
  execute_sql: { label: '任意 SQL 実行 (本番DB)', category: 'tastas-db' },
}

/**
 * カテゴリ → 表示用バッジテキスト (回答下部のチップに使う)。
 */
export const CATEGORY_BADGE: Record<AdvisorSourceCategory, string> = {
  'tastas-db': '本番DB',
  codebase: 'コード',
  github: 'GitHub',
  docs: 'ドキュメント',
  vercel: 'Vercel',
  supabase: 'Supabase',
  ga4: 'GA4',
  'search-console': 'Search Console',
  line: 'LINE',
  lstep: 'Lstep',
  other: 'その他',
}

export function resolveToolSource(toolName: string): ToolSourceLabel {
  return (
    TOOL_SOURCE_LABELS[toolName] ?? {
      label: toolName,
      category: 'other',
    }
  )
}
