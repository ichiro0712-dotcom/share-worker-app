'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Star, MapPin, Heart, Ban, X, FileText, Download, ExternalLink, Phone, User, Users, MapPin as MapPinIcon } from 'lucide-react';
import { getWorkerDetail, toggleWorkerFavorite, toggleWorkerBlock } from '@/src/lib/actions';
import { useAuth } from '@/contexts/AuthContext';

interface WorkerDetailData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  qualifications: string[];
  birthDate: string | null;
  age: number | null;
  // 追加フィールド
  gender: string | null;
  nationality: string | null;
  lastNameKana: string | null;
  firstNameKana: string | null;
  // 住所
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  addressLine: string | null;
  building: string | null;
  // 緊急連絡先
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  emergencyAddress: string | null;
  // 働き方・希望
  currentWorkStyle: string | null;
  desiredWorkStyle: string | null;
  jobChangeDesire: string | null;
  desiredWorkDaysPerWeek: string | null;
  desiredWorkPeriod: string | null;
  desiredWorkDays: string[];
  desiredStartTime: string | null;
  desiredEndTime: string | null;
  // 経験
  experienceFields: Record<string, string> | null;
  workHistories: string[];
  // 自己PR
  selfPR: string | null;
  // 銀行口座
  bankName: string | null;
  branchName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  // その他
  pensionNumber: string | null;
  // 自社データ
  ourFacilityWorkDays: number;
  ourFacilityAvgRating: number;
  ourFacilityReviewCount: number;
  // 全体データ
  totalWorkDays: number;
  otherFacilityWorkDays: number;
  totalAvgRating: number;
  totalReviewCount: number;
  // キャンセル率
  cancelRate: number;
  lastMinuteCancelRate: number;
  // サービス種別ごとの評価
  ratingsByFacilityType: {
    facilityType: string;
    averageRating: number;
    reviewCount: number;
  }[];
  // 直近勤務予定
  upcomingSchedules: {
    id: number;
    workDate: string;
    startTime: string;
    endTime: string;
    jobTitle: string;
    facilityName: string;
  }[];
  // 勤務履歴
  workHistory: {
    id: number;
    jobTitle: string;
    workDate: string;
    status: string;
  }[];
  // 評価履歴
  evaluations: {
    id: number;
    jobTitle: string;
    jobDate: string;
    rating: number;
    comment: string | null;
  }[];
  // ブックマーク状態
  isFavorite: boolean;
  isBlocked: boolean;
  // 項目別平均評価（新規追加）
  ratingsByCategory: {
    attendance: number | null;
    skill: number | null;
    execution: number | null;
    communication: number | null;
    attitude: number | null;
  } | null;
  // 資格証明書画像
  qualificationCertificates: Record<string, string | { certificate_image?: string }> | null;
}

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

