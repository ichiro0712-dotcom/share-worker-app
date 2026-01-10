import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getPublicJobById } from '@/src/lib/actions/job-public';
import { MapPin, Clock, JapaneseYen, Calendar, Users, Building2 } from 'lucide-react';

interface PageProps {
    params: Promise<{ id: string }>;
}

interface WorkDateItem {
    id: number;
    work_date: string;
    deadline: string;
    recruitment_count: number;
    matched_count: number;
    remaining: number;
}

// OGP/メタデータを動的に生成
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const job = await getPublicJobById(id);

    if (!job) {
        return {
            title: '求人が見つかりません | +TASTAS',
        };
    }

    const description = `時給${job.hourly_wage.toLocaleString()}円 | ${job.facility.prefecture}${job.facility.city} | ${job.qualifications?.join('・') || '資格不問'}`;

    return {
        title: `${job.title} | +TASTAS`,
        description,
        openGraph: {
            title: `${job.title} | +TASTAS`,
            description,
            type: 'website',
            images: job.images?.[0] ? [{ url: job.images[0] }] : [{ url: '/images/og-default.png' }],
            siteName: '+TASTAS',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${job.title} | +TASTAS`,
            description,
        },
        alternates: {
            canonical: `/public/jobs/${id}`,
        },
    };
}

export default async function PublicJobDetailPage({ params }: PageProps) {
    const { id } = await params;
    const job = await getPublicJobById(id);

    if (!job) {
        notFound();
    }

    // 勤務時間計算
    const calculateWorkHours = () => {
        if (!job.start_time || !job.end_time) return null;
        const [startH, startM] = job.start_time.split(':').map(Number);
        const [endH, endM] = job.end_time.split(':').map(Number);
        let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMinutes < 0) totalMinutes += 24 * 60; // 日跨ぎ対応
        const breakMinutes = Number(job.break_time) || 0;
        const workMinutes = totalMinutes - breakMinutes;
        const hours = Math.floor(workMinutes / 60);
        const minutes = workMinutes % 60;
        return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
    };

    // 日給計算
    const calculateDailyWage = () => {
        if (!job.start_time || !job.end_time || !job.hourly_wage) return null;
        const [startH, startM] = job.start_time.split(':').map(Number);
        const [endH, endM] = job.end_time.split(':').map(Number);
        let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        const breakMinutes = Number(job.break_time) || 0;
        const workMinutes = totalMinutes - breakMinutes;
        const workHours = workMinutes / 60;
        return Math.floor(job.hourly_wage * workHours);
    };

    const workHours = calculateWorkHours();
    const dailyWage = calculateDailyWage();

    // 勤務日のフォーマット
    const formatWorkDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`;
    };

    return (
        <div className="bg-background">
            {/* 画像カルーセル */}
            <div className="relative aspect-video bg-gray-100">
                {job.images && job.images.length > 0 ? (
                    <Image
                        src={job.images[0]}
                        alt={job.title}
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <Building2 className="w-16 h-16 text-gray-300" />
                    </div>
                )}
            </div>

            {/* メインコンテンツ */}
            <div className="p-4 space-y-6">
                {/* タイトル・施設名 */}
                <div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h1>
                    <p className="text-gray-600">{job.facility.name}</p>
                </div>

                {/* 給与情報 */}
                <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <JapaneseYen className="w-5 h-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">
                            {job.hourly_wage.toLocaleString()}円
                        </span>
                        <span className="text-gray-500">/時</span>
                    </div>
                    {dailyWage && (
                        <p className="text-sm text-gray-600">
                            日給目安: <span className="font-semibold">{dailyWage.toLocaleString()}円</span>
                            {job.transportation_fee && job.transportation_fee > 0 && (
                                <span className="ml-2">+ 交通費 {job.transportation_fee.toLocaleString()}円</span>
                            )}
                        </p>
                    )}
                </div>

                {/* 勤務日程 */}
                <div className="space-y-3">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        勤務日程
                    </h2>
                    <div className="grid grid-cols-3 gap-2">
                        {job.workDates.slice(0, 6).map((wd: WorkDateItem) => (
                            <div
                                key={wd.id}
                                className={`p-2 rounded-lg text-center text-sm ${
                                    wd.remaining > 0
                                        ? 'bg-green-50 border border-green-200'
                                        : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                                <div className="font-medium">{formatWorkDate(wd.work_date)}</div>
                                <div className="text-xs">
                                    {wd.remaining > 0 ? `残${wd.remaining}枠` : '満員'}
                                </div>
                            </div>
                        ))}
                    </div>
                    {job.workDates.length > 6 && (
                        <p className="text-sm text-gray-500 text-center">
                            他 {job.workDates.length - 6} 日程あり
                        </p>
                    )}
                </div>

                {/* 勤務時間 */}
                <div className="space-y-2">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-500" />
                        勤務時間
                    </h2>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-lg font-medium">
                            {job.start_time} 〜 {job.end_time}
                        </p>
                        <p className="text-sm text-gray-600">
                            実働 {workHours}
                            {job.break_time && Number(job.break_time) > 0 && `（休憩${job.break_time}分）`}
                        </p>
                    </div>
                </div>

                {/* 勤務地 */}
                <div className="space-y-2">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-500" />
                        勤務地
                    </h2>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                        <p className="font-medium">{job.facility.name}</p>
                        <p className="text-sm text-gray-600">
                            {job.facility.prefecture}{job.facility.city}{job.facility.address}
                            {job.facility.address_line && ` ${job.facility.address_line}`}
                        </p>
                    </div>
                </div>

                {/* 応募資格 */}
                {job.qualifications && job.qualifications.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-gray-500" />
                            応募資格
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {job.qualifications.map((qual: string, idx: number) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                                >
                                    {qual}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 仕事内容 */}
                {job.description && (
                    <div className="space-y-2">
                        <h2 className="font-semibold text-gray-900">仕事内容</h2>
                        <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                    </div>
                )}

                {/* 審査について */}
                {job.requires_interview && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-800">
                            ※ この求人は審査があります。応募後、施設からの承認が必要です。
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
