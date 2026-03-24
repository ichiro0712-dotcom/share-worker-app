'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, ChevronLeft, Heart, Clock, MapPin, ChevronRight, ChevronLeft as ChevronLeftIcon, Bookmark, VolumeX, Volume2, ExternalLink, Building2, Train, Car, Bike, Bus, Edit2, AlertTriangle, Home, FileText } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/tag';
import { formatDateTime, getDeadlineText, isDeadlineUrgent } from '@/utils/date';
import { applyForJobMultipleDates, acceptOffer, addJobBookmark, removeJobBookmark, isJobBookmarked, toggleFacilityFavorite, isFacilityFavorited, getUserSelfPR, updateUserSelfPR, getFacilityInterviewPassRate } from '@/src/lib/actions';
import { useBadge } from '@/contexts/BadgeContext';
import toast from 'react-hot-toast';
import { useErrorToast } from '@/components/ui/PersistentErrorToast';
import { trackGA4Event } from '@/src/lib/ga4-events';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

// デフォルトのプレースホルダー画像
const DEFAULT_JOB_IMAGE = '/images/samples/job_default_noimage.png';

interface ScheduledJob {
  date: string;
  startTime: string;
  endTime: string;
  jobId: number;
  workDateId: number;
}

interface InterviewPassRateData {
  passRate: number | null;
  appliedCount: number;
  matchedCount: number;
  period: string;
}

interface JobDetailClientProps {
  job: any;
  facility: any;
  relatedJobs: any[];
  facilityReviews: any[];
  initialHasApplied: boolean;
  initialAppliedWorkDateIds?: number[]; // 追加: 応募済みの勤務日IDリスト
  selectedDate?: string; // YYYY-MM-DD形式の選択された日付
  isPreviewMode?: boolean;
  scheduledJobs?: ScheduledJob[]; // ユーザーのスケジュール済み仕事（時間重複判定用）
  isPublic?: boolean; // 公開版（未ログイン）表示モード
  interviewPassRate?: InterviewPassRateData | null; // 面接通過率データ（審査あり求人用）
}

/**
 * 時間重複判定: 2つの時間帯が重なっているかチェック
 */
function isTimeOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  return e1 > s2 && e2 > s1;
}