// 勤務区分を判定
const getShiftType = (startTime: string, endTime: string): { label: string; bgColor: string; textColor: string } => {
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  // 夜勤（17時以降開始で翌朝終了）
  if (startHour >= 17 || endHour < startHour) {
    return { label: '夜勤', bgColor: 'bg-purple-100', textColor: 'text-purple-700' };
  }
  // 午前（13時前に終了）
  if (endHour <= 13) {
    return { label: '午前', bgColor: 'bg-orange-100', textColor: 'text-orange-700' };
  }
  // 午後（13時以降開始）
  if (startHour >= 13) {
    return { label: '午後', bgColor: 'bg-teal-100', textColor: 'text-teal-700' };
  }
  // 日勤
  return { label: '日勤', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
};

// 日付をフォーマット
const formatDate = (dateString: string): { month: string; day: string } => {
  const date = new Date(dateString);
  return {
    month: `${date.getMonth() + 1}月`,
    day: date.getDate().toString().padStart(2, '0'),
  };
};

export default function WorkerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(params.id);
  const [worker, setWorker] = useState<WorkerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  // モーダル表示用ステート
  const [showCertificatesModal, setShowCertificatesModal] = useState(false);
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false);

  useEffect(() => {
    console.log('[WorkerDetail] useEffect triggered', { isAdminLoading, isAdmin, admin, workerId });
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadWorker = async () => {
      console.log('[WorkerDetail] loadWorker started');
      setLoading(true);
      try {
        console.log('[WorkerDetail] Calling getWorkerDetail', { workerId, facilityId: admin.facilityId });
        const data = await getWorkerDetail(workerId, admin.facilityId);
        console.log('[WorkerDetail] getWorkerDetail result:', data ? 'Data received' : 'Null');
        setWorker(data);
        if (data) {
          setIsFavorite(data.isFavorite || false);
          setIsBlocked(data.isBlocked || false);
        }
      } catch (error) {
        console.error('Failed to load worker:', error);
      } finally {
        console.log('[WorkerDetail] loadWorker finished, setting loading to false');
        setLoading(false);
      }
    };

    loadWorker();
  }, [workerId, admin, isAdmin, isAdminLoading, router]);

  const handleToggleFavorite = async () => {
    if (!admin) return;
    try {
      const result = await toggleWorkerFavorite(workerId, admin.facilityId);
      if (result.success) {
        setIsFavorite(result.isFavorite || false);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleToggleBlock = async () => {
    if (!admin) return;
    try {
      const result = await toggleWorkerBlock(workerId, admin.facilityId);
      if (result.success) {
        setIsBlocked(result.isBlocked || false);
      }
    } catch (error) {
      console.error('Failed to toggle block:', error);
    }
  };

  console.log('[WorkerDetail] Render', { loading, isAdminLoading, hasWorker: !!worker });

  if (loading || isAdminLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500">読み込み中... (Loading: {loading ? 'Yes' : 'No'}, AdminLoading: {isAdminLoading ? 'Yes' : 'No'})</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ワーカーが見つかりません</p>
          <button
            onClick={() => {
              const returnTab = searchParams.get('returnTab');
              if (returnTab === 'workers') {
                router.push('/admin/applications?tab=workers');
              } else if (returnTab === 'jobs') {
                router.push('/admin/applications?tab=jobs');
              } else {
                router.back();
              }
            }}
            className="text-blue-500 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // DBから取得した経験年数データ
  const experienceData = worker.experienceFields
    ? Object.entries(worker.experienceFields).map(([field, years]) => ({ field, years }))
    : [];

  return (
    <div className="bg-gray-50 text-gray-800 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const returnTab = searchParams.get('returnTab');
              if (returnTab === 'workers') {
                router.push('/admin/applications?tab=workers');
              } else if (returnTab === 'jobs') {
                router.push('/admin/applications?tab=jobs');
              } else {
                router.back();
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">ワーカー詳細</h1>
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white">
            募集中
          </span>
        </div>
      </header>

      {/* Main Content (Bento Grid) */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-12 gap-4 h-full max-w-7xl mx-auto sm:min-w-[1024px]">

          {/* Column 1: Profile & Contact (3 cols) */}
          <div className="col-span-12 sm:col-span-3 flex flex-col gap-4">
            {/* Profile Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden ring-4 ring-gray-50">
                {worker.profileImage ? (
                  <img src={worker.profileImage} alt={worker.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                    {worker.name.charAt(0)}
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{worker.name}</h2>
              <p className="text-sm text-gray-500 mb-2">
                {worker.age !== null ? `${worker.age}歳` : '年齢不明'} / {worker.gender ? <span>{worker.gender}</span> : <span className="text-gray-400">性別未登録</span>}
              </p>

              {/* Location & Actions */}
              <div className="flex items-center justify-center gap-3 mb-4 w-full">
                <div className="flex items-center text-gray-600 text-xs bg-gray-100 px-2 py-1 rounded-full">
                  <MapPin className="w-3 h-3 mr-1" />
                  {worker.prefecture || worker.city ? (
                    <span>{worker.prefecture}{worker.city}</span>
                  ) : (
                    <span className="text-gray-400">住所未登録</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleToggleFavorite}
                    className={`w-7 h-7 border rounded-full flex items-center justify-center transition-colors shadow-sm ${isFavorite
                      ? 'bg-pink-50 border-pink-200 text-pink-500'
                      : 'bg-white border-gray-200 hover:bg-pink-50 text-gray-400 hover:text-pink-500'
                      }`}
                    title="お気に入り"
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleToggleBlock}
                    className={`w-7 h-7 border rounded-full flex items-center justify-center transition-colors shadow-sm ${isBlocked
                      ? 'bg-red-50 border-red-200 text-red-500'
                      : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                      }`}
                    title="ブロック"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Qualifications */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                {worker.qualifications.length > 0 ? (
                  worker.qualifications.map((qual, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md">
                      {qual}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">資格情報なし</span>
                )}
              </div>

              {/* Experience Section */}
              <div className="w-full mt-2">
                {experienceData.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {experienceData.map((exp, i) => (
                      <div
                        key={i}
                        className={`group relative px-2 py-1 ${getExperienceColor(exp.field)} text-white rounded-md cursor-help shadow-sm text-xs font-medium`}
                      >
                        {getAbbreviation(exp.field)} {exp.years}
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {exp.field}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center">経験情報なし</p>
                )}
              </div>
            </div>

            {/* Basic Stats - 働き方と希望 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">働き方と希望</h3>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">現在の働き方</span>
                  <span className={`text-xs font-medium ${worker.currentWorkStyle ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.currentWorkStyle || '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">希望勤務形態</span>
                  <span className={`text-xs font-medium ${worker.desiredWorkStyle ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.desiredWorkStyle || '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">転職意向</span>
                  <span className={`text-xs font-medium ${worker.jobChangeDesire ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.jobChangeDesire || '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">希望日数/週</span>
                  <span className={`text-xs font-medium ${worker.desiredWorkDaysPerWeek ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.desiredWorkDaysPerWeek || '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">希望勤務期間</span>
                  <span className={`text-xs font-medium ${worker.desiredWorkPeriod ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.desiredWorkPeriod || '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">希望曜日</span>
                  <span className={`text-xs font-medium text-right ${worker.desiredWorkDays.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.desiredWorkDays.length > 0 ? worker.desiredWorkDays.join(', ') : '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">希望時間帯</span>
                  <span className={`text-xs font-medium ${worker.desiredStartTime || worker.desiredEndTime ? 'text-gray-900' : 'text-gray-400'}`}>
                    {worker.desiredStartTime && worker.desiredEndTime
                      ? `${worker.desiredStartTime} 〜 ${worker.desiredEndTime}`
                      : worker.desiredStartTime
                        ? `${worker.desiredStartTime} 〜`
                        : worker.desiredEndTime
                          ? `〜 ${worker.desiredEndTime}`
                          : '未登録'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Performance & Schedule (6 cols) */}
          <div className="col-span-12 sm:col-span-6 flex flex-col gap-4">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">総勤務回数</div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-gray-900">{worker.totalWorkDays}</span>
                  <span className="text-xs text-gray-500 mb-1">回</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  自社: {worker.ourFacilityWorkDays}回 / 他社: {worker.otherFacilityWorkDays}回
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">キャンセル率</div>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${worker.cancelRate > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                    {worker.cancelRate.toFixed(0)}%
                  </span>
                </div>
                <div className={`text-xs mt-1 ${worker.lastMinuteCancelRate > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  直前: {worker.lastMinuteCancelRate.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Upcoming Schedule */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">直近の勤務予定</h3>
                <Link href={`/admin/workers/${workerId}/schedules`} className="text-xs text-blue-500 hover:underline">
                  全て見る
                </Link>
              </div>
              <div className="p-2 overflow-y-auto flex-1">
                {worker.upcomingSchedules.length > 0 ? (
                  <div className="space-y-2">
                    {worker.upcomingSchedules.map((schedule) => {
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
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    勤務予定なし
                  </div>
                )}
              </div>
            </div>

            {/* Self PR */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">自己PR</h3>
              {worker.selfPR ? (
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                  {worker.selfPR}
                </p>
              ) : (
                <p className="text-sm text-gray-400 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                  自己PRは未登録です
                </p>
              )}
            </div>
          </div>

          {/* Column 3: Ratings & Analysis (3 cols) */}
          <div className="col-span-12 sm:col-span-3 flex flex-col gap-4">
            {/* Ratings Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">評価分析</h3>

              {/* Overall Rating inside Analysis */}
              <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-xl">
                <div className="text-sm font-bold text-gray-700">総合評価</div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {worker.totalAvgRating > 0 ? worker.totalAvgRating.toFixed(1) : '-'}
                  </span>
                  <div className="flex items-center mb-1.5">
                    <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* 項目別スコアはDBにないため仮表示 */}
                {[
                  { label: '勤怠・時間', key: 'attendance' },
                  { label: 'スキル', key: 'skill' },
                  { label: '遂行力', key: 'execution' },
                  { label: 'コミュ力', key: 'communication' },
                  { label: '姿勢', key: 'attitude' },
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-bold text-gray-900">
                        {worker.ratingsByCategory?.[item.key as keyof typeof worker.ratingsByCategory]?.toFixed(1) || '-'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400"
                        style={{ width: `${(worker.ratingsByCategory?.[item.key as keyof typeof worker.ratingsByCategory] || 0) * 20}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Facility Type Ratings */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">サービス種別ごとの評価</h3>
              {worker.ratingsByFacilityType.length > 0 ? (
                <div className="space-y-3">
                  {worker.ratingsByFacilityType.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900">{item.facilityType}</span>
                        <span className="text-[10px] text-gray-500">{item.reviewCount}件のレビュー</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="text-sm font-bold text-gray-900">{item.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">評価データなし</div>
              )}
            </div>

            {/* その他リンク（モーダル表示に変更） */}
            <div className="flex gap-3 text-xs">
              <button
                onClick={() => setShowCertificatesModal(true)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                資格証明書写真
              </button>
              <button
                onClick={() => setShowEmergencyContactModal(true)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                緊急連絡先
              </button>
              <Link
                href={`/admin/workers/${workerId}/labor-documents`}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                労働条件通知書
              </Link>
            </div>
          </div>

        </div>
      </main>

      {/* 資格証明書モーダル */}
      {showCertificatesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">資格証明書</h2>
                <p className="text-sm text-gray-500">{worker.name}</p>
              </div>
              <button
                onClick={() => setShowCertificatesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            {/* コンテンツ */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* 資格証明書画像 */}
              <div>
                {(() => {
                  const certs = worker.qualificationCertificates;
                  if (!certs || Object.keys(certs).length === 0) {
                    return (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">
                          資格証明書画像は登録されていません
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(certs).map(([qualification, value]) => {
                        // URLを取得（新旧形式に対応）
                        const imageUrl = typeof value === 'string'
                          ? value
                          : (value as { certificate_image?: string })?.certificate_image;

                        return (
                          <div key={qualification} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                {qualification}
                              </h4>
                            </div>
                            <div className="p-4">
                              {imageUrl ? (
                                <div className="space-y-3">
                                  <a
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`${qualification}の証明書`}
                                      className="w-full h-40 object-contain bg-gray-100 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        (target.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                                      }}
                                    />
                                    <div className="hidden text-center py-6 text-gray-400 text-sm">
                                      画像を読み込めませんでした
                                    </div>
                                  </a>
                                  <div className="flex gap-2">
                                    <a
                                      href={imageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      開く
                                    </a>
                                    <a
                                      href={imageUrl}
                                      download
                                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      <Download className="w-3 h-3" />
                                      ダウンロード
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                  証明書画像が登録されていません
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 緊急連絡先モーダル */}
      {showEmergencyContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full overflow-hidden">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">緊急連絡先</h2>
                <p className="text-sm text-gray-500">{worker.name}</p>
              </div>
              <button
                onClick={() => setShowEmergencyContactModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            {/* コンテンツ */}
            <div className="p-6">
              {worker.emergencyName || worker.emergencyPhone || worker.emergencyRelation || worker.emergencyAddress ? (
                <div className="space-y-4">
                  {/* 氏名 */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">氏名</div>
                      <div className="text-sm font-medium text-gray-900">
                        {worker.emergencyName || <span className="text-gray-400">未登録</span>}
                      </div>
                    </div>
                  </div>
                  {/* 続柄 */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">続柄</div>
                      <div className="text-sm font-medium text-gray-900">
                        {worker.emergencyRelation || <span className="text-gray-400">未登録</span>}
                      </div>
                    </div>
                  </div>
                  {/* 電話番号 */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">電話番号</div>
                      {worker.emergencyPhone ? (
                        <a
                          href={`tel:${worker.emergencyPhone}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {worker.emergencyPhone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">未登録</span>
                      )}
                    </div>
                  </div>
                  {/* 住所 */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <MapPinIcon className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">住所</div>
                      <div className="text-sm font-medium text-gray-900">
                        {worker.emergencyAddress || <span className="text-gray-400">未登録</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    緊急連絡先が登録されていません
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
