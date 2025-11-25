'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Star, MapPin, Heart, Ban, Bookmark, ChevronRight, ChevronDown, Check, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { workers, workerApplications as initialApplications } from '@/data/workers';
import { ProfessionType, WorkerApplication } from '@/types/worker';
import { jobs } from '@/data/jobs';

type SortType = 'appliedDate' | 'distance' | 'applicationCount';

type JobWithStats = {
  jobId: number;
  templateName?: string; // テンプレート名
  jobTitle: string;
  facilityName: string;
  jobDates: string[]; // 複数の勤務日
  hourlyWage: number;
  startTime: string;
  endTime: string;
  workContent: string[];
  totalApplications: number;
  unreadCount: number;
  favoriteCount: number;
  blockedCount: number;
  clippedCount: number;
};

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<WorkerApplication[]>(initialApplications);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [professionFilters, setProfessionFilters] = useState<ProfessionType[]>([]);
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [showClippedOnly, setShowClippedOnly] = useState(false);
  const [sortType, setSortType] = useState<SortType>('appliedDate');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // URLパラメータから状態を復元
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId) {
      setSelectedJobId(Number(jobId));
    } else {
      setSelectedJobId(null);
      setSelectedDates([]);
    }
  }, [searchParams]);

  // 応募ワーカーのみを取得
  const appliedApplications = applications.filter(app => app.status === 'applied');

  // 求人ごとの統計を作成（jobIdでグループ化し、複数の勤務日を集約）
  const jobStatsMap = new Map<number, JobWithStats>();

  appliedApplications.forEach(app => {
    const job = jobs.find(j => j.id === app.jobId);
    if (!job) return;

    if (!jobStatsMap.has(app.jobId)) {
      jobStatsMap.set(app.jobId, {
        jobId: app.jobId,
        templateName: job.templateName,
        jobTitle: app.jobTitle,
        facilityName: app.facilityName,
        jobDates: [],
        hourlyWage: job.hourlyWage,
        startTime: job.startTime,
        endTime: job.endTime,
        workContent: job.workContent,
        totalApplications: 0,
        unreadCount: 0,
        favoriteCount: 0,
        blockedCount: 0,
        clippedCount: 0,
      });
    }

    const stats = jobStatsMap.get(app.jobId)!;
    // 勤務日を追加（重複を避ける）
    if (!stats.jobDates.includes(app.jobDate)) {
      stats.jobDates.push(app.jobDate);
    }
  });

  const jobStats = Array.from(jobStatsMap.values());

  // 各求人の統計を計算
  jobStats.forEach(job => {
    const jobApps = appliedApplications.filter(app => app.jobId === job.jobId);
    job.totalApplications = jobApps.length;
    job.unreadCount = jobApps.filter(app => !app.isRead).length;
    job.favoriteCount = jobApps.filter(app => app.isFavorite).length;
    job.blockedCount = jobApps.filter(app => app.isBlocked).length;
    job.clippedCount = jobApps.filter(app => app.isClipped).length;
    // 勤務日を日付順にソート
    job.jobDates.sort();
  });

  // 選択された求人の日付リストを取得
  const selectedJobDates = selectedJobId
    ? Array.from(new Set(appliedApplications
        .filter(app => app.jobId === selectedJobId)
        .map(app => app.jobDate)))
    : [];

  const toggleProfessionFilter = (profession: ProfessionType) => {
    setProfessionFilters(prev => {
      if (prev.includes(profession)) {
        return prev.filter(p => p !== profession);
      } else {
        return [...prev, profession];
      }
    });
  };

  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date);
      } else {
        return [...prev, date];
      }
    });
  };

  const toggleFavorite = (appId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setApplications(prev =>
      prev.map(app =>
        app.id === appId ? { ...app, isFavorite: !app.isFavorite } : app
      )
    );
  };

  const toggleBlocked = (appId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setApplications(prev =>
      prev.map(app =>
        app.id === appId ? { ...app, isBlocked: !app.isBlocked } : app
      )
    );
  };

  const toggleClipped = (appId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setApplications(prev =>
      prev.map(app =>
        app.id === appId ? { ...app, isClipped: !app.isClipped } : app
      )
    );
  };

  const handleMatch = (appId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // ステータスを「勤務予定」に変更
    setApplications(prev =>
      prev.map(app =>
        app.id === appId ? { ...app, status: 'scheduled' as const } : app
      )
    );

    // 自動メッセージ送信の通知（実際のメッセージ機能は別途実装）
    toast.success('マッチングが成立しました。自動メッセージを送信しました。');

    // ワーカー管理ページに遷移
    router.push('/admin/workers');
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProfessionLabel = (profession: ProfessionType | 'all') => {
    switch (profession) {
      case 'nursing':
        return '看護';
      case 'care':
        return '介護';
      case 'pharmacy':
        return '薬剤師';
      case 'all':
        return '全て';
    }
  };

  // ワーカーの応募日一覧を取得し、連続日を範囲表示する関数
  const getWorkerApplicationDates = (workerId: number, jobId: number) => {
    // このワーカーのこの求人への全ての応募を取得
    const workerApps = appliedApplications
      .filter(app => app.workerId === workerId && app.jobId === jobId)
      .map(app => app.jobDate)
      .sort();

    if (workerApps.length === 0) return [];

    // 日付を Date オブジェクトに変換
    const dates = workerApps.map(d => new Date(d));

    // 連続した日付をグループ化
    const groups: { start: Date; end: Date; dates: Date[] }[] = [];
    let currentGroup: Date[] = [dates[0]];

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currentDate = dates[i];
      const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // 連続している
        currentGroup.push(currentDate);
      } else {
        // 連続していない
        groups.push({
          start: currentGroup[0],
          end: currentGroup[currentGroup.length - 1],
          dates: currentGroup,
        });
        currentGroup = [currentDate];
      }
    }

    // 最後のグループを追加
    groups.push({
      start: currentGroup[0],
      end: currentGroup[currentGroup.length - 1],
      dates: currentGroup,
    });

    return groups;
  };

  // 日付を MM/DD 形式にフォーマット
  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // ワーカーの応募回数を取得
  const getWorkerApplicationCount = (workerId: number, jobId: number) => {
    return appliedApplications.filter(app => app.workerId === workerId && app.jobId === jobId).length;
  };

  const getSortLabel = (sort: SortType) => {
    switch (sort) {
      case 'appliedDate':
        return '応募日順';
      case 'distance':
        return '住所が近い順';
      case 'applicationCount':
        return '応募日が多い順';
    }
  };

  // ワーカーカード表示用のフィルタリング
  let filteredApplications = appliedApplications;

  if (selectedJobId !== null) {
    filteredApplications = filteredApplications.filter(app => app.jobId === selectedJobId);

    if (selectedDates.length > 0) {
      filteredApplications = filteredApplications.filter(app =>
        selectedDates.includes(app.jobDate)
      );
    }
  }

  filteredApplications = filteredApplications.filter((app) => {
    const worker = workers.find((w) => w.id === app.workerId);
    if (!worker) return false;
    if (professionFilters.length > 0 && !professionFilters.includes(worker.profession)) {
      return false;
    }
    if (showFavoriteOnly && !app.isFavorite) return false;
    if (showBlockedOnly && !app.isBlocked) return false;
    if (showClippedOnly && !app.isClipped) return false;
    return true;
  });

  // ソート処理
  filteredApplications = [...filteredApplications].sort((a, b) => {
    const workerA = workers.find((w) => w.id === a.workerId);
    const workerB = workers.find((w) => w.id === b.workerId);

    switch (sortType) {
      case 'appliedDate':
        // 応募日時が新しい順
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      case 'distance':
        // 住所（近い順 = 都道府県・市区町村の五十音順）
        const addressA = `${workerA?.prefecture}${workerA?.city}`;
        const addressB = `${workerB?.prefecture}${workerB?.city}`;
        return addressA.localeCompare(addressB, 'ja');
      case 'applicationCount':
        // 応募日が多い順
        if (selectedJobId) {
          const countA = getWorkerApplicationCount(a.workerId, selectedJobId);
          const countB = getWorkerApplicationCount(b.workerId, selectedJobId);
          return countB - countA;
        }
        return 0;
      default:
        return 0;
    }
  });

  // 求人リスト表示の場合
  if (selectedJobId === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold">応募管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              求人一覧 ({jobStats.length}件)
            </p>
          </div>
        </div>

        <div className="p-4">
          <div className="space-y-2">
            {jobStats.map((job) => (
              <button
                key={job.jobId}
                onClick={() => router.push(`/admin/applications?jobId=${job.jobId}`)}
                className="w-full bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow text-left"
              >
                {/* 上部: タイトルと応募統計 */}
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="flex-1">
                    {job.templateName && (
                      <div className="text-xs text-gray-600 mb-0.5">
                        テンプレート：{job.templateName}
                      </div>
                    )}
                    <h3 className="font-bold text-base text-gray-900">
                      求人：{job.jobTitle}
                    </h3>
                  </div>

                  {/* 右上: 応募数とアクション統計 */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-primary">{job.totalApplications}</span>
                      <span className="text-xs text-gray-600">件</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
                    </div>
                    {job.unreadCount > 0 && (
                      <span className="text-xs text-orange-600 font-medium">
                        未読{job.unreadCount}件
                      </span>
                    )}
                    {(job.favoriteCount > 0 || job.clippedCount > 0 || job.blockedCount > 0) && (
                      <div className="flex items-center gap-2 text-xs">
                        {job.favoriteCount > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                            <span className="font-medium text-gray-900">{job.favoriteCount}</span>
                          </div>
                        )}
                        {job.clippedCount > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Bookmark className="w-3 h-3 fill-blue-500 text-blue-500" />
                            <span className="font-medium text-gray-900">{job.clippedCount}</span>
                          </div>
                        )}
                        {job.blockedCount > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Ban className="w-3 h-3 text-gray-500" />
                            <span className="font-medium text-gray-900">{job.blockedCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 時給・勤務時間・勤務日を1行に */}
                <div className="flex items-center gap-4 mb-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">時給</span>
                    <span className="font-bold text-primary text-sm">¥{job.hourlyWage.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">勤務</span>
                    <span className="font-medium text-gray-900">{job.startTime}〜{job.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-gray-500">日程</span>
                    {job.jobDates.slice(0, 3).map((date, index) => (
                      <span key={index} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                        {new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                      </span>
                    ))}
                    {job.jobDates.length > 3 && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                        +{job.jobDates.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* 業務内容 */}
                <div className="flex items-start gap-1">
                  <span className="text-xs text-gray-500 flex-shrink-0">業務</span>
                  <div className="flex flex-wrap gap-1">
                    {job.workContent.slice(0, 6).map((content, index) => (
                      <span key={index} className="px-1.5 py-0.5 bg-gray-50 text-gray-700 text-xs rounded border border-gray-200">
                        {content}
                      </span>
                    ))}
                    {job.workContent.length > 6 && (
                      <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-xs rounded border border-gray-200">
                        +{job.workContent.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {jobStats.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="現在の応募者は0名です"
              description="求人を公開して、応募者を待ちましょう"
              actionLabel="求人管理へ"
              actionLink="/admin/jobs"
            />
          </div>
        )}
      </div>
    );
  }

  // ワーカー一覧表示の場合
  const selectedJob = jobStats.find(j => j.jobId === selectedJobId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">{selectedJob?.jobTitle}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {selectedJob?.facilityName} | 応募ワーカー ({filteredApplications.length}件)
          </p>
        </div>
      </div>

      {/* 日付選択カード */}
      {selectedJobDates.length > 1 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-bold mb-2">勤務日を選択</h3>
          <div className="flex gap-2 flex-wrap">
            {selectedJobDates.map((date) => (
              <button
                key={date}
                onClick={() => toggleDateSelection(date)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectedDates.includes(date)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {date}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* フィルターと並べ替え */}
      <div className="bg-white border-b border-gray-200 px-4 pb-3 pt-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* 職種フィルター */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setProfessionFilters([])}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.length === 0
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              全て
            </button>
            <button
              onClick={() => toggleProfessionFilter('nursing')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.includes('nursing')
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              看護
            </button>
            <button
              onClick={() => toggleProfessionFilter('care')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.includes('care')
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              介護
            </button>
            <button
              onClick={() => toggleProfessionFilter('pharmacy')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                professionFilters.includes('pharmacy')
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              薬剤師
            </button>
          </div>

          {/* 並べ替え */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <span>{getSortLabel(sortType)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showSortMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[180px]">
                <button
                  onClick={() => {
                    setSortType('appliedDate');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'appliedDate' ? 'text-primary font-medium' : ''
                  }`}
                >
                  応募日順
                </button>
                <button
                  onClick={() => {
                    setSortType('distance');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'distance' ? 'text-primary font-medium' : ''
                  }`}
                >
                  住所が近い順
                </button>
                <button
                  onClick={() => {
                    setSortType('applicationCount');
                    setShowSortMenu(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    sortType === 'applicationCount' ? 'text-primary font-medium' : ''
                  }`}
                >
                  応募日が多い順
                </button>
              </div>
            )}
          </div>
        </div>

        {/* アクションフィルター */}
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showFavoriteOnly}
              onChange={(e) => setShowFavoriteOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <Heart className="w-4 h-4 text-red-500" />
            <span>お気に入りのみ</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showBlockedOnly}
              onChange={(e) => setShowBlockedOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <Ban className="w-4 h-4 text-gray-500" />
            <span>ブロックのみ</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showClippedOnly}
              onChange={(e) => setShowClippedOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <Bookmark className="w-4 h-4 text-blue-500" />
            <span>後で見るのみ</span>
          </label>
        </div>

        <div className="text-sm text-gray-600">
          {filteredApplications.length}件
        </div>
      </div>

      {/* ワーカーカードグリッド */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredApplications.map((application) => {
            const worker = workers.find((w) => w.id === application.workerId);
            if (!worker) return null;

            return (
              <div
                key={application.id}
                className="relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* 住所（左上） */}
                <div className="absolute top-2 left-2 flex items-start gap-1 text-xs text-gray-600 z-10">
                  <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <div className="truncate max-w-[80px]">{worker.prefecture}</div>
                    <div className="truncate max-w-[80px]">{worker.city}</div>
                  </div>
                </div>

                {/* アクションアイコン（右上） */}
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button
                    onClick={(e) => toggleFavorite(application.id, e)}
                    className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform ${
                      application.isFavorite ? '' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        application.isFavorite
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e) => toggleBlocked(application.id, e)}
                    className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform ${
                      application.isBlocked ? '' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Ban
                      className={`w-4 h-4 ${
                        application.isBlocked ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e) => toggleClipped(application.id, e)}
                    className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform ${
                      application.isClipped ? '' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    <Bookmark
                      className={`w-4 h-4 ${
                        application.isClipped
                          ? 'fill-blue-500 text-blue-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                </div>

                <Link href={`/admin/workers/${worker.id}`} className="block">
                  {/* 顔写真 */}
                  <div className="p-3 pt-4 flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden">
                      {worker.photoUrl ? (
                        <img
                          src={worker.photoUrl}
                          alt={worker.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-2xl">{worker.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ワーカー基本情報 */}
                  <div className="px-3 pb-3">
                    <h3 className="font-bold text-center mb-1 truncate">
                      {worker.name}
                    </h3>

                    {/* 職種 */}
                    <div className="text-center mb-2">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        {getProfessionLabel(worker.profession)}
                      </span>
                    </div>

                    {/* 評価 */}
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-sm">
                        {worker.overallRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({worker.totalReviews})
                      </span>
                    </div>

                    {/* 資格 */}
                    <div className="flex flex-wrap gap-1 justify-center mb-2">
                      {worker.qualifications.map((qual, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-primary-light text-primary text-xs rounded"
                        >
                          {qual}
                        </span>
                      ))}
                    </div>

                    {/* 統計情報 */}
                    <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                      <div className="bg-gray-50 rounded p-1.5 text-center">
                        <div className="text-gray-500">勤務回数</div>
                        <div className="font-bold text-primary">
                          {worker.totalWorkDays}回
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded p-1.5 text-center">
                        <div className="text-gray-500">直前キャンセル</div>
                        <div className="font-bold text-orange-500">
                          {worker.lastMinuteCancelRate}%
                        </div>
                      </div>
                    </div>

                    {/* 応募日時と応募日一覧 */}
                    <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                      <div className="text-gray-500 truncate">
                        応募: {formatDateTime(application.appliedAt)}
                      </div>
                      {selectedJobId && (
                        <div className="flex flex-wrap gap-1">
                          {getWorkerApplicationDates(worker.id, selectedJobId).map((group, index) => {
                            const isConsecutive = group.dates.length > 1;
                            return (
                              <span
                                key={index}
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  isConsecutive
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {isConsecutive
                                  ? `${formatDate(group.start)}〜${formatDate(group.end)}`
                                  : formatDate(group.start)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>

                {/* マッチボタン */}
                <div className="px-3 pb-3">
                  <button
                    onClick={(e) => handleMatch(application.id, e)}
                    className="w-full py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    マッチング
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {filteredApplications.length === 0 && (
        <div className="p-4">
          <EmptyState
            icon={Users}
            title={professionFilters.length > 0 || showFavoriteOnly || showBlockedOnly || showClippedOnly
              ? '該当するワーカーが見つかりませんでした'
              : '応募ワーカーがいません'}
            description={professionFilters.length > 0 || showFavoriteOnly || showBlockedOnly || showClippedOnly
              ? 'フィルター条件を変更してお試しください'
              : 'この求人への応募を待っています'}
          />
        </div>
      )}
    </div>
  );
}
