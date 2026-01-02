'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    User,
    MessageCircle,
    XCircle,
    Clock,
    CreditCard,
    Briefcase,
    Calendar as CalendarIcon
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getShiftsForFacility, cancelShift } from '@/src/lib/actions';
import { getCurrentTime } from '@/utils/debugTime';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Shift {
    applicationId: number;
    workDateId: number;
    workDate: Date;
    startTime: string;
    endTime: string;
    breakTime: number | null;
    hourlyRate: number;
    transportationFee: number;
    workerId: number;
    workerName: string;
    workerProfileImage: string | null;
    qualifications: string[];
    status: string;
    jobId: number;
    weeklyFrequency: number | null;
    jobType: string;
}

// Helper functions for timeline view
function roundTimeToFiveMinutes(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    return `${String(hours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
}

function timeToPixels(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    // 5分 = 4px, 1時間 = 24px
    return hours * 24 + Math.floor(minutes / 5) * 4;
}

function getDurationPixels(startTime: string, endTime: string): number {
    const startPixels = timeToPixels(startTime);
    const endPixels = timeToPixels(endTime);
    return endPixels - startPixels;
}

function isTimeOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
    const toMinutes = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };
    const s1 = toMinutes(start1), e1 = toMinutes(end1);
    const s2 = toMinutes(start2), e2 = toMinutes(end2);
    return e1 > s2 && e2 > s1;
}

function groupOverlappingShifts(shifts: Shift[]): Shift[][] {
    if (shifts.length === 0) return [];

    const sorted = [...shifts].sort((a, b) =>
        timeToPixels(a.startTime) - timeToPixels(b.startTime)
    );

    const groups: Shift[][] = [];
    let currentGroup: Shift[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const overlaps = currentGroup.some(shift =>
            isTimeOverlapping(shift.startTime, shift.endTime, current.startTime, current.endTime)
        );

        if (overlaps) {
            currentGroup.push(current);
        } else {
            groups.push(currentGroup);
            currentGroup = [current];
        }
    }
    groups.push(currentGroup);

    return groups;
}

export default function ShiftManagementPage() {
    const { admin } = useAuth();
    const { showDebugError } = useDebugError();
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    const fetchShifts = useCallback(async () => {
        if (!admin?.facilityId) return;

        setIsLoading(true);
        try {
            let start, end;
            if (viewMode === 'week') {
                start = startOfWeek(currentDate, { weekStartsOn: 1 });
                end = endOfWeek(currentDate, { weekStartsOn: 1 });
            } else {
                start = startOfMonth(currentDate);
                end = endOfMonth(currentDate);
            }

            const searchStart = subWeeks(start, 1);
            const searchEnd = addWeeks(end, 1);

            const data = await getShiftsForFacility(
                admin.facilityId,
                searchStart.toISOString(),
                searchEnd.toISOString()
            );

            const parsedData = data.map(d => ({
                ...d,
                workDate: new Date(d.workDate)
            }));

            setShifts(parsedData);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: 'シフトデータ取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId: admin?.facilityId, viewMode, currentDate: currentDate.toISOString() }
            });
            console.error('Failed to fetch shifts:', error);
            toast.error('シフトの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    }, [admin?.facilityId, currentDate, viewMode]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const handlePrev = () => {
        if (viewMode === 'week') {
            setCurrentDate(subWeeks(currentDate, 1));
        } else {
            setCurrentDate(subMonths(currentDate, 1));
        }
    };

    const handleNext = () => {
        if (viewMode === 'week') {
            setCurrentDate(addWeeks(currentDate, 1));
        } else {
            setCurrentDate(addMonths(currentDate, 1));
        }
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const days = viewMode === 'week'
        ? eachDayOfInterval({
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 })
        })
        : eachDayOfInterval({
            start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
            end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
        });

    const getShiftsForDay = (date: Date) => {
        return shifts.filter(s => isSameDay(s.workDate, date));
    };

    // 月表示用：日を週ごとにグループ化
    const getWeeksFromDays = (allDays: Date[]): Date[][] => {
        const weeks: Date[][] = [];
        for (let i = 0; i < allDays.length; i += 7) {
            weeks.push(allDays.slice(i, i + 7));
        }
        return weeks;
    };

    const openDetailModal = (shift: Shift) => {
        setSelectedShift(shift);
        setIsDetailModalOpen(true);
    };

    const openCancelModal = (e: React.MouseEvent, shift: Shift) => {
        e.stopPropagation();
        setSelectedShift(shift);
        setIsCancelModalOpen(true);
    };

    const executeCancel = async () => {
        if (!selectedShift) return;

        try {
            const result = await cancelShift(selectedShift.applicationId);
            if (result.success) {
                toast.success('シフトをキャンセル（マッチング解除）しました');
                fetchShifts();
                setIsCancelModalOpen(false);
                setIsDetailModalOpen(false);
                setSelectedShift(null);
            } else {
                toast.error(result.error || 'キャンセルに失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'delete',
                operation: 'シフトキャンセル',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { applicationId: selectedShift.applicationId, facilityId: admin?.facilityId }
            });
            console.error('Cancel error:', error);
            toast.error('エラーが発生しました');
        }
    };

    const weekDays = eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
    });

    return (
        <div className="h-full flex flex-col">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <h1 className="text-xl font-bold text-gray-900">シフト管理</h1>
            </div>

            <div className="p-4 flex-1">
                <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${viewMode === 'month' ? 'min-h-[700px]' : ''}`}>
                    {/* カレンダーヘッダー */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <button onClick={handlePrev} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h2 className="text-lg font-bold text-gray-800 min-w-[140px] text-center">
                                {format(currentDate, 'yyyy年 M月', { locale: ja })}
                            </h2>
                            <button onClick={handleNext} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                            <button onClick={handleToday} className="ml-1 px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors">
                                今日
                            </button>
                        </div>

                        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === 'week'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                週
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === 'month'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                月
                            </button>
                        </div>
                    </div>
                    {viewMode === 'week' ? (
                        <div className="flex flex-col">
                            <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 z-10 bg-gray-50 border-b">
                                <div className="p-2 text-center text-xs text-gray-500">時間</div>
                                {weekDays.map((day, i) => {
                                    const dayOfWeek = ['月', '火', '水', '木', '金', '土', '日'][i];
                                    const isWeekend = i >= 5;
                                    const isToday = isSameDay(day, getCurrentTime());
                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={`p-2 text-center text-sm font-semibold border-l ${isToday ? 'bg-blue-50' : ''
                                                } ${isWeekend ? (i === 5 ? 'text-blue-600' : 'text-red-600') : 'text-gray-600'}`}
                                        >
                                            <div>{dayOfWeek}</div>
                                            <div className="text-xs font-normal">{format(day, 'M/d')}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
                                <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: '576px' }}>
                                    <div className="relative border-r">
                                        {/* 2時間刻みでラベル表示: 0, 2, 4, ..., 22 */}
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <div
                                                key={i}
                                                className="absolute w-full text-xs text-gray-400 text-right pr-2"
                                                style={{ top: `${i * 48}px` }}
                                            >
                                                {`${String(i * 2).padStart(2, '0')}:00`}
                                            </div>
                                        ))}
                                    </div>

                                    {weekDays.map((day) => {
                                        const dayShifts = getShiftsForDay(day);
                                        const groupedShifts = groupOverlappingShifts(dayShifts);

                                        return (
                                            <div key={day.toISOString()} className="relative border-l overflow-hidden">
                                                {/* 2時間刻みで横線: 0, 2, 4, ..., 22 */}
                                                {Array.from({ length: 12 }, (_, i) => (
                                                    <div
                                                        key={i}
                                                        className="absolute w-full border-t border-gray-200"
                                                        style={{ top: `${i * 48}px` }}
                                                    />
                                                ))}

                                                {groupedShifts.map((group, groupIdx) =>
                                                    group.map((shift, shiftIdx) => {
                                                        const top = timeToPixels(roundTimeToFiveMinutes(shift.startTime));
                                                        const height = getDurationPixels(
                                                            roundTimeToFiveMinutes(shift.startTime),
                                                            roundTimeToFiveMinutes(shift.endTime)
                                                        );
                                                        // Googleカレンダー風: 各イベントは少しずつ右にオフセット
                                                        // 最大5人まで想定、1人目は左0%から、オフセット15%ずつ
                                                        const offsetPercent = 15;
                                                        const baseWidth = 85; // 基本幅85%
                                                        const left = shiftIdx * offsetPercent;
                                                        // 最後のイベントは右端まで伸ばす
                                                        const width = shiftIdx === group.length - 1
                                                            ? 100 - left
                                                            : baseWidth;

                                                        return (
                                                            <div
                                                                key={shift.applicationId}
                                                                onClick={() => openDetailModal(shift)}
                                                                className={`absolute cursor-pointer rounded-sm p-1 text-xs overflow-hidden shadow-sm ${
                                                                    shift.jobType === 'OFFER'
                                                                        ? 'bg-blue-200 border-2 border-blue-500 hover:bg-blue-300'
                                                                        : shift.jobType === 'LIMITED_WORKED'
                                                                        ? 'bg-purple-100 border-2 border-purple-400 hover:bg-purple-200'
                                                                        : shift.jobType === 'LIMITED_FAVORITE'
                                                                        ? 'bg-pink-100 border-2 border-pink-400 hover:bg-pink-200'
                                                                        : 'bg-blue-100 border border-blue-300 hover:bg-blue-200'
                                                                }`}
                                                                style={{
                                                                    top: `${top}px`,
                                                                    height: `${Math.max(height, 20)}px`,
                                                                    left: `${left}%`,
                                                                    width: `${width}%`,
                                                                    zIndex: shiftIdx + 1,
                                                                }}
                                                            >
                                                                <div className="font-semibold truncate flex items-center gap-1">
                                                                    {shift.jobType === 'OFFER' && (
                                                                        <span className="px-1 py-0 text-[8px] font-bold bg-blue-600 text-white rounded">オファ</span>
                                                                    )}
                                                                    {shift.jobType === 'LIMITED_WORKED' && (
                                                                        <span className="px-1 py-0 text-[8px] font-bold bg-purple-600 text-white rounded">限定</span>
                                                                    )}
                                                                    {shift.jobType === 'LIMITED_FAVORITE' && (
                                                                        <span className="px-1 py-0 text-[8px] font-bold bg-pink-500 text-white rounded">限定★</span>
                                                                    )}
                                                                    <span className="truncate">{shift.workerName}</span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-600 truncate">
                                                                    {shift.startTime}-{shift.endTime}
                                                                </div>
                                                                {height > 60 && shift.qualifications.length > 0 && (
                                                                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                                                                        {shift.qualifications.slice(0, 2).map((q, i) => (
                                                                            <span key={i} className="px-1 py-0 bg-white/50 rounded text-[8px]">
                                                                                {q.length > 4 ? q.substring(0, 4) + '…' : q}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {getWeeksFromDays(days).map((week, weekIdx) => (
                                <div key={weekIdx} className="grid grid-cols-7">
                                    {week.map((day) => {
                                        const dayShifts = getShiftsForDay(day);
                                        const isToday = isSameDay(day, getCurrentTime());
                                        const isCurrentMonth = isSameMonth(day, currentDate);
                                        const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={`
                                                border-b border-r border-gray-200 p-2 transition-colors relative min-h-[120px]
                                                ${!isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}
                                                ${isToday ? 'bg-blue-50/30' : ''}
                                            `}
                                            >
                                                <div className={`text-sm mb-2 font-medium flex items-center justify-between ${isToday
                                                    ? 'text-blue-600'
                                                    : !isCurrentMonth
                                                        ? 'text-gray-400'
                                                        : isWeekend
                                                            ? 'text-gray-600'
                                                            : 'text-gray-700'
                                                    }`}>
                                                    <span className={`
                                                    w-7 h-7 flex items-center justify-center rounded-full
                                                    ${isToday ? 'bg-blue-600 text-white' : ''}
                                                `}>
                                                        {format(day, 'd')}
                                                    </span>
                                                    {dayShifts.length > 0 && (
                                                        <span className="text-xs text-gray-500 font-normal">
                                                            {dayShifts.length}件
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    {dayShifts.map(shift => (
                                                        <div
                                                            key={shift.applicationId}
                                                            onClick={() => openDetailModal(shift)}
                                                            className={`group p-2 rounded-lg border text-xs cursor-pointer hover:shadow-md transition-all ${
                                                                shift.jobType === 'OFFER'
                                                                    ? 'bg-blue-200 text-blue-800 border-2 border-blue-400'
                                                                    : shift.jobType === 'LIMITED_WORKED'
                                                                    ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                                                                    : shift.jobType === 'LIMITED_FAVORITE'
                                                                    ? 'bg-pink-100 text-pink-800 border-2 border-pink-300'
                                                                    : 'bg-blue-100 text-blue-700 border-blue-200'
                                                            }`}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex items-center gap-1 truncate">
                                                                    {shift.jobType === 'OFFER' && (
                                                                        <span className="px-1 py-0 text-[8px] font-bold bg-blue-600 text-white rounded flex-shrink-0">オファ</span>
                                                                    )}
                                                                    {shift.jobType === 'LIMITED_WORKED' && (
                                                                        <span className="px-1 py-0 text-[8px] font-bold bg-purple-600 text-white rounded flex-shrink-0">限定</span>
                                                                    )}
                                                                    {shift.jobType === 'LIMITED_FAVORITE' && (
                                                                        <span className="px-1 py-0 text-[8px] font-bold bg-pink-500 text-white rounded flex-shrink-0">限定★</span>
                                                                    )}
                                                                    <span className="font-bold truncate">{shift.startTime}-{shift.endTime}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 mt-1 font-medium truncate">
                                                                <User className="w-3 h-3 flex-shrink-0" />
                                                                {shift.workerName}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isDetailModalOpen && selectedShift && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
                        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-800">シフト詳細</h3>
                                    {selectedShift.jobType === 'OFFER' && (
                                        <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded">オファ</span>
                                    )}
                                    {selectedShift.jobType === 'LIMITED_WORKED' && (
                                        <span className="px-2 py-0.5 text-xs font-bold bg-purple-600 text-white rounded">限定</span>
                                    )}
                                    {selectedShift.jobType === 'LIMITED_FAVORITE' && (
                                        <span className="px-2 py-0.5 text-xs font-bold bg-pink-500 text-white rounded">限定★</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden border-2 border-white shadow-sm">
                                        {selectedShift.workerProfileImage ? (
                                            <img src={selectedShift.workerProfileImage} alt={selectedShift.workerName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                <User className="w-8 h-8" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-900">{selectedShift.workerName}</h4>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {selectedShift.qualifications.length > 0 ? (
                                                selectedShift.qualifications.map((q, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                                                        {q}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-gray-500">資格登録なし</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">勤務日</p>
                                            <p className="font-medium text-gray-900">
                                                {format(selectedShift.workDate, 'yyyy年M月d日 (EEE)', { locale: ja })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">勤務時間</p>
                                            <p className="font-medium text-gray-900">
                                                {selectedShift.startTime} 〜 {selectedShift.endTime}
                                                <span className="ml-2 text-sm text-gray-500">
                                                    （休憩: {selectedShift.breakTime != null && selectedShift.breakTime > 0
                                                        ? `${selectedShift.breakTime}分`
                                                        : <span className="text-amber-600">未入力</span>}）
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">時給</p>
                                            <p className="font-medium text-gray-900">
                                                ¥{selectedShift.hourlyRate.toLocaleString()}
                                                <span className="ml-2 text-sm text-gray-500">
                                                    （交通費: {selectedShift.transportationFee > 0
                                                        ? `¥${selectedShift.transportationFee.toLocaleString()}`
                                                        : 'なし'}）
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Briefcase className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">求人ID</p>
                                            <Link href={`/admin/jobs/${selectedShift.jobId}`} className="text-blue-600 hover:underline font-medium">
                                                #{selectedShift.jobId} を確認
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Link
                                        href={`/admin/messages?workerId=${selectedShift.workerId}`}
                                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        メッセージ
                                    </Link>
                                    <button
                                        onClick={(e) => {
                                            setIsDetailModalOpen(false);
                                            openCancelModal(e, selectedShift);
                                        }}
                                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isCancelModalOpen && selectedShift && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCancelModalOpen(false)}></div>
                        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <XCircle className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">シフトをキャンセルしますか？</h3>
                                <p className="text-sm text-gray-600">
                                    {selectedShift.workerName}さんの<br />
                                    {format(selectedShift.workDate, 'M月d日')} {selectedShift.startTime}〜 の勤務
                                </p>
                                <p className="text-xs text-red-500 mt-4 bg-red-50 p-3 rounded-lg text-left">
                                    ※ この操作は取り消せません。<br />
                                    ※ ワーカーにキャンセル通知が送信されます。
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCancelModalOpen(false)}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                >
                                    戻る
                                </button>
                                <button
                                    onClick={executeCancel}
                                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                                >
                                    キャンセル実行
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
