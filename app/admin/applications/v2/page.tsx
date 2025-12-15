'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    ChevronDown,
    ChevronUp,
    UserCircle,
    Calendar,
    Users,
    Briefcase,
    Award,
    Search,
    X,
    CheckCircle,
    AlertCircle,
    Heart,
    Ban,
    FileText,
    Clock,
    LayoutGrid,
    List,
    Filter,
    ArrowRight,
    Car,
    Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
    getJobsWithApplications,
    getApplicationsByWorker,
    updateApplicationStatus,
    toggleWorkerFavorite,
    toggleWorkerBlock,
    markJobApplicationsAsViewed,
    markWorkerApplicationsAsViewed,
} from '@/src/lib/actions';

// 型定義 (Server Actionsの戻り値に合わせて調整)
interface WorkerProfile {
    id: number;
    name: string;
    profileImage: string | null;
    qualifications: string[];
    location?: string | null;
}

interface Application {
    id: number;
    status: string;
    cancelledBy?: 'WORKER' | 'FACILITY' | null;
    createdAt: string | Date;
    worker: WorkerProfile;
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
    startTime: string;
    endTime: string;
    hourlyWage: number;
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

interface WorkerWithApplications {
    worker: {
        id: number;
        name: string;
        profileImage: string | null;
        qualifications: string[];
        location: string | null;
        rating: number | null;
        reviewCount: number;
        totalWorkDays: number;
        lastMinuteCancelRate: number;
        experienceFields: Array<{ field: string; years: string }>;
        isFavorite: boolean;
        isBlocked: boolean;
    };
    applications: {
        id: number;
        status: string;
        cancelledBy?: 'WORKER' | 'FACILITY' | null;
        createdAt: string;
        isUnviewed?: boolean;
        job: {
            id: number;
            title: string;
            workDate: string;
            startTime: string;
            endTime: string;
            hourlyWage: number;
            requiresInterview: boolean;
        };
    }[];
    unviewedCount: number;
}

export default function ApplicationsPageV2() {
    const { admin, isAdmin, isAdminLoading } = useAuth();
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'job' | 'worker' | 'timeline' | 'shift'>('shift');
    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [jobs, setJobs] = useState<JobWithApplications[]>([]);
    const [workers, setWorkers] = useState<WorkerWithApplications[]>([]);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch Data
    const fetchData = async () => {
        if (!admin?.facilityId) return;
        setIsLoading(true);
        try {
            const [jobsData, workersData] = await Promise.all([
                getJobsWithApplications(admin.facilityId),
                getApplicationsByWorker(admin.facilityId)
            ]);
            // Type guard or casting if necessary, assuming server actions match interfaces
            setJobs(jobsData as any);
            setWorkers(workersData as any);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (admin?.facilityId) {
            fetchData();
        }
    }, [admin?.facilityId]);

    // Render Content Switcher
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            );
        }

        switch (viewMode) {
            case 'job':
                return <JobView jobs={jobs} searchQuery={searchQuery} />;
            case 'worker':
                return <WorkerView workers={workers} searchQuery={searchQuery} />;
            case 'timeline':
                return <TimelineView jobs={jobs} />;
            case 'shift':
                return <ShiftView jobs={jobs} />;
            default:
                return null;
        }
    };

    if (isAdminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!isAdmin || !admin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">アクセス権限がありません</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header Area */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4 sticky top-0 z-30 shadow-sm/50">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">求人管理</h1>
                        <p className="text-sm text-gray-500 mt-1">応募状況とシフトの管理・承認を行えます</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    {/* View Toggles */}
                    <div className="flex bg-gray-100/80 p-1 rounded-lg border border-gray-200 shadow-inner">
                        <ViewToggle
                            mode="job"
                            current={viewMode}
                            setMode={setViewMode}
                            icon={Briefcase}
                            label="求人ごと"
                        />
                        <ViewToggle
                            mode="worker"
                            current={viewMode}
                            setMode={setViewMode}
                            icon={Users}
                            label="ワーカーごと"
                        />
                        <ViewToggle
                            mode="timeline"
                            current={viewMode}
                            setMode={setViewMode}
                            icon={Calendar}
                            label="カレンダー"
                        />
                        <ViewToggle
                            mode="shift"
                            current={viewMode}
                            setMode={setViewMode}
                            icon={Clock}
                            label="シフト"
                        />
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-sm w-full group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={viewMode === 'worker' ? "ワーカー名、スキルで検索..." : "求人タイトル、日付で検索..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-6">
                {renderContent()}
            </div>
        </div>
    );
}

// Sub-components