export function JobDetailClient({ job, facility, relatedJobs: _relatedJobs, facilityReviews, initialHasApplied: _initialHasApplied, initialAppliedWorkDateIds = [], selectedDate, isPreviewMode = false, scheduledJobs = [], isPublic = false, interviewPassRate = null }: JobDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshBadges } = useBadge();
  const { showDebugError } = useDebugError();

  // URLパラメータからselectedを読み取る（プロフィール編集から戻った場合）
  const selectedFromUrl = searchParams?.get('selected');
  const preselectedIds = selectedFromUrl ? selectedFromUrl.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];

  // LPからの遷移かどうか（おすすめ求人ウィジェット経由）
  const fromLp = searchParams?.get('from_lp');

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

  // 応募確認モーダル
  const [showApplyConfirmModal, setShowApplyConfirmModal] = useState(false);
  const [selfPR, setSelfPR] = useState<string | null>(null);
  const [selfPRLoading, setSelfPRLoading] = useState(false);
  const [isEditingSelfPR, setIsEditingSelfPR] = useState(false);
  const [editSelfPRValue, setEditSelfPRValue] = useState('');
  const [savingSelfPR, setSavingSelfPR] = useState(false);

  // 面接通過率（期間選択対応）
  const [passRateData, setPassRateData] = useState<InterviewPassRateData | null>(interviewPassRate);
  const [passRatePeriod, setPassRatePeriod] = useState<'current' | 'last' | 'two_months_ago'>('current');
  const [passRateLoading, setPassRateLoading] = useState(false);

  // 画像配列を安全に取得（空配列の場合やロードエラー時はフォールバック）
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const jobImages = useMemo(() => {
    const images = job.images && job.images.length > 0 ? job.images : [DEFAULT_JOB_IMAGE];
    const valid = images.filter((img: string) => !failedImages.has(img));
    return valid.length > 0 ? valid : [DEFAULT_JOB_IMAGE];
  }, [job.images, failedImages]);

  // 画像エラー時のフォールバック（同じsrcの重複更新を防止）
  const handleImageError = useCallback((src: string) => {
    if (src === DEFAULT_JOB_IMAGE) return; // デフォルト画像のエラーは無視（無限ループ防止）
    setFailedImages(prev => prev.has(src) ? prev : new Set(prev).add(src));
  }, []);

  // レンダー時に安全なインデックスを算出（useEffectは1フレーム遅れるため）
  const safeImageIndex = currentImageIndex < jobImages.length ? currentImageIndex : 0;

  // carousel indexが範囲外にならないようクランプ（次回レンダー以降のため）
  useEffect(() => {
    if (currentImageIndex >= jobImages.length) {
      setCurrentImageIndex(0);
    }
  }, [jobImages.length, currentImageIndex]);

  // job変更時にエラー状態をリセット
  useEffect(() => {
    setFailedImages(new Set());
    setCurrentImageIndex(0);
  }, [job.id]);

  useEffect(() => {
    // 公開版では認証が必要な機能をスキップ
    if (isPublic) return;

    // ブックマーク状態を取得
    isFacilityFavorited(String(facility.id)).then(setIsFavorite);
    isJobBookmarked(String(job.id), 'WATCH_LATER').then(setSavedForLater);
    isJobBookmarked(String(job.id), 'FAVORITE').then(setIsJobBookmarkedState);

    // ミュート状態を取得
    const mutedFacilities = JSON.parse(localStorage.getItem('mutedFacilities') || '[]');
    const isFacilityMuted = mutedFacilities.some((f: any) => f.facilityId === facility.id);
    setIsMuted(isFacilityMuted);
  }, [job.id, facility.id, isPublic]);

  // 選択状態の初期化（URLパラメータ、selectedDate、またはデフォルト）
  useEffect(() => {
    // URLパラメータからの選択がある場合（プロフィール編集から戻った場合）
    if (preselectedIds.length > 0) {
      // 応募可能なIDのみをフィルタリング
      const validIds = preselectedIds.filter(id => {
        const wd = job.workDates?.find((w: any) => w.id === id);
        if (!wd) return false;
        if (wd.isRecruitmentClosed) return false;
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
        if (!isApplied && !isFull && !selected.isRecruitmentClosed) {
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
      if (wd.isRecruitmentClosed) return false;
      const isApplied = appliedWorkDateIds.includes(wd.id);
      const matchedCount = wd.matchedCount || 0;
      const recruitmentCount = wd.recruitmentCount || job.recruitmentCount || 1;
      // 面接ありの場合は満員でも応募可能
      const isFull = !job.requiresInterview && matchedCount >= recruitmentCount;
      const isDeadlinePassed = new Date(wd.deadline) < new Date();
      return !isApplied && !isFull && !isDeadlinePassed;
    });
  }, [job.workDates, job.matchedCount, job.recruitmentCount, appliedWorkDateIds, job.requiresInterview]);

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

    // 一致するものがない場合は最初の日付を選択として扱う
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
          trackGA4Event('bookmark', { action: 'remove', job_id: job.id });
        }
      } else {
        const result = await addJobBookmark(String(job.id), 'FAVORITE');
        if (result.success) {
          setIsJobBookmarkedState(true);
          toast.success('求人ブックマークに追加しました');
          trackGA4Event('bookmark', { action: 'add', job_id: job.id });
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

  // 面接通過率の期間変更
  const handlePassRatePeriodChange = async (period: 'current' | 'last' | 'two_months_ago') => {
    if (passRatePeriod === period || passRateLoading) return;

    setPassRatePeriod(period);
    setPassRateLoading(true);

    try {
      const data = await getFacilityInterviewPassRate(facility.id, period);
      setPassRateData(data);
    } catch (error) {
      console.error('Failed to fetch pass rate:', error);
    } finally {
      setPassRateLoading(false);
    }
  };

  // 応募ボタンクリック時：確認モーダルを表示
  const handleApplyButtonClick = async () => {
    if (selectedWorkDateIds.length === 0) {
      toast.error('応募する勤務日を選択してください');
      return;
    }

    // N回以上勤務条件のチェック
    const weeklyFrequency = job.weekly_frequency || job.weeklyFrequency;
    if (weeklyFrequency) {
      // 既に応募済みの日数 + 今回選択した日数
      const totalDays = appliedWorkDateIds.length + selectedWorkDateIds.length;
      if (totalDays < weeklyFrequency) {
        toast.error(`この求人は${weeklyFrequency}回以上の勤務が条件です。あと${weeklyFrequency - totalDays}日選択してください。`);
        return;
      }
    }

    // 既に応募済みの勤務日が含まれているかチェック
    const alreadyAppliedSelected = selectedWorkDateIds.filter(id => appliedWorkDateIds.includes(id));
    if (alreadyAppliedSelected.length > 0) {
      toast.error('選択された勤務日の中に、既に応募済みのものが含まれています');
      return;
    }

    // 応募ボタンクリック記録（バックグラウンド、失敗無視）
    fetch('/api/application-click-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(() => {});
    trackGA4Event('application_click', { job_id: job.id });

    // 自己PRを取得
    setSelfPRLoading(true);
    setShowApplyConfirmModal(true);
    try {
      const result = await getUserSelfPR();
      if (result) {
        setSelfPR(result.selfPR);
        setEditSelfPRValue(result.selfPR || '');
      }
    } catch (error) {
      console.error('Failed to fetch selfPR:', error);
    } finally {
      setSelfPRLoading(false);
    }
  };

  // 自己PR保存
  const handleSaveSelfPR = async () => {
    setSavingSelfPR(true);
    try {
      const result = await updateUserSelfPR(editSelfPRValue);
      if (result.success) {
        setSelfPR(editSelfPRValue.trim() || null);
        setIsEditingSelfPR(false);
        toast.success('自己PRを保存しました');
      } else {
        showDebugError({
          type: 'save',
          operation: '自己PR保存',
          message: result.error || '保存に失敗しました',
          context: { jobId: job.id, selfPRLength: editSelfPRValue.length }
        });
        toast.error(result.error || '保存に失敗しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: '自己PR保存',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { jobId: job.id, selfPRLength: editSelfPRValue.length }
      });
      toast.error('保存に失敗しました');
    } finally {
      setSavingSelfPR(false);
    }
  };

  const { showError } = useErrorToast();

  const handleApply = async () => {
    // 1. 即座にモーダルを閉じる
    setShowApplyConfirmModal(false);

    // 2. 現在の状態をスナップショット保存（ロールバック用）
    const previousAppliedIds = [...appliedWorkDateIds];

    // 3. 楽観的UI更新：即座に応募済み状態にする
    setAppliedWorkDateIds(prev => [...prev, ...selectedWorkDateIds]);
    setSelectedWorkDateIds([]); // 選択をクリア

    const isOffer = job.jobType === 'OFFER';
    toast.success(isOffer ? 'オファーを受け付けました' : '応募を受け付けました');

    // 4. バックグラウンドでAPI実行
    try {
      // オファー求人の場合は acceptOffer を使用
      const result = isOffer
        ? await acceptOffer(String(job.id), selectedWorkDateIds[0])
        : await applyForJobMultipleDates(String(job.id), selectedWorkDateIds);

      if (result.success) {
        trackGA4Event('application_complete', {
          job_id: job.id,
          is_offer: isOffer,
          is_matched: !!result.isMatched,
        });
        // マッチング成立の場合は追加メッセージを表示
        if (result.isMatched) {
          toast.success('マッチングが成立しました！');
        }

        // メッセージバッジを更新（サーバー側の非同期メッセージ作成を待つため遅延）
        setTimeout(() => {
          refreshBadges();
        }, 2000);

        // サーバーサイドのキャッシュを更新してからリダイレクト
        router.refresh();
        setTimeout(() => {
          router.push('/');
        }, 500);
      } else {
        // 失敗時：ロールバック
        setAppliedWorkDateIds(previousAppliedIds);

        // プロフィール未完了エラーの場合はモーダル表示
        if ('missingFields' in result && result.missingFields) {
          const missingFields = result.missingFields as string[];
          setProfileMissingFields(missingFields);
          setShowProfileModal(true);
        } else {
          // デバッグ用エラー通知
          showDebugError({
            type: 'save',
            operation: '求人応募',
            message: result.error || '応募に失敗しました',
            context: {
              jobId: job.id,
              facilityId: facility.id,
              selectedWorkDateIds: selectedWorkDateIds,
              appliedWorkDateIds: appliedWorkDateIds,
            }
          });
          try {
            // エラー通知をバックグラウンドで送信
            fetch('/api/error-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                errorKey: 'APPLY_ERROR',
                userId: undefined, // クライアント側では特定できない場合もあるが、セッションから取れるなら入れる
                variables: {
                  error: String(result.error)
                }
              })
            }).catch(console.error);
          } catch (e) {
            console.error('Failed to trigger error notification:', e);
          }
          showError('APPLY_ERROR', `応募に失敗しました: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Application error:', error);
      // 失敗時：ロールバック
      setAppliedWorkDateIds(previousAppliedIds);
      // デバッグ用エラー通知
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: '求人応募（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: {
          jobId: job.id,
          facilityId: facility.id,
          selectedWorkDateIds: selectedWorkDateIds,
        }
      });
      showError('APPLY_ERROR', '応募に失敗しました。もう一度お試しください。');
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
    <div className={`min-h-screen bg-background max-w-lg mx-auto ${isPublic ? 'pb-32' : 'pb-36'}`}>
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        {isPreviewMode && (
          <div className="bg-blue-600 text-white text-center py-2 text-sm font-bold">
            プレビューモードで表示中
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between">
          {/* 公開版ではナビゲーションボタンを非表示 */}
          {!isPublic ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // 履歴がある場合は戻る、ない場合はホームへ
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/');
                  }
                }}
                aria-label="戻る"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => router.push('/')}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="トップページへ"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          ) : fromLp ? (
            <Link
              href={`/api/lp/${fromLp}`}
              className="flex items-center gap-1 text-sm text-primary"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>戻る</span>
            </Link>
          ) : (
            <Link
              href="/public/jobs"
              className="flex items-center gap-1 text-sm text-primary"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>求人一覧</span>
            </Link>
          )}
          <div className="flex-1 text-center text-sm">
            {formatDateTime(selectedDate || job.workDate, job.startTime, job.endTime)}
          </div>
          {/* 公開版では「あとで見る」ボタンを非表示 */}
          {!isPublic ? (
            <button
              onClick={handleSaveForLater}
              className="flex items-center gap-1 text-xs"
            >
              <Clock className={`w-5 h-5 ${savedForLater ? 'text-primary' : 'text-gray-400'}`} />
              <span className={savedForLater ? 'text-primary' : 'text-gray-600'}>
                {savedForLater ? '保存済み' : 'あとで見る'}
              </span>
            </button>
          ) : (
            /* 右側のスペーサー */
            <div className="w-16" />
          )}
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
            {getDeadlineText(job.deadline) === '締切済み' ? '募集終了' : `締切まで${getDeadlineText(job.deadline)}`}
          </span>
          <Badge variant="red">
            募集人数 {selectedWorkDates[0]?.appliedCount ?? job.appliedCount}/{selectedWorkDates[0]?.recruitmentCount ?? job.recruitmentCount}人
          </Badge>
        </div>

        {/* 画像カルーセル */}
        <div className="relative mb-4">
          {/* バッジ - overflow-hiddenの外に配置（求人種別 + 審査あり） */}
          <div className="absolute top-3 left-3 z-30 flex flex-col gap-1">
            {job.jobType === 'OFFER' && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                オファ
              </span>
            )}
            {job.jobType === 'LIMITED_WORKED' && (
              <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                限定
              </span>
            )}
            {job.jobType === 'LIMITED_FAVORITE' && (
              <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md flex items-center gap-0.5">
                限定<span className="text-yellow-300">★</span>
              </span>
            )}
            {job.jobType === 'ORIENTATION' && (
              <span className="bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                説明会
              </span>
            )}
            {job.requiresInterview && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                審査あり
              </span>
            )}
          </div>
          <div className="relative aspect-video rounded-card overflow-hidden">
            {jobImages[safeImageIndex].startsWith('blob:') ? (
              <img
                src={jobImages[safeImageIndex]}
                alt="施設画像"
                className="object-cover w-full h-full"
              />
            ) : (
              <Image
                src={jobImages[safeImageIndex]}
                alt="施設画像"
                fill
                className="object-cover"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgIBAwQDAAAAAAAAAAAAAQIDBAAFERIGEyExQVFh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQACAwEAAAAAAAAAAAAAAAABAgADESH/2gAMAwEAAhEDEEQA/8A0="
                priority={safeImageIndex === 0}
                onError={() => handleImageError(jobImages[safeImageIndex])}
              />
            )}
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
                  className={`h-1 rounded-full transition-all ${index === safeImageIndex ? 'w-6 bg-gray-800' : 'w-1 bg-gray-300'
                    }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* タグとバッジ（N回以上勤務を先頭に） */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {job.effectiveWeeklyFrequency && (
            <Badge variant="purple">
              {job.effectiveWeeklyFrequency}回以上勤務
            </Badge>
          )}
          {job.tags.map((tag: string) => (
            <Badge key={tag} variant="red">
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
            <span>
              {(job.prefecture || job.city || job.addressLine)
                ? `${job.prefecture || ''}${job.city || ''}${job.addressLine || ''}`
                : job.address}
            </span>
          </div>
          {/* 公開版ではお気に入り・ブックマーク・ミュートボタンを非表示 */}
          {!isPublic && (
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
          )}
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
              const isDateClosed = wd.isRecruitmentClosed === true;

              // 時間重複チェック
              const hasTimeConflict = scheduledJobs.some((scheduled) => {
                if (scheduled.date !== wd.workDate) return false;
                // 同じ求人の同じ勤務日はスキップ
                if (scheduled.workDateId === wd.id) return false;
                return isTimeOverlapping(
                  job.startTime,
                  job.endTime,
                  scheduled.startTime,
                  scheduled.endTime
                );
              });

              const isDisabled = isApplied || isFull || hasTimeConflict || isDateClosed;
              const unavailableReason = isDateClosed ? '募集終了' : isApplied ? '応募済み' : hasTimeConflict ? '時間重複' : isFull ? '募集終了' : null;

              return (
                <div
                  key={wd.id || index}
                  onClick={() => !isPublic && !isDisabled && toggleWorkDateSelection(wd.id)}
                  className={`p-4 border-2 rounded-card transition-colors relative ${isPublic
                    ? 'border-gray-200 bg-white'
                    : isDisabled
                      ? 'border-gray-300 bg-gray-200 cursor-not-allowed opacity-60'
                      : selectedWorkDateIds.includes(wd.id)
                        ? 'border-primary bg-primary-light/30 cursor-pointer'
                        : 'border-gray-200 hover:border-primary cursor-pointer'
                    }`}
                >
                  {/* 応募不可オーバーレイ（公開版では非表示） */}
                  {!isPublic && isDisabled && unavailableReason && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 rounded-card">
                      <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded">
                        {unavailableReason}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {/* 公開版ではチェックボックス非表示 */}
                    {!isPublic && (
                      <input
                        type="checkbox"
                        checked={selectedWorkDateIds.includes(wd.id)}
                        onChange={() => !isDisabled && toggleWorkDateSelection(wd.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isDisabled}
                        className="w-5 h-5 text-primary flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-sm font-bold ${isDisabled ? 'text-gray-500' : ''}`}>
                          {formatDateTime(wd.workDate, job.startTime, job.endTime)}
                        </div>
                        {isApplied && (
                          <Badge variant="default" className="text-xs">応募済み</Badge>
                        )}
                        {hasTimeConflict && !isApplied && (
                          <Badge variant="red" className="text-xs">時間重複</Badge>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span>休憩 {job.breakTime}</span>
                        <span>•</span>
                        <span>時給 {job.hourlyWage.toLocaleString()}円</span>
                      </div>
                      <div className={`text-xs mt-1 ${isFull ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {isFull ? '募集枠なし' : `募集人数 ${matchedCount}/${recruitmentCount}人`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${isDisabled ? 'text-gray-400' : 'text-red-500'}`}>
                        {job.wage.toLocaleString()}円
                      </div>
                      <div className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
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
                  const remainingSlots = Math.max(0, recruitmentCount - matchedCount);
                  const isDateClosed = wd.isRecruitmentClosed === true;

                  // 時間重複チェック
                  const hasTimeConflict = scheduledJobs.some((scheduled) => {
                    if (scheduled.date !== wd.workDate) return false;
                    // 同じ求人の同じ勤務日はスキップ
                    if (scheduled.workDateId === wd.id) return false;
                    return isTimeOverlapping(
                      job.startTime,
                      job.endTime,
                      scheduled.startTime,
                      scheduled.endTime
                    );
                  });

                  const isDisabled = isApplied || isFull || hasTimeConflict || isDateClosed;
                  const unavailableReason = isDateClosed ? '募集終了' : isApplied ? '応募済み' : hasTimeConflict ? '時間重複' : isFull ? '募集終了' : null;

                  return (
                    <div
                      key={wd.id || index}
                      onClick={() => !isPublic && !isDisabled && toggleWorkDateSelection(wd.id)}
                      className={`flex items-center gap-3 p-3 border rounded-card transition-colors relative ${isPublic
                        ? 'border-gray-200 bg-white'
                        : isDisabled
                          ? 'border-gray-300 bg-gray-200 cursor-not-allowed opacity-60'
                          : selectedWorkDateIds.includes(wd.id)
                            ? 'border-primary bg-primary-light/20 cursor-pointer'
                            : 'border-gray-200 hover:border-primary cursor-pointer'
                        }`}
                    >
                      {/* 応募不可オーバーレイ（公開版では非表示） */}
                      {!isPublic && isDisabled && unavailableReason && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 rounded-card">
                          <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded">
                            {unavailableReason}
                          </span>
                        </div>
                      )}
                      {/* 公開版ではチェックボックス非表示 */}
                      {!isPublic && (
                        <input
                          type="checkbox"
                          checked={selectedWorkDateIds.includes(wd.id)}
                          onChange={() => !isDisabled && toggleWorkDateSelection(wd.id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isDisabled}
                          className="w-5 h-5 text-primary flex-shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`text-sm font-bold ${isDisabled ? 'text-gray-500' : ''}`}>
                            {formatDateTime(wd.workDate, job.startTime, job.endTime)}
                          </div>
                          {isApplied && (
                            <Badge variant="default" className="text-xs">応募済み</Badge>
                          )}
                          {hasTimeConflict && !isApplied && (
                            <Badge variant="red" className="text-xs">時間重複</Badge>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span>休憩 {job.breakTime}</span>
                          <span>•</span>
                          <span>時給 {job.hourlyWage.toLocaleString()}円</span>
                        </div>
                        <div className={`text-xs mt-1 ${isFull ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                          {isFull ? '募集枠なし' : `残り枠 ${remainingSlots}人`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${isDisabled ? 'text-gray-400' : 'text-red-500'}`}>
                          {job.wage.toLocaleString()}円
                        </div>
                        <div className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
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

      {/* 責任者 */}
      <div className="border-t border-gray-200 pt-4 mb-4 px-4">
        <h3 className="mb-3 text-sm font-bold">責任者</h3>
        <div className="flex gap-3">
          {/* 画像パスの場合はimgタグで表示、それ以外は絵文字として表示 */}
          {job.managerAvatar && (job.managerAvatar.startsWith('/') || job.managerAvatar.includes('.jpg') || job.managerAvatar.includes('.png') || job.managerAvatar.includes('.jpeg') || job.managerAvatar.includes('.webp')) ? (
            <img
              src={job.managerAvatar}
              alt={job.managerName || '責任者'}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-orange-400 flex items-center justify-center text-white text-2xl flex-shrink-0">
              {job.managerAvatar || '👤'}
            </div>
          )}
          <div className="flex-1">
            <div className="mb-1 font-bold">{job.managerName}</div>
            <p className="text-sm text-gray-600 whitespace-pre-line">{job.managerMessage}</p>
          </div>
        </div>
      </div>

      {/* 仕事概要 */}
      <div className="mb-4 px-4">
        <h3 className="mb-3 text-base font-bold text-primary py-3 -mx-4 px-4 border-b-2 border-primary">仕事概要</h3>
        <div className="mt-3">
          <h4 className="mb-2 text-sm font-bold">仕事詳細</h4>
          {/* 仕事内容アイコン */}
          <div className="flex flex-wrap gap-2 mb-3">
            {job.workContent.map((content: string, index: number) => (
              <Tag key={index}>{content}</Tag>
            ))}
          </div>
          <div
            className={`text-sm text-gray-600 whitespace-pre-line overflow-hidden transition-all ${isOverviewExpanded ? 'max-h-none' : 'max-h-[22.5rem]'
              }`}
          >
            {job.overview}
          </div>
          {job.overview.split('\n').length > 15 && (
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
      <div className="mb-4 px-4">
        <h3 className="mb-3 text-base font-bold text-primary py-3 -mx-4 px-4 border-b-2 border-primary">申込条件</h3>
        <div className="mt-3 space-y-4">
          <div>
            <h4 className="text-sm mb-2 font-bold">必要な資格・条件</h4>
            <div className="flex flex-wrap gap-2">
              {job.requiredQualifications
                .flatMap((qual: string) => qual.split(/、|または/).map((q: string) => q.trim()).filter((q: string) => q))
                .map((qual: string, index: number) => (
                  <Tag key={index}>{qual}</Tag>
                ))}
              {job.effectiveWeeklyFrequency && (
                <Badge variant="purple">
                  {job.effectiveWeeklyFrequency}回以上勤務
                </Badge>
              )}
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
        </div>
      </div>

      {/* 事前情報 */}
      <div id="pre-info" className="mb-4 scroll-mt-16 px-4">
        <h3 className="mb-3 text-base font-bold text-primary py-3 -mx-4 px-4 border-b-2 border-primary">事前情報</h3>
        <div className="mt-3 space-y-4">
          {/* 服装など */}
          <div>
            <h4 className="text-sm mb-2 font-bold">服装など</h4>
            <ul className="text-sm text-gray-600 space-y-1 mb-3">
              {job.dresscode.map((item: string, index: number) => (
                <li key={index}>・{item}</li>
              ))}
            </ul>
            {/* ネイルOK・制服貸与アイコン */}
            {(job.nailOk || job.uniformProvided) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {job.nailOk && (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                    ネイルOK
                  </span>
                )}
                {job.uniformProvided && (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                    制服貸与
                  </span>
                )}
              </div>
            )}
            {/* サンプル画像 */}
            {job.dresscodeImages && job.dresscodeImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {job.dresscodeImages.map((imageUrl: string, index: number) => (
                  <div key={index} className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                    {imageUrl.startsWith('blob:') ? (
                      <img
                        src={imageUrl}
                        alt={`服装サンプル${index + 1}`}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Image
                        src={imageUrl}
                        alt={`服装サンプル${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                ))}
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

          {/* アクセス */}
          <div>
            <h4 className="text-sm mb-2 font-bold">アクセス</h4>
            <p className="text-sm text-gray-600 mb-2">{job.address}</p>

            {/* 最寄駅情報 */}
            {facility.stations && Array.isArray(facility.stations) && facility.stations.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                <Train className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span>
                  {facility.stations.map((station: { name: string; minutes: number }, index: number) => (
                    <span key={index}>
                      {index > 0 && '、'}
                      {station.name}から徒歩{station.minutes}分
                    </span>
                  ))}
                </span>
              </div>
            )}

            {/* アクセス説明 */}
            {(facility.accessDescription || job.accessDescription) && (
              <p className="text-sm text-gray-600 mb-3">
                {facility.accessDescription || job.accessDescription}
              </p>
            )}

            <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100 mb-2">
              {/* 地図は常に住所ベースで表示（lat/lngは信頼性が低いため）ID-7 */}
              {job.address && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'undefined' ? (
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(job.address)}&zoom=16&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="施設の地図"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">地図情報がありません</p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`;
                window.open(url, '_blank');
              }}
              className="text-sm text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 mb-3"
            >
              <ExternalLink className="w-4 h-4" />
              Google Mapで開く
            </button>

            {/* 交通手段（バッジ形式） */}
            <h4 className="text-sm font-bold mt-3 mb-2">交通手段</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {/* すべての交通手段を表示（利用可能/不可を区別） */}
              {[
                { name: '車', Icon: Car },
                { name: 'バイク', Icon: Bike },
                { name: '自転車', Icon: Bike },
                { name: '公共交通機関', Icon: Bus },
              ].map(({ name, Icon }) => {
                const isAvailable = facility.transportation?.includes(name);
                return (
                  <span
                    key={name}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs ${isAvailable
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-400 line-through'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {name}
                  </span>
                );
              })}
            </div>

            {/* 駐車場情報 */}
            {facility.parking && (
              <p className="text-sm text-gray-600 mb-2">敷地内駐車場: {facility.parking}</p>
            )}

            {/* 交通手段備考 */}
            {facility.transportationNote && (
              <p className="text-xs text-gray-500">※ {facility.transportationNote}</p>
            )}
          </div>
        </div>
      </div>

      {/* 労働条件通知書プレビュー */}
      <div className="mb-4 px-4">
        <Link
          href={isPublic ? `/public/jobs/${job.id}/labor-document` : `/jobs/${job.id}/labor-document`}
          className="flex items-center gap-2 px-3 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
        >
          <FileText className="w-4 h-4" />
          労働条件通知書を確認
        </Link>
      </div>

      {/* 面接通過率（審査あり求人のみ表示） */}
      {job.requiresInterview && passRateData && (
        <div className="mb-4 px-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                <span>📊</span>
                <span>面接通過率</span>
              </h3>
              {/* 期間選択ボタン */}
              <div className="flex gap-1">
                {[
                  { key: 'current' as const, label: '今月' },
                  { key: 'last' as const, label: '先月' },
                  { key: 'two_months_ago' as const, label: '先々月' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handlePassRatePeriodChange(key)}
                    disabled={passRateLoading}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      passRatePeriod === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                    } ${passRateLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {passRateLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : passRateData.passRate !== null ? (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-blue-600">
                      {passRateData.passRate}%
                    </span>
                    <span className="text-xs text-gray-500">
                      （{passRateData.matchedCount}/{passRateData.appliedCount}人）
                    </span>
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${passRateData.passRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                この期間の応募データはまだありません
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              ※この施設の審査あり求人における面接通過率です（採用・不採用の結果が出た応募が対象）
            </p>
          </div>
        </div>
      )}

      {/* レビュー */}
      {facilityReviews.length > 0 && (
        <div className="mb-4 px-4">
          <h3 className="mb-3 text-base font-bold text-primary py-3 -mx-4 px-4 border-b-2 border-primary">レビュー ({facilityReviews.length}件)</h3>
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

      {/* 申し込みボタン（プレビューモードと公開版では非表示、公開版はレイアウトのフッターを使用） */}
      {!isPreviewMode && !isPublic && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 z-10" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
          <div className="p-4">
            <Button
              onClick={handleApplyButtonClick}
              size="lg"
              className="w-full"
              disabled={isApplying || selectedWorkDateIds.length === 0 || !hasAvailableDates}
            >
              {!hasAvailableDates
                ? '応募できる日程がありません'
                : isApplying
                  ? (job.jobType === 'OFFER' ? '受諾中...' : '応募中...')
                  : selectedWorkDateIds.length > 0
                    ? (job.jobType === 'OFFER' ? 'オファーを受ける' : `${selectedWorkDateIds.length}件の日程に応募する`)
                    : !hasAvailableDates
                      ? '応募できる日程がありません'
                      : '日程を選択してください'}
            </Button>
          </div>
        </div>
      )}

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
              応募するには、以下の項目を完了する必要があります。
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-bold text-red-800 mb-2">未完了の項目:</p>
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

      {/* 応募確認モーダル */}
      {showApplyConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">応募内容の確認</h3>
              <button
                onClick={() => {
                  setShowApplyConfirmModal(false);
                  setIsEditingSelfPR(false);
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 審査あり/なしの説明 */}
              {job.requiresInterview ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-yellow-800">審査あり求人です</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        応募後、施設による審査があります。審査通過後にマッチングが成立します。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    <span className="font-bold">即時マッチング求人です</span>
                    <br />
                    <span className="text-xs">応募と同時にマッチングが成立します。</span>
                  </p>
                </div>
              )}

              {/* 応募日程の確認 */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">応募する日程（{selectedWorkDateIds.length}件）</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {selectedWorkDateIds.map((workDateId) => {
                    const wd = job.workDates?.find((w: any) => w.id === workDateId);
                    if (!wd) return null;
                    return (
                      <div key={workDateId} className="text-sm text-gray-700">
                        {formatDateTime(wd.workDate, job.startTime, job.endTime)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 自己PR */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-gray-900">自己PR</h4>
                  {!isEditingSelfPR && (
                    <button
                      onClick={() => {
                        setIsEditingSelfPR(true);
                        setEditSelfPRValue(selfPR || '');
                      }}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      編集
                    </button>
                  )}
                </div>

                {selfPRLoading ? (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500">
                    読み込み中...
                  </div>
                ) : isEditingSelfPR ? (
                  <div className="space-y-2">
                    <textarea
                      value={editSelfPRValue}
                      onChange={(e) => setEditSelfPRValue(e.target.value)}
                      placeholder="自己PRを入力してください（施設に表示されます）"
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      rows={4}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setIsEditingSelfPR(false);
                          setEditSelfPRValue(selfPR || '');
                        }}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleSaveSelfPR}
                        disabled={savingSelfPR}
                        className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {savingSelfPR ? '保存中...' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : selfPR ? (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {selfPR}
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-orange-800 font-medium">自己PRが未入力です</p>
                        <p className="text-xs text-orange-700 mt-1">
                          自己PRを入力すると、施設からの採用率が上がる可能性があります。
                        </p>
                        <button
                          onClick={() => {
                            setIsEditingSelfPR(true);
                            setEditSelfPRValue('');
                          }}
                          className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          今すぐ入力する
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* フッター */}
            <div className="flex gap-3 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowApplyConfirmModal(false);
                  setIsEditingSelfPR(false);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleApply}
                disabled={isEditingSelfPR}
                className="flex-1 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {job.jobType === 'OFFER' ? 'オファーを受ける' : (job.requiresInterview ? '応募する（審査あり）' : '応募する')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
