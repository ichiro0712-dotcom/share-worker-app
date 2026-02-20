'use client';

import { Book } from 'lucide-react';

// 全指標の定義（システム全体で統一使用）
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
            }
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
                definition: 'LP経由で登録したワーカーが行った応募の総数。応募・マッチングタブの応募数と同じ Application テーブルを使用し、LP帰属フィルター（User.registration_lp_id）で絞り込む',
                calculation: 'applications テーブルで user.registration_lp_id が対象LP のレコード数',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'applicationRate',
                label: '応募率',
                definition: 'LP経由で登録したワーカーのうち、1回以上応募したユニークユーザーの割合（登録数基準、100%を超えない）',
                calculation: '応募ユニークユーザー数（LP帰属） ÷ 登録数 × 100',
                usedIn: ['LP分析（公開求人）', 'LP分析（LP別アクセス状況）']
            },
            {
                key: 'avgDaysToApplication',
                label: '平均応募日数',
                definition: 'LP経由で登録したワーカー1人あたりの平均応募日数（何日分のシフトに応募したか）',
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

export default function MetricDefinitions() {
    return (
        <div className="space-y-8">
            <div className="flex items-center gap-2 mb-6">
                <Book className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-800">指標定義一覧</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
                このページでは、アナリティクスやダッシュボードで使用される全ての指標の定義を確認できます。
                各指標の計算方法は、システム全体で統一されています。
            </p>

            {Object.entries(METRIC_DEFINITIONS).map(([categoryKey, category]) => (
                <div key={categoryKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                        <h3 className="font-semibold text-slate-800">{category.title}</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {category.metrics.map((metric) => (
                            <div key={metric.key} className="px-6 py-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <span className="font-medium text-slate-800">{metric.label}</span>
                                        <code className="ml-2 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                            {metric.key}
                                        </code>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 mb-2">{metric.definition}</p>
                                <div className="flex flex-wrap gap-4 text-xs">
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400">計算:</span>
                                        <span className="text-slate-600 font-mono bg-slate-50 px-1.5 py-0.5 rounded">
                                            {metric.calculation}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-400">使用箇所:</span>
                                        <div className="flex gap-1">
                                            {metric.usedIn.map((usage, idx) => (
                                                <span
                                                    key={idx}
                                                    className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded"
                                                >
                                                    {usage}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
