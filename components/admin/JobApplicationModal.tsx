'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    ChevronDown,
    ChevronUp,
    UserCircle,
    Calendar,
    Users,
    X,
    CheckCircle,
    Clock,
} from 'lucide-react';

// 型定義
interface Worker {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
}

interface Application {
    id: number;
    status: string;
    cancelledBy?: 'WORKER' | 'FACILITY' | null;
    createdAt: string | Date;
    worker: Worker;
    rating: number | null;
    reviewCount: number;
    lastMinuteCancelRate: number;
}

interface WorkDate {
    id: number;
    date: string | Date;
    formattedDate: string;
    recruitmentCount: number;
    appliedCount: number;
    matchedCount: number;
    applications: Application[];
}

interface JobWithApplications {
    id: number;
    title: string;
    status: string;
    jobType?: 'NORMAL' | 'OFFER' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'ORIENTATION';
    startTime: string;
    endTime: string;
    hourlyWage: number;
    transportationFee?: number;
    workContent: string[];
    requiredQualifications: string[];
    requiresInterview: boolean;
    totalRecruitment: number;
    totalApplied: number;
    totalMatched: number;
    dateRange: string;
    workDates: WorkDate[];
    unviewedCount?: number;
}

interface JobApplicationModalProps {
    job: JobWithApplications | null;
    onClose: () => void;
    onStatusUpdate?: (applicationId: number, status: string, confirmMessage?: string) => Promise<void>;
    onMatchAll?: (workDateId: number, applications: Application[]) => Promise<void>;
    isUpdating?: number | null;
    // シングルデイモード用（v2シフトビュー）
    singleDateMode?: boolean;
    selectedWorkDate?: WorkDate | null;
}

// 資格に応じた色を取得する関数
function getQualificationColor(qualification: string): { bg: string; text: string } {
    // 無資格可
    if (qualification === '無資格可') {
        return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
    // 介護系（紫）
    if (['介護福祉士', '認定介護福祉士', '実務者研修', '初任者研修', '介護職員基礎研修',
        'ヘルパー1級', 'ヘルパー2級', '介護支援専門員', '認知症介護基礎研修',
        '認知症介護実践者研修', '認知症介護実践リーダー研修', '喀痰吸引等研修',
        '福祉用具専門相談員', 'レクリエーション介護士1級', 'レクリエーション介護士2級'].includes(qualification)) {
        return { bg: 'bg-purple-100', text: 'text-purple-700' };
    }
    // 看護系（ピンク）
    if (['看護師', '准看護師', '認定看護師', '専門看護師', '保健師', '助産師', '看護助手認定実務者'].includes(qualification)) {
        return { bg: 'bg-pink-100', text: 'text-pink-700' };
    }
    // リハビリ系（緑）
    if (['理学療法士', '作業療法士', '言語聴覚士', '柔道整復師', 'あん摩マッサージ指圧師', 'はり師', 'きゅう師'].includes(qualification)) {
        return { bg: 'bg-green-100', text: 'text-green-700' };
    }
    // 福祉相談系（青）
    if (['社会福祉士', '社会福祉主事', '精神保健福祉士'].includes(qualification)) {
        return { bg: 'bg-blue-100', text: 'text-blue-700' };
    }
    // 医療系（赤）
    if (['医師', '薬剤師', '保険薬剤師登録票', '歯科衛生士', '管理栄養士', '栄養士', '調理師', '医療事務認定実務者'].includes(qualification)) {
        return { bg: 'bg-red-100', text: 'text-red-700' };
    }
    // 障害福祉系（オレンジ）
    if (qualification.includes('重度訪問介護') || qualification.includes('同行援護') ||
        qualification.includes('行動援護') || qualification.includes('ガイドヘルパー') ||
        qualification.includes('難病患者')) {
        return { bg: 'bg-orange-100', text: 'text-orange-700' };
    }
    // その他（シアン）
    if (['保育士', 'ドライバー(運転免許証)'].includes(qualification)) {
        return { bg: 'bg-cyan-100', text: 'text-cyan-700' };
    }
    // デフォルト
    return { bg: 'bg-gray-100', text: 'text-gray-600' };
}

// 総支給額を計算する関数
function calculateTotalPayment(hourlyWage: number, startTime: string, endTime: string, transportationFee: number = 0): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let hours = (endH + endM / 60) - (startH + startM / 60);
    if (hours < 0) hours += 24; // 日跨ぎ対応
    return Math.round(hourlyWage * hours + transportationFee);
}

