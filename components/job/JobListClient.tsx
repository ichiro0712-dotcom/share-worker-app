'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, ChevronDown, Search, X } from 'lucide-react';
import { JobCard } from '@/components/job/JobCard';
import { DateSlider } from '@/components/job/DateSlider';
import { BottomNav } from '@/components/layout/BottomNav';
import { FilterModal } from '@/components/job/FilterModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { generateDates } from '@/utils/date';

type TabType = 'all' | 'limited' | 'nominated';
type SortOrder = 'distance' | 'wage' | 'deadline';

interface JobListClientProps {
  jobs: any[];
  facilities: any[];
}

export function JobListClient({ jobs, facilities }: JobListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedDateIndex, setSelectedDateIndex] = useState(0); // 0=今日
  const [sortOrder, setSortOrder] = useState<SortOrder>('distance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [appliedFilters, setAppliedFilters] = useState<any>(null);
  const [mutedFacilities, setMutedFacilities] = useState<number[]>([]);

  const itemsPerPage = 20;

  // ミュートされた施設IDを取得
  useEffect(() => {
    // 新形式のIDのみリストを優先的に使用
    const mutedIds = localStorage.getItem('mutedFacilityIds');
    if (mutedIds) {
      setMutedFacilities(JSON.parse(mutedIds));
    } else {
      // 旧形式からIDを抽出
      const muted = JSON.parse(localStorage.getItem('mutedFacilities') || '[]');
      const ids = muted.map((f: any) => typeof f === 'number' ? f : f.facilityId).filter(Boolean);
      setMutedFacilities(ids);
    }
  }, []);

  // URLパラメータから現在の絞り込み条件を取得
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; paramName: string; rawValue: string }[] = [];

    // 表示用ラベルの短縮マッピング
    const shortLabelMapping: Record<string, string> = {
      '登録した資格で応募できる仕事のみ': '登録した資格',
      '看護の仕事のみ': '看護',
      '公共交通機関（電車・バス・徒歩）': '公共交通機関',
      '敷地内駐車場あり': '駐車場',
    };

    const getShortLabel = (value: string) => shortLabelMapping[value] || value;

    // 都道府県
    const prefecture = searchParams.get('prefecture');
    if (prefecture) {
      filters.push({ key: `prefecture-${prefecture}`, label: prefecture, paramName: 'prefecture', rawValue: prefecture });
    }

    // 市区町村
    const city = searchParams.get('city');
    if (city) {
      filters.push({ key: `city-${city}`, label: city, paramName: 'city', rawValue: city });
    }

    // 最低時給
    const minWage = searchParams.get('minWage');
    if (minWage) {
      filters.push({ key: `minWage-${minWage}`, label: `${minWage}円以上`, paramName: 'minWage', rawValue: minWage });
    }

    // サービス種別（複数）
    const serviceTypes = searchParams.getAll('serviceType');
    serviceTypes.forEach((type) => {
      filters.push({ key: `serviceType-${type}`, label: getShortLabel(type), paramName: 'serviceType', rawValue: type });
    });

    // 移動手段（複数）
    const transportations = searchParams.getAll('transportation');
    transportations.forEach((t) => {
      filters.push({ key: `transportation-${t}`, label: getShortLabel(t), paramName: 'transportation', rawValue: t });
    });

    // その他条件（複数）
    const otherConditions = searchParams.getAll('otherCondition');
    otherConditions.forEach((c) => {
      filters.push({ key: `otherCondition-${c}`, label: getShortLabel(c), paramName: 'otherCondition', rawValue: c });
    });

    // タイプ（複数）
    const jobTypes = searchParams.getAll('jobType');
    jobTypes.forEach((type) => {
      filters.push({ key: `jobType-${type}`, label: getShortLabel(type), paramName: 'jobType', rawValue: type });
    });

    // 勤務時間（複数）
    const workTimeTypes = searchParams.getAll('workTimeType');
    workTimeTypes.forEach((type) => {
      filters.push({ key: `workTimeType-${type}`, label: getShortLabel(type), paramName: 'workTimeType', rawValue: type });
    });

    return filters;
  }, [searchParams]);

  // 個別のフィルターを削除する
  const handleRemoveFilter = (paramName: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (['serviceType', 'transportation', 'otherCondition', 'jobType', 'workTimeType'].includes(paramName)) {
      // 複数値を持つパラメータの場合
      const values = params.getAll(paramName);
      params.delete(paramName);
      values.filter((v) => v !== value).forEach((v) => params.append(paramName, v));
    } else {
      // 単一値のパラメータの場合
      params.delete(paramName);
    }

    // 市区町村を削除する場合、都道府県も一緒に削除するか確認
    if (paramName === 'prefecture') {
      params.delete('city');
    }

    router.push(`/?${params.toString()}`);
  };

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'limited' || tab === 'nominated') {
      window.location.href = `/under-construction?page=${tab}`;
    }
  };

  const handleFilterClick = () => {
    setShowFilterModal(true);
  };

  const handleApplyFilters = (filters: any) => {
    setAppliedFilters(filters);
    setCurrentPage(1); // フィルター適用時はページを1に戻す

    // URLパラメータにフィルターを反映
    const params = new URLSearchParams();
    if (filters.prefecture) params.set('prefecture', filters.prefecture);
    if (filters.city) params.set('city', filters.city);
    if (filters.minWage) {
      const wageNumber = filters.minWage.replace('円以上', '');
      params.set('minWage', wageNumber);
    }
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
      // 複数選択対応
      filters.serviceTypes.forEach((type: string) => {
        params.append('serviceType', type);
      });
    }
    if (filters.transportations && filters.transportations.length > 0) {
      filters.transportations.forEach((t: string) => {
        params.append('transportation', t);
      });
    }
    if (filters.otherConditions && filters.otherConditions.length > 0) {
      filters.otherConditions.forEach((c: string) => {
        params.append('otherCondition', c);
      });
    }

    // jobTypes (タイプフィルター): 内部値を表示用ラベルに変換
    if (filters.jobTypes && filters.jobTypes.length > 0) {
      const jobTypeMapping: Record<string, string> = {
        'qualified': '登録した資格で応募できる仕事のみ',
        'nursing': '看護の仕事のみ',
        'excludeOrientation': '説明会を除く',
      };
      filters.jobTypes.forEach((type: string) => {
        const label = jobTypeMapping[type];
        if (label) {
          params.append('jobType', label);
        }
      });
    }

    // workTimeTypes (勤務時間フィルター): 内部値を表示用ラベルに変換
    if (filters.workTimeTypes && filters.workTimeTypes.length > 0) {
      const workTimeMapping: Record<string, string> = {
        'day': '日勤',
        'night': '夜勤',
        'short': '1日4時間以下',
      };
      filters.workTimeTypes.forEach((type: string) => {
        const label = workTimeMapping[type];
        if (label) {
          params.append('workTimeType', label);
        }
      });
    }

    // ページをリロード（Server Componentで再フェッチ）
    router.push(`/?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setAppliedFilters(null);
    setCurrentPage(1);
    // 確実にURLパラメータをクリアして再読み込み
    window.location.href = '/';
  };

  // 日付選択時にページをリセット
  const handleDateSelect = (index: number) => {
    setSelectedDateIndex(index);
    setCurrentPage(1);
  };

  // ミュートフィルター：ミュートされた施設の求人を除外
  const filteredByMute = useMemo(() => {
    if (mutedFacilities.length === 0) return jobs;
    return jobs.filter((job) => !mutedFacilities.includes(job.facilityId));
  }, [jobs, mutedFacilities]);

  // 日付スライダーで選択された日付の求人のみ表示
  const dates = useMemo(() => generateDates(90), []);
  const filteredByDate = useMemo(() => {
    const selectedDate = dates[selectedDateIndex];
    if (!selectedDate) return filteredByMute;

    // 選択された日付の日付文字列を取得（元のオブジェクトを変更しないため新しいDateを作成）
    const targetDate = new Date(selectedDate);
    targetDate.setHours(0, 0, 0, 0);
    const targetDateStr = targetDate.toDateString();

    return filteredByMute.filter((job) => {
      // workDates配列がある場合は、いずれかの勤務日が選択日と一致するかチェック
      if (job.workDates && job.workDates.length > 0) {
        return job.workDates.some((wd: any) => {
          const workDate = new Date(wd.workDate);
          workDate.setHours(0, 0, 0, 0);
          return workDate.toDateString() === targetDateStr;
        });
      }
      // フォールバック：workDateを使用（旧データとの互換性）
      const jobDate = new Date(job.workDate);
      jobDate.setHours(0, 0, 0, 0);
      return jobDate.toDateString() === targetDateStr;
    });
  }, [filteredByMute, selectedDateIndex, dates]);

  // ソート処理
  const sortedJobs = [...filteredByDate].sort((a, b) => {
    if (sortOrder === 'wage') {
      // 時給順（高い順）
      return b.hourlyWage - a.hourlyWage;
    } else if (sortOrder === 'deadline') {
      // 締切順（締切が近い順）
      const deadlineA = new Date(a.deadline).getTime();
      const deadlineB = new Date(b.deadline).getTime();
      return deadlineA - deadlineB;
    }
    // distance（近い順）はデフォルトの順序を維持
    return 0;
  });

  // 選択された日付をYYYY-MM-DD形式で取得（JobCardに渡すため）
  const selectedDateStr = useMemo(() => {
    const date = dates[selectedDateIndex];
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [dates, selectedDateIndex]);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        {/* タブ */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabClick('all')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${
              activeTab === 'all' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            全体
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('limited')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${
              activeTab === 'limited' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            限定
            {activeTab === 'limited' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('nominated')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${
              activeTab === 'nominated' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            指名
            {activeTab === 'nominated' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* フィルターエリア */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-4">
              <button
                onClick={handleFilterClick}
                className="flex items-center gap-1 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>絞り込み</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-1 text-sm"
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {sortOrder === 'distance' ? '近い順' : sortOrder === 'wage' ? '時給順' : '締切順'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showSortMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        setSortOrder('distance');
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortOrder === 'distance' ? 'text-primary' : ''
                      }`}
                    >
                      近い順
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('wage');
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortOrder === 'wage' ? 'text-primary' : ''
                      }`}
                    >
                      時給順
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('deadline');
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortOrder === 'deadline' ? 'text-primary' : ''
                      }`}
                    >
                      締切順
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 日付スライダー */}
          <DateSlider
            selectedDateIndex={selectedDateIndex}
            onDateSelect={handleDateSelect}
          />

          {/* 絞り込み条件タグ */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {activeFilters.map((filter) => (
                <span
                  key={filter.key}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                >
                  {filter.label}
                  <button
                    onClick={() => handleRemoveFilter(filter.paramName, filter.rawValue)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={handleClearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                すべてクリア
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 求人リスト */}
      {sortedJobs.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState
            icon={Search}
            title="条件に一致する求人が見つかりませんでした"
            description="検索条件を変更してお試しください"
            actionLabel="条件をクリア"
            onAction={handleClearFilters}
          />
        </div>
      ) : (
        <>
          <div className="px-4 py-4 grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4 items-stretch">
            {sortedJobs
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((job) => {
                const facility = facilities.find((f) => f.id === job.facilityId);
                if (!facility) return null;

                return (
                  <div key={job.id} className="h-full">
                    <JobCard job={job} facility={facility} selectedDate={selectedDateStr} />
                  </div>
                );
              })}
          </div>

          {/* ページネーション */}
          <div className="px-4 py-4 flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded-lg ${
            currentPage === 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          ← 前へ
        </button>
        <span className="text-sm text-gray-600">
          {currentPage} / {Math.ceil(sortedJobs.length / itemsPerPage)}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(Math.ceil(sortedJobs.length / itemsPerPage), prev + 1)
            )
          }
          disabled={currentPage === Math.ceil(sortedJobs.length / itemsPerPage)}
          className={`px-4 py-2 rounded-lg ${
            currentPage === Math.ceil(sortedJobs.length / itemsPerPage)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          次へ →
        </button>
          </div>
        </>
      )}

      {/* 下部ナビゲーション */}
      <BottomNav />

      {/* フィルターモーダル */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
      />

    </div>
  );
}
