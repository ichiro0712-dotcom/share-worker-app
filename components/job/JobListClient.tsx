'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, ChevronDown, Search, X } from 'lucide-react';
import useSWR from 'swr';
import { JobCard } from '@/components/job/JobCard';
import { DateSlider } from '@/components/job/DateSlider';
import { FilterModal } from '@/components/job/FilterModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { JobListSkeleton } from '@/components/job/JobCardSkeleton';
import { useJobsSearch, prefetchJobsForDate } from '@/hooks/useJobsSearch';

type ListType = 'all' | 'limited' | 'offer';
type SortOrder = 'distance' | 'wage' | 'deadline';

// 求人リストタイプのラベル
const LIST_TYPE_LABELS: Record<ListType, string> = {
  all: 'すべて',
  limited: '限定求人',
  offer: 'オファー',
};

interface JobListClientProps {
  // 初期データ（サーバーサイドレンダリング用、オプション）
  initialJobs?: any[];
  initialFacilities?: any[];
  initialPagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasMore: boolean;
  };
  // 互換性のため
  jobs?: any[];
  facilities?: any[];
  pagination?: any;
}

// 件数取得用fetcher
const countsFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch counts');
  return res.json();
};

export function JobListClient({
  initialJobs,
  initialFacilities,
  initialPagination,
  jobs,
  facilities: propsFacilities,
  pagination: propsPagination
}: JobListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listType, setListType] = useState<ListType>('all');
  const [showListTypeMenu, setShowListTypeMenu] = useState(false);

  // URLパラメータから初期値を取得
  const dateIndexFromUrl = searchParams.get('dateIndex');
  const urlDateIndex = dateIndexFromUrl ? parseInt(dateIndexFromUrl, 10) : 0;
  const safeUrlDateIndex = isNaN(urlDateIndex) ? 0 : urlDateIndex;

  // ローカルステートで日付インデックスを管理（URL遷移なし）
  const [selectedDateIndex, setSelectedDateIndex] = useState(safeUrlDateIndex);

  // URLパラメータからソート順を取得
  const sortFromUrl = searchParams.get('sort') as SortOrder | null;
  const [sortOrder, setSortOrder] = useState<SortOrder>(sortFromUrl || 'distance');

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [mutedFacilities, setMutedFacilities] = useState<number[]>([]);

  // ユーザーの現在地（距離ソート用）
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  // 距離ソートが選択されている場合、現在地を取得
  useEffect(() => {
    if (sortOrder === 'distance' && !locationRequested && !userLocation) {
      // URLパラメータに位置情報がない場合のみ位置取得を試みる
      const hasLocationInUrl = searchParams.get('distanceLat') && searchParams.get('distanceLng');
      if (!hasLocationInUrl && navigator.geolocation) {
        setLocationRequested(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            console.log('位置情報の取得に失敗しました:', error.message);
            // 位置情報が取得できない場合は東京駅をデフォルトとする
            setUserLocation({ lat: 35.6812, lng: 139.7671 });
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
      }
    }
  }, [sortOrder, locationRequested, userLocation, searchParams]);

  // URLパラメータから検索条件を構築
  // 距離ソート用: URLパラメータに位置情報がなくても、userLocationがあれば使用
  const searchParamsObj = useMemo(() => {
    const urlDistanceLat = searchParams.get('distanceLat');
    const urlDistanceLng = searchParams.get('distanceLng');

    // 距離ソート時: URLに位置情報がなければuserLocationを使用
    let effectiveDistanceLat = urlDistanceLat || undefined;
    let effectiveDistanceLng = urlDistanceLng || undefined;

    if (sortOrder === 'distance' && !urlDistanceLat && !urlDistanceLng && userLocation) {
      effectiveDistanceLat = String(userLocation.lat);
      effectiveDistanceLng = String(userLocation.lng);
    }

    return {
      query: searchParams.get('query') || undefined,
      prefecture: searchParams.get('prefecture') || undefined,
      city: searchParams.get('city') || undefined,
      minWage: searchParams.get('minWage') || undefined,
      serviceTypes: searchParams.getAll('serviceType'),
      transportations: searchParams.getAll('transportation'),
      otherConditions: searchParams.getAll('otherCondition'),
      jobTypes: searchParams.getAll('jobType'),
      workTimeTypes: searchParams.getAll('workTimeType'),
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      dateIndex: selectedDateIndex,
      sort: sortOrder,
      timeRangeFrom: searchParams.get('timeRangeFrom') || undefined,
      timeRangeTo: searchParams.get('timeRangeTo') || undefined,
      distanceKm: searchParams.get('distanceKm') || undefined,
      distanceLat: effectiveDistanceLat,
      distanceLng: effectiveDistanceLng,
      listType: listType,
    };
  }, [searchParams, selectedDateIndex, sortOrder, userLocation, listType]);

  // SWRでデータ取得
  const {
    jobs: swrJobs,
    facilities: swrFacilities,
    pagination: swrPagination,
    isLoading,
    dates,
    prefetchNearbyDates
  } = useJobsSearch(
    searchParamsObj,
    (initialJobs || jobs) && (initialFacilities || propsFacilities) && (initialPagination || propsPagination)
      ? {
        jobs: initialJobs || jobs || [],
        facilities: initialFacilities || propsFacilities || [],
        pagination: initialPagination || propsPagination
      }
      : undefined
  );

  // 日付変更時にプリフェッチ
  useEffect(() => {
    prefetchNearbyDates(selectedDateIndex);
  }, [selectedDateIndex, prefetchNearbyDates]);

  // ミュートされた施設IDを取得
  useEffect(() => {
    const mutedIds = localStorage.getItem('mutedFacilityIds');
    if (mutedIds) {
      setMutedFacilities(JSON.parse(mutedIds));
    } else {
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

    const prefecture = searchParams.get('prefecture');
    if (prefecture) {
      filters.push({ key: `prefecture-${prefecture}`, label: prefecture, paramName: 'prefecture', rawValue: prefecture });
    }

    const city = searchParams.get('city');
    if (city) {
      filters.push({ key: `city-${city}`, label: city, paramName: 'city', rawValue: city });
    }

    const minWage = searchParams.get('minWage');
    if (minWage) {
      filters.push({ key: `minWage-${minWage}`, label: `${minWage}円以上`, paramName: 'minWage', rawValue: minWage });
    }

    const serviceTypes = searchParams.getAll('serviceType');
    serviceTypes.forEach((type) => {
      filters.push({ key: `serviceType-${type}`, label: getShortLabel(type), paramName: 'serviceType', rawValue: type });
    });

    const transportations = searchParams.getAll('transportation');
    transportations.forEach((t) => {
      filters.push({ key: `transportation-${t}`, label: getShortLabel(t), paramName: 'transportation', rawValue: t });
    });

    const otherConditions = searchParams.getAll('otherCondition');
    otherConditions.forEach((c) => {
      filters.push({ key: `otherCondition-${c}`, label: getShortLabel(c), paramName: 'otherCondition', rawValue: c });
    });

    const jobTypes = searchParams.getAll('jobType');
    jobTypes.forEach((type) => {
      filters.push({ key: `jobType-${type}`, label: getShortLabel(type), paramName: 'jobType', rawValue: type });
    });

    const workTimeTypes = searchParams.getAll('workTimeType');
    workTimeTypes.forEach((type) => {
      filters.push({ key: `workTimeType-${type}`, label: getShortLabel(type), paramName: 'workTimeType', rawValue: type });
    });

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

  // 日付変更ハンドラ（URL遷移なし、ローカルステートのみ更新）
  const handleDateChange = useCallback((index: number) => {
    setSelectedDateIndex(index);
  }, []);

  // 日付ホバー時のプリフェッチ
  const handleDateHover = useCallback((index: number) => {
    const baseParams = {
      query: searchParams.get('query') || undefined,
      prefecture: searchParams.get('prefecture') || undefined,
      city: searchParams.get('city') || undefined,
      minWage: searchParams.get('minWage') || undefined,
      serviceTypes: searchParams.getAll('serviceType'),
      transportations: searchParams.getAll('transportation'),
      otherConditions: searchParams.getAll('otherCondition'),
      jobTypes: searchParams.getAll('jobType'),
      workTimeTypes: searchParams.getAll('workTimeType'),
      sort: sortOrder,
      timeRangeFrom: searchParams.get('timeRangeFrom') || undefined,
      timeRangeTo: searchParams.get('timeRangeTo') || undefined,
      distanceKm: searchParams.get('distanceKm') || undefined,
      distanceLat: searchParams.get('distanceLat') || undefined,
      distanceLng: searchParams.get('distanceLng') || undefined,
    };
    prefetchJobsForDate(baseParams, index);
  }, [searchParams, sortOrder]);

  // 個別のフィルターを削除する
  const handleRemoveFilter = (paramName: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (['serviceType', 'transportation', 'otherCondition', 'jobType', 'workTimeType'].includes(paramName)) {
      const values = params.getAll(paramName);
      params.delete(paramName);
      values.filter((v) => v !== value).forEach((v) => params.append(paramName, v));
    } else {
      params.delete(paramName);
    }

    if (paramName === 'prefecture') {
      params.delete('city');
    }

    if (paramName === 'distanceKm') {
      params.delete('distanceLat');
      params.delete('distanceLng');
      params.delete('distanceAddress');
    }

    if (paramName === 'timeRange') {
      params.delete('timeRangeFrom');
      params.delete('timeRangeTo');
    }

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : '/');
  };

  const handleListTypeChange = (type: ListType) => {
    setListType(type);
    setShowListTypeMenu(false);
  };

  const handleFilterClick = () => {
    setShowFilterModal(true);
  };

  const handleApplyFilters = (filters: any) => {
    const params = new URLSearchParams(searchParams.toString());

    params.delete('page');

    if (filters.prefecture) {
      params.set('prefecture', filters.prefecture);
    } else {
      params.delete('prefecture');
    }

    if (filters.city) {
      params.set('city', filters.city);
    } else {
      params.delete('city');
    }

    if (filters.minWage) {
      const wageNumber = filters.minWage.replace('円以上', '');
      params.set('minWage', wageNumber);
    } else {
      params.delete('minWage');
    }

    params.delete('serviceType');
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
      filters.serviceTypes.forEach((type: string) => {
        params.append('serviceType', type);
      });
    }

    params.delete('transportation');
    if (filters.transportations && filters.transportations.length > 0) {
      filters.transportations.forEach((t: string) => {
        params.append('transportation', t);
      });
    }

    params.delete('otherCondition');
    if (filters.otherConditions && filters.otherConditions.length > 0) {
      filters.otherConditions.forEach((c: string) => {
        params.append('otherCondition', c);
      });
    }

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

    params.delete('timeRangeFrom');
    params.delete('timeRangeTo');
    if (filters.timeRangeFrom) {
      params.set('timeRangeFrom', filters.timeRangeFrom);
    }
    if (filters.timeRangeTo) {
      params.set('timeRangeTo', filters.timeRangeTo);
    }

    params.delete('distanceKm');
    params.delete('distanceLat');
    params.delete('distanceLng');
    params.delete('distanceAddress');
    if (filters.distanceEnabled && filters.distanceKm && filters.distanceLat && filters.distanceLng) {
      params.set('distanceKm', String(filters.distanceKm));
      params.set('distanceLat', String(filters.distanceLat));
      params.set('distanceLng', String(filters.distanceLng));
      if (filters.distanceAddress) {
        params.set('distanceAddress', filters.distanceAddress);
      }
    }

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : '/');
    setShowFilterModal(false);
  };

  // ページ変更処理
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    router.push(`/?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ソート順変更処理
  const handleSortChange = (order: SortOrder) => {
    setSortOrder(order);
    setShowSortMenu(false);
  };

  // ミュートフィルター：ミュートされた施設の求人を除外
  const displayedJobs = useMemo(() => {
    if (mutedFacilities.length === 0) return swrJobs;
    return swrJobs.filter((job) => !mutedFacilities.includes(job.facilityId));
  }, [swrJobs, mutedFacilities]);

  // 選択中の日付文字列
  const selectedDateStr = useMemo(() => {
    const date = dates[selectedDateIndex];
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [dates, selectedDateIndex]);

  const currentPage = swrPagination?.currentPage ?? 1;
  const totalPages = swrPagination?.totalPages ?? 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        {/* フィルターエリア */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            {/* 左側: 求人リストタイプ選択 */}
            <div className="relative">
              <button
                onClick={() => setShowListTypeMenu(!showListTypeMenu)}
                className="flex items-center gap-1 text-sm font-medium"
              >
                <span>{LIST_TYPE_LABELS[listType]}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showListTypeMenu && (
                <div className="absolute left-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={() => handleListTypeChange('all')}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${listType === 'all' ? 'text-primary font-medium' : ''}`}
                  >
                    すべて
                  </button>
                  <button
                    onClick={() => handleListTypeChange('limited')}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${listType === 'limited' ? 'text-primary font-medium' : ''}`}
                  >
                    限定求人
                  </button>
                  <button
                    onClick={() => handleListTypeChange('offer')}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${listType === 'offer' ? 'text-primary font-medium' : ''}`}
                  >
                    オファー
                  </button>
                </div>
              )}
            </div>

            {/* 右側: 絞り込み・ソート */}
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
                  <span>
                    {sortOrder === 'distance' ? '近い順' : sortOrder === 'wage' ? '時給順' : '締切順'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <button
                      onClick={() => handleSortChange('distance')}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortOrder === 'distance' ? 'text-primary font-medium' : ''}`}
                    >
                      近い順
                    </button>
                    <button
                      onClick={() => handleSortChange('wage')}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortOrder === 'wage' ? 'text-primary font-medium' : ''}`}
                    >
                      時給順
                    </button>
                    <button
                      onClick={() => handleSortChange('deadline')}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${sortOrder === 'deadline' ? 'text-primary font-medium' : ''}`}
                    >
                      締切順
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* アクティブなフィルタータグ */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => handleRemoveFilter(filter.paramName, filter.rawValue)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full hover:bg-primary/20 transition-colors"
                >
                  <span>{filter.label}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 日付スライダー */}
        <DateSlider
          dates={dates}
          selectedIndex={selectedDateIndex}
          onSelect={handleDateChange}
          onHover={handleDateHover}
        />
      </div>

      {/* コンテンツエリア */}
      <div className="p-4">
        {isLoading ? (
          // ローディング中はスケルトン表示
          <JobListSkeleton count={6} />
        ) : displayedJobs.length === 0 ? (
          // 求人がない場合
          <EmptyState
            icon={Search}
            title="条件に一致する求人が見つかりませんでした"
            description="検索条件を変更して再度お試しください"
          />
        ) : (
          // 求人リスト
          <>
            <div className="space-y-4">
              {displayedJobs.map((job) => {
                const facility = swrFacilities.find((f: any) => f.id === job.facilityId);
                return (
                  <JobCard
                    key={job.id}
                    job={job}
                    facility={facility}
                    selectedDate={selectedDateStr}
                  />
                );
              })}
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>

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
