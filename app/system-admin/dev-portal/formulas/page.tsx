'use client';

import Link from 'next/link';
import { ArrowLeft, Calculator, Users, Building2, Briefcase, GitMerge, Bell, FileCode, ExternalLink } from 'lucide-react';

// 計算式データ定義
interface FormulaDefinition {
    key: string;
    label: string;
    definition: string;
    formula: string;
    sourceFile: string;
    sourceLine?: string;
    category: 'worker' | 'facility' | 'job' | 'matching' | 'alert';
}

// 全計算式の一覧
const FORMULA_DEFINITIONS: FormulaDefinition[] = [
    // ワーカー関連
    {
        key: 'totalWorkers',
        label: '登録ワーカー数',
        definition: '現在登録されているワーカーの総数（退会者除く）',
        formula: 'users WHERE deleted_at IS NULL のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getWorkerAnalyticsData()',
        category: 'worker',
    },
    {
        key: 'newCount',
        label: '入会ワーカー数',
        definition: '指定期間内に新規登録したワーカー数',
        formula: '指定期間の created_at を持つ users レコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getWorkerAnalyticsData()',
        category: 'worker',
    },
    {
        key: 'withdrawnCount',
        label: '退会ワーカー数',
        definition: '指定期間内に退会したワーカー数',
        formula: '指定期間の deleted_at を持つ users レコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getWorkerAnalyticsData()',
        category: 'worker',
    },
    {
        key: 'withdrawalRate',
        label: '退会率',
        definition: '期間開始時の登録ワーカー数に対する退会者の割合',
        formula: '退会ワーカー数 ÷ 期間開始時登録数 × 100',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getWorkerAnalyticsData()',
        category: 'worker',
    },
    {
        key: 'workerReviewCount',
        label: 'レビュー数（ワーカー受領）',
        definition: 'ワーカーが施設から受けたレビュー数',
        formula: 'reviews WHERE reviewer_type = FACILITY のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getWorkerAnalyticsData()',
        category: 'worker',
    },
    {
        key: 'workerReviewAvg',
        label: 'レビュー平均点（ワーカー）',
        definition: 'ワーカーが施設から受けたレビューの平均評価',
        formula: 'レビュー合計点 ÷ レビュー数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getWorkerAnalyticsData()',
        category: 'worker',
    },
    {
        key: 'cancelRate',
        label: 'キャンセル率',
        definition: 'ワーカーによる応募キャンセルの割合',
        formula: 'ワーカーキャンセル数 ÷ 総応募数 × 100',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行345-350',
        category: 'worker',
    },
    {
        key: 'lastMinuteCancelRate',
        label: '直前キャンセル率',
        definition: '勤務前日以降にキャンセルした割合（全応募数に対する比率）',
        formula: '勤務前日以降のキャンセル数 ÷ 全応募数 × 100',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行352-360',
        category: 'worker',
    },

    // 施設関連
    {
        key: 'totalFacilities',
        label: '登録施設数',
        definition: '現在登録されている施設の総数（退会施設除く）',
        formula: 'facilities WHERE deleted_at IS NULL のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getFacilityAnalyticsData()',
        category: 'facility',
    },
    {
        key: 'newFacilityCount',
        label: '施設登録数',
        definition: '指定期間内に新規登録した施設数',
        formula: '指定期間の created_at を持つ facilities レコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getFacilityAnalyticsData()',
        category: 'facility',
    },
    {
        key: 'facilityReviewCount',
        label: 'レビュー数（施設受領）',
        definition: '施設がワーカーから受けたレビュー数',
        formula: 'reviews WHERE reviewer_type = WORKER のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getFacilityAnalyticsData()',
        category: 'facility',
    },
    {
        key: 'facilityReviewAvg',
        label: 'レビュー平均点（施設）',
        definition: '施設がワーカーから受けたレビューの平均評価',
        formula: 'レビュー合計点 ÷ レビュー数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getFacilityAnalyticsData()',
        category: 'facility',
    },
    {
        key: 'facilityWithdrawalRate',
        label: '施設退会率',
        definition: '期間開始時の登録施設数に対する退会施設の割合',
        formula: '退会施設数 ÷ 期間開始時登録数 × 100',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getFacilityAnalyticsData()',
        category: 'facility',
    },

    // 求人関連
    {
        key: 'parentJobCount',
        label: '親求人数',
        definition: '求人の基本情報数。1つの親求人に複数の勤務日（子求人）が紐づく',
        formula: 'jobs WHERE status = PUBLISHED のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getMatchingAnalyticsData()',
        category: 'job',
    },
    {
        key: 'childJobCount',
        label: '子求人数',
        definition: '実際の勤務日単位の求人数。ワーカーはこの単位で応募',
        formula: 'job_work_dates のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getMatchingAnalyticsData()',
        category: 'job',
    },
    {
        key: 'totalSlots',
        label: '総応募枠数',
        definition: '全ての子求人の募集人数の合計',
        formula: 'Σ（各子求人の recruitment_count）',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行707-715',
        category: 'job',
    },
    {
        key: 'remainingSlots',
        label: '応募枠数（残り）',
        definition: '全ての子求人でまだ埋まっていない応募枠の合計',
        formula: 'Σ（各子求人の recruitment_count - 確定済み応募数）',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行707-715',
        category: 'job',
    },
    {
        key: 'parentJobsPerFacility',
        label: '施設あたり親求人数',
        definition: '1施設あたりの平均親求人数',
        formula: '親求人数 ÷ アクティブ施設数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行750-757',
        category: 'job',
    },
    {
        key: 'childJobsPerFacility',
        label: '施設あたり子求人数',
        definition: '1施設あたりの平均子求人数',
        formula: '子求人数 ÷ アクティブ施設数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行750-757',
        category: 'job',
    },
    {
        key: 'limitedJobCount',
        label: '限定求人数',
        definition: '勤務済みワーカー限定またはお気に入り限定の求人数',
        formula: 'jobs WHERE job_type IN (LIMITED_WORKED, LIMITED_FAVORITE) のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getMatchingAnalyticsData()',
        category: 'job',
    },
    {
        key: 'offerJobCount',
        label: 'オファー数',
        definition: '施設から特定ワーカーへ送られた個別オファー数',
        formula: 'jobs WHERE job_type = OFFER のレコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getMatchingAnalyticsData()',
        category: 'job',
    },
    {
        key: 'offerAcceptanceRate',
        label: 'オファー承諾率',
        definition: 'オファー求人のうち承諾した割合',
        formula: 'オファー承諾数 ÷ オファー求人数 × 100',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行782-790',
        category: 'job',
    },
    {
        key: 'limitedJobApplicationRate',
        label: '限定求人応募率',
        definition: '限定求人に対して応募があった割合',
        formula: '限定求人応募数 ÷ 限定求人数 × 100',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行782-790',
        category: 'job',
    },

    // マッチング関連
    {
        key: 'applicationCount',
        label: '応募数',
        definition: '指定期間内に行われた応募の総数',
        formula: '指定期間内の applications レコード数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getMatchingAnalyticsData()',
        category: 'matching',
    },
    {
        key: 'matchingCount',
        label: 'マッチング数',
        definition: '応募がマッチング成立（SCHEDULED以上）したもの',
        formula: 'ステータスが APPLIED, CANCELLED 以外の応募数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: 'getMatchingAnalyticsData()',
        category: 'matching',
    },
    {
        key: 'avgMatchingHours',
        label: 'マッチング期間（時間）',
        definition: '親求人作成〜マッチング成立までの平均時間',
        formula: 'Σ（マッチング成立時刻 - 親求人作成時刻）÷ マッチング数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行729-736',
        category: 'matching',
    },
    {
        key: 'avgApplicationMatchingPeriod',
        label: '応募→マッチング平均',
        definition: 'ワーカー応募〜マッチングまでの平均時間',
        formula: 'Σ（マッチング成立時刻 - 応募時刻）÷ マッチング数',
        sourceFile: 'src/lib/system-actions.ts',
        sourceLine: '行1415-1420',
        category: 'matching',
    },
    {
        key: 'avgJobMatchingPeriod',
        label: '求人公開→初回マッチング平均',
        definition: '求人公開〜最初のマッチング成立までの平均時間',
        formula: '各求人の（初回マッチング時刻 - 求人公開時刻）の平均',
        sourceFile: 'src/lib/system-actions.ts',
        sourceLine: '行1443-1457',
        category: 'matching',
    },
    {
        key: 'applicationsPerWorker',
        label: 'ワーカーあたり応募数',
        definition: 'アクティブワーカー1人あたりの平均応募数',
        formula: '応募数 ÷ アクティブワーカー数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行738-748',
        category: 'matching',
    },
    {
        key: 'matchingsPerWorker',
        label: 'ワーカーあたりマッチング数',
        definition: 'アクティブワーカー1人あたりの平均マッチング数',
        formula: 'マッチング数 ÷ アクティブワーカー数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行738-748',
        category: 'matching',
    },
    {
        key: 'reviewsPerWorker',
        label: 'ワーカーあたりレビュー数',
        definition: 'アクティブワーカー1人あたりの平均レビュー受領数',
        formula: 'ワーカー受領レビュー数 ÷ アクティブワーカー数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行738-748',
        category: 'matching',
    },
    {
        key: 'matchingsPerFacility',
        label: '施設あたりマッチング数',
        definition: 'アクティブ施設1施設あたりの平均マッチング数',
        formula: 'マッチング数 ÷ アクティブ施設数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行750-757',
        category: 'matching',
    },
    {
        key: 'reviewsPerFacility',
        label: '施設あたりレビュー数',
        definition: 'アクティブ施設1施設あたりの平均レビュー受領数',
        formula: '施設受領レビュー数 ÷ アクティブ施設数',
        sourceFile: 'src/lib/analytics-actions.ts',
        sourceLine: '行750-757',
        category: 'matching',
    },

    // アラート関連
    {
        key: 'avgRatingThreshold',
        label: '平均評価閾値',
        definition: 'この値以下の平均評価でアラートが発動する',
        formula: '通知設定で設定可能（デフォルト: 2.5）',
        sourceFile: 'app/system-admin/analytics/tabs/MetricDefinitions.tsx',
        category: 'alert',
    },
    {
        key: 'cancelRateThreshold',
        label: 'キャンセル率閾値',
        definition: 'この値を超えるキャンセル率でアラートが発動する',
        formula: '通知設定で設定可能（デフォルト: 30%）',
        sourceFile: 'app/system-admin/analytics/tabs/MetricDefinitions.tsx',
        category: 'alert',
    },
    {
        key: 'consecutiveLowRatingCount',
        label: '連続低評価回数',
        definition: 'この回数連続で低評価を受けるとアラートが発動',
        formula: '通知設定で設定可能（デフォルト: 3回）',
        sourceFile: 'app/system-admin/analytics/tabs/MetricDefinitions.tsx',
        category: 'alert',
    },
];

