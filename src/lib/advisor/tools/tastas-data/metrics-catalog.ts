/**
 * Advisor で query_metric から呼べる指標の事前定義カタログ
 *
 * MetricDefinitions.tsx と同期するのが理想だが、UI 用と SQL 用は構造が異なるため、
 * SQL 実行可能な指標のみここで定義する。
 *
 * 新しい指標を追加する場合:
 * 1. METRIC_CATALOG に新しいエントリを追加
 * 2. queryMetricImpl にケースを追加
 * 3. MetricDefinitions.tsx にも UI 用定義を追加
 */

export type MetricGroupBy = 'none' | 'day' | 'lp_id' | 'campaign_code';

export interface MetricCatalogEntry {
  key: string;
  label: string;
  description: string;
  unit: string;
  /** 取得可能か (false の場合は reason / planned が必要) */
  available: boolean;
  reason?: string;
  plannedFrom?: string;
  /** 計算ロジックの説明 (LLM 向け) */
  calculation: string;
  /** 対応する group_by の種別 */
  supportedGroupBy: MetricGroupBy[];
}

export const METRIC_CATALOG: MetricCatalogEntry[] = [
  {
    key: 'TOTAL_WORKERS',
    label: '登録ワーカー数',
    description: '現在登録されているワーカーの総数 (退会者除外)',
    unit: '人',
    available: true,
    calculation: 'User テーブルで deleted_at IS NULL のレコード数',
    supportedGroupBy: ['none'],
  },
  {
    key: 'NEW_WORKERS',
    label: '入会ワーカー数',
    description: '期間内に新規登録したワーカー数',
    unit: '人',
    available: true,
    calculation: 'User の created_at が指定期間内のレコード数',
    supportedGroupBy: ['none', 'day'],
  },
  {
    key: 'TOTAL_FACILITIES',
    label: '登録施設数',
    description: '現在登録されている施設の総数 (退会除外)',
    unit: '件',
    available: true,
    calculation: 'Facility テーブルで deleted_at IS NULL のレコード数',
    supportedGroupBy: ['none'],
  },
  {
    key: 'TOTAL_JOBS',
    label: '求人総数',
    description: 'Job テーブルの全件数',
    unit: '件',
    available: true,
    calculation: 'Job テーブル全件',
    supportedGroupBy: ['none'],
  },
  {
    key: 'ACTIVE_JOBS',
    label: 'アクティブ求人数',
    description: '現在公開中の求人数',
    unit: '件',
    available: true,
    calculation: 'Job.status = "active" のレコード数',
    supportedGroupBy: ['none'],
  },
  {
    key: 'NEW_APPLICATIONS',
    label: '応募数',
    description: '期間内の応募件数',
    unit: '件',
    available: true,
    calculation: 'Application の created_at が指定期間内のレコード数',
    supportedGroupBy: ['none', 'day'],
  },
  {
    key: 'LP_PV',
    label: 'LP閲覧数',
    description: 'LP のページビュー数 (期間内)',
    unit: 'PV',
    available: true,
    calculation: 'LpPageView の created_at が指定期間内のレコード数',
    supportedGroupBy: ['none', 'day', 'lp_id', 'campaign_code'],
  },
  {
    key: 'LP_REGISTRATIONS',
    label: 'LP経由の登録数',
    description: '期間内の LP 経由のワーカー登録数',
    unit: '人',
    available: true,
    calculation: 'User の registration_lp_id が NOT NULL かつ created_at が指定期間内',
    supportedGroupBy: ['none', 'day', 'lp_id', 'campaign_code'],
  },
  {
    key: 'PUBLIC_JOB_PV',
    label: '公開求人詳細PV',
    description: '未ログイン状態での求人詳細閲覧数',
    unit: 'PV',
    available: true,
    calculation: 'PublicJobPageView の created_at が指定期間内',
    supportedGroupBy: ['none', 'day'],
  },
  {
    key: 'JOB_SEARCH_PV',
    label: 'ワーカーTOP訪問数',
    description: 'ログイン後のワーカーTOPページ閲覧数',
    unit: 'PV',
    available: true,
    calculation: 'JobSearchPageView の created_at が指定期間内',
    supportedGroupBy: ['none', 'day'],
  },
  {
    key: 'APPLICATION_CLICK',
    label: '応募クリック数',
    description: '求人詳細での応募ボタンクリック数 (ログイン後)',
    unit: '件',
    available: true,
    calculation: 'ApplicationClickEvent の created_at が指定期間内',
    supportedGroupBy: ['none', 'day'],
  },
  // ── 取得不可 (将来実装) ──
  {
    key: 'LINE_FRIEND_ADDS',
    label: 'LINE友だち追加数',
    description: 'LINE 公式アカウントへの友だち追加数',
    unit: '人',
    available: false,
    reason: 'LINE Webhook (/api/line/webhook) が未実装のため取得できません',
    plannedFrom: 'Phase 1: LINE Messaging API 連携の実装後',
    calculation: '(未実装) LineFriendEvent テーブル予定',
    supportedGroupBy: ['none', 'day', 'lp_id'],
  },
  {
    key: 'SEARCH_QUERY_ENTRIES',
    label: '検索クエリ別流入',
    description: 'Google 検索からの検索クエリ別流入数',
    unit: '回',
    available: false,
    reason: 'Google Search Console API が未統合のため取得できません',
    plannedFrom: 'Phase 2: GSC API 統合の実装後',
    calculation: '(未実装) GSC API 経由',
    supportedGroupBy: ['none'],
  },
  {
    key: 'LSTEP_DELIVERIES',
    label: 'Lstep 配信数',
    description: 'Lステップから送信された配信メッセージ数',
    unit: '通',
    available: false,
    reason: 'Lstep webhook 連携が未実装のため取得できません',
    plannedFrom: 'Lstep webhook 受信機能の実装後',
    calculation: '(未実装) LstepEvent テーブル予定',
    supportedGroupBy: ['none', 'day'],
  },
];
