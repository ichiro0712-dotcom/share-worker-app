/**
 * Gemini に「全データソースで何が取れるか」を伝えるための定義。
 *
 * METRIC_CATALOG は本番 DB (query_metric) で取れる指標だけを定義しているため、
 * GA4 / Search Console / その他のデータソースで取れるものは別途ここで列挙する。
 *
 * ⚠️ 重要: ここに書かれていないものを Gemini が「取得不可」と過剰判定する事故 (2026-05-03) を
 * 防ぐため、データソースで取り得る代表的な指標例も具体的に書くこと。
 */

export interface DataSourceCapability {
  key: string
  label: string
  /** ユーザーが言いそうな自然言語キーワード (Gemini の判断材料) */
  examples: string[]
  /** Gemini に対する短い能力説明 */
  description: string
}

export const DATA_SOURCE_CAPABILITIES: DataSourceCapability[] = [
  {
    key: 'query_metric',
    label: '本番 DB 指標集計',
    examples: ['LP別PV', 'CV', 'CTR', '応募数', 'LINE誘導クリック数', 'JIDS訪問数'],
    description:
      'TASTAS 本番 DB に直接クエリ。LP 別 / 求人別 / キャンペーン別の指標を JST 集計可能。' +
      'metric_keys を必ず一緒に指定する。METRIC_CATALOG を参照して有効なキーのみ使う。',
  },
  {
    key: 'query_ga4',
    label: 'Google Analytics 4',
    examples: [
      'サイト全体の PV',
      'サイト全体のセッション数',
      'ページ別 PV (URL 別)',
      'デバイス別アクセス',
      '流入元 / 流入経路 (Organic / Direct / Referral)',
      '国・地域別アクセス',
      '滞在時間',
      '直帰率',
      '新規 vs リピーター',
    ],
    description:
      'GA4 のレポート API を叩いてサイト全体のアクセス解析を取得可能。' +
      'LP 単位ではなく **サイト全体や任意ページパス** の数字、流入経路、デバイス分布などはここで取る。',
  },
  {
    key: 'query_search_console',
    label: 'Google Search Console',
    examples: ['検索クエリ別流入', '検索順位', 'CTR (検索結果)', 'インプレッション数'],
    description: 'Google 検索からの流入データ。検索キーワード、検索順位、CTR、表示回数を取得可能。',
  },
  {
    key: 'get_jobs_summary',
    label: '求人サマリ',
    examples: ['求人総数', '掲載中件数', '施設別求人数', '職種別求人数'],
    description: '求人テーブルの現状スナップショット (期間集計ではない、現時点の件数)。',
  },
  {
    key: 'get_users_summary',
    label: 'ユーザーサマリ',
    examples: ['ワーカー総数', '管理者総数', '登録ユーザー数'],
    description: 'ワーカー / 施設管理者 / システム管理者の総数 (期間集計ではない、現時点)。',
  },
  {
    key: 'get_recent_errors',
    label: 'エラーログ',
    examples: ['直近のシステムエラー', 'エラー発生件数'],
    description: '直近のサーバーエラーログ。',
  },
  {
    key: 'get_supabase_logs',
    label: 'Supabase ログ',
    examples: ['Auth ログ', 'Postgres エラー'],
    description: 'Supabase の Auth / Postgres ログ (直近 24h)。',
  },
  {
    key: 'get_vercel_logs',
    label: 'Vercel ログ',
    examples: ['ランタイムログ', '関数ログ'],
    description: 'Vercel のランタイム / 関数ログ。',
  },
  {
    key: 'get_vercel_deployments',
    label: 'Vercel デプロイ履歴',
    examples: ['直近のデプロイ', 'デプロイ成功/失敗', 'リリース時刻'],
    description: 'Vercel の直近デプロイ履歴 (本番 / プレビュー)。',
  },
  {
    key: 'get_recent_commits',
    label: 'GitHub コミット履歴',
    examples: ['最近のコミット', 'デプロイ履歴に近い変更'],
    description: '直近の GitHub コミット履歴。',
  },
]

/** Gemini に提示する「全能力サマリ」(Markdown 文字列) */
export function buildDataSourceCapabilitiesForPrompt(): string {
  const lines: string[] = []
  for (const ds of DATA_SOURCE_CAPABILITIES) {
    lines.push(`### \`${ds.key}\` — ${ds.label}`)
    lines.push(ds.description)
    lines.push(`**取得可能例**: ${ds.examples.join(' / ')}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
