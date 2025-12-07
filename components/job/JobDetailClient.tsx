'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, Heart, Clock, MapPin, ChevronRight, ChevronLeft as ChevronLeftIcon, Bookmark, VolumeX, Volume2, ExternalLink, Building2 } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/tag';
import { formatDateTime, getDeadlineText, isDeadlineUrgent } from '@/utils/date';
import { applyForJob, addJobBookmark, removeJobBookmark, isJobBookmarked, toggleFacilityFavorite, isFacilityFavorited } from '@/src/lib/actions';
import toast from 'react-hot-toast';

// デフォルトのプレースホルダー画像
const DEFAULT_JOB_IMAGE = '/images/anken.png';

interface JobDetailClientProps {
  job: any;
  facility: any;
  relatedJobs: any[];
  facilityReviews: any[];
  initialHasApplied: boolean;
  initialAppliedWorkDateIds?: number[]; // 追加: 応募済みの勤務日IDリスト
  selectedDate?: string; // YYYY-MM-DD形式の選択された日付
}

export function JobDetailClient({ job, facility, relatedJobs, facilityReviews, initialHasApplied, initialAppliedWorkDateIds = [], selectedDate }: JobDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータからselectedを読み取る（プロフィール編集から戻った場合）
  const selectedFromUrl = searchParams.get('selected');
  const preselectedIds = selectedFromUrl ? selectedFromUrl.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savedForLater, setSavedForLater] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [selectedWorkDateIds, setSelectedWorkDateIds] = useState<number[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  // const [hasApplied, setHasApplied] = useState(initialHasApplied); // 廃止: 個別の応募状態を使用
  const [appliedWorkDateIds, setAppliedWorkDateIds] = useState<number[]>(initialAppliedWorkDateIds);
  const [isFavoriteProcessing, setIsFavoriteProcessing] = useState(false);
  const [isSaveForLaterProcessing, setIsSaveForLaterProcessing] = useState(false);
  const [isJobBookmarkedState, setIsJobBookmarkedState] = useState(false);
  const [isJobBookmarkProcessing, setIsJobBookmarkProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // プロフィール未完了モーダル
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileMissingFields, setProfileMissingFields] = useState<string[]>([]);

  // 画像配列を安全に取得（空配列の場合はプレースホルダーを使用）
  const jobImages = job.images && job.images.length > 0 ? job.images : [DEFAULT_JOB_IMAGE];

  useEffect(() => {
    // ブックマーク状態を取得
    isFacilityFavorited(String(facility.id)).then(setIsFavorite);
    isJobBookmarked(String(job.id), 'WATCH_LATER').then(setSavedForLater);
    isJobBookmarked(String(job.id), 'FAVORITE').then(setIsJobBookmarkedState);

    // ミュート状態を取得
    const mutedFacilities = JSON.parse(localStorage.getItem('mutedFacilities') || '[]');
    const isFacilityMuted = mutedFacilities.some((f: any) => f.facilityId === facility.id);
    setIsMuted(isFacilityMuted);
  }, [job.id, facility.id]);

  // 選択状態の初期化（URLパラメータ、selectedDate、またはデフォルト）
  useEffect(() => {
    // URLパラメータからの選択がある場合（プロフィール編集から戻った場合）
    if (preselectedIds.length > 0) {
      // 応募可能なIDのみをフィルタリング
      const validIds = preselectedIds.filter(id => {
        const wd = job.workDates?.find((w: any) => w.id === id);
        if (!wd) return false;
        const isApplied = initialAppliedWorkDateIds.includes(id);
        const matchedCount = wd.matchedCount || 0;
        const recruitmentCount = wd.recruitmentCount || job.recruitmentCount || 1;
        const isFull = !job.requiresInterview && matchedCount >= recruitmentCount;
        return !isApplied && !isFull;
      });
      if (validIds.length > 0) {
        setSelectedWorkDateIds(validIds);
        return;
      }
    }

    // 旧形式の場合
    if (!job.workDates || job.workDates.length === 0) {
      const matchedCount = job.matchedCount || 0;
      const recruitmentCount = job.recruitmentCount || 1;
      const isFull = matchedCount >= recruitmentCount;
      if (!isFull && selectedDate) {
        setSelectedWorkDateIds([job.id]);
      }
      return;
    }

    // selectedDateが指定されている場合のみ、その日付が応募可能かチェックして選択
    if (selectedDate) {
      const selected = job.workDates.find((wd: any) => wd.workDate === selectedDate);
      if (selected) {
        const isApplied = initialAppliedWorkDateIds.includes(selected.id);
        const matchedCount = selected.matchedCount || 0;
        const recruitmentCount = selected.recruitmentCount || job.recruitmentCount || 1;
        const isFull = !job.requiresInterview && matchedCount >= recruitmentCount;
        if (!isApplied && !isFull) {
          setSelectedWorkDateIds([selected.id]);
          return;
        }
      }
    }
    // デフォルトは空配列（ワーカーが自分で選ぶ）
  }, []);

  // 応募可能な日程があるかチェック
  const hasAvailableDates = useMemo(() => {
    if (!job.workDates || job.workDates.length === 0) {
      // 旧形式
      const matchedCount = job.matchedCount || 0;
      const recruitmentCount = job.recruitmentCount || 1;
      return matchedCount < recruitmentCount;
    }

    return job.workDates.some((wd: any) => {
      const isApplied = appliedWorkDateIds.includes(wd.id);
      const matchedCount = wd.matchedCount || 0;
      const recruitmentCount = wd.recruitmentCount || job.recruitmentCount || 1;
      // 面接ありの場合は満員でも応募可能
      const isFull = !job.requiresInterview && matchedCount >= recruitmentCount;
      return !isApplied && !isFull;
    });
  }, [job.workDates, job.matchedCount, job.recruitmentCount, appliedWorkDateIds]);

  // 選択された日付と他の日付を分離
  const { selectedWorkDates, otherWorkDates } = useMemo(() => {
    if (!job.workDates || job.workDates.length === 0) {
      // フォールバック：workDateを使用（旧データ形式）
      return {
        selectedWorkDates: [{ id: job.id, workDate: job.workDate, appliedCount: job.appliedCount, matchedCount: job.matchedCount, recruitmentCount: job.recruitmentCount }],
        otherWorkDates: [],
      };
    }

    if (!selectedDate) {
      // selectedDateがない場合は最初の日付を選択として扱う
      return {
        selectedWorkDates: job.workDates.slice(0, 1),
        otherWorkDates: job.workDates.slice(1),
      };
    }

    // selectedDateに一致するworkDateを検索
    const selected = job.workDates.filter((wd: any) => wd.workDate === selectedDate);
    const other = job.workDates.filter((wd: any) => wd.workDate !== selectedDate);

    // 一致するものがない場合は最初の日付を選択
    if (selected.length === 0) {
      return {
        selectedWorkDates: job.workDates.slice(0, 1),
        otherWorkDates: job.workDates.slice(1),
      };
    }

    return {
      selectedWorkDates: selected,
      otherWorkDates: other,
    };
  }, [job.workDates, job.workDate, job.id, job.appliedCount, job.recruitmentCount, selectedDate]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev === jobImages.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? jobImages.length - 1 : prev - 1));
  };

  const handleFavorite = async () => {
    if (isFavoriteProcessing) return;

    setIsFavoriteProcessing(true);
    try {
      const result = await toggleFacilityFavorite(String(facility.id));
      if (result.success) {
        setIsFavorite(result.isFavorite ?? false);
        toast.success(result.isFavorite ? 'お気に入り施設に追加しました' : 'お気に入り施設から削除しました');
      }
    } finally {
      setIsFavoriteProcessing(false);
    }
  };

  const handleJobBookmark = async () => {
    if (isJobBookmarkProcessing) return;

    setIsJobBookmarkProcessing(true);
    try {
      if (isJobBookmarkedState) {
        const result = await removeJobBookmark(String(job.id), 'FAVORITE');
        if (result.success) {
          setIsJobBookmarkedState(false);
          toast.success('求人ブックマークから削除しました');
        }
      } else {
        const result = await addJobBookmark(String(job.id), 'FAVORITE');
        if (result.success) {
          setIsJobBookmarkedState(true);
          toast.success('求人ブックマークに追加しました');
        }
      }
    } finally {
      setIsJobBookmarkProcessing(false);
    }
  };

  const handleSaveForLater = async () => {
    if (isSaveForLaterProcessing) return;

    setIsSaveForLaterProcessing(true);
    try {
      if (savedForLater) {
        const result = await removeJobBookmark(String(job.id), 'WATCH_LATER');
        if (result.success) {
          setSavedForLater(false);
        }
      } else {
        const result = await addJobBookmark(String(job.id), 'WATCH_LATER');
        if (result.success) {
          setSavedForLater(true);
        }
      }
    } finally {
      setIsSaveForLaterProcessing(false);
    }
  };

  const handleApply = async () => {
    if (selectedWorkDateIds.length === 0) {
      toast.error('応募する勤務日を選択してください');
      return;
    }

    // 既に応募済みの勤務日が含まれているかチェック
    const alreadyAppliedSelected = selectedWorkDateIds.filter(id => appliedWorkDateIds.includes(id));
    if (alreadyAppliedSelected.length > 0) {
      toast.error('選択された勤務日の中に、既に応募済みのものが含まれています');
      return;
    }

    setIsApplying(true);

    try {
      // 選択された勤務日すべてに応募
      const results = await Promise.all(
        selectedWorkDateIds.map((workDateId) => applyForJob(String(job.id), workDateId))
      );

      // すべて成功したかチェック
      const allSuccess = results.every((result) => result.success);

      if (allSuccess) {
        toast.success('応募しました！');
        // 応募済みIDリストを更新
        setAppliedWorkDateIds(prev => [...prev, ...selectedWorkDateIds]);
        // 選択を解除
        setSelectedWorkDateIds([]);
      } else {
        // 一部または全部失敗
        const failedResult = results.find((result) => !result.success);

        // プロフィール未完了エラーの場合はモーダル表示
        if (failedResult && 'missingFields' in failedResult && failedResult.missingFields) {
          const missingFields = failedResult.missingFields as string[];
          setProfileMissingFields(missingFields);
          setShowProfileModal(true);
        } else {
          const errorMessages = results
            .filter((result) => !result.success)
            .map((result) => result.error)
            .join('\n');
          toast.error(`応募に失敗しました: ${errorMessages}`);
        }
      }
    } catch (error) {
      console.error('Application error:', error);
      toast.error('応募に失敗しました。もう一度お試しください。');
    } finally {
      setIsApplying(false);
    }
  };

  const toggleWorkDateSelection = (workDateId: number) => {
    setSelectedWorkDateIds(prev => {
      if (prev.includes(workDateId)) {
        return prev.filter(id => id !== workDateId);
      } else {
        return [...prev, workDateId];
      }
    });
  };

  const handleMute = () => {
    const mutedFacilities = JSON.parse(localStorage.getItem('mutedFacilities') || '[]');

    if (isMuted) {
      // ミュート解除
      const newMuted = mutedFacilities.filter((f: any) => f.facilityId !== facility.id);
      localStorage.setItem('mutedFacilities', JSON.stringify(newMuted));
      // IDのみのリストも更新（JobListClient用）
      const mutedIds = newMuted.map((f: any) => f.facilityId);
      localStorage.setItem('mutedFacilityIds', JSON.stringify(mutedIds));
      setIsMuted(false);
      toast.success(`${facility.name}のミュートを解除しました`);
    } else {
      // ミュート（施設名も保存）
      const newMutedFacility = {
        facilityId: facility.id,
        facilityName: facility.name,
        mutedAt: new Date().toISOString(),
      };
      mutedFacilities.push(newMutedFacility);
      localStorage.setItem('mutedFacilities', JSON.stringify(mutedFacilities));
      // IDのみのリストも更新（JobListClient用）
      const mutedIds = mutedFacilities.map((f: any) => f.facilityId);
      localStorage.setItem('mutedFacilityIds', JSON.stringify(mutedIds));
      setIsMuted(true);
      toast.success(`${facility.name}をミュートしました。この施設の求人は一覧に表示されなくなります`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center text-sm">
            {formatDateTime(job.workDate, job.startTime, job.endTime)}
          </div>
          <button
            onClick={handleSaveForLater}
            className="flex items-center gap-1 text-xs"
          >
            <Clock className={`w-5 h-5 ${savedForLater ? 'text-primary' : 'text-gray-400'}`} />
            <span className={savedForLater ? 'text-primary' : 'text-gray-600'}>
              {savedForLater ? '保存済み' : 'あとで見る'}
            </span>
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="px-4 py-4">
        {/* 締切バッジ + 募集人数 */}
        <div className="flex justify-end items-center gap-2 mb-3">
          <span className={`inline-block text-xs px-2 py-1 rounded ${isDeadlineUrgent(job.deadline)
            ? 'bg-red-500 text-white'
            : 'bg-gray-300 text-gray-800'
          }`}>
            締切まで{getDeadlineText(job.deadline)}
          </span>
          <Badge variant="red">
            募集人数 {job.appliedCount}/{job.recruitmentCount}人
          </Badge>
        </div>

        {/* 画像カルーセル */}
        <div className="relative mb-4">
          {/* 面接ありバッジ - overflow-hiddenの外に配置 */}
          {job.requiresInterview && (
            <div className="absolute top-3 left-3 z-30">
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                面接あり
              </span>
            </div>
          )}
          <div className="relative aspect-video rounded-card overflow-hidden">
            <Image
              src={jobImages[currentImageIndex]}
              alt="施設画像"
              fill
              className="object-cover"
            />
            {/* 面接ありバッジ - 画像左上 */}
            {jobImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {/* インジケーター */}
          {jobImages.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {jobImages.map((_: any, index: number) => (
                <div
                  key={index}
                  className={`h-1 rounded-full transition-all ${index === currentImageIndex ? 'w-6 bg-gray-800' : 'w-1 bg-gray-300'
                    }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* タグとバッジ */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {job.tags.map((tag: string) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
          {job.badges.map((badge: any, index: number) => (
            <Badge key={index} variant="yellow">
              {badge.text}
            </Badge>
          ))}
        </div>

        {/* 施設情報 */}
        <div className="mb-4">
          <h2 className="text-lg font-bold mb-1">{job.title}</h2>
          <p className="text-sm text-gray-500">{facility.name}</p>
          <p className="text-sm text-gray-500 mb-2">{facility.type}</p>
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
            <MapPin className="w-4 h-4" />
            <span>{job.address}</span>
          </div>
          <div className="flex gap-4">
            <button onClick={handleJobBookmark} className="flex items-center gap-1 text-sm">
              <Bookmark
                className={`w-5 h-5 ${isJobBookmarkedState ? 'fill-primary text-primary' : 'text-gray-400'}`}
              />
              <span className={isJobBookmarkedState ? 'text-primary' : 'text-gray-600'}>求人ブックマーク</span>
            </button>
            <button onClick={handleFavorite} className="flex items-center gap-1 text-sm">
              <Heart
                className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
              />
              <span className={isFavorite ? 'text-red-500' : 'text-gray-600'}>お気に入り施設</span>
            </button>
            <button onClick={handleMute} className={`flex items-center gap-1 text-sm ${isMuted ? 'text-orange-500' : 'text-gray-600'}`}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? 'ミュート中' : 'ミュート'}</span>
            </button>
          </div>
        </div>

        {/* 選択された勤務日 */}
        <div className="mb-4">
          <h3 className="mb-3 text-sm font-bold">選択された勤務日</h3>
          <div className="space-y-2">
            {selectedWorkDates.map((wd: any, index: number) => {
              const isApplied = appliedWorkDateIds.includes(wd.id);
              const recruitmentCount = wd.recruitmentCount || job.recruitmentCount;
              const matchedCount = wd.matchedCount || 0;
              // 面接ありの場合は満員でも応募可能
              const isFull = !job.requiresInterview && matchedCount >= recruitmentCount;
              const isDisabled = isApplied || isFull;
              return (
                <div
                  key={wd.id || index}
                  onClick={() => !isDisabled && toggleWorkDateSelection(wd.id)}
                  className={`p-4 border-2 rounded-card transition-colors relative ${isFull && !isApplied
                    ? 'border-gray-300 bg-gray-200 cursor-not-allowed opacity-60'
                    : isApplied
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      : selectedWorkDateIds.includes(wd.id)
                        ? 'border-primary bg-primary-light/30 cursor-pointer'
                        : 'border-gray-200 hover:border-primary cursor-pointer'
                    }`}
                >
                  {/* 募集終了オーバーレイ */}
                  {isFull && !isApplied && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 rounded-card">
                      <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded">
                        募集終了
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedWorkDateIds.includes(wd.id)}
                      onChange={() => !isDisabled && toggleWorkDateSelection(wd.id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isDisabled}
                      className="w-5 h-5 text-primary flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-sm font-bold ${isFull ? 'text-gray-500' : ''}`}>
                          {formatDateTime(wd.workDate, job.startTime, job.endTime)}
                        </div>
                        {isApplied && (
                          <Badge variant="default" className="text-xs">応募済み</Badge>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${isFull ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span>休憩 {job.breakTime}</span>
                        <span>•</span>
                        <span>時給 {job.hourlyWage.toLocaleString()}円</span>
                      </div>
                      <div className={`text-xs mt-1 ${isFull ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {isFull ? '募集枠なし' : `募集人数 ${matchedCount}/${recruitmentCount}人`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${isFull ? 'text-gray-400' : 'text-red-500'}`}>
                        {job.wage.toLocaleString()}円
                      </div>
                      <div className={`text-xs ${isFull ? 'text-gray-400' : 'text-gray-600'}`}>
                        交通費{job.transportationFee.toLocaleString()}円込
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* その他の応募日時（同じ求人の他の日程） */}
        {otherWorkDates.length > 0 && (
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h3 className="mb-3 text-sm font-bold">その他の応募日時（{otherWorkDates.length}件）</h3>
            <div className="space-y-2">
              {otherWorkDates
                .slice(0, showAllDates ? undefined : 6)
                .map((wd: any, index: number) => {
                  const isApplied = appliedWorkDateIds.includes(wd.id);
                  const recruitmentCount = wd.recruitmentCount || job.recruitmentCount;
                  const matchedCount = wd.matchedCount || 0;
                  // 面接ありの場合は満員でも応募可能
                  const isFull = !job.requiresInterview && matchedCount >= recruitmentCount;
                  const isDisabled = isApplied || isFull;
                  const remainingSlots = Math.max(0, recruitmentCount - matchedCount);
                  return (
                    <div
                      key={wd.id || index}
                      onClick={() => !isDisabled && toggleWorkDateSelection(wd.id)}
                      className={`flex items-center gap-3 p-3 border rounded-card transition-colors relative ${isFull && !isApplied
                        ? 'border-gray-300 bg-gray-200 cursor-not-allowed opacity-60'
                        : isApplied
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                          : selectedWorkDateIds.includes(wd.id)
                            ? 'border-primary bg-primary-light/20 cursor-pointer'
                            : 'border-gray-200 hover:border-primary cursor-pointer'
                        }`}
                    >
                      {/* 募集終了オーバーレイ */}
                      {isFull && !isApplied && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 rounded-card">
                          <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded">
                            募集終了
                          </span>
                        </div>
                      )}
                      <input
                        type="checkbox"
                        checked={selectedWorkDateIds.includes(wd.id)}
                        onChange={() => !isDisabled && toggleWorkDateSelection(wd.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isDisabled}
                        className="w-5 h-5 text-primary flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`text-sm font-bold ${isFull ? 'text-gray-500' : ''}`}>
                            {formatDateTime(wd.workDate, job.startTime, job.endTime)}
                          </div>
                          {isApplied && (
                            <Badge variant="default" className="text-xs">応募済み</Badge>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${isFull ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span>休憩 {job.breakTime}</span>
                          <span>•</span>
                          <span>時給 {job.hourlyWage.toLocaleString()}円</span>
                        </div>
                        <div className={`text-xs mt-1 ${isFull ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                          {isFull ? '募集枠なし' : `残り枠 ${remainingSlots}人`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${isFull ? 'text-gray-400' : 'text-red-500'}`}>
                          {job.wage.toLocaleString()}円
                        </div>
                        <div className={`text-xs ${isFull ? 'text-gray-400' : 'text-gray-600'}`}>
                          交通費{job.transportationFee.toLocaleString()}円込
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {otherWorkDates.length > 6 && !showAllDates && (
              <button
                onClick={() => setShowAllDates(true)}
                className="w-full mt-3 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-primary-light transition-colors"
              >
                さらに表示
              </button>
            )}
          </div>
        )}
      </div>

      {/* 申し込みボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <Button
          onClick={handleApply}
          size="lg"
          className="w-full"
          disabled={isApplying || selectedWorkDateIds.length === 0}
        >
          {isApplying ? '応募中...' : selectedWorkDateIds.length > 0 ? `${selectedWorkDateIds.length}件の日程に応募する` : !hasAvailableDates ? '応募できる日程がありません' : '日程を選択してください'}
        </Button>
      </div>
      {/* 責任者 */}
      <div className="border-t border-gray-200 pt-4 mb-4">
        <h3 className="mb-3 text-sm font-bold">責任者</h3>
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-400 flex items-center justify-center text-white text-2xl flex-shrink-0">
            {job.managerAvatar}
          </div>
          <div className="flex-1">
            <div className="mb-1 font-bold">{job.managerName}</div>
            <p className="text-sm text-gray-600 whitespace-pre-line">{job.managerMessage}</p>
          </div>
        </div>
      </div>

      {/* この求人の特徴 */}
      {job.featureTags && job.featureTags.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="mb-3 text-sm font-bold">この求人の特徴</h3>
          <div className="flex flex-wrap gap-2">
            {job.featureTags.map((tag: string, index: number) => (
              <span
                key={index}
                className="inline-block bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 仕事概要 */}
      <div className="mb-4">
        <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">仕事概要</h3>
        <div className="mt-3">
          <h4 className="mb-2 text-sm font-bold">仕事詳細</h4>
          {/* 仕事内容アイコン */}
          <div className="flex flex-wrap gap-2 mb-3">
            {job.workContent.map((content: string, index: number) => (
              <Tag key={index}>{content}</Tag>
            ))}
          </div>
          <div
            className={`text-sm text-gray-600 whitespace-pre-line overflow-hidden transition-all ${isOverviewExpanded ? 'max-h-none' : 'max-h-[10.5rem] md:max-h-[7.5rem]'
              }`}
          >
            {job.overview}
          </div>
          {job.overview.length > 100 && (
            <button
              className="text-blue-500 text-sm mt-2"
              onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
            >
              {isOverviewExpanded ? '閉じる ∧' : 'さらに表示 ∨'}
            </button>
          )}
        </div>
      </div>

      {/* 申込条件 */}
      <div className="mb-4">
        <div className="mt-3 space-y-4">
          <div>
            <h4 className="text-sm mb-2 font-bold">必要な資格</h4>
            <div className="flex flex-wrap gap-2">
              {job.requiredQualifications
                .flatMap((qual: string) => qual.split(/、|または/).map((q: string) => q.trim()).filter((q: string) => q))
                .map((qual: string, index: number) => (
                  <Tag key={index}>{qual}</Tag>
                ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm mb-2 font-bold">経験・スキル</h4>
            <div className="text-sm text-gray-600">
              {job.requiredExperience.map((exp: string, index: number) => (
                <p key={index}>・{exp}</p>
              ))}
            </div>
          </div>
          {/* 募集条件（週N回以上・1ヶ月以上） */}
          {(job.weeklyFrequency || job.monthlyCommitment) && (
            <div>
              <h4 className="text-sm mb-2 font-bold">募集条件</h4>
              <div className="flex flex-wrap gap-2">
                {job.weeklyFrequency && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full">
                    週{job.weeklyFrequency}回以上勤務できる方
                  </span>
                )}
                {job.monthlyCommitment && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                    1ヶ月以上勤務できる方
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 事前情報 */}
      <div id="pre-info" className="mb-4 scroll-mt-16">
        <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">事前情報</h3>
        <div className="mt-3 space-y-4">
          {/* 服装など */}
          <div>
            <h4 className="text-sm mb-2 font-bold">服装など</h4>
            <ul className="text-sm text-gray-600 space-y-1 mb-3">
              {job.dresscode.map((item: string, index: number) => (
                <li key={index}>・{item}</li>
              ))}
            </ul>
            {/* サンプル画像 */}
            {job.dresscodeImages && job.dresscodeImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {job.dresscodeImages.map((imageUrl: string, index: number) => (
                  <div key={index} className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                    <Image
                      src={imageUrl}
                      alt={`服装サンプル${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                  <Image
                    src="/images/hukuso.png"
                    alt="服装サンプル1"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                  <Image
                    src="/images/hukuso.png"
                    alt="服装サンプル2"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                  <Image
                    src="/images/hukuso.png"
                    alt="服装サンプル3"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 持ち物 */}
          <div>
            <h4 className="text-sm mb-2 font-bold">持ち物</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {job.belongings.map((item: string, index: number) => (
                <li key={index}>・{item}</li>
              ))}
            </ul>
          </div>

          {/* その他添付資料 */}
          {job.attachments && job.attachments.length > 0 && (
            <div>
              <h4 className="text-sm mb-2 font-bold">その他添付資料</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                {job.attachments.map((attachment: string, index: number) => {
                  const fileName = attachment.split('/').pop() || 'ファイル';
                  return (
                    <li key={index}>
                      <a
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        ・{fileName}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 施設情報 */}
          <div>
            <h4 className="text-sm mb-2 font-bold">施設情報</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{facility.corporationName}</p>
              <p>{facility.name}</p>
              <p>電話番号: {facility.phoneNumber}</p>
              <button
                onClick={() => router.push(`/facilities/${facility.id}`)}
                className="mt-2 text-sm text-primary hover:text-primary/80 hover:underline flex items-center gap-1"
              >
                <Building2 className="w-4 h-4" />
                この施設の詳細を見る
              </button>
            </div>
          </div>

          {/* アクセス（住所+交通手段を統合） */}
          <div>
            <h4 className="text-sm mb-2 font-bold">アクセス</h4>
            <p className="text-sm text-gray-600 mb-2">{job.address}</p>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100 mb-2">
              {/* 地図画像: 施設が登録した画像があればそれを使用、なければGoogle Maps Static APIで動的生成 */}
              {job.mapImage && !job.mapImage.includes('map-placeholder') ? (
                <Image
                  src={job.mapImage}
                  alt="地図"
                  fill
                  className="object-cover"
                />
              ) : (
                <Image
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(job.address)}&zoom=15&size=600x400&maptype=roadmap&markers=color:red%7C${encodeURIComponent(job.address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`}
                  alt="地図"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-red-500" />
            </div>
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`;
                window.open(url, '_blank');
              }}
              className="text-sm text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              Google Mapで開く
            </button>
            {/* 交通手段 */}
            <p className="text-xs text-gray-600 mt-4 mb-2">交通手段</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {job.transportMethods.map((method: any, index: number) => (
                <span
                  key={index}
                  className={`px-3 py-1 rounded-full text-xs ${method.available
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-400 line-through'
                    }`}
                >
                  {method.name}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>駐車場: {job.parking ? 'あり' : 'なし'}</p>
              <p>{job.accessDescription}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 労働条件通知書ボタン */}
      <div className="mb-4 px-4">
        <button
          onClick={() => toast('労働条件通知書のダミーデータです', { icon: '📄' })}
          className="px-3 py-1.5 text-xs text-white bg-primary rounded hover:bg-primary/90 transition-colors"
        >
          労働条件通知書を確認
        </button>
      </div>

      {/* レビュー */}
      {facilityReviews.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">レビュー ({facilityReviews.length}件)</h3>
          <div className="mt-3 space-y-4">
            {/* 評価分布バー */}
            {(() => {
              const totalReviews = facilityReviews.length;
              const avgRating = totalReviews > 0
                ? facilityReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
                : 0;

              // 評価分布を計算
              const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
              facilityReviews.forEach((r: any) => {
                if (ratingCounts[r.rating] !== undefined) {
                  ratingCounts[r.rating]++;
                }
              });

              return (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-yellow-500">★</span>
                    <span className="text-xl font-bold">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">({totalReviews}件)</span>
                  </div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = ratingCounts[rating];
                      const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <span className="text-xs w-3">{rating}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {facilityReviews.slice(0, 5).map((review: any) => (
              <div key={review.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                <div className="mb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-700">
                      {review.ageGroup}/{review.gender}/{review.qualification}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(review.createdAt).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {/* 評価 */}
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <span
                        key={value}
                        className={`text-sm ${value <= review.rating
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                          }`}
                      >
                        ★
                      </span>
                    ))}
                    <span className="ml-1 text-sm font-semibold text-gray-700">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {review.jobTitle} ({review.jobDate})
                  </p>
                </div>

                {/* 良かった点 */}
                <div className="bg-green-50 border border-green-100 rounded-lg p-2 mb-2">
                  <h5 className="text-xs font-bold text-green-900 mb-1 flex items-center gap-1">
                    <span>👍</span>
                    <span>良かった点</span>
                  </h5>
                  <p className="text-xs text-gray-700">{review.goodPoints || 'とくにないです'}</p>
                </div>

                {/* 改善点 */}
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-2">
                  <h5 className="text-xs font-bold text-orange-900 mb-1 flex items-center gap-1">
                    <span>💡</span>
                    <span>改善点</span>
                  </h5>
                  <p className="text-xs text-gray-700">{review.improvements || 'とくにないです'}</p>
                </div>
              </div>
            ))}

            {facilityReviews.length > 5 && (
              <button
                onClick={() => router.push(`/facilities/${facility.id}`)}
                className="w-full py-3 text-sm text-primary border border-primary rounded-lg hover:bg-primary-light transition-colors"
              >
                さらにレビューを見る（残り{facilityReviews.length - 5}件）
              </button>
            )}
          </div>
        </div>
      )}

      {/* 申し込みボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <Button
          onClick={handleApply}
          size="lg"
          className="w-full"
          disabled={isApplying || selectedWorkDateIds.length === 0}
        >
          {isApplying ? '応募中...' : selectedWorkDateIds.length > 0 ? `${selectedWorkDateIds.length}件の日程に応募する` : !hasAvailableDates ? '応募できる日程がありません' : '日程を選択してください'}
        </Button>
      </div>

      {/* プロフィール未完了モーダル */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4">プロフィールを完成させてください</h2>

            <p className="text-sm text-gray-600 mb-4">
              応募するには、以下のプロフィール項目を入力する必要があります。
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-bold text-red-800 mb-2">未入力の項目:</p>
              <ul className="text-sm text-red-700 space-y-1">
                {profileMissingFields.map((field, index) => (
                  <li key={index}>・{field}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowProfileModal(false)}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  // 戻り先URLを生成（選択中の勤務日IDを含める）
                  const returnUrl = `/jobs/${job.id}${selectedWorkDateIds.length > 0 ? `?selected=${selectedWorkDateIds.join(',')}` : ''}`;
                  router.push(`/mypage/profile?returnUrl=${encodeURIComponent(returnUrl)}`);
                }}
              >
                プロフィールを編集
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
