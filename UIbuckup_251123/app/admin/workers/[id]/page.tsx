'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Star, MapPin, Phone, Mail, User } from 'lucide-react';
import { workers, workHistories, workerEvaluations } from '@/data/workers';

export default function WorkerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const workerId = parseInt(params.id);
  const worker = workers.find((w) => w.id === workerId);
  const histories = workHistories.filter((h) => h.workerId === workerId);
  const evaluations = workerEvaluations.filter((e) => e.workerId === workerId);

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">ワーカー詳細</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 基本情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex gap-4 mb-4">
            {/* 顔写真 */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden">
                {worker.photoUrl ? (
                  <img
                    src={worker.photoUrl}
                    alt={worker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-3xl">{worker.name.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 名前・評価 */}
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">{worker.name}</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg font-bold">
                    {worker.overallRating.toFixed(1)}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  ({worker.totalReviews}件の評価)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>
                  {worker.prefecture} {worker.city}
                </span>
              </div>
            </div>
          </div>

          {/* 詳細情報 */}
          <div className="space-y-3 pt-3 border-t border-gray-200">
            <div className="flex gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-gray-500">年齢: </span>
                <span>{worker.age}歳</span>
                <span className="ml-3 text-gray-500">性別: </span>
                <span>{worker.gender}</span>
              </div>
            </div>
            <div className="flex gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span>{worker.phone}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span>{worker.email}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">住所: </span>
              <span>
                {worker.prefecture} {worker.city} {worker.address}
              </span>
            </div>
          </div>
        </div>

        {/* 総合評価詳細 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">評価詳細</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">技術力</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">
                    {worker.ratingBreakdown.skill.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">態度</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">
                    {worker.ratingBreakdown.attitude.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">時間厳守</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">
                    {worker.ratingBreakdown.punctuality.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">コミュニケーション</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">
                    {worker.ratingBreakdown.communication.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 勤務実績サマリー */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">勤務実績</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">総勤務日数</div>
              <div className="text-2xl font-bold text-primary">
                {worker.totalWorkDays}
                <span className="text-sm text-gray-600 ml-1">日</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">評価件数</div>
              <div className="text-2xl font-bold text-primary">
                {worker.totalReviews}
                <span className="text-sm text-gray-600 ml-1">件</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">キャンセル率</div>
              <div className="text-2xl font-bold text-orange-500">
                {worker.cancelRate}
                <span className="text-sm text-gray-600 ml-1">%</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600 mb-1">直前キャンセル率</div>
              <div className="text-2xl font-bold text-red-500">
                {worker.lastMinuteCancelRate}
                <span className="text-sm text-gray-600 ml-1">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 資格・経験 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">資格・経験</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600 mb-1">保有資格</div>
              <div className="flex flex-wrap gap-2">
                {worker.qualifications.map((qual, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary-light text-primary text-sm rounded-full"
                  >
                    {qual}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">介護経験</div>
              <div className="text-sm font-medium">{worker.careExperience}</div>
            </div>
            {worker.nursingExperience && (
              <div>
                <div className="text-sm text-gray-600 mb-1">看護経験</div>
                <div className="text-sm font-medium">
                  {worker.nursingExperience}
                </div>
              </div>
            )}
            {worker.specialSkills.length > 0 && (
              <div>
                <div className="text-sm text-gray-600 mb-1">特別スキル</div>
                <div className="flex flex-wrap gap-2">
                  {worker.specialSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 希望条件 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">希望条件</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600 mb-1">希望サービス種別</div>
              <div className="flex flex-wrap gap-2">
                {worker.preferredServiceTypes.map((type, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">希望勤務時間</div>
              <div className="flex flex-wrap gap-2">
                {worker.preferredWorkTimes.map((time, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                  >
                    {time}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">移動手段</div>
              <div className="flex flex-wrap gap-2">
                {worker.transportation.map((trans, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                  >
                    {trans}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 緊急連絡先 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">緊急連絡先</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">氏名: </span>
              <span className="font-medium">{worker.emergencyContact.name}</span>
            </div>
            <div>
              <span className="text-gray-600">続柄: </span>
              <span className="font-medium">
                {worker.emergencyContact.relationship}
              </span>
            </div>
            <div>
              <span className="text-gray-600">電話番号: </span>
              <span className="font-medium">{worker.emergencyContact.phone}</span>
            </div>
          </div>
        </div>

        {/* 職務履歴サマリー */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">職務履歴サマリー</h3>
          <div className="space-y-3">
            {histories.map((history) => (
              <div
                key={history.id}
                className="pb-3 border-b border-gray-200 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium">{history.facilityName}</div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">
                      {history.averageRating.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <div>勤務回数: {history.workCount}回</div>
                  <div>最終勤務日: {history.lastWorkDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近の評価 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">最近の評価</h3>
          <div className="space-y-4">
            {evaluations.slice(0, 5).map((evaluation) => (
              <div
                key={evaluation.id}
                className="pb-4 border-b border-gray-200 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">
                      {evaluation.facilityName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {evaluation.jobDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">
                      {(
                        (evaluation.skill +
                          evaluation.attitude +
                          evaluation.punctuality +
                          evaluation.communication) /
                        4
                      ).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">技術力</span>
                    <span className="font-medium">{evaluation.skill}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">態度</span>
                    <span className="font-medium">{evaluation.attitude}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">時間厳守</span>
                    <span className="font-medium">{evaluation.punctuality}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">コミュニケーション</span>
                    <span className="font-medium">
                      {evaluation.communication}
                    </span>
                  </div>
                </div>
                {evaluation.comment && (
                  <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                    {evaluation.comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