function ViewToggle({ mode, current, setMode, icon: Icon, label }: { mode: any, current: any, setMode: any, icon: any, label: string }) {
    const isActive = mode === current;
    return (
        <button
            onClick={() => setMode(mode)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${isActive
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );
}

function JobView({ jobs, searchQuery }: { jobs: JobWithApplications[], searchQuery: string }) {
    const filteredJobs = useMemo(() => {
        if (!searchQuery) return jobs;
        return jobs.filter(j => j.title.includes(searchQuery));
    }, [jobs, searchQuery]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredJobs.map(job => (
                <div key={job.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                    {/* Status Line */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${job.status === 'PUBLISHED' ? 'bg-blue-500' :
                        job.status === 'WORKING' ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>

                    <div className="pl-2">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-wrap gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${job.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-700' :
                                    job.status === 'WORKING' ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>
                                    {job.status === 'PUBLISHED' ? '公開中' : job.status}
                                </span>
                                {job.requiresInterview && (
                                    <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded font-bold">審査あり</span>
                                )}
                            </div>
                            <Link href={`/admin/jobs/${job.id}`} className="text-gray-400 hover:text-blue-600 transition-colors">
                                <FileText size={16} />
                            </Link>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1" title={job.title}>{job.title}</h3>

                        <div className="space-y-4 mb-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-1.5 font-medium">
                                    <Clock size={14} className="text-gray-400" />
                                    {job.dateRange}
                                </span>
                                <span className="font-bold bg-gray-50 px-2 py-1 rounded">¥{job.hourlyWage.toLocaleString()}<span className="text-gray-400 text-xs font-normal">/時</span></span>
                            </div>

                            {/* Matching Status */}
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-gray-500 font-medium">マッチング進捗</span>
                                    <span className={`font-bold ${job.totalMatched >= job.totalRecruitment ? 'text-green-600' : 'text-blue-600'}`}>
                                        {Math.round((job.totalMatched / job.totalRecruitment) * 100)}%
                                        <span className="text-gray-400 ml-1 font-normal">({job.totalMatched}/{job.totalRecruitment}名)</span>
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${job.totalMatched >= job.totalRecruitment ? 'bg-green-500' : 'bg-blue-500'}`}
                                        style={{ width: `${Math.min((job.totalMatched / job.totalRecruitment) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Applicants Preview */}
                        <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                            <div className="flex -space-x-2 overflow-hidden py-1 pl-1">
                                {job.workDates.flatMap(wd => wd.applications).slice(0, 4).map((app, i) => (
                                    <div key={app.id} className="w-8 h-8 rounded-full border-2 border-white relative overflow-hidden bg-gray-200" title={app.worker.name}>
                                        {app.worker.profileImage ? (
                                            <Image src={app.worker.profileImage} alt={app.worker.name} fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold">
                                                {app.worker.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {job.totalApplied > 4 && (
                                    <div className="w-8 h-8 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center text-blue-600 text-xs font-bold shadow-sm">
                                        +{job.totalApplied - 4}
                                    </div>
                                )}
                                {job.totalApplied === 0 && (
                                    <span className="text-xs text-gray-400 italic pl-1">まだ応募はありません</span>
                                )}
                            </div>

                            {job.unviewedCount > 0 && (
                                <div className="animate-bounce bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    +{job.unviewedCount} 新着
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function WorkerView({ workers, searchQuery }: { workers: WorkerWithApplications[], searchQuery: string }) {
    const filteredWorkers = useMemo(() => {
        if (!searchQuery) return workers;
        const q = searchQuery.toLowerCase();
        return workers.filter(w =>
            w.worker.name.toLowerCase().includes(q) ||
            w.worker.qualifications.some(qa => qa.toLowerCase().includes(q))
        );
    }, [workers, searchQuery]);

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            {filteredWorkers.map(w => (
                <div key={w.worker.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-5 hover:shadow-md transition-all cursor-pointer group">
                    <div className="relative w-16 h-16 rounded-full bg-gray-100 flex-shrink-0 border border-gray-200 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                        {w.worker.profileImage ? (
                            <Image src={w.worker.profileImage} alt={w.worker.name} fill className="object-cover" />
                        ) : (
                            <UserCircle className="w-full h-full text-gray-300 p-2" />
                        )}
                        {w.unviewedCount > 0 && (
                            <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-gray-900">{w.worker.name}</h3>
                                    {w.worker.isFavorite && <Heart size={14} className="fill-pink-500 text-pink-500" />}
                                </div>
                                <div className="flex gap-3 text-sm text-gray-500 mt-1 items-center">
                                    <span className="flex items-center gap-1 text-yellow-600 font-bold">★ {w.worker.rating?.toFixed(1) || '-'} <span className="font-normal text-gray-400">({w.worker.reviewCount})</span></span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span>勤務 {w.worker.totalWorkDays}回</span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span className={w.worker.lastMinuteCancelRate > 0 ? "text-red-500 font-medium" : ""}>直前キャンセル {w.worker.lastMinuteCancelRate.toFixed(0)}%</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {w.worker.qualifications.map((q, i) => (
                                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{q}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                {w.unviewedCount > 0 && (
                                    <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm animate-pulse">
                                        未対応 {w.unviewedCount}件
                                    </div>
                                )}
                                <button className="text-gray-400 hover:text-blue-600 p-1">
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

interface VisualItem {
    job: JobWithApplications;
    workDate: WorkDate;
    startHour: number;
    duration: number;
    // Layout props
    left: number;
    width: number;
    zIndex: number;
}

function isTimeOverlapping(start1: number, end1: number, start2: number, end2: number): boolean {
    return Math.max(start1, start2) < Math.min(end1, end2);
}

function TimelineView({ jobs: realJobs }: { jobs: JobWithApplications[] }) {
    // Current Week State
    const [currentDate, setCurrentDate] = useState(new Date());

    // Helper: Get Start of Week (Sunday)
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.setDate(diff));
    };

    const startOfWeek = useMemo(() => getStartOfWeek(currentDate), [currentDate]);

    // Generate 7 days for the header
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }, [startOfWeek]);

    // MOCK DATA GENERATOR
    const jobs = useMemo(() => {
        const mockJobs: JobWithApplications[] = [];
        const baseDate = new Date(startOfWeek);

        // Configuration: [DayIndex, Count]
        const distribution = [
            { day: 0, count: 0 },
            { day: 1, count: 1 }, // Mon
            { day: 2, count: 1 }, // Tue
            { day: 3, count: 2 }, // Wed
            { day: 4, count: 3 }, // Thu
            { day: 5, count: 4 }, // Fri
            { day: 6, count: 10 }, // Sat
        ];

        let idCounter = 1000;

        distribution.forEach(({ day, count }) => {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + day);
            const dateStr = date.toISOString().split('T')[0];

            for (let i = 0; i < count; i++) {
                // Vary times with 20% short shift (3 hours)
                const isShort = i % 5 === 0; // 20% chance approx
                const startHour = 8 + (i % 10);
                // Short = 3 hours, Normal = 4-8 hours random? Let's keep normal as 4 for consistency or variation
                const duration = isShort ? 3 : 4 + (i % 3);

                const endHour = startHour + duration;
                const startTime = `${startHour.toString().padStart(2, '0')}:00`;
                const endTime = `${endHour.toString().padStart(2, '0')}:00`;

                // Vary status
                const isFull = i % 3 === 0;
                const requiresInterview = i % 4 === 0;
                const recruitmentCount = 3;
                const matchedCount = isFull ? 3 : (i % 3);

                mockJobs.push({
                    id: idCounter++,
                    title: isShort ? `[短] デモ求人: ${i + 1}番目` : `デモ求人: ${i + 1}番目`,
                    status: 'PUBLISHED',
                    startTime,
                    endTime,
                    hourlyWage: 1200,
                    workContent: [],
                    requiredQualifications: [],
                    requiresInterview,
                    totalRecruitment: recruitmentCount,
                    totalApplied: matchedCount + 1,
                    totalMatched: matchedCount,
                    dateRange: dateStr,
                    unviewedCount: 0,
                    workDates: [{
                        id: idCounter++,
                        date: date,
                        formattedDate: dateStr,
                        recruitmentCount,
                        appliedCount: matchedCount + 1,
                        matchedCount,
                        applications: Array.from({ length: matchedCount + 1 }).map((_, idx) => ({
                            id: idCounter++,
                            status: idx < matchedCount ? 'SCHEDULED' : 'APPLIED',
                            createdAt: new Date(),
                            worker: {
                                id: idCounter++,
                                name: `ワーカー${idx}`,
                                profileImage: null,
                                qualifications: [],
                            },
                            rating: 4.5,
                            reviewCount: 10,
                            lastMinuteCancelRate: 0,
                        }))
                    }]
                });
            }
        });

        return [...realJobs, ...mockJobs];
    }, [startOfWeek, realJobs]);

    // Navigation
    const nextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const prevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const goToday = () => {
        setCurrentDate(new Date());
    };

    // Filter jobs for the current week AND COMPUTE LAYOUT
    const weeklyItems = useMemo(() => {
        const itemsMap = new Map<number, { job: JobWithApplications, workDate: WorkDate, startHour: number, duration: number }[]>();

        // 1. Gather Items
        for (let i = 0; i < 7; i++) itemsMap.set(i, []);
        const weekStartMs = startOfWeek.getTime();
        const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

        jobs.forEach(job => {
            job.workDates.forEach(wd => {
                const wdDate = new Date(wd.date);
                const wdTime = wdDate.getTime();
                if (wdTime >= weekStartMs && wdTime < weekEndMs) {
                    const dayIndex = wdDate.getDay();
                    const [startH, startM] = job.startTime.split(':').map(Number);
                    const [endH, endM] = job.endTime.split(':').map(Number);
                    const startHour = startH + startM / 60;
                    let endHour = endH + endM / 60;
                    if (endHour < startHour) endHour += 24;
                    const duration = endHour - startHour;
                    itemsMap.get(dayIndex)?.push({ job, workDate: wd, startHour, duration });
                }
            });
        });

        // 2. Compute Layout (Offsetting) per day
        const layoutMap = new Map<number, VisualItem[]>();

        itemsMap.forEach((dayItems, dayIndex) => {
            // Sort by start time, then duration (desc)
            dayItems.sort((a, b) => {
                if (a.startHour !== b.startHour) return a.startHour - b.startHour;
                return b.duration - a.duration;
            });

            const visuals: VisualItem[] = [];
            const groups: VisualItem[][] = [];
            let currentGroup: VisualItem[] = [];

            // Grouping logic based on overlap
            dayItems.forEach((item, idx) => {
                const itemEnd = item.startHour + item.duration;

                // Check if this item overlaps with ANY item in the current group
                // Actually, a simpler approach for "cascading" is to just check against the whole group range?
                // Visual Reference logic: 
                // Checks overlap with *currentGroup*. If overlaps, add to group. Else, define group finish.

                // Simplified "Group by connected components of interval graph" approach:
                // If it overlaps with *anything* in the current cluster, add it.
                // But specifically for visual "shifted" look:
                // We just need to know "how many prior items in this group does it overlap with?" -> that determines indentation.

                // Let's stick to the reference implementation's approach:
                // "overlaps = currentGroup.some(...)"

                const isOverlappingGroup = currentGroup.some(g =>
                    isTimeOverlapping(g.startHour, g.startHour + g.duration, item.startHour, itemEnd)
                );

                const visualItem: VisualItem = {
                    ...item,
                    left: 0,
                    width: 100,
                    zIndex: 1
                };

                if (currentGroup.length === 0 || isOverlappingGroup) {
                    currentGroup.push(visualItem);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [visualItem];
                }
            });
            if (currentGroup.length > 0) groups.push(currentGroup);

            // Calculate layout within groups
            groups.forEach(group => {
                group.forEach((item, idx) => {
                    const offsetPercent = 15; // 15% shift
                    const baseWidth = 85;

                    // Cap indentation to avoid running off-screen (max 6 levels deep? 90%?)
                    const maxLeft = 85;
                    const rawLeft = idx * offsetPercent;
                    item.left = Math.min(rawLeft, maxLeft);

                    // If it's the last item in the group, stretch it. Otherwise fixed width.
                    // Also ensure width is not negative.
                    const availableWidth = 100 - item.left;
                    if (idx === group.length - 1) {
                        item.width = Math.max(availableWidth, 5); // At least 5%
                    } else {
                        // If next item starts very close, we might be overlapped.
                        // But for simple "card stack" look, baseWidth is fine, just cap it.
                        item.width = Math.min(baseWidth, availableWidth);
                    }

                    item.zIndex = idx + 10;
                });
                visuals.push(...group);
            });

            layoutMap.set(dayIndex, visuals);
        });

        return layoutMap;
    }, [jobs, startOfWeek]);

    // Time Axis (6:00 to 22:00 for focus, but render full if needed. Let's do 0-24 for safety)
    const timeSlots = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Calendar Header / Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {startOfWeek.getFullYear()}年 {startOfWeek.getMonth() + 1}月
                    </h2>
                    <div className="flex items-center bg-white rounded-md border border-gray-300 shadow-sm">
                        <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 border-r border-gray-300 text-gray-600"><ChevronDown className="rotate-90 w-5 h-5" /></button>
                        <button onClick={goToday} className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 text-gray-700">今日</button>
                        <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 border-l border-gray-300 text-gray-600"><ChevronDown className="-rotate-90 w-5 h-5" /></button>
                    </div>
                </div>
                <div className="text-sm text-gray-500">
                    <span className="font-bold">{jobs.length}</span> 件の求人 / <span className="font-bold">{jobs.reduce((acc, j) => acc + j.workDates.length, 0)}</span> 勤務日
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="flex-1 overflow-auto relative">
                <div className="flex min-w-[1000px]">
                    {/* Time Axis Column */}
                    <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-200 sticky left-0 z-20">
                        <div className="h-10 border-b border-gray-200"></div> {/* Header Spacer */}
                        {timeSlots.map(hour => (
                            <div key={hour} className="h-20 border-b border-gray-100 text-xs text-gray-400 font-medium text-center relative">
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gray-50 px-1">{hour}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Columns for Days */}
                    <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
                        {weekDays.map((day, dayIdx) => {
                            const isToday = new Date().toDateString() === day.toDateString();
                            return (
                                <div key={dayIdx} className="flex flex-col relative min-w-[140px]">
                                    {/* Day Header */}
                                    <div className={`h-10 flex items-center justify-center gap-2 border-b border-gray-200 sticky top-0 z-10 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                                        <span className="text-sm font-bold">{day.getDate()}</span>
                                        <span className="text-xs uppercase font-medium">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                    </div>

                                    {/* Day Grid Lines */}
                                    <div className="relative flex-1">
                                        {timeSlots.map(hour => (
                                            <div key={hour} className="h-20 border-b border-gray-100"></div>
                                        ))}

                                        {/* Jobs as Absolute Blocks */}
                                        {weeklyItems.get(dayIdx)?.map((item, itemIdx) => {
                                            const isFull = item.workDate.matchedCount >= item.workDate.recruitmentCount;
                                            const hasPending = item.workDate.applications.some(a => a.status === 'APPLIED');

                                            // Top position: hour * 80px (h-20)
                                            // Height: duration * 80px
                                            const top = item.startHour * 80;
                                            const height = item.duration * 80;

                                            return (
                                                <div
                                                    key={item.workDate.id}
                                                    className={`absolute rounded-lg border p-1.5 shadow-sm overflow-hidden transition-all hover:z-[100] hover:scale-[1.02] cursor-pointer group ${isFull
                                                        ? 'bg-green-50/90 border-green-200 hover:border-green-400'
                                                        : 'bg-blue-50/90 border-blue-200 hover:border-blue-400'
                                                        }`}
                                                    style={{
                                                        top: `${top}px`,
                                                        height: `${height}px`,
                                                        left: `${item.left}%`,
                                                        width: `${item.width}%`,
                                                        zIndex: item.zIndex
                                                    }}
                                                >
                                                    <div className="flex flex-col h-full">
                                                        <div className="flex justify-between items-start">
                                                            <div className="text-xs font-bold text-gray-700 truncate">{item.job.startTime}-{item.job.endTime}</div>
                                                            <div className="flex gap-1">
                                                                {item.job.requiresInterview && (
                                                                    <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold border border-orange-200">審</span>
                                                                )}
                                                                <div className={`text-[10px] px-1.5 rounded font-bold ${isFull ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'
                                                                    }`}>
                                                                    {item.workDate.matchedCount}/{item.workDate.recruitmentCount}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="font-bold text-xs text-gray-900 line-clamp-2 leading-tight mt-1">
                                                            {item.job.title}
                                                        </div>

                                                        {/* Applicants Preview (Mini) */}
                                                        {item.workDate.applications.length > 0 && (
                                                            <div className="mt-auto pt-1 flex items-center justify-between">
                                                                <div className="flex -space-x-1.5 overflow-hidden">
                                                                    {item.workDate.applications.slice(0, 3).map(app => (
                                                                        <div key={app.id} className="w-5 h-5 rounded-full border border-white bg-gray-200 relative overflow-hidden" title={app.worker.name}>
                                                                            {app.worker.profileImage && <Image src={app.worker.profileImage} fill alt="" className="object-cover" />}
                                                                        </div>
                                                                    ))}
                                                                    {item.workDate.applications.length > 3 && (
                                                                        <div className="w-5 h-5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-500">
                                                                            +{item.workDate.applications.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Pending Badge */}
                                                                {hasPending && (
                                                                    <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full animate-pulse shadow-sm">
                                                                        !
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {/* Legend */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-4 text-xs text-gray-600 justify-end">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div> 募集中</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div> 満員・確定</div>
                <div className="flex items-center gap-1.5"><span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded font-bold border border-orange-200">審</span> 審査あり</div>
            </div>
        </div>
    );
}

// ... (Previous code remains)

// ----------------------------------------------------------------------
// Shift Detail Modal
// ----------------------------------------------------------------------

function ShiftDetailModal({
    isOpen,
    onClose,
    item
}: {
    isOpen: boolean;
    onClose: () => void;
    item: VisualItem | null
}) {
    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded textxs font-bold ${item.job.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {item.job.status === 'PUBLISHED' ? '募集中' : item.job.status}
                            </span>
                            <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{item.job.title}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>{item.workDate.formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{item.job.startTime} - {item.job.endTime}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Users className="w-4 h-4" />
                                <span>定員: {item.workDate.recruitmentCount}名</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
                            <div className="text-sm text-blue-600 font-medium mb-1">マッチング</div>
                            <div className="text-2xl font-bold text-blue-900">{item.workDate.matchedCount}</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg text-center border border-orange-100">
                            <div className="text-sm text-orange-600 font-medium mb-1">応募中</div>
                            <div className="text-2xl font-bold text-orange-900">
                                {item.workDate.applications.filter(a => a.status === 'APPLIED').length}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
                            <div className="text-sm text-gray-600 font-medium mb-1">未読</div>
                            <div className="text-2xl font-bold text-gray-900">{item.job.unviewedCount || 0}</div>
                        </div>
                    </div>

                    {/* Applicant List */}
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>応募者・参加者一覧</span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                            {item.workDate.applications.length}
                        </span>
                    </h4>

                    <div className="space-y-3">
                        {item.workDate.applications.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                まだ応募はありません
                            </div>
                        ) : (
                            item.workDate.applications.map(app => (
                                <div key={app.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg relative overflow-hidden">
                                            {app.worker.profileImage ? (
                                                <Image src={app.worker.profileImage} fill alt="" className="object-cover" />
                                            ) : (
                                                <span className="text-gray-400">👤</span>
                                            )}
                                            {/* Status Badge on Avatar */}
                                            {app.status === 'APPLIED' && (
                                                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-900">{app.worker.name}</p>
                                                {app.status === 'SCHEDULED' && (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">確定済み</span>
                                                )}
                                                {app.status === 'APPLIED' && (
                                                    <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">審査待ち</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <span>⭐️ {app.rating}</span>
                                                <span>•</span>
                                                <span>レビュー {app.reviewCount}件</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                                            メッセージ
                                        </button>
                                        {app.status === 'APPLIED' && (
                                            <>
                                                <button className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors">
                                                    お断り
                                                </button>
                                                <button className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
                                                    採用する
                                                </button>
                                            </>
                                        )}
                                        {app.status === 'SCHEDULED' && (
                                            <button className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                キャンセル
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

function ShiftView({ jobs: realJobs }: { jobs: JobWithApplications[] }) {
    // Current Week State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<VisualItem | null>(null);

    // Helper: Get Start of Week (Sunday) to align with other views
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.setDate(diff));
    };

    const startOfWeek = useMemo(() => getStartOfWeek(currentDate), [currentDate]);

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }, [startOfWeek]);

    // Enhanced Mock Data Generator
    const jobs = useMemo(() => {
        const mockJobs: JobWithApplications[] = [];
        const baseDate = new Date(startOfWeek);

        const distribution = [
            { day: 0, count: 0 },
            { day: 1, count: 1 }, // Mon
            { day: 2, count: 1 }, // Tue
            { day: 3, count: 2 }, // Wed
            { day: 4, count: 3 }, // Thu
            { day: 5, count: 5 }, // Fri
            { day: 6, count: 8 }, // Sat
        ];

        let idCounter = 3000;

        distribution.forEach(({ day, count }) => {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + day);
            const dateStr = date.toISOString().split('T')[0];

            for (let i = 0; i < count; i++) {
                const isShort = i % 5 === 0;
                const startHour = 8 + (i % 8) + (Math.random() * 2); // Random-ish start
                const duration = isShort ? 3 : 4 + (Math.floor(Math.random() * 4));

                // Align to nearest 30min for cleaner look
                const alignedStartHour = Math.floor(startHour * 2) / 2;

                const endHour = alignedStartHour + duration;
                const startH = Math.floor(alignedStartHour);
                const startM = (alignedStartHour % 1) * 60;
                const endH = Math.floor(endHour);
                const endM = (endHour % 1) * 60;

                const startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
                const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

                const isFull = i % 3 === 0;
                const requiresInterview = i % 2 === 0; // 50% chance of interview
                const hasUnread = i % 4 === 0; // 25% chance of unread applicants
                const unviewedCount = hasUnread ? Math.floor(Math.random() * 3) + 1 : 0;

                const recruitmentCount = 3;
                const matchedCount = isFull ? 3 : (i % 3);

                // Qualifications for demo
                const demoQuals = ['driver', 'helper2', 'nurse'];
                const requiredQualifications = i % 3 === 0 ? [] : [demoQuals[i % 3]];

                mockJobs.push({
                    id: idCounter++,
                    title: isShort ? `[短] 急募配送スタッフ: ${i + 1}番目` : `配膳・ホールスタッフ募集: ${i + 1}番目`,
                    status: 'PUBLISHED',
                    startTime,
                    endTime,
                    hourlyWage: 1200 + (i * 50),
                    workContent: [],
                    requiredQualifications,
                    requiresInterview,
                    totalRecruitment: recruitmentCount,
                    totalApplied: matchedCount + 1,
                    totalMatched: matchedCount,
                    dateRange: dateStr,
                    unviewedCount: unviewedCount,
                    workDates: [{
                        id: idCounter++,
                        date: date,
                        formattedDate: dateStr,
                        recruitmentCount,
                        appliedCount: matchedCount + 1 + unviewedCount,
                        matchedCount,
                        applications: Array.from({ length: matchedCount + 1 + unviewedCount }).map((_, idx) => ({
                            id: idCounter++,
                            status: idx < matchedCount ? 'SCHEDULED' : 'APPLIED',
                            createdAt: new Date(),
                            worker: {
                                id: idCounter++,
                                name: `テストワーカー${idx}`,
                                profileImage: null,
                                qualifications: [],
                            },
                            rating: 4.0 + (idx * 0.1),
                            reviewCount: 5 + idx * 2,
                            lastMinuteCancelRate: 0,
                        }))
                    }]
                });
            }
        });

        return [...realJobs, ...mockJobs];
    }, [startOfWeek, realJobs]);

    // Navigation (Shared logic)
    const nextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };
    const prevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };
    const goToday = () => {
        setCurrentDate(new Date());
    };

    // Calculate Layout
    const dailyLayout = useMemo(() => {
        const layout = new Map<number, { rows: VisualItem[][], maxRows: number }>();
        const weekStartMs = startOfWeek.getTime();
        const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

        // 1. Group items by day
        const dayItemsMap = new Map<number, VisualItem[]>();
        for (let i = 0; i < 7; i++) dayItemsMap.set(i, []);

        jobs.forEach(job => {
            job.workDates.forEach(wd => {
                const wdDate = new Date(wd.date);
                const wdTime = wdDate.getTime();
                if (wdTime >= weekStartMs && wdTime < weekEndMs) {
                    const dayIndex = wdDate.getDay();
                    const [startH, startM] = job.startTime.split(':').map(Number);
                    const [endH, endM] = job.endTime.split(':').map(Number);
                    const startHour = startH + startM / 60;
                    let endHour = endH + endM / 60;
                    if (endHour < startHour) endHour += 24;
                    const duration = endHour - startHour;

                    // Calculate generic left/width for Horizontal Time axis (0-24h)
                    // 24h = 100%
                    const left = (startHour / 24) * 100;
                    const width = (duration / 24) * 100;

                    dayItemsMap.get(dayIndex)?.push({
                        job,
                        workDate: wd,
                        startHour,
                        duration,
                        left,
                        width,
                        zIndex: 1
                    });
                }
            });
        });

        // 2. Compute Stacking (Rows)
        dayItemsMap.forEach((items, dayIndex) => {
            items.sort((a, b) => a.startHour - b.startHour);
            const rows: VisualItem[][] = [];

            items.forEach(item => {
                let placed = false;
                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    const lastInRow = row[row.length - 1];
                    const lastEnd = lastInRow.startHour + lastInRow.duration;
                    // Add minimal buffer to prevent visual crowding? 0.1h
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
            layout.set(dayIndex, { rows, maxRows: rows.length });
        });

        return layout;
    }, [jobs, startOfWeek]);

    const timeSlots = Array.from({ length: 24 }, (_, i) => i);

    // Qualification Icon Helper
    const renderQualIcon = (qual: string) => {
        switch (qual) {
            case 'driver': return <Car size={10} className="text-gray-500" />;
            case 'nurse': return <Activity size={10} className="text-gray-500" />;
            default: return <Award size={10} className="text-gray-500" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
            <ShiftDetailModal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                item={selectedItem}
            />

            {/* Header / Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {startOfWeek.getFullYear()}年 {startOfWeek.getMonth() + 1}月
                    </h2>
                    <div className="flex items-center bg-white rounded-md border border-gray-300 shadow-sm">
                        <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 border-r border-gray-300 text-gray-600"><ChevronDown className="rotate-90 w-5 h-5" /></button>
                        <button onClick={goToday} className="px-3 py-1.5 text-sm font-bold hover:bg-gray-100 text-gray-700">今日</button>
                        <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 border-l border-gray-300 text-gray-600"><ChevronDown className="-rotate-90 w-5 h-5" /></button>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">1</span> 新着応募</div>
                    <div className="flex items-center gap-1"><FileText size={12} className="text-orange-500" /> 審査あり</div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="min-w-[2000px]"> {/* Doubled Width Container */}
                    {/* Table Header: Time Axis */}
                    <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
                        <div className="w-24 flex-shrink-0 p-2 border-r border-gray-200 bg-gray-50 sticky left-0 z-30 shadow-sm"></div>
                        <div className="flex-1 relative h-8">
                            {timeSlots.map(h => (
                                <div key={h} className="absolute text-xs text-gray-400 border-l border-gray-200 h-full pl-1" style={{ left: `${(h / 24) * 100}%` }}>
                                    {h}:00
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rows: Vertical Days */}
                    <div className="divide-y divide-gray-200">
                        {weekDays.map((day, dayIndex) => {
                            const layout = dailyLayout.get(dayIndex);
                            const isToday = new Date().toDateString() === day.toDateString();
                            const rowHeight = 50; // Increased height for better visibility
                            const totalHeight = Math.max((layout?.maxRows || 0) * rowHeight + 20, 100);

                            return (
                                <div key={dayIndex} className="flex group bg-white hover:bg-gray-50 transition-colors">
                                    {/* Day Label Column */}
                                    <div className={`w-24 flex-shrink-0 border-r border-gray-200 p-3 flex flex-col items-center justify-center gap-1 sticky left-0 z-20 shadow-sm ${isToday ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                                        <span className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</span>
                                        <span className="text-xs font-bold text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                    </div>

                                    {/* Timeline Lane */}
                                    <div className="flex-1 relative" style={{ height: `${totalHeight}px` }}>
                                        {/* Grid Lines */}
                                        {timeSlots.map(h => (
                                            <div key={h} className="absolute top-0 bottom-0 border-r border-gray-100" style={{ left: `${(h / 24) * 100}%` }}></div>
                                        ))}

                                        {/* Job Items */}
                                        {layout?.rows.map((row, rowIndex) => (
                                            row.map(item => {
                                                const isFull = item.workDate.matchedCount >= item.workDate.recruitmentCount;
                                                // 5 chars truncate logic
                                                const truncatedTitle = item.job.title.length > 5 ? item.job.title.slice(0, 5) + '...' : item.job.title;

                                                return (
                                                    <div
                                                        key={item.workDate.id}
                                                        onClick={() => setSelectedItem(item)}
                                                        className={`absolute rounded-full border text-xs overflow-hidden shadow-sm flex items-center px-3 cursor-pointer transition-all hover:z-30 hover:scale-[1.02] hover:shadow-md ${isFull
                                                            ? 'bg-green-100/90 border-green-300 text-green-900'
                                                            : 'bg-blue-100/90 border-blue-300 text-blue-900'
                                                            }`}
                                                        style={{
                                                            left: `${item.left}%`,
                                                            width: `${item.width}%`,
                                                            top: `${10 + rowIndex * rowHeight}px`,
                                                            height: `${rowHeight - 10}px`
                                                        }}
                                                    >
                                                        <div className="flex items-center w-full gap-2">
                                                            {/* Title */}
                                                            <span className="font-bold whitespace-nowrap" title={item.job.title}>
                                                                {truncatedTitle}
                                                            </span>

                                                            {/* Qualification Icons */}
                                                            <div className="flex items-center gap-0.5">
                                                                {item.job.requiredQualifications.map((q, idx) => (
                                                                    <div key={idx} title={q}>{renderQualIcon(q)}</div>
                                                                ))}
                                                                {/* Example 'Unnecessary' icon if needed, but sticking to required quals for now */}
                                                            </div>

                                                            {/* Review Mark */}
                                                            {item.job.requiresInterview && (
                                                                <div title="要審査">
                                                                    <FileText size={12} className="text-orange-600 fill-orange-100" />
                                                                </div>
                                                            )}

                                                            {/* Spacer */}
                                                            <div className="flex-1" />

                                                            {/* Unread Badge (New!) */}
                                                            {item.job.unviewedCount > 0 && (
                                                                <div className="flex items-center justify-center w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold shadow-sm animate-pulse">
                                                                    {item.job.unviewedCount}
                                                                </div>
                                                            )}

                                                            {/* Person Emoji + Count */}
                                                            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono whitespace-nowrap ${isFull ? 'bg-green-200/50' : 'bg-white/50'
                                                                }`}>
                                                                <span>👤</span>
                                                                <span className="font-bold">{item.workDate.matchedCount}</span>
                                                                <span className="opacity-60">/{item.workDate.recruitmentCount}</span>
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
