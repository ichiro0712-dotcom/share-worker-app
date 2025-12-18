'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Users,
} from 'lucide-react';
import JobApplicationModal from '@/components/admin/JobApplicationModal';
import { getQualificationAbbreviation } from '@/constants/qualifications';

// 型定義
export interface WorkerProfile {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location?: string | null;
}

export interface Application {
    id: number;
    status: string;
    cancelledBy?: 'WORKER' | 'FACILITY' | null;
    createdAt: string | Date;
    worker: WorkerProfile;
    rating: number | null;
    reviewCount: number;
    lastMinuteCancelRate: number;
}

export interface WorkDate {
    id: number;
    date: string | Date;
    formattedDate: string;
    recruitmentCount: number;
    appliedCount: number;
    matchedCount: number;
    unviewedCount: number;
    applications: Application[];
}

export interface JobWithApplications {
    id: number;
    title: string;
    status: string;
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
    unviewedCount: number;
}

interface VisualItem {
    job: JobWithApplications;
    workDate: WorkDate;
    startHour: number;
    duration: number;
    left: number;
    width: number;
    zIndex: number;
}

// 求人バーの背景色を取得する関数（ステータス・満員・過去の状態を考慮）
function getJobBarStyle(status: string, isFull: boolean, isPast: boolean): { bg: string; border: string; text: string } {
    if (isPast || status === 'CLOSED' || status === 'COMPLETED') {
        return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-400' };
    }
    if (isFull) {
        return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500' };
    }
    if (status === 'DRAFT') {
        return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' };
    }
    return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' };
}