// 勤務時間を計算する関数
function calculateWorkHours(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let hours = (endH + endM / 60) - (startH + startM / 60);
    if (hours < 0) hours += 24;
    return hours;
}

export default function JobApplicationModal({
    job,
    onClose,
    onStatusUpdate,
    onMatchAll,
    isUpdating,
    singleDateMode = false,
    selectedWorkDate,
}: JobApplicationModalProps) {
    const [expandedDates, setExpandedDates] = useState<Set<number>>(new Set());

    // シングルデイモードの場合、選択されたWorkDateのみを表示
    const workDatesToShow = useMemo(() => {
        if (singleDateMode && selectedWorkDate) {
            return [selectedWorkDate];
        }
        return job?.workDates || [];
    }, [singleDateMode, selectedWorkDate, job]);

    if (!job) return null;

    const toggleDateExpand = (dateId: number) => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateId)) {
                next.delete(dateId);
            } else {
                next.add(dateId);
            }
            return next;
        });
    };

    const toggleAllDates = (expand: boolean) => {
        if (expand) {
            setExpandedDates(new Set(workDatesToShow.map(wd => wd.id)));
        } else {
            setExpandedDates(new Set());
        }
    };

    const transportationFee = job.transportationFee || 0;
    const workHours = calculateWorkHours(job.startTime, job.endTime);
    const totalPayment = calculateTotalPayment(job.hourlyWage, job.startTime, job.endTime, transportationFee);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* モーダルヘッダー */}
                <div className="p-6 border-b border-gray-200 flex items-start justify-between bg-gray-50">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${job.status === 'PUBLISHED' ? 'bg-blue-600 text-white' :
                                job.status === 'WORKING' ? 'bg-blue-800 text-white' :
                                    job.status === 'COMPLETED' ? 'bg-blue-50 text-blue-300' :
                                        'bg-blue-100 text-blue-400'
                                }`}>
                                {job.status === 'PUBLISHED' ? '公開中' :
                                    job.status === 'WORKING' ? '勤務中' :
                                        job.status === 'COMPLETED' ? '完了' :
                                            job.status === 'STOPPED' ? '停止中' : job.status}
                            </span>
                            {/* 求人種別バッジ */}
                            {job.jobType && job.jobType !== 'NORMAL' && (
                                <span className={`px-2 py-0.5 text-xs font-bold rounded shadow-sm ${
                                    job.jobType === 'OFFER' ? 'bg-blue-600 text-white' :
                                    job.jobType === 'LIMITED_WORKED' ? 'bg-purple-600 text-white' :
                                    job.jobType === 'LIMITED_FAVORITE' ? 'bg-pink-500 text-white' :
                                    job.jobType === 'ORIENTATION' ? 'bg-teal-500 text-white' :
                                    'bg-gray-100 text-gray-700'
                                }`}>
                                    {job.jobType === 'OFFER' ? 'オファ' :
                                     job.jobType === 'LIMITED_WORKED' ? '限定' :
                                     job.jobType === 'LIMITED_FAVORITE' ? (
                                       <>限定<span className="text-yellow-300">★</span></>
                                     ) :
                                     job.jobType === 'ORIENTATION' ? '説明会' : ''}
                                </span>
                            )}
                            {job.requiresInterview && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                                    審査あり
                                </span>
                            )}
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-600">
                                ID: {job.id}
                            </span>
                            <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
                        </div>

                        {/* 資格条件バッジ */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-sm text-gray-500">必要資格:</span>
                            {job.requiredQualifications.length > 0 ? (
                                job.requiredQualifications.map((qual, idx) => {
                                    const colors = getQualificationColor(qual);
                                    return (
                                        <span
                                            key={idx}
                                            className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}
                                        >
                                            {qual}
                                        </span>
                                    );
                                })
                            ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                    無資格可
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                            <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {singleDateMode && selectedWorkDate
                                    ? selectedWorkDate.formattedDate
                                    : job.dateRange}
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {job.startTime} 〜 {job.endTime}
                                <span className="text-gray-400 ml-1">({workHours.toFixed(1)}h)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                応募: {singleDateMode && selectedWorkDate
                                    ? selectedWorkDate.appliedCount
                                    : job.totalApplied}名 / マッチング: {singleDateMode && selectedWorkDate
                                    ? selectedWorkDate.matchedCount
                                    : job.totalMatched}名
                            </div>
                        </div>

                        {/* 時給・交通費・総支給額（シンプルテキスト） */}
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span>時給: ¥{job.hourlyWage.toLocaleString()}</span>
                            <span>交通費: {transportationFee > 0 ? `¥${transportationFee.toLocaleString()}` : '支給なし'}</span>
                            <span>総支給額: ¥{totalPayment.toLocaleString()}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors ml-4"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* モーダルコンテンツ（スクロール可能） */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {!singleDateMode && workDatesToShow.length > 1 && (
                        <div className="flex justify-end gap-2 mb-4">
                            <button
                                onClick={() => toggleAllDates(true)}
                                className="text-xs text-admin-primary hover:underline"
                            >
                                すべて展開
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                onClick={() => toggleAllDates(false)}
                                className="text-xs text-admin-primary hover:underline"
                            >
                                すべて折りたたみ
                            </button>
                        </div>
                    )}

                    <div className="space-y-4">
                        {workDatesToShow.map(workDate => {
                            // シングルデイモードでは常に展開
                            const isExpanded = singleDateMode || expandedDates.has(workDate.id);
                            const isFull = workDate.matchedCount >= workDate.recruitmentCount;
                            const hasApplicants = workDate.applications.length > 0;
                            const fillRate = workDate.recruitmentCount > 0
                                ? (workDate.matchedCount / workDate.recruitmentCount) * 100
                                : 0;

                            return (
                                <div
                                    key={workDate.id}
                                    className={`bg-white rounded-lg border transition-all overflow-hidden ${isFull ? 'border-green-200 shadow-sm' :
                                        hasApplicants ? 'border-blue-200 shadow-md' : 'border-gray-200'
                                        }`}
                                >
                                    {/* 日付ヘッダー */}
                                    <div
                                        onClick={() => !singleDateMode && toggleDateExpand(workDate.id)}
                                        className={`p-4 flex items-center justify-between ${!singleDateMode ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors ${isExpanded ? 'border-b border-gray-100' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center border ${isFull ? 'bg-green-50 border-green-200 text-green-700' :
                                                hasApplicants ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                                                }`}>
                                                <span className="text-xs font-bold">{workDate.formattedDate.split('(')[0]}</span>
                                                <span className="text-[10px]">({workDate.formattedDate.split('(')[1]?.replace(')', '') || ''})</span>
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900">
                                                        {job.startTime} 〜 {job.endTime}
                                                    </span>
                                                    {isFull && (
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                                            満員
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${isFull ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(fillRate, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span>
                                                        募集: {workDate.recruitmentCount}名 /
                                                        <span className={isFull ? 'text-green-600 font-bold' : ''}> マッチング: {workDate.matchedCount}</span> /
                                                        応募: {workDate.appliedCount}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {hasApplicants && (
                                                <div className="flex -space-x-2">
                                                    {workDate.applications.slice(0, 3).map(app => (
                                                        <div key={app.id} className="relative w-8 h-8 rounded-full border-2 border-white overflow-hidden">
                                                            {app.worker.profileImage ? (
                                                                <Image src={app.worker.profileImage} alt={app.worker.name} fill className="object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                                                    <UserCircle className="w-5 h-5 text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {workDate.applications.length > 3 && (
                                                        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                                                            +{workDate.applications.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {!singleDateMode && (
                                                isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* 応募者リスト（展開時） */}
                                    {isExpanded && (
                                        <div className="p-4 bg-gray-50/30">
                                            {workDate.applications.length === 0 ? (
                                                <div className="text-center py-4 text-gray-500 text-sm">
                                                    まだ応募はありません
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {/* 一括操作バー */}
                                                    {onMatchAll && workDate.applications.some(a => a.status === 'APPLIED') && (
                                                        <div className="flex justify-end mb-2">
                                                            <button
                                                                onClick={() => onMatchAll(workDate.id, workDate.applications)}
                                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                                            >
                                                                <CheckCircle className="w-3 h-3" />
                                                                未対応を一括マッチング
                                                            </button>
                                                        </div>
                                                    )}

                                                    {workDate.applications.map(app => (
                                                        <div key={app.id} className="bg-white p-3 rounded border border-gray-100 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <Link href={`/admin/workers/${app.worker.id}?returnTab=jobs`} className="block relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 hover:opacity-80">
                                                                    {app.worker.profileImage ? (
                                                                        <Image src={app.worker.profileImage} alt={app.worker.name} fill className="object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                                            <UserCircle className="w-6 h-6 text-gray-400" />
                                                                        </div>
                                                                    )}
                                                                </Link>

                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Link href={`/admin/workers/${app.worker.id}?returnTab=jobs`} className="font-bold text-gray-900 hover:text-admin-primary hover:underline">
                                                                            {app.worker.name}
                                                                        </Link>
                                                                        <div className="flex items-center text-xs text-yellow-500">
                                                                            ★ {app.rating ? app.rating.toFixed(1) : '-'}
                                                                            <span className="text-gray-400 ml-1">({app.reviewCount})</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                                        <span className={app.lastMinuteCancelRate > 0 ? 'text-red-500 font-medium' : ''}>
                                                                            直前キャンセル: {app.lastMinuteCancelRate.toFixed(0)}%
                                                                        </span>
                                                                        <span>応募: {new Date(app.createdAt).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {app.status === 'APPLIED' && onStatusUpdate && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => onStatusUpdate(app.id, 'SCHEDULED')}
                                                                            disabled={isUpdating === app.id}
                                                                            className="px-3 py-1.5 bg-admin-primary text-white text-xs font-medium rounded-admin-button hover:bg-admin-primary-dark transition-colors disabled:opacity-50"
                                                                        >
                                                                            マッチング
                                                                        </button>
                                                                        <button
                                                                            onClick={() => onStatusUpdate(app.id, 'CANCELLED', job.requiresInterview ? 'この応募を不採用にしますか？' : 'この応募をキャンセルしますか？')}
                                                                            disabled={isUpdating === app.id}
                                                                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                                                                        >
                                                                            {job.requiresInterview ? '不採用' : 'キャンセル'}
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {app.status === 'APPLIED' && !onStatusUpdate && (
                                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded flex items-center gap-1">
                                                                        審査待ち
                                                                    </span>
                                                                )}
                                                                {app.status === 'SCHEDULED' && (
                                                                    <>
                                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded flex items-center gap-1">
                                                                            <CheckCircle className="w-3 h-3" />
                                                                            マッチング済
                                                                        </span>
                                                                        {onStatusUpdate && (
                                                                            <button
                                                                                onClick={() => onStatusUpdate(app.id, 'CANCELLED', 'このマッチングをキャンセルしますか？')}
                                                                                disabled={isUpdating === app.id}
                                                                                className="text-xs text-gray-400 hover:text-red-500 underline"
                                                                            >
                                                                                キャンセル
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {app.status === 'CANCELLED' && (
                                                                    <span className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 ${app.cancelledBy === 'WORKER'
                                                                            ? 'bg-red-50 text-red-600'
                                                                            : app.cancelledBy === 'FACILITY'
                                                                                ? 'bg-gray-100 text-gray-600'
                                                                                : 'bg-yellow-50 text-yellow-700'
                                                                        }`}>
                                                                        <X className="w-3 h-3" />
                                                                        {app.cancelledBy === 'WORKER'
                                                                            ? 'ワーカー辞退'
                                                                            : app.cancelledBy === 'FACILITY'
                                                                                ? '施設キャンセル'
                                                                                : '応募取消'}
                                                                    </span>
                                                                )}
                                                                {['WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'].includes(app.status) && (
                                                                    <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded">
                                                                        勤務中/完了
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
