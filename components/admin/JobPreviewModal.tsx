'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, Heart, Clock } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Tag } from '@/components/ui/tag';
import { calculateDailyWage } from '@/utils/salary';

interface JobPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: any;
  selectedDates: string[];
  facility: any;
}

export function JobPreviewModal({
  isOpen,
  onClose,
  formData,
  selectedDates,
  facility,
}: JobPreviewModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);

  if (!isOpen) return null;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev === formData.images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? formData.images.length - 1 : prev - 1));
  };

  const formatWorkTime = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return '';
    return `${startTime}〜${endTime}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`;
  };

  const dailyWage = calculateDailyWage(
    formData.startTime,
    formData.endTime,
    formData.breakTime,
    formData.hourlyWage,
    formData.transportationFee
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">求人プレビュー</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* プレビューコンテンツ */}
        <div className="p-6">
          {/* 募集人数 */}
          <div className="flex justify-end mb-3">
            <Badge variant="red">
              募集人数 0/{formData.recruitmentCount}人
            </Badge>
          </div>

          {/* 画像カルーセル */}
          {formData.images.length > 0 && (
            <div className="relative mb-4">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100">
                {formData.images[currentImageIndex] instanceof File ? (
                  <Image
                    src={URL.createObjectURL(formData.images[currentImageIndex])}
                    alt="施設画像"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    画像プレビュー
                  </div>
                )}
                {formData.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 hover:bg-white transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 hover:bg-white transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              {/* インジケーター */}
              {formData.images.length > 1 && (
                <div className="flex justify-center gap-1 mt-2">
                  {formData.images.map((_: any, index: number) => (
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
          )}

          {/* タグとバッジ */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <Badge variant="default">{formData.jobType}</Badge>
            {formData.tags?.map((tag: string) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>

          {/* 施設情報 */}
          {facility && (
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-1">{facility.name}</h2>
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{facility.address}</span>
              </div>
              <div className="flex gap-4">
                <button className="flex items-center gap-1 text-sm">
                  <Heart className="w-5 h-5 text-gray-400" />
                  <span className="text-red-500">お気に入り</span>
                </button>
              </div>
            </div>
          )}

          {/* 選択された勤務日 */}
          {selectedDates.length > 0 && (
            <div className="mb-4 space-y-2">
              {selectedDates.slice(0, 3).map((date) => (
                <div
                  key={date}
                  className="p-4 border-2 border-primary rounded-lg bg-primary-light/30"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="w-5 h-5 text-primary flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold mb-1">
                        {formatDate(date)} {formatWorkTime(formData.startTime, formData.endTime)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>休憩 {formData.breakTime}分</span>
                        <span>•</span>
                        <span>時給 {formData.hourlyWage?.toLocaleString() || 0}円</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-500">
                        {dailyWage.toLocaleString()}円
                      </div>
                      <div className="text-xs text-gray-600">
                        交通費{formData.transportationFee?.toLocaleString() || 0}円込
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {selectedDates.length > 3 && (
                <p className="text-sm text-gray-600 text-center">
                  他 {selectedDates.length - 3} 件の勤務日
                </p>
              )}
            </div>
          )}

          {/* 仕事内容 */}
          {formData.workContent?.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="mb-3 text-sm font-bold">仕事内容</h3>
              <div className="flex flex-wrap gap-2">
                {formData.workContent.map((content: string, index: number) => (
                  <Tag key={index}>{content}</Tag>
                ))}
              </div>
            </div>
          )}

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
                {formData.jobDescription || '仕事の詳細が入力されていません'}
              </div>
              {formData.jobDescription && formData.jobDescription.length > 100 && (
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
              {formData.qualifications?.length > 0 && (
                <div>
                  <h4 className="text-sm mb-2 font-bold">必要な資格</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.qualifications.map((qualification: string, index: number) => (
                      <Tag key={index}>{qualification}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {formData.skills?.length > 0 && (
                <div>
                  <h4 className="text-sm mb-2 font-bold">経験・スキル</h4>
                  <div className="text-sm text-gray-600">
                    {formData.skills.map((skill: string, index: number) => (
                      <p key={index}>・{skill}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => alert('労働条件通知書のダミーデータです')}
                    className="mt-3 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    労働条件通知書を確認
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 事前情報 */}
          <div className="mb-4">
            <h3 className="mb-3 text-sm bg-primary-light px-4 py-3 -mx-4">事前情報</h3>
            <div className="mt-3 space-y-4">
              {/* 服装など */}
              {(formData.dresscode?.length > 0 || formData.dresscodeImages?.length > 0) && (
                <div>
                  <h4 className="text-sm mb-2 font-bold">服装など</h4>
                  {formData.dresscode?.length > 0 && (
                    <ul className="text-sm text-gray-600 space-y-1 mb-3">
                      {formData.dresscode.map((item: string, index: number) => (
                        <li key={index}>・{item}</li>
                      ))}
                    </ul>
                  )}
                  {formData.dresscodeImages?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {formData.dresscodeImages.map((file: File, index: number) => (
                        <div key={index} className="relative aspect-video overflow-hidden rounded-lg border border-gray-200">
                          <Image
                            src={URL.createObjectURL(file)}
                            alt={`服装サンプル${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 持ち物・その他 */}
              {formData.belongings?.length > 0 && (
                <div>
                  <h4 className="text-sm mb-2 font-bold">持ち物・その他</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {formData.belongings.map((item: string, index: number) => (
                      <li key={index}>・{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 備考 */}
          {formData.notes && (
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="mb-3 text-sm font-bold">備考</h3>
              <p className="text-sm whitespace-pre-wrap">{formData.notes}</p>
            </div>
          )}

          {/* 勤務条件 */}
          <div className="border-t border-gray-200 pt-4 mb-4">
            <h3 className="mb-3 text-sm font-bold">勤務条件</h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-600 w-24">勤務時間:</span>
                <span>{formatWorkTime(formData.startTime, formData.endTime)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 w-24">休憩時間:</span>
                <span>{formData.breakTime}分</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 w-24">時給:</span>
                <span>{formData.hourlyWage?.toLocaleString() || 0}円</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 w-24">交通費:</span>
                <span>{formData.transportationFee?.toLocaleString() || 0}円</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 w-24">日給:</span>
                <span className="font-bold text-red-500">{dailyWage.toLocaleString()}円</span>
              </div>
            </div>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
