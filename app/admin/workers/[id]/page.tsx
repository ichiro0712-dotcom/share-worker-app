'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Star, Phone, Mail, Calendar, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { getWorkerDetail } from '@/src/lib/actions';
import { useAuth } from '@/contexts/AuthContext';

// DBにないデータを表示するコンポーネント
const NoDbData = ({ label }: { label?: string }) => (
  <span className="text-red-500 font-bold text-xs">DBにないよ！{label && `(${label})`}</span>
);

interface WorkerDetailData {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  qualifications: string[];
  birthDate: string | null;
  age: number | null;
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
  // 施設種別ごとの評価
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
}

export default function WorkerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(params.id);
  const [worker, setWorker] = useState<WorkerDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadWorker = async () => {
      setLoading(true);
      try {
        const data = await getWorkerDetail(workerId, admin.facilityId);
        setWorker(data);
      } catch (error) {
        console.error('Failed to load worker:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorker();
  }, [workerId, admin, isAdmin, isAdminLoading, router]);

  if (loading || isAdminLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ワーカーが見つかりません</p>
          <button
            onClick={() => router.back()}
            className="text-primary hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.back()} className="hover:bg-gray-100 rounded p-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">ワーカー詳細ダッシュボード</h1>
      </div>

      {/* メインコンテンツ - 4エリアグリッド */}
      <div className="flex-1 p-3 grid grid-cols-4 gap-3 overflow-hidden">

        {/* ========================================
            エリア1: ユーザー基本情報
        ======================================== */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col overflow-hidden">
          <h2 className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">ユーザー基本情報</h2>

          <div className="flex gap-3 mb-3">
            {/* アイコン画像 */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                {worker.profileImage ? (
                  <img
                    src={worker.profileImage}
                    alt={worker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-xl">{worker.name.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 名前・年齢・性別 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">{worker.name}</h3>
              <div className="text-xs text-gray-600 mt-1">
                {worker.age !== null ? `${worker.age}歳` : <NoDbData label="生年月日" />}
                {' / '}
                <NoDbData label="性別" />
              </div>
            </div>
          </div>

          {/* タグ情報 */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">資格</div>
            <div className="flex flex-wrap gap-1">
              {worker.qualifications.length > 0 ? (
                worker.qualifications.map((qual, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">
                    {qual}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">なし</span>
              )}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">経験年数</div>
            <NoDbData label="experienceYears" />
          </div>

          {/* 基本評価 */}
          <div className="mt-auto pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-lg font-bold">
                  {worker.totalAvgRating > 0 ? worker.totalAvgRating.toFixed(1) : '-'}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                ({worker.totalReviewCount}件)
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              総勤務: {worker.totalWorkDays}回
            </div>
          </div>
        </div>

        {/* ========================================
            エリア2: スケジュール・アクション
        ======================================== */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col overflow-hidden">
          <h2 className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">スケジュール・アクション</h2>

          {/* 直近の勤務予定 */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              直近の勤務予定
            </div>
            {worker.upcomingSchedules.length > 0 ? (
              <div className="space-y-1">
                {worker.upcomingSchedules.map((schedule) => (
                  <div key={schedule.id} className="text-xs bg-green-50 border border-green-200 rounded p-1.5">
                    <div className="font-medium text-green-800">{schedule.workDate}</div>
                    <div className="text-green-600">{schedule.startTime}〜{schedule.endTime}</div>
                    <div className="text-gray-600 truncate">{schedule.facilityName}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-2">予定なし</div>
            )}
          </div>

          {/* アクションリンク */}
          <div className="mt-auto space-y-2 pt-2 border-t">
            <div className="text-xs text-gray-500 mb-1">アクション</div>

            {worker.phone ? (
              <a
                href={`tel:${worker.phone}`}
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <Phone className="w-3 h-3" />
                緊急連絡: {worker.phone}
              </a>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-gray-400">電話番号なし</span>
              </div>
            )}

            <a
              href={`mailto:${worker.email}`}
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <Mail className="w-3 h-3" />
              {worker.email}
            </a>

            <button className="flex items-center gap-2 text-xs text-primary hover:underline">
              <FileText className="w-3 h-3" />
              採用報告を作成
            </button>
          </div>
        </div>

        {/* ========================================
            エリア3: 詳細ステータス
        ======================================== */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col overflow-hidden">
          <h2 className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">詳細ステータス</h2>

          {/* 自己PR */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">自己PR</div>
            <div className="text-xs bg-gray-50 rounded p-2 min-h-[40px]">
              <NoDbData label="selfIntroduction" />
            </div>
          </div>

          {/* 勤務回数内訳 */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded p-2">
              <div className="text-[10px] text-blue-600">自社勤務</div>
              <div className="text-sm font-bold text-blue-800">{worker.ourFacilityWorkDays}回</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-[10px] text-gray-600">他社勤務</div>
              <div className="text-sm font-bold text-gray-800">{worker.otherFacilityWorkDays}回</div>
            </div>
          </div>

          {/* キャンセル率 */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="bg-yellow-50 rounded p-2">
              <div className="text-[10px] text-yellow-700">キャンセル率</div>
              <div className={`text-sm font-bold ${worker.cancelRate > 10 ? 'text-red-600' : 'text-gray-800'}`}>
                {worker.cancelRate.toFixed(0)}%
              </div>
            </div>
            <div className={`rounded p-2 ${worker.lastMinuteCancelRate > 10 ? 'bg-red-50' : 'bg-yellow-50'}`}>
              <div className={`text-[10px] ${worker.lastMinuteCancelRate > 10 ? 'text-red-700' : 'text-yellow-700'}`}>
                直前キャンセル率
              </div>
              <div className={`text-sm font-bold ${worker.lastMinuteCancelRate > 10 ? 'text-red-600' : worker.lastMinuteCancelRate > 0 ? 'text-yellow-600' : 'text-gray-800'}`}>
                {worker.lastMinuteCancelRate.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* 転職意向・希望の働き方 */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">転職意向</div>
            <NoDbData label="jobChangeIntent" />
          </div>
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">希望の働き方</div>
            <NoDbData label="preferredWorkStyle" />
          </div>

          {/* 資格証明書画像 */}
          <div className="mt-auto pt-2 border-t">
            <div className="text-xs text-gray-500 mb-1">資格証明書</div>
            <NoDbData label="qualificationCertificateImages" />
          </div>
        </div>

        {/* ========================================
            エリア4: 評価スコア詳細
        ======================================== */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col overflow-hidden">
          <h2 className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">評価スコア詳細</h2>

          {/* 総合評価 */}
          <div className="mb-3 bg-yellow-50 rounded p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-yellow-700">総合評価</div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-lg font-bold text-yellow-800">
                  {worker.totalAvgRating > 0 ? worker.totalAvgRating.toFixed(1) : '-'}
                </span>
                <span className="text-xs text-yellow-600">({worker.totalReviewCount}件)</span>
              </div>
            </div>
          </div>

          {/* 項目別スコア */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">項目別スコア</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center py-1 border-b">
                <span>時間厳守</span>
                <NoDbData label="timeScore" />
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span>業務遂行</span>
                <NoDbData label="executionScore" />
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span>挨拶・態度</span>
                <NoDbData label="attitudeScore" />
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span>コミュニケーション</span>
                <NoDbData label="communicationScore" />
              </div>
              <div className="flex justify-between items-center py-1">
                <span>スキル</span>
                <NoDbData label="skillScore" />
              </div>
            </div>
          </div>

          {/* 施設種別ごとの評価 */}
          <div className="mt-auto pt-2 border-t overflow-y-auto">
            <div className="text-xs text-gray-500 mb-1">施設種別ごとの評価</div>
            {worker.ratingsByFacilityType.length > 0 ? (
              <div className="space-y-1">
                {worker.ratingsByFacilityType.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-gray-50 rounded p-1.5">
                    <span className="truncate">{item.facilityType}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{item.averageRating.toFixed(1)}</span>
                      <span className="text-gray-500">({item.reviewCount})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400">データなし</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
