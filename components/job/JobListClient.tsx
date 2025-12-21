'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, ChevronDown, Search, X } from 'lucide-react';
import { JobCard } from '@/components/job/JobCard';
import { DateSlider } from '@/components/job/DateSlider';
import { FilterModal } from '@/components/job/FilterModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { generateDates } from '@/utils/date';

type TabType = 'all' | 'limited' | 'nominated';
type SortOrder = 'distance' | 'wage' | 'deadline';

interface JobListClientProps {
  jobs: any[];
  facilities: any[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasMore: boolean;
  };
}

export function JobListClient({ jobs, facilities, pagination }: JobListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // URLパラメータから日付インデックスを取得
  const dateIndexFromUrl = searchParams.get('dateIndex');
  const urlDateIndex = dateIndexFromUrl ? parseInt(dateIndexFromUrl, 10) : 0;
  const safeUrlDateIndex = isNaN(urlDateIndex) ? 0 : urlDateIndex;

  const [selectedDateIndex, setSelectedDateIndex] = useState(safeUrlDateIndex);

  // URLパラメータからソート順を取得
  const sortFromUrl = searchParams.get('sort') as SortOrder | null;
  const [sortOrder, setSortOrder] = useState<SortOrder>(sortFromUrl || 'distance');

  // URLパラメータの変更を監視して同期
  useEffect(() => {
    setSelectedDateIndex(safeUrlDateIndex);
    if (sortFromUrl) {
      setSortOrder(sortFromUrl);
    }
  }, [safeUrlDateIndex, sortFromUrl]);

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  // クライアントサイドページネーション用のstate（互換性のため残すが、paginationがある場合はそちらを優先）
  const [clientCurrentPage, setClientCurrentPage] = useState(1);
  const [appliedFilters, setAppliedFilters] = useState<any>(null);
  const [mutedFacilities, setMutedFacilities] = useState<number[]>([]);

  const itemsPerPage = 20;

  const currentPage = pagination ? pagination.currentPage : clientCurrentPage;
  const totalPages = pagination ? pagination.totalPages : Math.ceil(jobs.length / itemsPerPage);

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

  // 表示用ラベルの短縮マッピング
  const shortLabelMapping: Record<string, string> = {
    '登録した資格で応募できる仕事のみ': '登録した資格',
    '看護の仕事のみ': '看護',
    '説明会を除く': '説明会除外',
    '公共交通機関（電車・バス・徒歩）': '公共交通機関',
    '敷地内駐車場あり': '駐車場',
    '1日4時間以下': '4h以下',
    '日勤': '日勤',
    '夜勤': '夜勤',
  };

  const getShortLabel = (value: string) => shortLabelMapping[value] || value;

  // FilterModal用の初期値を生成
  const initialFiltersForModal = useMemo(() => {
    // URLパラメータからFilterStateを構築
    const jobTypeMapping: Record<string, string> = {
      '登録した資格で応募できる仕事のみ': 'qualified',
      '看護の仕事のみ': 'nursing',
      '説明会を除く': 'excludeOrientation',
    };
    const workTimeMapping: Record<string, string> = {
      '日勤': 'day',
      '夜勤': 'night',
      '1日4時間以下': 'short',
    };

    const jobTypes = searchParams.getAll('jobType').map(t => jobTypeMapping[t]).filter(Boolean);
    const workTimeTypes = searchParams.getAll('workTimeType').map(t => workTimeMapping[t]).filter(Boolean);
    const minWageParam = searchParams.get('minWage');
    const distanceKm = searchParams.get('distanceKm');
    const distanceLat = searchParams.get('distanceLat');
    const distanceLng = searchParams.get('distanceLng');
    const distanceAddress = searchParams.get('distanceAddress');

    return {
      prefecture: searchParams.get('prefecture') || '',
      city: searchParams.get('city') || '',
      jobTypes,
      workTimeTypes,
      timeRangeFrom: searchParams.get('timeRangeFrom') || '',
      timeRangeTo: searchParams.get('timeRangeTo') || '',
      minWage: minWageParam ? `${minWageParam}円以上` : '',
      serviceTypes: searchParams.getAll('serviceType'),
      transportations: searchParams.getAll('transportation'),
      otherConditions: searchParams.getAll('otherCondition'),
      distanceEnabled: !!(distanceKm && distanceLat && distanceLng),
      distanceAddress: distanceAddress || '',
      distanceKm: distanceKm ? parseFloat(distanceKm) : 10,
      distanceLat: distanceLat ? parseFloat(distanceLat) : null,
      distanceLng: distanceLng ? parseFloat(distanceLng) : null,
    };
  }, [searchParams]);

  // URLパラメータから現在の絞り込み条件を取得
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; paramName: string; rawValue: string }[] = [];

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

    // 時間帯フィルター
    const timeRangeFrom = searchParams.get('timeRangeFrom');
    const timeRangeTo = searchParams.get('timeRangeTo');
    if (timeRangeFrom || timeRangeTo) {
      const label = timeRangeFrom && timeRangeTo
        ? `${timeRangeFrom}〜${timeRangeTo}`
        : timeRangeFrom
        ? `${timeRangeFrom}〜`
        : `〜${timeRangeTo}`;
      filters.push({
        key: `timeRange-${timeRangeFrom}-${timeRangeTo}`,
        label,
        paramName: 'timeRange',
        rawValue: `${timeRangeFrom || ''}-${timeRangeTo || ''}`
      });
    }

    // 距離検索
    const distanceKm = searchParams.get('distanceKm');
    const distanceLat = searchParams.get('distanceLat');
    const distanceLng = searchParams.get('distanceLng');
    if (distanceKm && distanceLat && distanceLng) {
      filters.push({
        key: `distance-${distanceKm}km`,
        label: `${distanceKm}km以内`,
        paramName: 'distanceKm',
        rawValue: distanceKm
      });
    }

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

    // 距離検索を削除する場合、関連パラメータもすべて削除
    if (paramName === 'distanceKm') {
      params.delete('distanceLat');
      params.delete('distanceLng');
      params.delete('distanceAddress');
    }

    // 時間帯フィルターを削除する場合、両方のパラメータを削除
    if (paramName === 'timeRange') {
      params.delete('timeRangeFrom');
      params.delete('timeRangeTo');
    }

    // dateIndex, page, sortは維持される
    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : '/');
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

    // URLパラメータにフィルターを反映
    const params = new URLSearchParams(searchParams.toString());

    // ページを1に戻す（新しいフィルタ条件では件数が変わるため）
    params.delete('page');

    // 都道府県
    if (filters.prefecture) {
      params.set('prefecture', filters.prefecture);
    } else {
      params.delete('prefecture');
    }

    // 市区町村（都道府県を変更したら必ずリセット）
    if (filters.city) {
      params.set('city', filters.city);
    } else {
      params.delete('city');
    }

    // 時給
    if (filters.minWage) {
      const wageNumber = filters.minWage.replace('円以上', '');
      params.set('minWage', wageNumber);
    } else {
      params.delete('minWage');
    }

    // サービス種別
    params.delete('serviceType');
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
      filters.serviceTypes.forEach((type: string) => {
        params.append('serviceType', type);
      });
    }

    // 移動手段
    params.delete('transportation');
    if (filters.transportations && filters.transportations.length > 0) {
      filters.transportations.forEach((t: string) => {
        params.append('transportation', t);
      });
    }

    // その他条件
    params.delete('otherCondition');
    if (filters.otherConditions && filters.otherConditions.length > 0) {
      filters.otherConditions.forEach((c: string) => {
        params.append('otherCondition', c);
      });
    }

    // jobTypes (タイプフィルター)
    params.delete('jobType');
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

    // workTimeTypes (勤務時間フィルター)
    params.delete('workTimeType');
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

    // 時間帯フィルター
    params.delete('timeRangeFrom');
    params.delete('timeRangeTo');
    if (filters.timeRangeFrom) {
      params.set('timeRangeFrom', filters.timeRangeFrom);
    }
    if (filters.timeRangeTo) {
      params.set('timeRangeTo', filters.timeRangeTo);
    }

    // 距離検索パラメータ
    params.delete('distanceKm');
    params.delete('distanceLat');
    params.delete('distanceLng');
    params.delete('distanceAddress');
    if (filters.distanceEnabled && filters.distanceLat && filters.distanceLng) {
      params.set('distanceKm', String(filters.distanceKm));
      params.set('distanceLat', String(filters.distanceLat));
      params.set('distanceLng', String(filters.distanceLng));
      if (filters.distanceAddress) {
        params.set('distanceAddress', filters.distanceAddress);
      }
    }

    // ページをリロード（Server Componentで再フェッチ）
    router.push(`/?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setAppliedFilters(null);
    // 確実にURLパラメータをクリアして再読み込み
    window.location.href = '/';
  };

  // 日付選択時にURLパラメータを更新（ページは1に戻る）
  const handleDateSelect = (index: number) => {
    setSelectedDateIndex(index);
    if (!pagination) setClientCurrentPage(1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // ページをリセット

    if (index === 0) {
      params.delete('dateIndex');
    } else {
      params.set('dateIndex', String(index));
    }
    const queryString = params.toString();
    router.replace(queryString ? `/?${queryString}` : '/', { scroll: false });
  };

  // ページ変更処理
  const handlePageChange = (page: number) => {
    if (pagination) {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      router.push(`/?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setClientCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ソート順変更処理
  const handleSortChange = (order: SortOrder) => {
    setSortOrder(order);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', order);
    router.push(`/?${params.toString()}`);
    setShowSortMenu(false);
  };

  // ミュートフィルター：ミュートされた施設の求人を除外
  const filteredByMute = useMemo(() => {
    if (mutedFacilities.length === 0) return jobs;
    return jobs.filter((job) => !mutedFacilities.includes(job.facilityId));
  }, [jobs, mutedFacilities]);

  // サーバーサイドページネーション使用時は、Dateフィルタリングはサーバー側で行われている前提
  // ただし、DateSliderの表示用日付文字列は必要
  const dates = useMemo(() => generateDates(90), []);
  const selectedDateStr = useMemo(() => {
    const date = dates[selectedDateIndex];
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [dates, selectedDateIndex]);

  // 表示するジョブ（クライアントサイドページネーションの場合のみスライス）
  const displayedJobs = useMemo(() => {
    // サーバーサイドページネーションの場合、jobsは既にそのページのデータ
    if (pagination) {
      return filteredByMute;
    }

    // クライアントサイド互換（旧動作）
    // 日付フィルタリング
    let filtered = filteredByMute;
    if (selectedDateIndex !== -1) { // 常に日付選択されている前提ならこのチェックは簡易化可
      const selectedDate = dates[selectedDateIndex];
      if (selectedDate) {
        const targetDate = new Date(selectedDate);
        targetDate.setHours(0, 0, 0, 0);
        const targetDateStr = targetDate.toDateString();

        filtered = filteredByMute.filter((job) => {
          if (job.workDates && job.workDates.length > 0) {
            return job.workDates.some((wd: any) => {
              const workDate = new Date(wd.workDate);
              workDate.setHours(0, 0, 0, 0);
              return workDate.toDateString() === targetDateStr;
            });
          }
          const jobDate = new Date(job.workDate);
          jobDate.setHours(0, 0, 0, 0);
          return jobDate.toDateString() === targetDateStr;
        });
      }
    }

    // ソート（クライアントサイド）
    // ...（省略：サーバーサイドに移行したため、ここでのソートは本来不要だが互換性のため残すなら実装が必要。
    // 今回はpaginationがある前提で進めるため、このブロックはシンプルにする）

    return filtered.slice((clientCurrentPage - 1) * itemsPerPage, clientCurrentPage * itemsPerPage);
  }, [filteredByMute, pagination, selectedDateIndex, dates, clientCurrentPage]);


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        {/* タブ */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabClick('all')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${activeTab === 'all' ? 'text-primary' : 'text-gray-500'
              }`}
          >
            全体
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('limited')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${activeTab === 'limited' ? 'text-primary' : 'text-gray-500'
              }`}
          >
            限定
            {activeTab === 'limited' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('nominated')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${activeTab === 'nominated' ? 'text-primary' : 'text-gray-500'
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
                className={`flex items-center gap-1 text-sm ${activeFilters.length > 0 ? 'text-primary font-medium' : ''}`}
              >
                <Filter className="w-4 h-4" />
                <span>絞り込み</span>
                {activeFilters.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-primary text-white text-xs rounded-full">
                    {activeFilters.length}
                  </span>
                )}
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
                      onClick={() => handleSortChange('distance')}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortOrder === 'distance' ? 'text-primary' : ''
                        }`}
                    >
                      近い順
                    </button>
                    <button
                      onClick={() => handleSortChange('wage')}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortOrder === 'wage' ? 'text-primary' : ''
                        }`}
                    >
                      時給順
                    </button>
                    <button
                      onClick={() => handleSortChange('deadline')}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortOrder === 'deadline' ? 'text-primary' : ''
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
      {displayedJobs.length === 0 ? (
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
            {displayedJobs.map((job, index) => {
              const facility = facilities.find((f) => f.id === job.facilityId);
              if (!facility) return null;

              return (
                <div key={job.id} className="h-full">
                  <JobCard job={job} facility={facility} selectedDate={selectedDateStr} priority={index < 4} />
                </div>
              );
            })}
          </div>

          {/* ページネーション: サーバーサイドの場合はPaginationコンポーネントを使用 */}
          {pagination ? (
            <div className="py-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          ) : (
            <div className="px-4 py-4 flex items-center justify-center gap-4">
              <button
                onClick={() => setClientCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg ${currentPage === 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90'
                  }`}
              >
                ← 前へ
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setClientCurrentPage((prev) =>
                    Math.min(totalPages, prev + 1)
                  )
                }
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg ${currentPage === totalPages
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90'
                  }`}
              >
                次へ →
              </button>
            </div>
          )}
        </>
      )}

      {/* フィルターモーダル */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        initialFilters={initialFiltersForModal}
      />

    </div>
  );
}
