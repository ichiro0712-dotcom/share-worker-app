'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Info, Filter, Check, X, Loader2, BarChart3 } from 'lucide-react';
import {
    getWorkerAnalyticsData,
    getFacilityAnalyticsData,
    getMatchingAnalyticsData,
} from '@/src/lib/analytics-actions';
import type { AnalyticsFilter, WorkerMetrics, FacilityMetrics, MatchingMetrics } from '@/src/lib/analytics-actions';

// ======================== 定義データ（export維持） ========================

export const METRIC_DEFINITIONS = {
    // ========== ワーカー関連 ==========
    worker: {
        title: 'ワーカー関連',
        metrics: [
            {
                key: 'totalWorkers',
                label: '登録ワーカー数',
                definition: '現在登録されているワーカーの総数（退会者を除く）',
                calculation: 'users テーブルで deleted_at IS NULL のレコード数',
                usedIn: ['ダッシュボード KPI', 'ワーカー分析']
            },
            {
                key: 'newCount',
                label: '入会ワーカー数',
                definition: '指定期間内に新規登録したワーカーの数',
                calculation: '指定期間の created_at を持つ users レコード数',
                usedIn: ['ダッシュボード トレンド', 'ワーカー分析']
            },
            {
                key: 'withdrawnCount',
                label: '退会ワーカー数',
                definition: '指定期間内に退会したワーカーの数',
                calculation: '指定期間の deleted_at を持つ users レコード数',
                usedIn: ['ワーカー分析']
            },
            {
                key: 'withdrawalRate',
                label: '退会率',
                definition: '期間開始時の登録ワーカー数に対する退会者の割合',
                calculation: '退会ワーカー数 ÷ 期間開始時の登録ワーカー数 × 100',
                usedIn: ['ワーカー分析']
            },
            {
                key: 'workerReviewCount',
                label: 'レビュー数（ワーカー受領）',
                definition: 'ワーカーが施設から受けたレビューの数',
                calculation: 'reviews テーブルで reviewer_type = FACILITY のレコード数',
                usedIn: ['ワーカー分析']
            },
            {
                key: 'workerReviewAvg',
                label: 'レビュー平均点（ワーカー）',
                definition: 'ワーカーが施設から受けたレビューの平均評価',
                calculation: 'レビュー合計点 ÷ レビュー数',
                usedIn: ['ワーカー分析', 'アラート判定']
            },
            {
                key: 'cancelRate',
                label: 'キャンセル率',
                definition: 'ワーカーによる応募キャンセルの割合',
                calculation: 'ワーカーキャンセル数 ÷ 総応募数 × 100',
                usedIn: ['ワーカー分析', 'アラート判定']
            },
            {
                key: 'lastMinuteCancelRate',
                label: '直前キャンセル率',
                definition: '勤務前日以降にキャンセルした割合（全応募数に対する比率）',
                calculation: '勤務前日以降のキャンセル数 ÷ 全応募数 × 100',
                usedIn: ['ワーカー分析']
            },
            {
                key: 'dropoutRate',
                label: '離脱率',
                definition: '登録後に実質的な活動がないまま離脱したワーカーの割合（将来実装予定）',
                calculation: '現在は0を返す（将来実装予定）',
                usedIn: ['ワーカー分析', '施設分析']
            }
        ]
    },

    // ========== 施設関連 ==========
    facility: {
        title: '施設関連',
        metrics: [
            {
                key: 'totalFacilities',
                label: '登録施設数',
                definition: '現在登録されている施設の総数（退会施設を除く）',
                calculation: 'facilities テーブルで deleted_at IS NULL のレコード数',
                usedIn: ['ダッシュボード KPI', '施設分析']
            },
            {
                key: 'newFacilityCount',
                label: '施設登録数',
                definition: '指定期間内に新規登録した施設の数',
                calculation: '指定期間の created_at を持つ facilities レコード数',
                usedIn: ['ダッシュボード トレンド', '施設分析']
            },
            {
                key: 'withdrawnFacilityCount',
                label: '退会施設数',
                definition: '指定期間内に退会した施設の数',
                calculation: '指定期間の deleted_at を持つ facilities レコード数',
                usedIn: ['施設分析']
            },
            {
                key: 'facilityWithdrawalRate',
                label: '施設退会率',
                definition: '期間開始時の登録施設数に対する退会施設の割合',
                calculation: '退会施設数 ÷ 期間開始時の登録施設数 × 100',
                usedIn: ['施設分析']
            },
            {
                key: 'facilityReviewCount',
                label: 'レビュー数（施設受領）',
                definition: '施設がワーカーから受けたレビューの数',
                calculation: 'reviews テーブルで reviewer_type = WORKER のレコード数',
                usedIn: ['施設分析']
            },
            {
                key: 'facilityReviewAvg',
                label: 'レビュー平均点（施設）',
                definition: '施設がワーカーから受けたレビューの平均評価',
                calculation: 'レビュー合計点 ÷ レビュー数',
                usedIn: ['施設分析', 'アラート判定']
            },
            {
                key: 'parentJobInterviewCount',
                label: '親求人数（面接あり）',
                definition: '面接ありの親求人の数',
                calculation: 'jobs テーブルで requires_interview = true のレコード数',
                usedIn: ['施設分析']
            },
            {
                key: 'childJobInterviewCount',
                label: '子求人数（面接あり）',
                definition: '面接ありの親求人に紐づく子求人の数',
                calculation: 'job_work_dates テーブルで紐づく job の requires_interview = true のレコード数',
                usedIn: ['施設分析']
            },
        ]
    },

    // ========== 求人関連 ==========
    job: {
        title: '求人関連',
        metrics: [
            {
                key: 'parentJobCount',
                label: '親求人数',
                definition: '求人の基本情報（Job テーブル）の数。1つの親求人に複数の勤務日（子求人）が紐づく',
                calculation: 'jobs テーブルで status = PUBLISHED のレコード数',
                usedIn: ['ダッシュボード KPI', '応募・マッチング分析']
            },
            {
                key: 'childJobCount',
                label: '子求人数',
                definition: '実際の勤務日単位の求人数（JobWorkDate テーブル）。ワーカーはこの単位で応募する',
                calculation: 'job_work_dates テーブルのレコード数',
                usedIn: ['ダッシュボード KPI', '応募・マッチング分析']
            },
            {
                key: 'totalSlots',
                label: '総応募枠数',
                definition: '全ての子求人の募集人数（recruitment_count）の合計',
                calculation: 'Σ (各子求人の recruitment_count)',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'remainingSlots',
                label: '応募枠数（残り）',
                definition: '全ての子求人で、まだ埋まっていない応募枠の合計',
                calculation: 'Σ (各子求人の recruitment_count - 確定済み応募数)',
                usedIn: ['ダッシュボード KPI', '応募・マッチング分析']
            },
            {
                key: 'parentJobsPerFacility',
                label: '施設あたり親求人数',
                definition: '1施設あたりの平均親求人数',
                calculation: '親求人数 ÷ アクティブ施設数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'childJobsPerFacility',
                label: '施設あたり子求人数',
                definition: '1施設あたりの平均子求人数',
                calculation: '子求人数 ÷ アクティブ施設数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'limitedJobCount',
                label: '限定求人数',
                definition: '勤務済みワーカー限定またはお気に入りワーカー限定の求人数',
                calculation: 'jobs テーブルで job_type IN (LIMITED_WORKED, LIMITED_FAVORITE) のレコード数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'offerJobCount',
                label: 'オファー数',
                definition: '施設から特定ワーカーへ送られた個別オファーの数',
                calculation: 'jobs テーブルで job_type = OFFER のレコード数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'offerAcceptanceRate',
                label: 'オファー承諾率',
                definition: 'オファー求人のうち、ワーカーが承諾した割合',
                calculation: 'オファー承諾数 ÷ オファー求人数 × 100',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'limitedJobApplicationRate',
                label: '限定求人応募率',
                definition: '限定求人に対して応募があった割合',
                calculation: '限定求人への応募数 ÷ 限定求人数 × 100',
                usedIn: ['応募・マッチング分析']
            }
        ]
    },

    // ========== 求人分析（ログイン後）関連 ==========
    jobAnalytics: {
        title: '求人分析（ログイン後）関連',
        metrics: [
            {
                key: 'jobAnalyticsTotalPV',
                label: '求人PV',
                definition: 'ログイン後ユーザーが求人詳細ページを閲覧した総回数（退会済みユーザーも含む）',
                calculation: 'job_detail_page_views テーブルの期間内レコード数（deleted_at 不問）',
                usedIn: ['求人分析']
            },
            {
                key: 'jobAnalyticsTotalUsers',
                label: '閲覧ユーザー数',
                definition: '期間内に求人詳細ページを1回以上閲覧したユニークユーザー数（退会済みユーザーも含む）',
                calculation: 'job_detail_page_views テーブルの期間内ユニーク user_id 数（deleted_at 不問）',
                usedIn: ['求人分析']
            },
            {
                key: 'jobAnalyticsApplicationCount',
                label: '応募数（求人分析）',
                definition: '期間内の応募総数（退会済みユーザーの応募も含む）',
                calculation: 'applications テーブルの期間内レコード数（deleted_at 不問）',
                usedIn: ['求人分析']
            },
            {
                key: 'jobAnalyticsApplicationUserCount',
                label: '応募ユニークユーザー数',
                definition: '期間内に1回以上応募したユニークユーザー数（退会済みユーザーも含む）',
                calculation: 'applications テーブルの期間内ユニーク user_id 数（deleted_at 不問）',
                usedIn: ['求人分析']
            },
            {
                key: 'jobAnalyticsApplicationRate',
                label: '応募率（求人分析）',
                definition: '求人詳細を閲覧したユーザーのうち応募したユーザーの割合',
                calculation: '応募ユニークユーザー数 ÷ 閲覧ユーザー数 × 100',
                usedIn: ['求人分析（求人ランキング）']
            },
            {
                key: 'jobAnalyticsAvgApplicationDays',
                label: '平均応募日数（求人分析）',
                definition: '応募ユーザー1人あたりの平均応募数',
                calculation: '応募数 ÷ 応募ユニークユーザー数',
                usedIn: ['求人分析']
            }
        ]
    },

    // ========== LP基本トラッキング関連 ==========
    lpBasicTracking: {
        title: 'LP基本トラッキング関連',
        metrics: [
            {
                key: 'lpPV',
                label: 'PV（ページビュー）',
                definition: 'LPページが読み込まれた回数。同一ユーザーが複数回訪問した場合も、それぞれ1PVとしてカウント',
                calculation: 'lp_page_views テーブルで対象LP・期間のレコード数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）', 'LPトラッキング']
            },
            {
                key: 'lpSessions',
                label: 'セッション',
                definition: 'ユニークな訪問数。sessionStorageベースのセッションIDで識別。同一ブラウザの同一タブでの複数PVは1セッション',
                calculation: 'lp_page_views テーブルで対象LP・期間のユニーク session_id 数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）', 'LPトラッキング']
            },
            {
                key: 'lpEvents',
                label: 'イベント（CTAクリック）',
                definition: 'CTAボタンがクリックされた回数。通常LP: LINE友だち追加リンク等、LP0: 「会員登録して応募する」ボタン',
                calculation: 'lp_click_events テーブルで対象LP・期間のレコード数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）', 'LPトラッキング']
            },
            {
                key: 'lpEventCTR',
                label: 'イベントCTR',
                definition: 'セッションあたりのCTAクリック率',
                calculation: 'イベント数 ÷ セッション数 × 100',
                usedIn: ['LP分析（LP別アクセス状況）', 'LPトラッキング']
            },
            {
                key: 'lpRegistrations',
                label: '登録数',
                definition: 'LP経由での会員登録数。LP訪問時にlocalStorageに保存されたLP ID・キャンペーンコードが登録時にユーザーレコードに紐付け',
                calculation: 'users テーブルで registration_lp_id が対象LP のレコード数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）', 'LPトラッキング']
            },
            {
                key: 'lpJobDetailPV',
                label: '求人閲覧数（LP0）',
                definition: 'LP0の求人詳細ページ（/public/jobs/[id]）が閲覧された合計回数。LP0固有の指標',
                calculation: 'public_job_page_views テーブルで lp_id=0・期間のレコード数',
                usedIn: ['LP分析（公開求人）']
            },
            {
                key: 'lpAvgDwellTime',
                label: '平均滞在時間',
                definition: 'LP滞在時間の平均。通常LP: 最大300秒、LP0: 最大600秒でキャップ',
                calculation: 'lp_engagement_summaries テーブルで total_dwell_time の平均',
                usedIn: ['LP分析（公開求人）', 'LPトラッキング']
            }
        ]
    },

    // ========== 応募・マッチング関連 ==========
    matching: {
        title: '応募・マッチング関連',
        metrics: [
            {
                key: 'applicationCount',
                label: '応募数',
                definition: '指定期間内に行われた応募の総数',
                calculation: 'applications テーブルで指定期間内の created_at を持つレコード数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'matchingCount',
                label: 'マッチング数',
                definition: '応募がマッチング成立（SCHEDULED以上）したものの数',
                calculation: 'status が APPLIED, CANCELLED 以外の応募数',
                usedIn: ['ダッシュボード トレンド', '応募・マッチング分析']
            },
            {
                key: 'avgMatchingHours',
                label: 'マッチング期間（時間）',
                definition: '親求人が作成されてからマッチングが成立するまでの平均時間',
                calculation: 'Σ (マッチング成立時刻 - 親求人作成時刻) ÷ マッチング数',
                usedIn: ['ダッシュボード トレンド', '応募・マッチング分析']
            },
            {
                key: 'avgApplicationMatchingPeriod',
                label: '応募→マッチング平均',
                definition: 'ワーカーが応募してからマッチングするまでの平均時間',
                calculation: 'Σ (マッチング成立時刻 - 応募時刻) ÷ マッチング数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'avgJobMatchingPeriod',
                label: '求人公開→初回マッチング平均',
                definition: '求人が公開されてから最初のマッチングが成立するまでの平均時間',
                calculation: '各求人の (初回マッチング時刻 - 求人公開時刻) の平均',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'applicationsPerWorker',
                label: 'ワーカーあたり応募数',
                definition: 'アクティブワーカー1人あたりの平均応募数',
                calculation: '応募数 ÷ アクティブワーカー数',
                usedIn: ['ダッシュボード トレンド', '応募・マッチング分析']
            },
            {
                key: 'matchingsPerWorker',
                label: 'ワーカーあたりマッチング数',
                definition: 'アクティブワーカー1人あたりの平均マッチング数',
                calculation: 'マッチング数 ÷ アクティブワーカー数',
                usedIn: ['ダッシュボード トレンド', '応募・マッチング分析']
            },
            {
                key: 'reviewsPerWorker',
                label: 'ワーカーあたりレビュー数',
                definition: 'アクティブワーカー1人あたりの平均レビュー受領数',
                calculation: 'ワーカー受領レビュー数 ÷ アクティブワーカー数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'matchingsPerFacility',
                label: '施設あたりマッチング数',
                definition: 'アクティブ施設1施設あたりの平均マッチング数',
                calculation: 'マッチング数 ÷ アクティブ施設数',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'reviewsPerFacility',
                label: '施設あたりレビュー数',
                definition: 'アクティブ施設1施設あたりの平均レビュー受領数',
                calculation: '施設受領レビュー数 ÷ アクティブ施設数',
                usedIn: ['応募・マッチング分析']
            }
        ]
    },

    // ========== LPトラッキング関連 ==========
    lpTracking: {
        title: 'LPトラッキング関連',
        metrics: [
            {
                key: 'registrationRate',
                label: '登録率',
                definition: 'LP閲覧セッションのうち、ワーカー登録に至った割合。旧名称「CVR」と同一指標',
                calculation: '登録数 ÷ セッション数 × 100',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'parentJobPV',
                label: '親求人PV',
                definition: 'LP経由で登録したワーカーが、プラットフォーム内で求人詳細ページを閲覧した回数',
                calculation: 'job_detail_page_views テーブルで、対象LP帰属ユーザー（User.registration_lp_id）に該当するレコード数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'parentJobSessions',
                label: '親求人セッション',
                definition: 'LP経由で登録したワーカーのうち、求人詳細ページを1回以上閲覧したユニークユーザー数',
                calculation: 'job_detail_page_views テーブルで対象LP帰属ユーザーのユニーク user_id 数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'lpApplicationCount',
                label: '応募数（LP帰属）',
                definition: 'LP経由で登録したワーカーが行った応募の総数',
                calculation: 'applications テーブルで user.registration_lp_id が対象LP のレコード数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'applicationRate',
                label: '応募率',
                definition: 'LP経由で登録したワーカーのうち、1回以上応募したユニークユーザーの割合',
                calculation: '応募ユニークユーザー数（LP帰属） ÷ 登録数 × 100',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'avgDaysToApplication',
                label: '平均応募日数',
                definition: 'LP経由で登録したワーカー1人あたりの平均応募日数',
                calculation: '応募数（LP帰属） ÷ ユニーク応募ワーカー数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'applicationDays',
                label: '応募日数',
                definition: '期間内の応募総数（1応募=1勤務日）',
                calculation: 'applicationCountと同値',
                usedIn: ['応募・マッチング分析']
            },
            {
                key: 'avgApplicationDays',
                label: '平均応募日数（応募・マッチング）',
                definition: 'ワーカー1人あたりの平均応募日数',
                calculation: '応募数 ÷ ユニーク応募ワーカー数',
                usedIn: ['応募・マッチング分析']
            }
        ]
    },

    // ========== 登録動線分析関連 ==========
    funnel: {
        title: '登録動線分析関連',
        metrics: [
            {
                key: 'registrationPagePV',
                label: '新規登録ページPV',
                definition: '新規登録ページ（/register/worker）の閲覧数。未ログインユーザー対象でsessionStorageベースのセッションIDで記録。ソースフィルターの影響を受けない（匿名データのため）',
                calculation: 'registration_page_views テーブルの期間内レコード数（日付フィルターのみ、ソースフィルター不可）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'registrationPageUU',
                label: '新規登録ページUU',
                definition: '新規登録ページのユニーク訪問者数。sessionStorageベースのセッションIDで識別。ソースフィルターの影響を受けない（匿名データのため）',
                calculation: 'registration_page_views テーブルの期間内ユニーク session_id 数（日付フィルターのみ、ソースフィルター不可）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'funnelRegistered',
                label: '登録完了数（登録動線）',
                definition: '期間内に新規登録したユーザー数（退会済みユーザーも含む）',
                calculation: 'users テーブルで期間内の created_at を持つレコード数（deleted_at 不問）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'funnelVerified',
                label: 'メール認証完了数',
                definition: '期間内に登録したユーザーのうちメール認証を完了したユーザー数',
                calculation: '期間内登録ユーザーのうち email_verified = true のレコード数',
                usedIn: ['登録動線分析']
            },
            {
                key: 'searchPV',
                label: '求人検索PV',
                definition: '期間内に登録したユーザーによる求人検索ページ（トップページ）の総閲覧数。行動の日付は問わない（コホート集計）',
                calculation: 'job_search_page_views テーブルで期間内登録ユーザーの全レコード数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'funnelSearchReached',
                label: '求人検索到達UU',
                definition: '期間内に登録したユーザーのうち求人検索ページ（トップページ）に到達したユーザー数。行動の日付は問わない（コホート集計）',
                calculation: 'job_search_page_views テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'jobViewedPV',
                label: '求人詳細PV',
                definition: '期間内に登録したユーザーによる求人詳細ページの総閲覧数。行動の日付は問わない（コホート集計）',
                calculation: 'job_detail_page_views テーブルで期間内登録ユーザーの全レコード数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'funnelJobViewed',
                label: '求人詳細閲覧UU（登録動線）',
                definition: '期間内に登録したユーザーのうち求人詳細ページを1回以上閲覧したユーザー数。行動の日付は問わない（コホート集計）',
                calculation: 'job_detail_page_views テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'funnelBookmarked',
                label: 'お気に入り登録数（登録動線）',
                definition: '期間内に登録したユーザーのうち1件以上求人をお気に入り登録したユーザー数（施設お気に入りは除外）。行動の日付は問わない（コホート集計）',
                calculation: 'bookmarks テーブルで type=FAVORITE かつ target_job_id IS NOT NULL の期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'applicationClickUU',
                label: '応募ボタンクリックUU',
                definition: '期間内に登録したユーザーのうち応募ボタンをクリックしたユニークユーザー数。確認モーダル表示時に記録（最終送信ではない）。行動の日付は問わない（コホート集計）',
                calculation: 'application_click_events テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'funnelApplied',
                label: '応募完了UU（登録動線）',
                definition: '期間内に登録したユーザーのうち1件以上応募を完了したユーザー数（キャンセル済みも含む＝行動ログとして記録）。行動の日付は問わない（コホート集計）',
                calculation: 'applications テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'applicationTotal',
                label: '応募総数（登録動線）',
                definition: '期間内に登録したユーザーによる応募の総件数（UUではなくPV的な件数カウント）。行動の日付は問わない（コホート集計）',
                calculation: 'applications テーブルで期間内登録ユーザーの全レコード数（行動日フィルターなし）',
                usedIn: ['登録動線分析']
            },
            {
                key: 'overallConversionRate',
                label: '全体コンバージョン率',
                definition: '期間内に登録したユーザーのうち応募に至ったユーザーの割合',
                calculation: '応募完了UU ÷ 登録完了数 × 100',
                usedIn: ['登録動線分析']
            },
            {
                key: 'avgRegistrationToVerifyHours',
                label: '登録→認証 平均所要時間',
                definition: 'ユーザー登録からメール認証完了までの平均時間（時間単位）',
                calculation: 'Σ (email_verified_at - created_at) ÷ 認証済みユーザー数',
                usedIn: ['登録動線分析']
            }
        ]
    },

    // ========== アラート関連 ==========
    alert: {
        title: 'アラート判定',
        metrics: [
            {
                key: 'avgRatingThreshold',
                label: '平均評価閾値',
                definition: 'この値以下の平均評価でアラートが発動する',
                calculation: '通知設定で設定可能（デフォルト: 2.5）',
                usedIn: ['ダッシュボード アラート']
            },
            {
                key: 'cancelRateThreshold',
                label: 'キャンセル率閾値',
                definition: 'この値を超えるキャンセル率でアラートが発動する',
                calculation: '通知設定で設定可能（デフォルト: 30%）',
                usedIn: ['ダッシュボード アラート']
            },
            {
                key: 'consecutiveLowRatingCount',
                label: '連続低評価回数',
                definition: 'この回数連続で低評価を受けるとアラートが発動する',
                calculation: '通知設定で設定可能（デフォルト: 3回）',
                usedIn: ['ダッシュボード アラート']
            }
        ]
    }
};

