'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    createAnnouncement,
    updateAnnouncement,
    getAnnouncementDetail,
    AnnouncementFilterConditions
} from '@/src/lib/system-actions';
import { getAnalyticsRegions, RegionData } from '@/src/lib/analytics-actions';
import { ChevronLeft, Save, ChevronDown, ChevronUp, Users, Building2, AlertCircle, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import Link from 'next/link';
import { AGE_RANGES, GENDERS } from '@/src/lib/analytics-constants';
import { SERVICE_CATEGORY_LIST } from '@/constants/serviceTypes';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';

interface FilterConditions {
    regionIds: number[];
    ageRanges: string[];
    genders: string[];
    qualifications: string[];
    facilityTypes: string[];
}

type PublishMode = 'draft' | 'now' | 'scheduled';

interface AnnouncementFormProps {
    mode: 'create' | 'edit';
    announcementId?: number;
}

export default function AnnouncementForm({ mode, announcementId }: AnnouncementFormProps) {
    const { showDebugError } = useDebugError();
    const router = useRouter();
    const [loading, setLoading] = useState(mode === 'edit');
    const [submitting, setSubmitting] = useState(false);
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [isWorkerFilterOpen, setIsWorkerFilterOpen] = useState(false);
    const [isFacilityFilterOpen, setIsFacilityFilterOpen] = useState(false);
    const [isAlreadyPublished, setIsAlreadyPublished] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'NEWS',
        target_type: 'BOTH',
    });

    const [publishMode, setPublishMode] = useState<PublishMode>('draft');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('09:00');

    const [filters, setFilters] = useState<FilterConditions>({
        regionIds: [],
        ageRanges: [],
        genders: [],
        qualifications: [],
        facilityTypes: [],
    });

    // === 初期データ取得 ===
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (mode === 'edit' && announcementId) {
                    // 編集モード：お知らせデータと地域データを同時取得
                    const [data, regionsData] = await Promise.all([
                        getAnnouncementDetail(announcementId),
                        getAnalyticsRegions()
                    ]);
                    setRegions(regionsData);

                    if (data) {
                        setFormData({
                            title: data.title,
                            content: data.content,
                            category: data.category,
                            target_type: data.target_type,
                        });

                        // 既に公開済みかどうか
                        setIsAlreadyPublished(!!data.published_at);

                        // 公開モードの設定
                        if (data.published) {
                            setPublishMode('now');
                        } else if (data.scheduled_at) {
                            setPublishMode('scheduled');
                            const scheduled = new Date(data.scheduled_at);
                            setScheduledDate(scheduled.toISOString().split('T')[0]);
                            setScheduledTime(scheduled.toTimeString().slice(0, 5));
                        } else {
                            setPublishMode('draft');
                        }

                        // フィルター条件を復元
                        if (data.filter_conditions) {
                            const fc = data.filter_conditions as Record<string, unknown>;
                            setFilters({
                                regionIds: (fc.regionIds as number[]) || [],
                                ageRanges: (fc.ageRanges as string[]) || [],
                                genders: (fc.genders as string[]) || [],
                                qualifications: (fc.qualifications as string[]) || [],
                                facilityTypes: (fc.facilityTypes as string[]) || [],
                            });
                        }
                    } else {
                        toast.error('お知らせが見つかりません');
                        router.push('/system-admin/announcements');
                    }
                } else {
                    // 作成モード：地域データのみ取得
                    const regionsData = await getAnalyticsRegions();
                    setRegions(regionsData);
                }
            } catch (e) {
                const debugInfo = extractDebugInfo(e);
                showDebugError({
                    type: 'fetch',
                    operation: 'お知らせ詳細・地域データ取得',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { mode, announcementId }
                });
                console.error(e);
                toast.error('読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [mode, announcementId, router]);

    // === フィルター操作 ===
    const handleRegionChange = (regionId: number) => {
        setFilters(prev => {
            const newRegionIds = prev.regionIds.includes(regionId)
                ? prev.regionIds.filter(id => id !== regionId)
                : [...prev.regionIds, regionId];
            return { ...prev, regionIds: newRegionIds };
        });
    };

    const handleCheckboxChange = (
        key: 'ageRanges' | 'genders' | 'qualifications' | 'facilityTypes',
        value: string
    ) => {
        setFilters(prev => {
            const currentValues = prev[key];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [key]: newValues };
        });
    };

    // === 送信処理 ===
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.content) {
            toast.error('タイトルと本文は必須です');
            return;
        }

        // 予約公開の場合、日時チェック
        if (publishMode === 'scheduled') {
            if (!scheduledDate) {
                toast.error('公開日を選択してください');
                return;
            }
            const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
            if (scheduledDateTime <= new Date()) {
                toast.error('公開日時は現在より後の日時を設定してください');
                return;
            }
        }

        const isWorkerTarget = formData.target_type === 'WORKER' || formData.target_type === 'BOTH';
        const isFacilityTarget = formData.target_type === 'FACILITY' || formData.target_type === 'BOTH';

        setSubmitting(true);
        try {
            // フィルター条件を整形
            const filterConditions: AnnouncementFilterConditions = {};

            if (isWorkerTarget) {
                if (filters.ageRanges.length > 0) filterConditions.ageRanges = filters.ageRanges;
                if (filters.genders.length > 0) filterConditions.genders = filters.genders;
                if (filters.qualifications.length > 0) filterConditions.qualifications = filters.qualifications;
            }

            if (isFacilityTarget) {
                if (filters.facilityTypes.length > 0) filterConditions.facilityTypes = filters.facilityTypes;
            }

            if (filters.regionIds.length > 0) {
                filterConditions.regionIds = filters.regionIds;
            }

            // 予約公開日時の設定
            let scheduled_at: string | null = null;
            if (publishMode === 'scheduled' && scheduledDate) {
                scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            }

            const payload = {
                ...formData,
                published: publishMode === 'now',
                scheduled_at,
                filter_conditions: filterConditions,
            };

            let result;
            if (mode === 'create') {
                result = await createAnnouncement(payload);
            } else {
                result = await updateAnnouncement(announcementId!, payload);
            }

            if (result.success) {
                const message = mode === 'create'
                    ? (publishMode === 'now' ? 'お知らせを公開しました' :
                        publishMode === 'scheduled' ? 'お知らせを予約しました' : 'お知らせを下書き保存しました')
                    : (isAlreadyPublished ? 'お知らせを更新しました' :
                        publishMode === 'now' ? 'お知らせを更新・公開しました' :
                            publishMode === 'scheduled' ? 'お知らせを更新・予約しました' : 'お知らせを更新しました');
                toast.success(message);
                router.push('/system-admin/announcements');
            } else {
                const debugInfo = extractDebugInfo(result.error);
                showDebugError({
                    type: mode === 'create' ? 'save' : 'update',
                    operation: mode === 'create' ? 'お知らせ作成' : 'お知らせ更新',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { payload }
                });
                toast.error(result.error || `${mode === 'create' ? '作成' : '更新'}に失敗しました`);
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: mode === 'create' ? 'save' : 'update',
                operation: mode === 'create' ? 'お知らせ作成' : 'お知らせ更新',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { formData, publishMode }
            });
            toast.error('エラーが発生しました');
        } finally {
            setSubmitting(false);
        }
    };

    // === 計算値 ===
    const workerFilterCount = filters.ageRanges.length + filters.genders.length + filters.qualifications.length;
    const facilityFilterCount = filters.facilityTypes.length;
    const isWorkerTarget = formData.target_type === 'WORKER' || formData.target_type === 'BOTH';
    const isFacilityTarget = formData.target_type === 'FACILITY' || formData.target_type === 'BOTH';
    const today = new Date().toISOString().split('T')[0];

    // === ローディング表示 ===
    if (loading) {
        return <div className="p-8 text-center text-slate-500">読み込み中...</div>;
    }

    // === レンダリング ===
    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* ヘッダー */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/system-admin/announcements" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">
                    {mode === 'create' ? 'お知らせ作成' : 'お知らせ編集'}
                </h1>
            </div>

            {/* 公開済み警告（編集モードのみ） */}
            {mode === 'edit' && isAlreadyPublished && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">このお知らせは既に公開されています</p>
                        <p className="text-xs text-amber-600 mt-1">
                            配信先の変更は既に配信済みのユーザーには影響しません。新しい配信先設定は次回公開時に反映されます。
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* タイトル */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            タイトル <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="お知らせのタイトル"
                        />
                    </div>

                    {/* カテゴリー・配信先タイプ */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">カテゴリー</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="NEWS">ニュース</option>
                                <option value="MAINTENANCE">メンテナンス</option>
                                <option value="EVENT">イベント</option>
                                <option value="IMPORTANT">重要</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">配信先</label>
                            <select
                                value={formData.target_type}
                                onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                disabled={mode === 'edit' && isAlreadyPublished}
                            >
                                <option value="BOTH">ワーカー・施設両方</option>
                                <option value="WORKER">ワーカーのみ</option>
                                <option value="FACILITY">施設のみ</option>
                            </select>
                        </div>
                    </div>

                    {/* 地域フィルター */}
                    {regions.length > 0 && !(mode === 'edit' && isAlreadyPublished) && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                地域で絞り込み（任意）
                            </label>
                            <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-lg">
                                {regions.map(r => (
                                    <label
                                        key={r.id}
                                        className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={filters.regionIds.includes(r.id)}
                                            onChange={() => handleRegionChange(r.id)}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        {r.name}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                選択しない場合は全地域に配信されます
                            </p>
                        </div>
                    )}

                    {/* ワーカー詳細フィルター */}
                    {isWorkerTarget && !(mode === 'edit' && isAlreadyPublished) && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setIsWorkerFilterOpen(!isWorkerFilterOpen)}
                                className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Users className="w-5 h-5 text-blue-600" />
                                    <span className="font-medium text-blue-800">ワーカー配信条件</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                        {workerFilterCount > 0 ? `${workerFilterCount}件選択中` : '全ワーカー'}
                                    </span>
                                </div>
                                {isWorkerFilterOpen ? (
                                    <ChevronUp className="w-5 h-5 text-blue-600" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-blue-600" />
                                )}
                            </button>

                            {isWorkerFilterOpen && (
                                <div className="p-4 space-y-6 bg-white">
                                    <p className="text-xs text-slate-500">
                                        選択しない場合は全てのワーカーに配信されます
                                    </p>

                                    {/* 年齢層 */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">年齢層</label>
                                        <div className="flex flex-wrap gap-4">
                                            {AGE_RANGES.map(a => (
                                                <label
                                                    key={a.value}
                                                    className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.ageRanges.includes(a.value)}
                                                        onChange={() => handleCheckboxChange('ageRanges', a.value)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    />
                                                    {a.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 性別 */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">性別</label>
                                        <div className="flex flex-wrap gap-4">
                                            {GENDERS.map(g => (
                                                <label
                                                    key={g.value}
                                                    className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.genders.includes(g.value)}
                                                        onChange={() => handleCheckboxChange('genders', g.value)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    />
                                                    {g.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 保有資格 */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">保有資格</label>
                                        <div className="space-y-4">
                                            {QUALIFICATION_GROUPS.map(group => (
                                                <div key={group.name}>
                                                    <h4 className="text-xs font-semibold text-slate-500 mb-2">{group.name}</h4>
                                                    <div className="flex flex-wrap gap-3">
                                                        {group.qualifications.map(q => (
                                                            <label
                                                                key={q}
                                                                className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters.qualifications.includes(q)}
                                                                    onChange={() => handleCheckboxChange('qualifications', q)}
                                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                                />
                                                                {q}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 施設詳細フィルター */}
                    {isFacilityTarget && !(mode === 'edit' && isAlreadyPublished) && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setIsFacilityFilterOpen(!isFacilityFilterOpen)}
                                className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-800">施設配信条件</span>
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                        {facilityFilterCount > 0 ? `${facilityFilterCount}件選択中` : '全施設'}
                                    </span>
                                </div>
                                {isFacilityFilterOpen ? (
                                    <ChevronUp className="w-5 h-5 text-green-600" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-green-600" />
                                )}
                            </button>

                            {isFacilityFilterOpen && (
                                <div className="p-4 space-y-6 bg-white">
                                    <p className="text-xs text-slate-500">
                                        選択しない場合は全ての施設に配信されます
                                    </p>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">サービス種別</label>
                                        <div className="flex flex-wrap gap-4">
                                            {SERVICE_CATEGORY_LIST.map(t => (
                                                <label
                                                    key={t}
                                                    className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.facilityTypes.includes(t)}
                                                        onChange={() => handleCheckboxChange('facilityTypes', t)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    />
                                                    {t}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 本文 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            本文 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required
                            rows={10}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="お知らせの内容を入力してください"
                        />
                    </div>

                    {/* 公開設定（公開済みでない場合のみ） */}
                    {!(mode === 'edit' && isAlreadyPublished) && (
                        <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                            <label className="block text-sm font-medium text-slate-700">公開設定</label>

                            <div className="space-y-3">
                                {/* 下書き保存 */}
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="publishMode"
                                        checked={publishMode === 'draft'}
                                        onChange={() => setPublishMode('draft')}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Save className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm text-slate-700">下書きとして保存</span>
                                    </div>
                                </label>

                                {/* 今すぐ公開 */}
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="publishMode"
                                        checked={publishMode === 'now'}
                                        onChange={() => setPublishMode('now')}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Send className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-slate-700">今すぐ公開する</span>
                                    </div>
                                </label>

                                {/* 予約公開 */}
                                <div className={`p-3 rounded-lg border ${publishMode === 'scheduled' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="publishMode"
                                            checked={publishMode === 'scheduled'}
                                            onChange={() => setPublishMode('scheduled')}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-indigo-500" />
                                            <span className="text-sm text-slate-700">日時を指定して公開</span>
                                        </div>
                                    </label>

                                    {publishMode === 'scheduled' && (
                                        <div className="mt-4 ml-7 flex items-center gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">公開日</label>
                                                <input
                                                    type="date"
                                                    value={scheduledDate}
                                                    onChange={(e) => setScheduledDate(e.target.value)}
                                                    min={today}
                                                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">公開時刻</label>
                                                <input
                                                    type="time"
                                                    value={scheduledTime}
                                                    onChange={(e) => setScheduledTime(e.target.value)}
                                                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ボタン */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Link
                            href="/system-admin/announcements"
                            className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            キャンセル
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70 ${mode === 'edit' && isAlreadyPublished
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : publishMode === 'now'
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : publishMode === 'scheduled'
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        : 'bg-slate-600 text-white hover:bg-slate-700'
                                }`}
                        >
                            {mode === 'edit' && isAlreadyPublished ? (
                                <Save className="w-4 h-4" />
                            ) : publishMode === 'now' ? (
                                <Send className="w-4 h-4" />
                            ) : publishMode === 'scheduled' ? (
                                <Clock className="w-4 h-4" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {submitting ? '保存中...' :
                                mode === 'edit' && isAlreadyPublished ? '更新する' :
                                    publishMode === 'now' ? '公開する' :
                                        publishMode === 'scheduled' ? '予約する' :
                                            '下書き保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