// カテゴリ設定
const CATEGORIES = {
    worker: { label: 'ワーカー関連', icon: Users, color: 'blue' },
    facility: { label: '施設関連', icon: Building2, color: 'green' },
    job: { label: '求人関連', icon: Briefcase, color: 'purple' },
    matching: { label: 'マッチング関連', icon: GitMerge, color: 'orange' },
    alert: { label: 'アラート関連', icon: Bell, color: 'red' },
} as const;

// ソースファイルの説明
const SOURCE_FILES = [
    {
        path: 'src/lib/analytics-actions.ts',
        description: '各分析機能の実装。実際のDB計算・データ取得を担当',
        functions: ['getWorkerAnalyticsData()', 'getFacilityAnalyticsData()', 'getMatchingAnalyticsData()'],
    },
    {
        path: 'src/lib/system-actions.ts',
        description: 'システム管理用のアクション関数。期間統計の詳細計算を実装',
        functions: ['getMatchingPeriodStats()'],
    },
    {
        path: 'app/system-admin/analytics/tabs/MetricDefinitions.tsx',
        description: 'システム全体で統一使用される全指標の定義（ユーザー表示用）',
        functions: ['METRIC_DEFINITIONS オブジェクト'],
    },
    {
        path: 'src/lib/analytics-constants.ts',
        description: 'フィルター用の定数定義（年齢層、性別、施設種類、都道府県）',
        functions: [],
    },
];