// ======================== 定義検索ヘルパー ========================

function findDefinitionStatic(definitionKey: string): { label: string; definition: string; calculation: string; usedIn: string[] } | null {
    for (const section of Object.values(METRIC_DEFINITIONS)) {
        for (const metric of section.metrics) {
            if (metric.key === definitionKey) return metric;
        }
    }
    return null;
}

// ======================== ツールチップコンポーネント（Portal方式） ========================

function MetricTooltip({ definitionKey }: { definitionKey: string }) {
    const def = findDefinitionStatic(definitionKey);
    const iconRef = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    if (!def) return null;

    const handleEnter = () => {
        if (iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setPos({
                top: rect.top + rect.height / 2,
                left: rect.right + 8,
            });
        }
        setShow(true);
    };

    const handleLeave = () => setShow(false);

    return (
        <>
            <div
                ref={iconRef}
                className="inline-flex ml-1 cursor-help"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <Info className={`w-3 h-3 transition-colors ${show ? 'text-indigo-600' : 'text-slate-400'}`} />
            </div>
            {show && typeof window !== 'undefined' && createPortal(
                <div
                    style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
                    className="z-[99999] w-72 bg-white border border-slate-200 rounded-lg shadow-xl p-3 pointer-events-none"
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                >
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-slate-200 rotate-45" />
                    <span className="font-semibold text-xs text-slate-800 block mb-1">{def.label}</span>
                    <p className="text-[11px] text-slate-600 mb-1.5 leading-relaxed">{def.definition}</p>
                    <div className="bg-slate-50 rounded p-1.5 text-[11px] text-slate-600 font-mono mb-1.5">
                        計算: {def.calculation}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {def.usedIn.map((u: string, i: number) => (
                            <span key={i} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">{u}</span>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

// ======================== 日付ユーティリティ ========================

const getFirstDayOfMonth = (date: Date): Date => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
};
const getLastDayOfMonth = (date: Date): Date => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
};
const getFirstDayOfYear = (date: Date): Date => new Date(date.getFullYear(), 0, 1);
const getLastDayOfYear = (date: Date): Date => new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const formatMonthDisplay = (date: Date): string => `${date.getFullYear()}年${date.getMonth() + 1}月`;
const formatYearDisplay = (date: Date): string => `${date.getFullYear()}年`;

type PeriodMode = 'daily' | 'monthly';

// ======================== セクション定義 ========================

// 指標の表示フォーマット
type MetricFormat = 'integer' | 'decimal' | 'percent';
// 合計列の集計方法: sum=合計, last=最終日の値, average=平均
type AggType = 'sum' | 'last' | 'average';

interface MetricConfig {
    dataKey: string;        // Server Action / API レスポンスのフィールド名
    label: string;          // 表示名
    definitionKey: string;  // METRIC_DEFINITIONS 内のkey (インフォポップオーバー用)
    format: MetricFormat;
    aggType: AggType;
}

interface SectionConfig {
    id: string;
    title: string;
    bgColor: string;        // セクションヘッダーの背景色
    headerTextColor: string;
    stickyBg: string;        // sticky列の背景色
    metrics: MetricConfig[];
}

const SECTIONS: SectionConfig[] = [
    {
        id: 'worker',
        title: 'ワーカー分析',
        bgColor: 'bg-blue-50',
        headerTextColor: 'text-blue-900',
        stickyBg: 'bg-blue-50',
        metrics: [
            { dataKey: 'registeredCount', label: '登録ワーカー数', definitionKey: 'totalWorkers', format: 'integer', aggType: 'last' },
            { dataKey: 'newCount', label: '入会ワーカー数', definitionKey: 'newCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'withdrawnCount', label: '退会ワーカー数', definitionKey: 'withdrawnCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'reviewCount', label: 'レビュー数', definitionKey: 'workerReviewCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'reviewAvg', label: 'レビュー平均点', definitionKey: 'workerReviewAvg', format: 'decimal', aggType: 'average' },
            { dataKey: 'cancelRate', label: 'キャンセル率', definitionKey: 'cancelRate', format: 'percent', aggType: 'average' },
            { dataKey: 'lastMinuteCancelRate', label: '直前キャンセル率', definitionKey: 'lastMinuteCancelRate', format: 'percent', aggType: 'average' },
            { dataKey: 'dropoutRate', label: '離脱率', definitionKey: 'dropoutRate', format: 'percent', aggType: 'average' },
            { dataKey: 'withdrawalRate', label: '退会率', definitionKey: 'withdrawalRate', format: 'percent', aggType: 'average' },
        ],
    },
    {
        id: 'facility',
        title: '施設分析',
        bgColor: 'bg-emerald-50',
        headerTextColor: 'text-emerald-900',
        stickyBg: 'bg-emerald-50',
        metrics: [
            { dataKey: 'registeredCount', label: '登録施設数', definitionKey: 'totalFacilities', format: 'integer', aggType: 'last' },
            { dataKey: 'newCount', label: '施設登録数', definitionKey: 'newFacilityCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'withdrawnCount', label: '退会施設数', definitionKey: 'withdrawnFacilityCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'reviewCount', label: 'レビュー数', definitionKey: 'facilityReviewCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'reviewAvg', label: 'レビュー平均点', definitionKey: 'facilityReviewAvg', format: 'decimal', aggType: 'average' },
            { dataKey: 'dropoutRate', label: '離脱率', definitionKey: 'dropoutRate', format: 'percent', aggType: 'average' },
            { dataKey: 'withdrawalRate', label: '退会率', definitionKey: 'facilityWithdrawalRate', format: 'percent', aggType: 'average' },
            { dataKey: 'parentJobCount', label: '親求人数', definitionKey: 'parentJobCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'parentJobInterviewCount', label: '親求人数（面接あり）', definitionKey: 'parentJobInterviewCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'childJobCount', label: '子求人数', definitionKey: 'childJobCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'childJobInterviewCount', label: '子求人数（面接あり）', definitionKey: 'childJobInterviewCount', format: 'integer', aggType: 'sum' },
        ],
    },
    {
        id: 'matching',
        title: '応募・マッチング',
        bgColor: 'bg-violet-50',
        headerTextColor: 'text-violet-900',
        stickyBg: 'bg-violet-50',
        metrics: [
            { dataKey: 'parentJobCount', label: '親求人数', definitionKey: 'parentJobCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'childJobCount', label: '子求人数', definitionKey: 'childJobCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'totalSlots', label: '総応募枠数', definitionKey: 'totalSlots', format: 'integer', aggType: 'sum' },
            { dataKey: 'remainingSlots', label: '応募枠数（残り）', definitionKey: 'remainingSlots', format: 'integer', aggType: 'last' },
            { dataKey: 'applicationCount', label: '応募数', definitionKey: 'applicationCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'matchingCount', label: 'マッチング数', definitionKey: 'matchingCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'avgMatchingHours', label: 'マッチング期間(h)', definitionKey: 'avgMatchingHours', format: 'decimal', aggType: 'average' },
            { dataKey: 'applicationsPerWorker', label: 'ワーカーあたり応募数', definitionKey: 'applicationsPerWorker', format: 'decimal', aggType: 'average' },
            { dataKey: 'matchingsPerWorker', label: 'ワーカーあたりマッチング数', definitionKey: 'matchingsPerWorker', format: 'decimal', aggType: 'average' },
            { dataKey: 'reviewsPerWorker', label: 'ワーカーあたりレビュー数', definitionKey: 'reviewsPerWorker', format: 'decimal', aggType: 'average' },
            { dataKey: 'parentJobsPerFacility', label: '施設あたり親求人数', definitionKey: 'parentJobsPerFacility', format: 'decimal', aggType: 'average' },
            { dataKey: 'childJobsPerFacility', label: '施設あたり子求人数', definitionKey: 'childJobsPerFacility', format: 'decimal', aggType: 'average' },
            { dataKey: 'matchingsPerFacility', label: '施設あたりマッチング数', definitionKey: 'matchingsPerFacility', format: 'decimal', aggType: 'average' },
            { dataKey: 'reviewsPerFacility', label: '施設あたりレビュー数', definitionKey: 'reviewsPerFacility', format: 'decimal', aggType: 'average' },
            { dataKey: 'applicationDays', label: '応募日数', definitionKey: 'applicationDays', format: 'integer', aggType: 'sum' },
            { dataKey: 'avgApplicationDays', label: '平均応募日数', definitionKey: 'avgApplicationDays', format: 'decimal', aggType: 'average' },
            { dataKey: 'limitedJobCount', label: '限定求人数', definitionKey: 'limitedJobCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'offerJobCount', label: 'オファー数', definitionKey: 'offerJobCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'offerAcceptanceRate', label: 'オファー承諾率', definitionKey: 'offerAcceptanceRate', format: 'percent', aggType: 'average' },
            { dataKey: 'limitedJobApplicationRate', label: '限定求人応募率', definitionKey: 'limitedJobApplicationRate', format: 'percent', aggType: 'average' },
        ],
    },
    {
        id: 'jobAnalytics',
        title: '求人分析',
        bgColor: 'bg-amber-50',
        headerTextColor: 'text-amber-900',
        stickyBg: 'bg-amber-50',
        metrics: [
            { dataKey: 'totalPV', label: '求人PV', definitionKey: 'jobAnalyticsTotalPV', format: 'integer', aggType: 'sum' },
            { dataKey: 'totalUsers', label: '閲覧ユーザー数', definitionKey: 'jobAnalyticsTotalUsers', format: 'integer', aggType: 'sum' },
            { dataKey: 'applicationCount', label: '応募数', definitionKey: 'jobAnalyticsApplicationCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'applicationUserCount', label: '応募UU', definitionKey: 'jobAnalyticsApplicationUserCount', format: 'integer', aggType: 'sum' },
            { dataKey: 'avgApplicationDays', label: '平均応募日数', definitionKey: 'jobAnalyticsAvgApplicationDays', format: 'decimal', aggType: 'average' },
        ],
    },
    {
        id: 'funnel',
        title: '登録動線',
        bgColor: 'bg-indigo-50',
        headerTextColor: 'text-indigo-900',
        stickyBg: 'bg-indigo-50',
        metrics: [
            { dataKey: 'registrationPagePV', label: '新規登録ページPV', definitionKey: 'registrationPagePV', format: 'integer', aggType: 'sum' },
            { dataKey: 'registrationPageUU', label: '新規登録ページUU', definitionKey: 'registrationPageUU', format: 'integer', aggType: 'sum' },
            { dataKey: 'registered', label: '登録完了数', definitionKey: 'funnelRegistered', format: 'integer', aggType: 'sum' },
            { dataKey: 'verified', label: 'メール認証完了数', definitionKey: 'funnelVerified', format: 'integer', aggType: 'sum' },
            { dataKey: 'searchPV', label: '求人検索PV', definitionKey: 'searchPV', format: 'integer', aggType: 'sum' },
            { dataKey: 'searchReached', label: '求人検索到達UU', definitionKey: 'funnelSearchReached', format: 'integer', aggType: 'sum' },
            { dataKey: 'jobViewedPV', label: '求人詳細PV', definitionKey: 'jobViewedPV', format: 'integer', aggType: 'sum' },
            { dataKey: 'jobViewed', label: '求人詳細閲覧UU', definitionKey: 'funnelJobViewed', format: 'integer', aggType: 'sum' },
            { dataKey: 'bookmarked', label: 'お気に入り登録UU', definitionKey: 'funnelBookmarked', format: 'integer', aggType: 'sum' },
            { dataKey: 'applicationClickUU', label: '応募ボタンクリックUU', definitionKey: 'applicationClickUU', format: 'integer', aggType: 'sum' },
            { dataKey: 'applied', label: '応募完了UU', definitionKey: 'funnelApplied', format: 'integer', aggType: 'sum' },
            { dataKey: 'applicationTotal', label: '応募総数', definitionKey: 'applicationTotal', format: 'integer', aggType: 'sum' },
            { dataKey: 'overallConversionRate', label: '全体転換率', definitionKey: 'overallConversionRate', format: 'percent', aggType: 'average' },
        ],
    },
];

// ======================== Pivot変換 ========================

type PivotedData = Record<string, { total: number; byDate: Record<string, number> }>;

function pivotServerActionData(
    data: Record<string, unknown>[],
    metrics: MetricConfig[],
    dateKey: string = 'date'
): PivotedData {
    const result: PivotedData = {};

    for (const m of metrics) {
        const values: Record<string, number> = {};
        for (const row of data) {
            const dateStr = row[dateKey] as string;
            const val = (row[m.dataKey] as number) ?? 0;
            values[dateStr] = val;
        }

        let total: number;
        const vals = Object.values(values);
        if (vals.length === 0) {
            total = 0;
        } else if (m.aggType === 'last') {
            total = vals[vals.length - 1];
        } else if (m.aggType === 'average') {
            const nonZero = vals.filter(v => v !== 0);
            total = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
        } else {
            total = vals.reduce((a, b) => a + b, 0);
        }

        result[m.dataKey] = { total, byDate: values };
    }

    return result;
}

function pivotBreakdownData(
    breakdown: Record<string, unknown>[],
    metrics: MetricConfig[],
    periodKey: string = 'period'
): PivotedData {
    const result: PivotedData = {};

    for (const m of metrics) {
        const values: Record<string, number> = {};
        for (const row of breakdown) {
            const dateStr = row[periodKey] as string;
            const val = (row[m.dataKey] as number) ?? 0;
            values[dateStr] = val;
        }

        let total: number;
        const vals = Object.values(values);
        if (vals.length === 0) {
            total = 0;
        } else if (m.aggType === 'last') {
            total = vals[vals.length - 1];
        } else if (m.aggType === 'average') {
            const nonZero = vals.filter(v => v !== 0);
            total = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
        } else {
            total = vals.reduce((a, b) => a + b, 0);
        }

        result[m.dataKey] = { total, byDate: values };
    }

    return result;
}

// ======================== 値フォーマット ========================

function formatValue(value: number | undefined, fmt: MetricFormat): string {
    if (value === undefined || value === null) return '-';
    if (fmt === 'percent') return `${Math.round(value * 100) / 100}%`;
    if (fmt === 'decimal') return (Math.round(value * 100) / 100).toLocaleString();
    return Math.round(value).toLocaleString();
}

// findDefinition は findDefinitionStatic として上部に移動済み

// ======================== 固定の流入元選択肢 ========================
const FIXED_SOURCE_OPTIONS = [
    { value: 'direct', label: '直接流入' },
];

// ======================== 日別period文字列を表示用に変換 ========================
function formatDailyPeriod(period: string): string {
    const parts = period.split('-');
    if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    if (parts.includes('/')) {
        const slashParts = period.split('/');
        if (slashParts.length >= 2) return `${parseInt(slashParts[slashParts.length - 2])}/${parseInt(slashParts[slashParts.length - 1])}`;
    }
    return period;
}

function formatMonthlyPeriod(period: string): string {
    const parts = period.split('-');
    if (parts.length === 2) return `${parseInt(parts[1])}月`;
    if (period.includes('/')) {
        const slashParts = period.split('/');
        if (slashParts.length >= 2) return `${parseInt(slashParts[slashParts.length - 1])}月`;
    }
    return period;
}

// ======================== メインコンポーネント ========================

interface SectionState {
    open: boolean;
    loading: boolean;
    data: PivotedData | null;
    dateColumns: string[];
    error: string | null;
}

export default function MetricDefinitions() {
    const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [currentYear, setCurrentYear] = useState<Date>(new Date());

    // ソースフィルター
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [lpOptions, setLpOptions] = useState<Array<{ value: string; label: string }>>([]);
    const filterRef = useRef<HTMLDivElement>(null);

    // GA4差分分析モーダル
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [compareData, setCompareData] = useState<{
        db: { registrationPagePV: number; registrationPageUU: number; searchPV: number; searchReached: number; jobViewedPV: number; jobViewed: number };
        ga4: { registrationPage: { pageViews: number; totalUsers: number }; jobSearchPage: { pageViews: number; totalUsers: number }; jobDetailPage: { pageViews: number; totalUsers: number } };
    } | null>(null);

    // セクション状態
    const [sections, setSections] = useState<Record<string, SectionState>>(() => {
        const init: Record<string, SectionState> = {};
        SECTIONS.forEach((s, i) => {
            init[s.id] = { open: i === 0, loading: false, data: null, dateColumns: [], error: null };
        });
        return init;
    });

    // ======================== 日付範囲計算 ========================

    const getDateRange = useCallback((): { startDate: string; endDate: string; breakdown: 'daily' | 'monthly' } => {
        if (periodMode === 'daily') {
            const start = getFirstDayOfMonth(currentMonth);
            const end = getLastDayOfMonth(currentMonth);
            return { startDate: formatDate(start), endDate: formatDate(end), breakdown: 'daily' };
        }
        const start = getFirstDayOfYear(currentYear);
        const end = getLastDayOfYear(currentYear);
        return { startDate: formatDate(start), endDate: formatDate(end), breakdown: 'monthly' };
    }, [periodMode, currentMonth, currentYear]);

    // ======================== データフェッチ ========================

    const fetchSectionData = useCallback(async (sectionId: string) => {
        const section = SECTIONS.find(s => s.id === sectionId);
        if (!section) return;

        setSections(prev => ({
            ...prev,
            [sectionId]: { ...prev[sectionId], loading: true, error: null },
        }));

        try {
            const { startDate, endDate, breakdown } = getDateRange();
            const viewMode = breakdown;
            const targetYear = periodMode === 'daily' ? currentMonth.getFullYear() : currentYear.getFullYear();
            const targetMonth = periodMode === 'daily' ? currentMonth.getMonth() + 1 : undefined;

            let pivoted: PivotedData;
            let dateColumns: string[] = [];

            if (sectionId === 'worker' || sectionId === 'facility' || sectionId === 'matching') {
                const filter: AnalyticsFilter = {
                    viewMode,
                    targetYear,
                    targetMonth,
                    startDate: new Date(`${startDate}T00:00:00+09:00`),
                    endDate: new Date(`${endDate}T23:59:59.999+09:00`),
                };

                let rawData: Record<string, unknown>[];
                if (sectionId === 'worker') {
                    rawData = (await getWorkerAnalyticsData(filter)) as unknown as Record<string, unknown>[];
                } else if (sectionId === 'facility') {
                    rawData = (await getFacilityAnalyticsData(filter)) as unknown as Record<string, unknown>[];
                } else {
                    rawData = (await getMatchingAnalyticsData(filter)) as unknown as Record<string, unknown>[];
                }

                dateColumns = rawData.map(r => r.date as string);
                pivoted = pivotServerActionData(rawData, section.metrics);
            } else if (sectionId === 'jobAnalytics') {
                const params = new URLSearchParams({ startDate, endDate, breakdown });
                const res = await fetch(`/api/job-analytics?${params}`);
                const json = await res.json();

                if (json.breakdown && json.breakdown.length > 0) {
                    dateColumns = json.breakdown.map((r: Record<string, unknown>) => r.period as string);
                    pivoted = pivotBreakdownData(json.breakdown, section.metrics);
                } else {
                    pivoted = {};
                    for (const m of section.metrics) {
                        pivoted[m.dataKey] = { total: (json[m.dataKey] as number) ?? 0, byDate: {} };
                    }
                }
            } else if (sectionId === 'funnel') {
                const sourceParam = selectedSources.length === 0 ? 'all' : selectedSources.join(',');
                const params = new URLSearchParams({ startDate, endDate, breakdown, source: sourceParam });
                const res = await fetch(`/api/funnel-analytics?${params}`);
                const json = await res.json();

                // LP一覧をレスポンスから取得
                if (json.lpSources && json.lpSources.length > 0) {
                    setLpOptions(json.lpSources);
                }

                const hasSourceFilter = json.hasSourceFilter === true;

                if (json.breakdown && json.breakdown.length > 0) {
                    dateColumns = json.breakdown.map((r: Record<string, unknown>) => r.period as string);

                    // breakdownにはoverallConversionRateとapplicationTotalが含まれないので手計算
                    const enrichedBreakdown = json.breakdown.map((row: Record<string, unknown>) => {
                        const registered = (row.registered as number) ?? 0;
                        const applied = (row.applied as number) ?? 0;
                        return {
                            ...row,
                            applicationTotal: 0, // breakdownには含まれない
                            overallConversionRate: registered > 0 ? Math.round((applied / registered) * 1000) / 10 : 0,
                        };
                    });

                    pivoted = pivotBreakdownData(enrichedBreakdown, section.metrics);

                    // サマリー値でtotalを上書き（API全体集計のほうが正確）
                    if (json.funnel) {
                        for (const m of section.metrics) {
                            if (m.dataKey === 'overallConversionRate') {
                                pivoted[m.dataKey].total = json.overallConversionRate ?? 0;
                            } else if (m.dataKey in json.funnel) {
                                const summaryVal = (json.funnel as Record<string, number>)[m.dataKey];
                                if (m.aggType === 'sum') {
                                    pivoted[m.dataKey].total = summaryVal ?? pivoted[m.dataKey].total;
                                }
                            }
                        }
                    }

                    // ソースフィルター時、registrationPagePV/UU はフィルター非対応
                    if (hasSourceFilter) {
                        for (const dk of ['registrationPagePV', 'registrationPageUU']) {
                            if (pivoted[dk]) {
                                pivoted[dk].total = -1; // -1 = 非対応マーカー
                                for (const key of Object.keys(pivoted[dk].byDate)) {
                                    pivoted[dk].byDate[key] = -1;
                                }
                            }
                        }
                    }
                } else {
                    pivoted = {};
                    if (json.funnel) {
                        for (const m of section.metrics) {
                            if (m.dataKey === 'overallConversionRate') {
                                pivoted[m.dataKey] = { total: json.overallConversionRate ?? 0, byDate: {} };
                            } else {
                                const val = (json.funnel as Record<string, number>)[m.dataKey] ?? 0;
                                pivoted[m.dataKey] = { total: hasSourceFilter && (m.dataKey === 'registrationPagePV' || m.dataKey === 'registrationPageUU') ? -1 : val, byDate: {} };
                            }
                        }
                    }
                }
            } else {
                pivoted = {};
            }

            setSections(prev => ({
                ...prev,
                [sectionId]: { ...prev[sectionId], loading: false, data: pivoted, dateColumns, error: null },
            }));
        } catch (err) {
            console.error(`Failed to fetch ${sectionId}:`, err);
            setSections(prev => ({
                ...prev,
                [sectionId]: { ...prev[sectionId], loading: false, error: 'データの取得に失敗しました' },
            }));
        }
    }, [getDateRange, periodMode, currentMonth, currentYear, selectedSources]);

    // 初回: 開いているセクションのデータ取得
    const initialFetchDone = useRef(false);
    useEffect(() => {
        if (initialFetchDone.current) return;
        initialFetchDone.current = true;
        for (const s of SECTIONS) {
            if (sections[s.id]?.open) {
                fetchSectionData(s.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 期間変更時: 開いているセクションを再フェッチ
    const prevPeriodKey = useRef('');
    useEffect(() => {
        const key = `${periodMode}-${currentMonth.getTime()}-${currentYear.getTime()}`;
        if (prevPeriodKey.current === key) return;
        if (prevPeriodKey.current === '') {
            prevPeriodKey.current = key;
            return;
        }
        prevPeriodKey.current = key;
        for (const s of SECTIONS) {
            if (sections[s.id]?.open && sections[s.id]?.data !== null) {
                fetchSectionData(s.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodMode, currentMonth, currentYear, fetchSectionData]);

    // ソースフィルター変更時: funnelセクションのみ再フェッチ
    const prevSourceKey = useRef('');
    useEffect(() => {
        const key = selectedSources.join(',');
        if (prevSourceKey.current === key) return;
        if (prevSourceKey.current === '' && key === '') {
            prevSourceKey.current = key;
            return;
        }
        prevSourceKey.current = key;
        if (sections.funnel?.open && sections.funnel?.data !== null) {
            fetchSectionData('funnel');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSources]);

    // ======================== セクション開閉 ========================

    const toggleSection = useCallback((sectionId: string) => {
        setSections(prev => {
            const cur = prev[sectionId];
            const nowOpen = !cur.open;
            const updated = { ...prev, [sectionId]: { ...cur, open: nowOpen } };
            // 開いた時にデータ未取得なら取得
            if (nowOpen && cur.data === null && !cur.loading) {
                setTimeout(() => fetchSectionData(sectionId), 0);
            }
            return updated;
        });
    }, [fetchSectionData]);

    // ======================== GA4差分分析 ========================

    const fetchCompareData = useCallback(async () => {
        setCompareLoading(true);
        setCompareError(null);
        setCompareData(null);

        try {
            const { startDate, endDate, breakdown } = getDateRange();

            // DB側（funnel-analytics）とGA4側（ga-analytics compare）を並行取得
            const [funnelRes, ga4Res] = await Promise.all([
                fetch(`/api/funnel-analytics?startDate=${startDate}&endDate=${endDate}&breakdown=${breakdown}&source=all`),
                fetch(`/api/ga-analytics?reportType=compare&startDate=${startDate}&endDate=${endDate}`),
            ]);

            if (!funnelRes.ok) throw new Error(`DB API error: ${funnelRes.status}`);
            if (!ga4Res.ok) throw new Error(`GA4 API error: ${ga4Res.status}`);

            const funnelJson = await funnelRes.json();
            const ga4Json = await ga4Res.json();

            setCompareData({
                db: {
                    registrationPagePV: funnelJson.funnel?.registrationPagePV ?? funnelJson.registrationPagePV ?? 0,
                    registrationPageUU: funnelJson.funnel?.registrationPageUU ?? funnelJson.registrationPageUU ?? 0,
                    searchPV: funnelJson.funnel?.searchPV ?? 0,
                    searchReached: funnelJson.funnel?.searchReached ?? 0,
                    jobViewedPV: funnelJson.funnel?.jobViewedPV ?? 0,
                    jobViewed: funnelJson.funnel?.jobViewed ?? 0,
                },
                ga4: ga4Json,
            });
        } catch (err) {
            console.error('GA4 comparison fetch error:', err);
            setCompareError(err instanceof Error ? err.message : 'データ取得に失敗しました');
        } finally {
            setCompareLoading(false);
        }
    }, [getDateRange]);

    const handleOpenCompare = useCallback(() => {
        setShowCompareModal(true);
        fetchCompareData();
    }, [fetchCompareData]);

    // ======================== ナビゲーション ========================

    const navigateMonth = (direction: number) => {
        const next = new Date(currentMonth);
        next.setMonth(next.getMonth() + direction);
        setCurrentMonth(next);
    };

    const navigateYear = (direction: number) => {
        const next = new Date(currentYear);
        next.setFullYear(next.getFullYear() + direction);
        setCurrentYear(next);
    };

    // ======================== レンダリング ========================

    return (
        <div>
            {/* コントロールバー */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* モード切替 */}
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                {(['daily', 'monthly'] as PeriodMode[]).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setPeriodMode(mode)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                            periodMode === mode
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {mode === 'daily' ? '日' : '月'}
                                    </button>
                                ))}
                            </div>

                            {/* ナビゲーション: 日モード */}
                            {periodMode === 'daily' && (
                                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                                    <button onClick={() => navigateMonth(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[120px] text-center">
                                        {formatMonthDisplay(currentMonth)}
                                    </span>
                                    <button onClick={() => navigateMonth(1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* ナビゲーション: 月モード */}
                            {periodMode === 'monthly' && (
                                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                                    <button onClick={() => navigateYear(-1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="px-3 py-1.5 text-sm font-medium text-slate-700 min-w-[100px] text-center">
                                        {formatYearDisplay(currentYear)}
                                    </span>
                                    <button onClick={() => navigateYear(1)} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* GA4差分分析 + ソースフィルター */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleOpenCompare}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                GA4差分分析
                            </button>
                            {selectedSources.length > 0 && (
                                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                                    登録動線のみ適用
                                </span>
                            )}
                            <button
                                onClick={() => setShowFilterDropdown(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                    selectedSources.length > 0
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                絞り込み
                                {selectedSources.length > 0 && (
                                    <span className="ml-1 bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                                        {selectedSources.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* フィルターモーダル */}
                        {showFilterDropdown && (
                            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                                <div className="fixed inset-0 bg-black/30" onClick={() => setShowFilterDropdown(false)} />
                                <div ref={filterRef} className="relative bg-white rounded-xl shadow-2xl w-80 max-h-[70vh] flex flex-col">
                                    <div className="px-5 py-4 border-b border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-slate-800">流入元で絞り込み</h3>
                                            <button onClick={() => setShowFilterDropdown(false)} className="text-slate-400 hover:text-slate-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">登録動線セクションのみに適用されます</p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto py-2">
                                        {[...FIXED_SOURCE_OPTIONS, ...lpOptions].map(opt => {
                                            const isSelected = selectedSources.includes(opt.value);
                                            return (
                                                <label
                                                    key={opt.value}
                                                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedSources(prev =>
                                                            isSelected
                                                                ? prev.filter(s => s !== opt.value)
                                                                : [...prev, opt.value]
                                                        );
                                                    }}
                                                >
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                                                    }`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="text-sm text-slate-700">{opt.label}</span>
                                                </label>
                                            );
                                        })}
                                        {lpOptions.length === 0 && (
                                            <div className="px-5 py-3 text-xs text-slate-400">LP情報を読み込み中...</div>
                                        )}
                                    </div>
                                    <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
                                        {selectedSources.length > 0 ? (
                                            <button onClick={() => setSelectedSources([])} className="text-xs text-slate-500 hover:text-slate-700">全解除</button>
                                        ) : (
                                            <span className="text-xs text-slate-400">{[...FIXED_SOURCE_OPTIONS, ...lpOptions].length}件の流入元</span>
                                        )}
                                        <button onClick={() => setShowFilterDropdown(false)} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">閉じる</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* GA4差分分析モーダル */}
            {showCompareModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/30" onClick={() => setShowCompareModal(false)} />
                    <div className="relative bg-white rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-emerald-600" />
                                        GA4差分分析
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        独自DB と GA4 の数値を比較（{periodMode === 'daily' ? formatMonthDisplay(currentMonth) : formatYearDisplay(currentYear)}）
                                    </p>
                                </div>
                                <button onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {compareLoading && (
                                <div className="text-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                    <p className="mt-3 text-sm text-slate-500">データを取得中...</p>
                                </div>
                            )}

                            {compareError && (
                                <div className="text-center py-12">
                                    <p className="text-sm text-red-500">{compareError}</p>
                                    <button onClick={fetchCompareData} className="mt-3 text-sm text-indigo-600 hover:underline">再試行</button>
                                </div>
                            )}

                            {compareData && !compareLoading && (
                                <>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500">
                                                <th className="px-4 py-2.5 text-left text-xs font-medium">指標</th>
                                                <th className="px-4 py-2.5 text-right text-xs font-medium">独自DB</th>
                                                <th className="px-4 py-2.5 text-right text-xs font-medium">GA4</th>
                                                <th className="px-4 py-2.5 text-right text-xs font-medium">差分</th>
                                                <th className="px-4 py-2.5 text-right text-xs font-medium">差分率</th>
                                                <th className="px-4 py-2.5 text-center text-xs font-medium">判定</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(() => {
                                                const rows = [
                                                    { label: '登録ページPV', dbVal: compareData.db.registrationPagePV, ga4Val: compareData.ga4.registrationPage.pageViews },
                                                    { label: '登録ページUU', dbVal: compareData.db.registrationPageUU, ga4Val: compareData.ga4.registrationPage.totalUsers },
                                                    { label: '求人検索PV', dbVal: compareData.db.searchPV, ga4Val: compareData.ga4.jobSearchPage.pageViews },
                                                    { label: '求人検索UU', dbVal: compareData.db.searchReached, ga4Val: compareData.ga4.jobSearchPage.totalUsers },
                                                    { label: '求人詳細PV', dbVal: compareData.db.jobViewedPV, ga4Val: compareData.ga4.jobDetailPage.pageViews },
                                                    { label: '求人詳細UU', dbVal: compareData.db.jobViewed, ga4Val: compareData.ga4.jobDetailPage.totalUsers },
                                                ];

                                                return rows.map(row => {
                                                    const diff = row.ga4Val - row.dbVal;
                                                    const diffRate = row.dbVal > 0 ? (diff / row.dbVal) * 100 : 0;
                                                    const absDiffRate = Math.abs(diffRate);
                                                    let statusColor = 'text-emerald-600 bg-emerald-50';
                                                    let statusLabel = '正常';
                                                    if (absDiffRate > 20) {
                                                        statusColor = 'text-red-600 bg-red-50';
                                                        statusLabel = '要確認';
                                                    } else if (absDiffRate > 10) {
                                                        statusColor = 'text-amber-600 bg-amber-50';
                                                        statusLabel = '注意';
                                                    }

                                                    return (
                                                        <tr key={row.label} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 text-slate-700 font-medium">{row.label}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums">{row.dbVal.toLocaleString()}</td>
                                                            <td className="px-4 py-2.5 text-right tabular-nums">{row.ga4Val.toLocaleString()}</td>
                                                            <td className={`px-4 py-2.5 text-right tabular-nums ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-blue-500' : ''}`}>
                                                                {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                                            </td>
                                                            <td className={`px-4 py-2.5 text-right tabular-nums ${absDiffRate > 20 ? 'text-red-500 font-medium' : absDiffRate > 10 ? 'text-amber-500' : ''}`}>
                                                                {row.dbVal > 0 ? `${diffRate > 0 ? '+' : ''}${diffRate.toFixed(1)}%` : '—'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColor}`}>
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>

                                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            <span className="font-medium text-slate-600">差分の要因:</span>{' '}
                                            GA4は広告ブロッカー（GTMがブロックされる）、ボットフィルタリング、管理者パス除外の影響で、
                                            独自DBよりも数値が低くなる傾向があります。10%以内の差分は正常範囲です。
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-xs">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />正常（10%以内）</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />注意（10-20%）</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />要確認（20%超）</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setShowCompareModal(false)}
                                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* セクション一覧 */}
            <div className="space-y-3">
                {SECTIONS.map(section => {
                    const state = sections[section.id];
                    if (!state) return null;

                    return (
                        <div key={section.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                            {/* セクションヘッダー */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className={`w-full flex items-center justify-between px-6 py-3 ${section.bgColor} hover:opacity-90 transition-opacity`}
                            >
                                <div className="flex items-center gap-2">
                                    {state.open ? <ChevronUp className={`w-4 h-4 ${section.headerTextColor}`} /> : <ChevronDown className={`w-4 h-4 ${section.headerTextColor}`} />}
                                    <span className={`font-semibold text-sm ${section.headerTextColor}`}>{section.title}</span>
                                    <span className="text-xs text-slate-500">({section.metrics.length}指標)</span>
                                </div>
                                {state.loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                            </button>

                            {/* テーブル */}
                            {state.open && (
                                <div>
                                    {state.loading && !state.data && (
                                        <div className="text-center py-8">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                            <p className="mt-2 text-xs text-slate-500">読み込み中...</p>
                                        </div>
                                    )}

                                    {state.error && (
                                        <div className="text-center py-8 text-sm text-red-500">{state.error}</div>
                                    )}

                                    {state.data && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm table-fixed">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500">
                                                        <th className={`px-4 py-2.5 text-left text-xs font-medium sticky left-0 ${section.stickyBg} z-20 w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-200`}>
                                                            指標名
                                                        </th>
                                                        <th className={`px-3 py-2.5 text-right text-xs font-medium sticky left-[200px] ${section.stickyBg} z-20 w-[70px] min-w-[70px] max-w-[70px] border-r-2 border-slate-300`}>
                                                            合計
                                                        </th>
                                                        {state.dateColumns.map(col => (
                                                            <th key={col} className="px-3 py-2.5 text-right text-xs font-medium w-[70px] min-w-[70px] whitespace-nowrap">
                                                                {periodMode === 'daily' ? formatDailyPeriod(col) : formatMonthlyPeriod(col)}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {section.metrics.map(metric => {
                                                        const metricData = state.data?.[metric.dataKey];
                                                        const totalValue = metricData?.total;
                                                        const isUnavailable = totalValue === -1;

                                                        return (
                                                            <tr key={metric.dataKey} className="hover:bg-slate-50/50">
                                                                {/* 指標名 + ℹ アイコン（インライン） */}
                                                                <td className={`px-4 py-2 sticky left-0 ${section.stickyBg} z-10 border-r border-slate-200 text-xs w-[200px] min-w-[200px] max-w-[200px]`}>
                                                                    <span className="text-slate-700 font-medium">{metric.label}</span>
                                                                    <MetricTooltip definitionKey={metric.definitionKey} />
                                                                </td>
                                                                {/* 合計列 */}
                                                                <td className={`px-3 py-2 text-right font-semibold sticky left-[200px] ${section.stickyBg} z-10 border-r-2 border-slate-300 text-xs w-[70px] min-w-[70px] max-w-[70px]`}>
                                                                    {isUnavailable ? <span className="text-slate-400">-</span> : formatValue(totalValue, metric.format)}
                                                                </td>
                                                                {/* 日付列 */}
                                                                {state.dateColumns.map(col => {
                                                                    const val = metricData?.byDate[col];
                                                                    const colUnavailable = val === -1;
                                                                    return (
                                                                        <td key={col} className="px-3 py-2 text-right text-xs text-slate-600 whitespace-nowrap w-[70px] min-w-[70px]">
                                                                            {colUnavailable ? <span className="text-slate-400">-</span> : formatValue(val, metric.format)}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
