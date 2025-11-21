'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { jobs } from '@/data/jobs';
import { facilities } from '@/data/facilities';
import { formatDateTime } from '@/utils/date';
import { Suspense } from 'react';

function ApplicationConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URLパラメータから選択されたjobIdsを取得
  const jobIdsParam = searchParams.get('jobIds');
  const jobIds = jobIdsParam ? jobIdsParam.split(',').map(id => parseInt(id)) : [];

  // 選択されたジョブの情報を取得
  const selectedJobs = jobs.filter(job => jobIds.includes(job.id));

  // 施設情報を取得（最初のジョブの施設）
  const facility = selectedJobs.length > 0
    ? facilities.find(f => f.id === selectedJobs[0].facilityId)
    : null;

  const handleConfirm = () => {
    // 確認ボタンを押したら、元の完了ページへ遷移
    router.push('/application-complete');
  };

  if (selectedJobs.length === 0 || !facility) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">選択された求人が見つかりません</p>
          <Button onClick={() => router.back()}>戻る</Button>
        </div>
      </div>
    );
  }

  // 合計金額を計算
  const totalWage = selectedJobs.reduce((sum, job) => sum + job.wage, 0);
  const totalTransportationFee = selectedJobs.reduce((sum, job) => sum + job.transportationFee, 0);

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">応募内容確認</h1>
          <div className="w-6"></div> {/* スペーサー */}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-2">施設情報</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-bold text-base mb-1">{facility.name}</p>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <span className="text-yellow-400">★</span>
              <span>{facility.rating.toFixed(1)}</span>
              <span>({facility.reviewCount}件)</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">
            選択した募集内容（{selectedJobs.length}件）
          </h2>
          <div className="space-y-3">
            {selectedJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 border-2 border-primary rounded-lg bg-primary-light/10"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-bold mb-2">
                      {formatDateTime(job.workDate, job.startTime, job.endTime)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                      <span>休憩 {job.breakTime}</span>
                      <span>•</span>
                      <span>時給 {job.hourlyWage.toLocaleString()}円</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {job.address}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-500">
                      {job.wage.toLocaleString()}円
                    </div>
                    <div className="text-xs text-gray-600">
                      交通費{job.transportationFee.toLocaleString()}円込
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 合計金額 */}
        <div className="mb-6 bg-primary-light/20 p-4 rounded-lg border-2 border-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">合計給与</span>
            <span className="text-xl font-bold text-red-500">
              {totalWage.toLocaleString()}円
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>交通費合計</span>
            <span>{totalTransportationFee.toLocaleString()}円込</span>
          </div>
        </div>

        {/* 確認メッセージ */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-center font-bold">
            この内容で応募してよろしいですか？
          </p>
        </div>
      </div>

      {/* 確認ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <Button onClick={handleConfirm} size="lg" className="w-full">
          この内容で応募する
        </Button>
      </div>
    </div>
  );
}

export default function ApplicationConfirm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    }>
      <ApplicationConfirmContent />
    </Suspense>
  );
}
