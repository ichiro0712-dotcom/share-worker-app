'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSystemWorkerDetail, toggleWorkerSuspension, generateWorkerMasqueradeToken, getWorkerEditLogs } from '@/src/lib/system-actions';
import {
    ChevronLeft, Ban, CheckCircle, Mail, Phone, MapPin, Calendar, Briefcase,
    FileText, Star, User, Clock, AlertTriangle, LogIn, Shield, CreditCard,
    Building, Users, History
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

// 経験分野の略称変換
const getAbbreviation = (field: string): string => {
    const abbreviations: Record<string, string> = {
        '特別養護老人ホーム': '特養',
        '介護老人保健施設': '老健',
        'グループホーム': 'GH',
        'デイサービス': 'デイ',
        '訪問介護': '訪介',
        '有料老人ホーム': '有料',
        'サービス付き高齢者向け住宅': 'サ高住',
    };
    return abbreviations[field] || field;
};

// 経験分野の色を取得
const getExperienceColor = (field: string): string => {
    const colors: Record<string, string> = {
        '特別養護老人ホーム': 'bg-blue-600',
        '介護老人保健施設': 'bg-indigo-600',
        'グループホーム': 'bg-purple-600',
        'デイサービス': 'bg-orange-500',
        '訪問介護': 'bg-green-600',
        '有料老人ホーム': 'bg-pink-600',
        'サービス付き高齢者向け住宅': 'bg-teal-600',
    };
    return colors[field] || 'bg-gray-600';
};

// 日付フォーマット
const formatDate = (dateString: string | Date): { month: string; day: string } => {
    const date = new Date(dateString);
    return {
        month: `${date.getMonth() + 1}月`,
        day: date.getDate().toString().padStart(2, '0'),
    };
};

// 勤務区分を判定
const getShiftType = (startTime: string, endTime: string): { label: string; bgColor: string; textColor: string } => {
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);

    if (startHour >= 17 || endHour < startHour) {
        return { label: '夜勤', bgColor: 'bg-purple-100', textColor: 'text-purple-700' };
    }
    if (endHour <= 13) {
        return { label: '午前', bgColor: 'bg-orange-100', textColor: 'text-orange-700' };
    }
    if (startHour >= 13) {
        return { label: '午後', bgColor: 'bg-teal-100', textColor: 'text-teal-700' };
    }
    return { label: '日勤', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
};

export default function SystemAdminWorkerDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { showDebugError } = useDebugError();
    const workerId = parseInt(params.id);
    const [worker, setWorker] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSuspended, setIsSuspended] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [editLogs, setEditLogs] = useState<any[]>([]);
    const [showEditLogs, setShowEditLogs] = useState(false);

    useEffect(() => {
        const loadWorker = async () => {
            setLoading(true);
            try {
                const [data, logs] = await Promise.all([
                    getSystemWorkerDetail(workerId),
                    getWorkerEditLogs(workerId, 10)
                ]);
                if (data) {
                    setWorker(data);
                    setIsSuspended(data.isSuspended);
                }
                setEditLogs(logs);
            } catch (error) {
                const debugInfo = extractDebugInfo(error);
                showDebugError({
                    type: 'fetch',
                    operation: 'ワーカー詳細・編集ログ取得',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { workerId }
                });
                console.error('Failed to load worker:', error);
            } finally {
                setLoading(false);
            }
        };
        loadWorker();
    }, [workerId]);

    const handleToggleSuspension = async () => {
        if (!confirm(isSuspended ? 'このワーカーのアカウント停止を解除しますか？' : 'このワーカーのアカウントを停止しますか？\n停止するとワーカーはログインできなくなります。')) {
            return;
        }

        setProcessing(true);
        try {
            const result = await toggleWorkerSuspension(workerId, !isSuspended);
            if (result.success) {
                setIsSuspended(result.isSuspended ?? false);
                toast.success(result.isSuspended ? 'アカウントを停止しました' : 'アカウント停止を解除しました');
            } else {
                toast.error('更新に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'update',
                operation: 'ワーカー停止ステータス切替',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { workerId, targetSuspension: !isSuspended }
            });
            toast.error('エラーが発生しました');
        } finally {
            setProcessing(false);
        }
    };

    const handleMasquerade = async () => {
        if (!confirm('このワーカーとしてログインします。\nワーカーのマイページにアクセスし、閲覧・編集が可能になります。')) {
            return;
        }

        try {
            const result = await generateWorkerMasqueradeToken(workerId);
            if (result.success && result.token) {
                // 別タブでマスカレードページを開く
                window.open(`/masquerade/worker?token=${result.token}`, '_blank');
            } else {
                toast.error('マスカレードトークンの生成に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'other',
                operation: 'ワーカーマスカレードトークン生成(auth)',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { workerId }
            });
            toast.error('エラーが発生しました');
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                    <p className="text-gray-500">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (!worker) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-gray-500 mb-4">ワーカーが見つかりません</p>
                    <Link href="/system-admin/workers" className="text-indigo-500 hover:underline">
                        一覧に戻る
                    </Link>
                </div>
            </div>
        );
    }

    // 経験データの変換
    const experienceData = worker.experience_fields
        ? Object.entries(worker.experience_fields as Record<string, string>).map(([field, years]) => ({ field, years }))
        : [];

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Link href="/system-admin/workers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                                {worker.name}
                                {isSuspended ? (
                                    <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full flex items-center gap-1 font-medium">
                                        <Ban className="w-4 h-4" /> 停止中
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center gap-1 font-medium">
                                        <CheckCircle className="w-4 h-4" /> 有効
                                    </span>
                                )}
                            </h1>
                            <p className="text-gray-500 text-sm">ID: {worker.id} / 登録日: {format(new Date(worker.created_at), 'yyyy/MM/dd')}</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleMasquerade}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                        >
                            <LogIn className="w-4 h-4" />
                            ワーカーとしてログイン
                        </button>
                        <button
                            onClick={handleToggleSuspension}
                            disabled={processing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors ${isSuspended
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-red-600 hover:bg-red-700'
                                } disabled:opacity-50`}
                        >
                            {isSuspended ? (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    停止解除
                                </>
                            ) : (
                                <>
                                    <Ban className="w-4 h-4" />
                                    アカウント停止
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content - Bento Grid */}
            <main className="p-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-12 gap-6">

                    {/* Column 1: Profile & Contact (3 cols) */}
                    <div className="col-span-12 lg:col-span-3 space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden ring-4 ring-gray-50">
                                    {worker.profile_image ? (
                                        <img src={worker.profile_image} alt={worker.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                                            {(worker.name || '?').charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">{worker.name || '名前未設定'}</h2>
                                {worker.last_name_kana && worker.first_name_kana && (
                                    <p className="text-xs text-gray-400 mb-2">{worker.last_name_kana} {worker.first_name_kana}</p>
                                )}
                                <p className="text-sm text-gray-500 mb-4">
                                    {worker.age !== null ? `${worker.age}歳` : '年齢不明'} / {worker.gender || '性別未登録'}
                                </p>

                                {/* Qualifications */}
                                <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                                    {worker.qualifications?.length > 0 ? (
                                        worker.qualifications.map((qual: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md">
                                                {qual}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-400">資格情報なし</span>
                                    )}
                                </div>

                                {/* Experience */}
                                {experienceData.length > 0 && (
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {experienceData.map((exp, i) => (
                                            <div
                                                key={i}
                                                className={`group relative px-2 py-1 ${getExperienceColor(exp.field)} text-white rounded-md cursor-help shadow-sm text-xs font-medium`}
                                            >
                                                {getAbbreviation(exp.field)} {exp.years}
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                    {exp.field}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" /> 連絡先
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    {worker.email}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    {worker.phone_number || '未登録'}
                                </div>
                                <div className="flex items-start gap-3 text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                    <div>
                                        {worker.postal_code && <div className="text-xs text-gray-400">〒{worker.postal_code}</div>}
                                        {worker.prefecture}{worker.city}{worker.address_line}
                                        {worker.building && <div>{worker.building}</div>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {worker.birth_date ? format(new Date(worker.birth_date), 'yyyy/MM/dd') : '未登録'}
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> 緊急連絡先
                            </h3>
                            {worker.emergency_name ? (
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div><span className="text-gray-400">氏名:</span> {worker.emergency_name}</div>
                                    <div><span className="text-gray-400">続柄:</span> {worker.emergency_relation || '未登録'}</div>
                                    <div><span className="text-gray-400">電話:</span> {worker.emergency_phone || '未登録'}</div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">緊急連絡先は未登録です</p>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Stats & Schedule (6 cols) */}
                    <div className="col-span-12 lg:col-span-6 space-y-6">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <div className="text-xs text-gray-500 mb-1">総勤務回数</div>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold text-gray-900">{worker.totalWorkDays}</span>
                                    <span className="text-xs text-gray-500 mb-1">回</span>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <div className="text-xs text-gray-500 mb-1">総合評価</div>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold text-gray-900">
                                        {worker.totalAvgRating > 0 ? worker.totalAvgRating.toFixed(1) : '-'}
                                    </span>
                                    <Star className="w-5 h-5 text-yellow-400 fill-current mb-1" />
                                </div>
                                <div className="text-xs text-gray-400 mt-1">{worker.totalReviewCount}件のレビュー</div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <div className="text-xs text-gray-500 mb-1">キャンセル率</div>
                                <div className="flex items-end gap-2">
                                    <span className={`text-2xl font-bold ${worker.cancelRate > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                                        {worker.cancelRate.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Upcoming Schedule */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    直近の勤務予定
                                </h3>
                            </div>
                            <div className="p-4">
                                {worker.upcomingSchedules?.length > 0 ? (
                                    <div className="space-y-3">
                                        {worker.upcomingSchedules.map((schedule: any) => {
                                            const { month, day } = formatDate(schedule.workDate);
                                            const shift = getShiftType(schedule.startTime, schedule.endTime);
                                            return (
                                                <div key={schedule.id} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="flex-shrink-0 w-12 text-center bg-white rounded border border-gray-200 p-1">
                                                        <div className="text-[10px] text-gray-500">{month}</div>
                                                        <div className="text-lg font-bold text-gray-900 leading-none">{day}</div>
                                                    </div>
                                                    <div className="ml-3 flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-sm font-bold text-gray-900">
                                                                {schedule.startTime} - {schedule.endTime}
                                                            </span>
                                                            <span className={`px-1.5 py-0.5 ${shift.bgColor} ${shift.textColor} text-[10px] rounded`}>
                                                                {shift.label}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-600">{schedule.facilityName}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 text-sm py-8">勤務予定なし</div>
                                )}
                            </div>
                        </div>

                        {/* Self PR */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> 自己PR
                            </h3>
                            {worker.self_pr ? (
                                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap">
                                    {worker.self_pr}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 italic">
                                    自己PRは未登録です
                                </p>
                            )}
                        </div>

                        {/* Work History */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="p-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-gray-400" />
                                    勤務履歴
                                </h3>
                            </div>
                            <div className="p-4">
                                {worker.workHistory?.length > 0 ? (
                                    <div className="space-y-2">
                                        {worker.workHistory.map((history: any) => (
                                            <div key={history.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                                                <div>
                                                    <div className="font-medium text-gray-900">{history.jobTitle}</div>
                                                    <div className="text-xs text-gray-500">{history.facilityName}</div>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {format(new Date(history.workDate), 'yyyy/MM/dd')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 text-sm py-8">勤務履歴なし</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Column 3: Ratings & Bank Info (3 cols) */}
                    <div className="col-span-12 lg:col-span-3 space-y-6">
                        {/* Rating Analysis */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Star className="w-4 h-4" /> 評価分析
                            </h3>
                            {worker.ratingsByCategory ? (
                                <div className="space-y-3">
                                    {[
                                        { label: '勤怠・時間', key: 'attendance' },
                                        { label: 'スキル', key: 'skill' },
                                        { label: '遂行力', key: 'execution' },
                                        { label: 'コミュ力', key: 'communication' },
                                        { label: '姿勢', key: 'attitude' },
                                    ].map((item) => (
                                        <div key={item.key} className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-600">{item.label}</span>
                                                <span className="font-bold text-gray-900">
                                                    {worker.ratingsByCategory[item.key]?.toFixed(1) || '-'}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-400"
                                                    style={{ width: `${(worker.ratingsByCategory[item.key] || 0) * 20}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 text-sm py-4">評価データなし</div>
                            )}
                        </div>

                        {/* Recent Reviews */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="p-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    最近のレビュー
                                </h3>
                            </div>
                            <div className="p-4">
                                {worker.reviews?.length > 0 ? (
                                    <div className="space-y-3">
                                        {worker.reviews.map((review: any) => (
                                            <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                                        <span className="text-sm font-bold">{review.rating.toFixed(1)}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {format(new Date(review.created_at), 'yyyy/MM/dd')}
                                                    </span>
                                                </div>
                                                {review.comment && (
                                                    <p className="text-xs text-gray-600 line-clamp-2">{review.comment}</p>
                                                )}
                                                <p className="text-xs text-gray-400 mt-1">{review.reviewerName}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 text-sm py-4">レビューなし</div>
                                )}
                            </div>
                        </div>

                        {/* Work Preferences */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> 働き方と希望
                            </h3>
                            <div className="space-y-2.5 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">現在の働き方</span>
                                    <span className="font-medium text-gray-900">{worker.current_work_style || '未登録'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">転職意向</span>
                                    <span className="font-medium text-gray-900">{worker.job_change_desire || '未登録'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">希望日数/週</span>
                                    <span className="font-medium text-gray-900">{worker.desired_work_days_week || '未登録'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">希望曜日</span>
                                    <span className="font-medium text-gray-900">
                                        {worker.desired_work_days?.length > 0 ? worker.desired_work_days.join(', ') : '未登録'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Bank Info (Masked) */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> 銀行口座情報
                            </h3>
                            {worker.bank_name ? (
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div><span className="text-gray-400">銀行名:</span> {worker.bank_name}</div>
                                    <div><span className="text-gray-400">支店名:</span> {worker.branch_name || '未登録'}</div>
                                    <div><span className="text-gray-400">口座名義:</span> {worker.account_name || '未登録'}</div>
                                    <div><span className="text-gray-400">口座番号:</span> ****{worker.account_number?.slice(-4) || '****'}</div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">銀行口座情報は未登録です</p>
                            )}
                        </div>

                        {/* Qualification Certificates */}
                        {worker.qualificationCertificates && Object.keys(worker.qualificationCertificates).length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> 資格証明書
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(worker.qualificationCertificates).slice(0, 3).map(([qualName, imageUrl]: [string, any], i: number) => (
                                        <div key={i} className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group">
                                            <img src={imageUrl} alt={qualName} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                {qualName}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {Object.keys(worker.qualificationCertificates).length > 3 && (
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        他 {Object.keys(worker.qualificationCertificates).length - 3} 件
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Edit Logs Section */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                            <button
                                onClick={() => setShowEditLogs(!showEditLogs)}
                                className="w-full flex items-center justify-between"
                            >
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <History className="w-4 h-4" /> 編集ログ
                                    {editLogs.length > 0 && (
                                        <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded">
                                            {editLogs.length}件
                                        </span>
                                    )}
                                </h3>
                                <ChevronLeft className={`w-4 h-4 text-gray-400 transition-transform ${showEditLogs ? '-rotate-90' : ''}`} />
                            </button>

                            {showEditLogs && (
                                <div className="mt-4 space-y-3">
                                    {editLogs.length > 0 ? (
                                        editLogs.map((log: any) => (
                                            <div key={log.id} className="border-l-2 border-amber-300 pl-3 py-1">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span className="font-medium text-gray-700">{log.adminName}</span>
                                                    <span>•</span>
                                                    <span>{format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm')}</span>
                                                </div>
                                                <div className="text-sm text-gray-600 mt-0.5">
                                                    {log.action === 'WORKER_MASQUERADE_START' && (
                                                        <span className="text-indigo-600">マスカレードセッション開始</span>
                                                    )}
                                                    {log.action === 'MASQUERADE_EDIT' && (
                                                        <span className="text-amber-600">
                                                            プロフィール編集
                                                            {log.details && typeof log.details === 'object' && (log.details as any).fields && (
                                                                <span className="text-gray-500 ml-1">
                                                                    ({((log.details as any).fields as string[]).join(', ')})
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">編集ログはありません</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