export default function FormulasPage() {
    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
            blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
            green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
            purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
            orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800' },
            red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
        };
        return colors[color] || colors.blue;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* ヘッダー */}
                <header className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Link
                            href="/system-admin/dev-portal"
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <div className="bg-indigo-600 p-2 rounded-lg">
                                    <Calculator className="w-6 h-6 text-white" />
                                </div>
                                計算式・指標一覧
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">システム全体で使用される計算式・メトリクスの統合管理</p>
                        </div>
                    </div>

                    {/* サマリー */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                        {Object.entries(CATEGORIES).map(([key, cat]) => {
                            const count = FORMULA_DEFINITIONS.filter(f => f.category === key).length;
                            const colors = getColorClasses(cat.color);
                            const Icon = cat.icon;
                            return (
                                <a
                                    key={key}
                                    href={`#${key}`}
                                    className={`${colors.bg} ${colors.border} border rounded-lg p-3 hover:shadow-md transition-all`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className={`w-4 h-4 ${colors.text}`} />
                                        <span className={`text-sm font-medium ${colors.text}`}>{cat.label}</span>
                                    </div>
                                    <div className={`text-2xl font-bold ${colors.text} mt-1`}>{count}</div>
                                </a>
                            );
                        })}
                    </div>
                </header>

                {/* ソースファイル一覧 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                        <FileCode className="w-4 h-4 text-gray-600" />
                        ソースファイル一覧
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {SOURCE_FILES.map((file) => (
                            <div key={file.path} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                                <div className="font-mono text-sm text-indigo-600 mb-1">{file.path}</div>
                                <p className="text-sm text-gray-600 mb-2">{file.description}</p>
                                {file.functions.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {file.functions.map((fn) => (
                                            <span key={fn} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                {fn}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* カテゴリ別計算式一覧 */}
                {Object.entries(CATEGORIES).map(([categoryKey, category]) => {
                    const formulas = FORMULA_DEFINITIONS.filter(f => f.category === categoryKey);
                    const colors = getColorClasses(category.color);
                    const Icon = category.icon;

                    return (
                        <div
                            key={categoryKey}
                            id={categoryKey}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                        >
                            <h2 className={`text-lg font-bold ${colors.text} mb-4 flex items-center gap-2 border-b pb-3`}>
                                <Icon className="w-5 h-5" />
                                {category.label}
                                <span className={`${colors.badge} text-xs px-2 py-0.5 rounded-full ml-2`}>
                                    {formulas.length} 指標
                                </span>
                            </h2>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 w-[180px]">指標名</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 w-[250px]">定義</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600">計算式</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600 w-[200px]">ソース</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formulas.map((formula) => (
                                            <tr key={formula.key} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-3">
                                                    <div className="font-medium text-gray-900">{formula.label}</div>
                                                    <div className="font-mono text-xs text-gray-400">{formula.key}</div>
                                                </td>
                                                <td className="py-3 px-3 text-gray-600">{formula.definition}</td>
                                                <td className="py-3 px-3">
                                                    <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-800">
                                                        {formula.formula}
                                                    </code>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="font-mono text-xs text-indigo-600">{formula.sourceFile}</div>
                                                    {formula.sourceLine && (
                                                        <div className="text-xs text-gray-400">{formula.sourceLine}</div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}

                {/* 関連リンク */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                        <ExternalLink className="w-4 h-4 text-gray-600" />
                        関連ページ
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Link
                            href="/system-admin/analytics"
                            className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                        >
                            <div className="font-medium text-gray-900">アナリティクス</div>
                            <p className="text-xs text-gray-500 mt-1">指標を使用したダッシュボード</p>
                        </Link>
                        <Link
                            href="/system-admin/dev-portal"
                            className="block p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all"
                        >
                            <div className="font-medium text-gray-900">開発ポータル</div>
                            <p className="text-xs text-gray-500 mt-1">開発者向けダッシュボード</p>
                        </Link>
                        <Link
                            href="/system-admin/alerts"
                            className="block p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-md transition-all"
                        >
                            <div className="font-medium text-gray-900">アラート設定</div>
                            <p className="text-xs text-gray-500 mt-1">閾値に基づくアラート管理</p>
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
