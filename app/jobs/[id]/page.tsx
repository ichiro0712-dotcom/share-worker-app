'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronLeft, Heart, Clock, MapPin, ChevronRight, ChevronLeft as ChevronLeftIcon } from 'lucide-react';
import Image from 'next/image';
import { jobs } from '@/data/jobs';
import { facilities } from '@/data/facilities';
import { reviews } from '@/data/reviews';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { formatDateTime, getDeadlineText } from '@/utils/date';

export default function JobDetail() {
  const params = useParams();
  const router = useRouter();
  const jobId = parseInt(params.id as string);

  const job = jobs.find((j) => j.id === jobId);
  const facility = job ? facilities.find((f) => f.id === job.facilityId) : null;
  const facilityReviews = job ? reviews.filter((r) => r.facilityId === job.facilityId) : [];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savedForLater, setSavedForLater] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  if (!job || !facility) {
    return <div>求人が見つかりません</div>;
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev === job.images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? job.images.length - 1 : prev - 1));
  };

  const handleFavorite = () => {
    alert('未定：お気に入り機能はPhase 2で実装予定です');
    setIsFavorite(!isFavorite);
  };

  const handleSaveForLater = () => {
    alert('未定：あとで見る機能はPhase 2で実装予定です');
    setSavedForLater(!savedForLater);
  };

  const handleApply = () => {
    router.push('/application-complete');
  };

  const handleMute = () => {
    alert('未定：ミュート機能はPhase 2で実装予定です');
  };

  return (
    <div className="min-h-screen bg-white pb-20">
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

        {/* ナビゲーションタブ */}
        <div className="bg-primary-light border-t border-gray-300">
          <div className="flex">
            {['overview', 'conditions', 'preinfo', 'review'].map((section) => {
              const labels = {
                overview: '仕事概要',
                conditions: '申込条件',
                preinfo: '事前情報',
                review: 'レビュー'
              };

              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`flex-1 py-3 text-sm border-b-2 transition-colors text-center ${
                    activeSection === section
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-600'
                  }`}
                >
                  {labels[section as keyof typeof labels]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="px-4 py-4">
        {/* タグとバッジ */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {job.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {job.badges.map((badge, index) => (
            <Badge key={index} variant="primary">
              {badge.text}
            </Badge>
          ))}
        </div>

        {/* 募集人数 */}
        <div className="flex justify-end mb-3">
          <Badge variant="red">
            募集人数 {job.appliedCount}/{job.recruitmentCount}人
          </Badge>
        </div>

        {/* 画像カルーセル */}
        <div className="relative mb-4">
          <div className="relative aspect-video overflow-hidden rounded-lg">
            <Image
              src={job.images[currentImageIndex]}
              alt="施設画像"
              fill
              className="object-cover"
            />
            {job.images.length > 1 && (
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
          {job.images.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {job.images.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 rounded-full transition-all ${
                    index === currentImageIndex ? 'w-6 bg-gray-800' : 'w-1 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* 施設情報 */}
        <div className="mb-4">
          <h2 className="text-lg mb-1">{facility.name}</h2>
          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
            <MapPin className="w-4 h-4" />
            <span>{job.address}</span>
          </div>
          <div className="flex gap-4">
            <button onClick={handleFavorite} className="flex items-center gap-1 text-sm">
              <Heart
                className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
              />
              <span className="text-red-500">お気に入り</span>
            </button>
            <button onClick={handleMute} className="flex items-center gap-1 text-sm text-gray-600">
              <span>ミュート</span>
            </button>
          </div>
        </div>

        {/* お仕事カード（複数日程） */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {/* 同じ施設の他の日程の求人を表示 */}
            {jobs.filter(j => j.facilityId === job.facilityId && j.id !== job.id).slice(0, 5).map((relatedJob) => (
              <div
                key={relatedJob.id}
                onClick={() => router.push(`/jobs/${relatedJob.id}`)}
                className="flex-shrink-0 w-48 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                <div className="text-sm mb-1">{formatDateTime(relatedJob.workDate, relatedJob.startTime, relatedJob.endTime).split(' ')[0]}</div>
                <div className="text-xs text-gray-600 mb-1">{relatedJob.startTime}-{relatedJob.endTime}</div>
                <div className="text-xs text-blue-500 mb-2">{getDeadlineText(relatedJob.deadline)}</div>
                <div className="text-xs text-gray-600 mb-2">休憩 {relatedJob.breakTime}</div>
                <div className="text-2xl text-red-500 mb-1">{relatedJob.wage.toLocaleString()}円</div>
                <div className="text-xs text-gray-600 text-right">募集{relatedJob.appliedCount}/{relatedJob.recruitmentCount}人</div>
                <div className="text-xs text-gray-600 text-right">交通費{relatedJob.transportationFee.toLocaleString()}円込</div>
              </div>
            ))}
          </div>
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

        {/* 仕事内容 */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="mb-3 text-sm font-bold">仕事内容</h3>
          <div className="flex flex-wrap gap-2">
            {job.workContent.map((content, index) => (
              <Tag key={index}>{content}</Tag>
            ))}
          </div>
        </div>

        {/* 仕事概要 */}
        <div className="mb-4">
          <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">仕事概要</h3>
          <div className="mt-3">
            <h4 className="mb-2 text-sm font-bold">仕事詳細</h4>
            <div
              className={`text-sm text-gray-600 whitespace-pre-line overflow-hidden transition-all ${
                isOverviewExpanded ? 'max-h-none' : 'max-h-[10.5rem] md:max-h-[7.5rem]'
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
          <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">申込条件</h3>
          <div className="mt-3 space-y-4">
            <div>
              <h4 className="text-sm mb-2 font-bold">必要な資格</h4>
              <div className="text-sm text-gray-600">
                {job.requiredQualifications.join(', ')}
              </div>
            </div>
            <div>
              <h4 className="text-sm mb-2 font-bold">経験・スキル</h4>
              <div className="text-sm text-gray-600">
                {job.requiredExperience.map((exp, index) => (
                  <p key={index}>・{exp}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 事前情報 */}
        <div className="mb-4">
          <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">事前情報</h3>
          <div className="mt-3 space-y-4">
            {/* 服装など */}
            <div>
              <h4 className="text-sm mb-2 font-bold">服装など</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {job.dresscode.map((item, index) => (
                  <li key={index}>・{item}</li>
                ))}
              </ul>
            </div>

            {/* 持ち物・その他 */}
            <div>
              <h4 className="text-sm mb-2 font-bold">持ち物・その他</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {job.belongings.map((item, index) => (
                  <li key={index}>・{item}</li>
                ))}
                {job.otherConditions.length > 0 && job.otherConditions.map((item, index) => (
                  <li key={`other-${index}`}>・{item}</li>
                ))}
              </ul>
            </div>

            {/* 法人名 */}
            <div>
              <h4 className="text-sm mb-2 font-bold">法人名</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{facility.corporationName}</p>
                <p>{facility.name}</p>
                <p>電話番号: {facility.phoneNumber}</p>
              </div>
            </div>

            {/* 住所 */}
            <div>
              <h4 className="text-sm mb-2 font-bold">住所</h4>
              <p className="text-sm text-gray-600 mb-2">{job.address}</p>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100 mb-2">
                <Image
                  src={job.mapImage}
                  alt="地図"
                  fill
                  className="object-cover"
                />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-red-500" />
              </div>
              <button
                onClick={() => alert('未定：Google Map連携はPhase 2で実装予定です')}
                className="text-sm text-blue-500"
              >
                🗺️ Google Mapで開く
              </button>
            </div>

            {/* アクセス */}
            <div>
              <h4 className="text-sm mb-2 font-bold">アクセス</h4>
              <p className="text-xs text-gray-600 mb-2">交通手段</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {job.transportMethods.map((method, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-full text-xs ${
                      method.available
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

        {/* レビュー */}
        {facilityReviews.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">レビュー</h3>
            <div className="mt-3">
              <p className="mb-3">
                <span className="text-yellow-500">★</span>
                <span className="text-lg">{facility.rating.toFixed(1)}</span>
                <span className="text-sm text-gray-500 ml-1">（{facility.reviewCount}件）</span>
              </p>

              {/* 評価分布バー */}
              <div className="mb-6 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = Math.floor(Math.random() * facility.reviewCount / 2);
                  const percentage = facility.reviewCount > 0 ? (count / facility.reviewCount) * 100 : 0;

                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-xs w-3">{rating}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                {facilityReviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      {review.age}/{review.gender}/{review.occupation}/{review.period}
                    </p>
                    <div className="mb-2">
                      <h5 className="text-sm font-bold mb-1">良かった点</h5>
                      <p className="text-sm text-gray-600">{review.goodPoints}</p>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold mb-1">改善点</h5>
                      <p className="text-sm text-gray-600">{review.improvements}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* さらにレビューを見るボタン */}
              {facility.reviewCount > 3 && (
                <button
                  onClick={() => alert('未定：レビュー一覧表示はPhase 2で実装予定です')}
                  className="mt-4 w-full py-3 text-sm text-primary border border-primary rounded-lg hover:bg-primary-light transition-colors"
                >
                  さらにレビューを見る ({facility.reviewCount}件)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 申し込みボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <Button onClick={handleApply} size="lg" className="w-full">
          申し込む
        </Button>
      </div>
    </div>
  );
}
