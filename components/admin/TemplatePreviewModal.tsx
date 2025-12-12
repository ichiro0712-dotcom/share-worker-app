'use client';

import { X, Clock, Banknote, MapPin, Briefcase, Award, Shirt, Package } from 'lucide-react';
import Image from 'next/image';
import { calculateDailyWage } from '@/utils/salary';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateData: {
    name: string;
    title: string;
    startTime: string;
    endTime: string;
    breakTime: number;
    hourlyWage: number;
    transportationFee: number;
    recruitmentCount: number;
    workContent: string[];
    jobDescription: string;
    qualifications: string[];
    skills: string[];
    dresscode: string[];
    belongings: string[];
    icons: string[];
    images: string[];
    dresscodeImages?: string[];
    attachments?: string[];
  };
  facilityName: string;
}

export function TemplatePreviewModal({ isOpen, onClose, templateData, facilityName }: TemplatePreviewModalProps) {
  if (!isOpen) return null;

  const dailyWage = calculateDailyWage(
    templateData.startTime,
    templateData.endTime,
    templateData.breakTime,
    templateData.hourlyWage,
    templateData.transportationFee
  );

  const displayImages = templateData.images.length > 0 ? templateData.images : ['/images/anken.png'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダルコンテンツ */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">テンプレートプレビュー</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* プレビューバナー */}
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="text-sm text-yellow-800 text-center">
            📋 これはテンプレートのプレビューです。実際の求人として公開されるものではありません。
          </p>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* テンプレート名 */}
          <div className="mb-4 pb-4 border-b">
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">テンプレート名</span>
            <h3 className="text-lg font-bold mt-1">{templateData.name || '（テンプレート名未設定）'}</h3>
          </div>

          {/* 画像 */}
          {displayImages.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-3 gap-2">
                {displayImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-[3/2] rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={img}
                      alt={`画像 ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 基本情報 */}
          <div className="mb-6">
            <h4 className="font-bold text-gray-900 mb-3">{templateData.title || '（タイトル未設定）'}</h4>
            <p className="text-sm text-gray-600 mb-2">{facilityName}</p>

            {/* アイコン */}
            {templateData.icons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {templateData.icons.map((icon, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                    {icon}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 勤務条件 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-start gap-2">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">勤務時間</p>
                <p className="text-sm text-gray-600">
                  {templateData.startTime} 〜 {templateData.endTime}
                </p>
                <p className="text-xs text-gray-500">休憩 {templateData.breakTime}分</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Banknote className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">給与</p>
                <p className="text-sm text-gray-600">時給 {templateData.hourlyWage.toLocaleString()}円</p>
                <p className="text-xs text-gray-500">
                  交通費 {templateData.transportationFee.toLocaleString()}円 / 日給 {dailyWage.toLocaleString()}円
                </p>
              </div>
            </div>
          </div>

          {/* 仕事内容 */}
          {templateData.workContent.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <h5 className="text-sm font-medium">仕事内容</h5>
              </div>
              <div className="flex flex-wrap gap-1">
                {templateData.workContent.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 仕事詳細 */}
          {templateData.jobDescription && (
            <div className="mb-4">
              <h5 className="text-sm font-medium mb-2">仕事詳細</h5>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {templateData.jobDescription}
              </p>
            </div>
          )}

          {/* 資格条件 */}
          {templateData.qualifications.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-gray-400" />
                <h5 className="text-sm font-medium">資格条件</h5>
              </div>
              <div className="flex flex-wrap gap-1">
                {templateData.qualifications.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* スキル */}
          {templateData.skills.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium mb-2">スキル・経験</h5>
              <div className="flex flex-wrap gap-1">
                {templateData.skills.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 服装 */}
          {templateData.dresscode.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Shirt className="w-4 h-4 text-gray-400" />
                <h5 className="text-sm font-medium">服装・身だしなみ</h5>
              </div>
              <div className="flex flex-wrap gap-1">
                {templateData.dresscode.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 持ち物 */}
          {templateData.belongings.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-gray-400" />
                <h5 className="text-sm font-medium">持ち物・その他</h5>
              </div>
              <div className="flex flex-wrap gap-1">
                {templateData.belongings.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-4 py-3 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