// 資格に応じた色を取得する関数（求人バー用：満員/過去時はグレー）
function getQualificationBarColor(qualification: string, isInactive: boolean): { bg: string; text: string } {
    if (isInactive) {
        return { bg: 'bg-gray-200', text: 'text-gray-500' };
    }
    if (qualification === '無資格可') {
        return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
    if (['介護福祉士', '認定介護福祉士', '実務者研修', '初任者研修', '介護職員基礎研修',
        'ヘルパー1級', 'ヘルパー2級', '介護支援専門員', '認知症介護基礎研修',
        '認知症介護実践者研修', '認知症介護実践リーダー研修', '喀痰吸引等研修',
        '福祉用具専門相談員', 'レクリエーション介護士1級', 'レクリエーション介護士2級'].includes(qualification)) {
        return { bg: 'bg-purple-100', text: 'text-purple-700' };
    }
    if (['看護師', '准看護師', '認定看護師', '専門看護師', '保健師', '助産師', '看護助手認定実務者'].includes(qualification)) {
        return { bg: 'bg-pink-100', text: 'text-pink-700' };
    }
    if (['理学療法士', '作業療法士', '言語聴覚士', '柔道整復師', 'あん摩マッサージ指圧師', 'はり師', 'きゅう師'].includes(qualification)) {
        return { bg: 'bg-green-100', text: 'text-green-700' };
    }
    if (['社会福祉士', '社会福祉主事', '精神保健福祉士'].includes(qualification)) {
        return { bg: 'bg-blue-100', text: 'text-blue-700' };
    }
    if (['医師', '薬剤師', '保険薬剤師登録票', '歯科衛生士', '管理栄養士', '栄養士', '調理師', '医療事務認定実務者'].includes(qualification)) {
        return { bg: 'bg-red-100', text: 'text-red-700' };
    }
    if (qualification.includes('重度訪問介護') || qualification.includes('同行援護') ||
        qualification.includes('行動援護') || qualification.includes('ガイドヘルパー') ||
        qualification.includes('難病患者')) {
        return { bg: 'bg-orange-100', text: 'text-orange-700' };
    }
    if (['保育士', 'ドライバー(運転免許証)'].includes(qualification)) {
        return { bg: 'bg-cyan-100', text: 'text-cyan-700' };
    }
    return { bg: 'bg-gray-100', text: 'text-gray-600' };
}

interface MonthlyShiftViewProps {
    jobs: JobWithApplications[];
    qualificationAbbreviations?: Record<string, string>;
}

// 月間シフトビュー
export function MonthlyShiftView({ jobs, qualificationAbbreviations }: MonthlyShiftViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<VisualItem | null>(null);

    // ページ読み込み時点の時刻を記録（固定、更新しない）
    const [pageLoadTime] = useState(() => new Date());
    const today = useMemo(() => new Date(pageLoadTime.getFullYear(), pageLoadTime.getMonth(), pageLoadTime.getDate()), [pageLoadTime]);
    const todayRowRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 今月を表示している場合のみ、今日の行にスクロール
    const isCurrentMonth = currentDate.getFullYear() === pageLoadTime.getFullYear() && currentDate.getMonth() === pageLoadTime.getMonth();

    useEffect(() => {
        if (scrollContainerRef.current) {
            if (isCurrentMonth && todayRowRef.current) {
                const container = scrollContainerRef.current;
                const todayRow = todayRowRef.current;
                const headerOffset = 50;
                container.scrollTop = todayRow.offsetTop - headerOffset;
            } else {
                scrollContainerRef.current.scrollTop = 0;
            }
        }
    }, [currentDate, isCurrentMonth]);

    // 月の開始日を取得
    const getStartOfMonth = (d: Date) => {
        return new Date(d.getFullYear(), d.getMonth(), 1);
    };

    // 月の終了日を取得
    const getEndOfMonth = (d: Date) => {
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
    };

    const startOfMonth = useMemo(() => getStartOfMonth(currentDate), [currentDate]);
    const endOfMonth = useMemo(() => getEndOfMonth(currentDate), [currentDate]);

    // 月の日数を取得
    const daysInMonth = useMemo(() => {
        const days = [];
        const start = new Date(startOfMonth);
        while (start <= endOfMonth) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
        return days;
    }, [startOfMonth, endOfMonth]);

    // ナビゲーション
    const nextMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    const prevMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };

    const goThisMonth = () => {
        setCurrentDate(new Date());
    };

    // 日ごとのレイアウト計算
    const dailyLayout = useMemo(() => {
        const layout = new Map<string, { rows: VisualItem[][], maxRows: number }>();
        const monthStartMs = startOfMonth.getTime();
        const monthEndMs = new Date(endOfMonth.getTime() + 24 * 60 * 60 * 1000).getTime();

        // 日付キーごとにアイテムをグループ化
        const dayItemsMap = new Map<string, VisualItem[]>();

        jobs.forEach(job => {
            job.workDates.forEach(wd => {
                const wdDate = new Date(wd.date);
                const wdTime = wdDate.getTime();
                if (wdTime >= monthStartMs && wdTime < monthEndMs) {
                    const dateKey = wdDate.toISOString().split('T')[0];
                    const [startH, startM] = job.startTime.split(':').map(Number);
                    const [endH, endM] = job.endTime.split(':').map(Number);
                    // 6時を基準に調整（0-5時は24-29時として扱う）
                    let adjustedStartHour = startH + startM / 60;
                    if (adjustedStartHour < 6) adjustedStartHour += 24;
                    let adjustedEndHour = endH + endM / 60;
                    if (adjustedEndHour < 6) adjustedEndHour += 24;
                    if (adjustedEndHour < adjustedStartHour) adjustedEndHour += 24;
                    const duration = adjustedEndHour - adjustedStartHour;

                    // 横軸は時間（6:00〜翌6:00 = 24時間）
                    const visibleStart = 6;
                    const visibleDuration = 24;
                    const left = Math.max(0, ((adjustedStartHour - visibleStart) / visibleDuration) * 100);
                    const width = Math.min((duration / visibleDuration) * 100, 100 - left);

                    if (!dayItemsMap.has(dateKey)) {
                        dayItemsMap.set(dateKey, []);
                    }

                    dayItemsMap.get(dateKey)?.push({
                        job,
                        workDate: wd,
                        startHour: adjustedStartHour,
                        duration,
                        left,
                        width,
                        zIndex: 1
                    });
                }
            });
        });

        // 行の計算
        dayItemsMap.forEach((items, dateKey) => {
            items.sort((a, b) => a.startHour - b.startHour);
            const rows: VisualItem[][] = [];

            items.forEach(item => {
                let placed = false;
                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    const lastInRow = row[row.length - 1];
                    const lastEnd = lastInRow.startHour + lastInRow.duration;
                    if (item.startHour >= lastEnd + 0.1) {
                        row.push(item);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    rows.push([item]);
                }
            });
            layout.set(dateKey, { rows, maxRows: rows.length });
        });

        return layout;
    }, [jobs, startOfMonth, endOfMonth]);

    // 時間軸（6時〜翌6時 = 24時間）
    const timeSlots = Array.from({ length: 25 }, (_, i) => (i + 6) % 24);

    return (
        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
            {/* 共通モーダル（シングルデイモード） */}
            {selectedItem && (
                <JobApplicationModal
                    job={selectedItem.job}
                    onClose={() => setSelectedItem(null)}
                    singleDateMode={true}
                    selectedWorkDate={selectedItem.workDate}
                />
            )}

            {/* Header / Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                    </h2>
                    <div className="flex items-center bg-white rounded-md border border-gray-300 shadow-sm">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 border-r border-gray-300 text-gray-600">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={goThisMonth} className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 text-gray-700">今月</button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 border-l border-gray-300 text-gray-600">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-green-50 border border-green-300 rounded"></div>
                        <span>募集中</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
                        <span>未掲載</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
                        <span>満員/終了</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>新着応募</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-3 bg-red-500"></div>
                        <span>現在時刻</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
                <div className="min-w-[1200px]">
                    {/* Table Header: Time Axis */}
                    <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
                        <div className="w-20 flex-shrink-0 p-2 border-r border-gray-200 bg-gray-50 sticky left-0 z-30 shadow-sm text-xs text-gray-500 text-center">
                            日付
                        </div>
                        <div className="flex-1 relative h-6">
                            {timeSlots.map((h, index) => (
                                <div
                                    key={index}
                                    className="absolute text-[10px] text-gray-400 border-l border-gray-200 h-full flex items-center pl-1"
                                    style={{ left: `${(index / 24) * 100}%` }}
                                >
                                    {h}:00
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows: 月の各日 */}
                    <div className="divide-y divide-gray-100">
                        {daysInMonth.map((day) => {
                            const dateKey = day.toISOString().split('T')[0];
                            const layout = dailyLayout.get(dateKey);
                            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                            const isToday = dayStart.getTime() === today.getTime();
                            const isPastDay = dayStart < today;
                            const dayOfWeek = day.getDay();
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                            const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

                            // 今日の場合、現在時刻の位置を計算（6:00〜翌6:00 = 24時間）
                            const currentHour = pageLoadTime.getHours() + pageLoadTime.getMinutes() / 60;
                            const adjustedCurrentHour = currentHour < 6 ? currentHour + 24 : currentHour;
                            const nowLinePosition = isToday && adjustedCurrentHour >= 6 && adjustedCurrentHour <= 30
                                ? ((adjustedCurrentHour - 6) / 24) * 100
                                : null;

                            const rowHeight = 28;
                            const totalHeight = Math.max((layout?.maxRows || 0) * rowHeight + 8, 36);

                            return (
                                <div
                                    key={dateKey}
                                    ref={isToday ? todayRowRef : undefined}
                                    className={`flex group ${isPastDay ? 'bg-gray-200/70' : isWeekend ? 'bg-gray-50/50' : 'bg-white'} hover:bg-blue-50/30 transition-colors`}
                                >
                                    {/* Day Label Column */}
                                    <div className={`w-20 flex-shrink-0 border-r border-gray-200 px-2 py-1 flex items-center gap-2 sticky left-0 z-20 ${isToday ? 'bg-blue-100' : isPastDay ? 'bg-gray-300' : isWeekend ? 'bg-gray-100' : 'bg-white'} group-hover:bg-blue-50/50`}>
                                        <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : isPastDay ? 'text-gray-500' : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-900'}`}>
                                            {day.getDate()}
                                        </span>
                                        <span className={`text-[10px] ${isPastDay ? 'text-gray-500' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                                            {weekdayNames[dayOfWeek]}
                                        </span>
                                    </div>

                                    {/* Timeline Lane */}
                                    <div className="flex-1 relative" style={{ minHeight: `${totalHeight}px` }}>
                                        {/* Grid Lines */}
                                        {timeSlots.map((_, index) => (
                                            <div
                                                key={index}
                                                className="absolute top-0 bottom-0 border-l border-gray-100"
                                                style={{ left: `${(index / 24) * 100}%` }}
                                            />
                                        ))}

                                        {/* 現在時刻線（今日のみ） */}
                                        {nowLinePosition !== null && (
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                                                style={{ left: `${nowLinePosition}%` }}
                                            />
                                        )}

                                        {/* Job Items */}
                                        {layout?.rows.map((row, rowIndex) => (
                                            row.map(item => {
                                                const isFull = item.workDate.matchedCount >= item.workDate.recruitmentCount;
                                                const isPastJob = isPastDay;
                                                const isInactive = isFull || isPastJob;
                                                const barStyle = getJobBarStyle(item.job.status, isFull, isPastJob);

                                                return (
                                                    <div
                                                        key={item.workDate.id}
                                                        onClick={() => setSelectedItem(item)}
                                                        className={`absolute rounded border text-[10px] overflow-hidden shadow-sm flex items-center px-1.5 cursor-pointer transition-all hover:z-30 hover:shadow-md ${barStyle.bg} ${barStyle.border} ${barStyle.text} ${isPastJob ? 'opacity-60' : ''}`}
                                                        style={{
                                                            left: `${item.left}%`,
                                                            width: `${Math.max(item.width, 3)}%`,
                                                            top: `${4 + rowIndex * rowHeight}px`,
                                                            height: `${rowHeight - 4}px`
                                                        }}
                                                    >
                                                        <div className="flex items-center w-full gap-1 overflow-hidden">
                                                            {/* 1. 資格条件バッジ（先頭） */}
                                                            {(() => {
                                                                const qual = item.job.requiredQualifications.length > 0
                                                                    ? item.job.requiredQualifications[0]
                                                                    : '無資格可';
                                                                const colors = getQualificationBarColor(qual, isInactive);
                                                                return (
                                                                    <span
                                                                        className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded ${colors.bg} ${colors.text}`}
                                                                        title={item.job.requiredQualifications.length > 0 ? item.job.requiredQualifications.join(', ') : '無資格可'}
                                                                    >
                                                                        {getQualificationAbbreviation(qual, qualificationAbbreviations)}
                                                                        {item.job.requiredQualifications.length > 1 && '他'}
                                                                    </span>
                                                                );
                                                            })()}

                                                            {/* 2. タイトル（伸縮して残りスペースを使う） */}
                                                            <span className={`font-medium truncate flex-1 min-w-0`} title={item.job.title}>
                                                                {item.job.title}
                                                            </span>

                                                            {/* 3. 時給（応募枠の左） */}
                                                            <span className={`flex-shrink-0 text-[9px] font-bold ${isInactive ? 'text-gray-400' : 'text-orange-600'}`}>
                                                                ¥{item.job.hourlyWage.toLocaleString()}
                                                            </span>

                                                            {/* 4. Unread Badge - workDateごとの未確認応募数 */}
                                                            {item.workDate.unviewedCount > 0 && !isInactive && (
                                                                <div className="flex-shrink-0 w-3 h-3 bg-red-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center">
                                                                    {item.workDate.unviewedCount}
                                                                </div>
                                                            )}

                                                            {/* 5. 応募枠（右端） */}
                                                            <div className={`flex-shrink-0 flex items-center gap-0.5 text-[9px] ${isInactive ? 'text-gray-400' : 'text-green-700'}`}>
                                                                <Users size={8} />
                                                                <span className="font-bold">{item.workDate.matchedCount}/{item.workDate.recruitmentCount}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
