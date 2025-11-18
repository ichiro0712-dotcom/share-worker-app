'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Star } from 'lucide-react';
import { facilities } from '@/data/facilities';
import { useAuth } from '@/contexts/AuthContext';

export default function NewReview({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [formData, setFormData] = useState({
    period: '',
    goodPoints: '',
    improvements: '',
  });

  const facilityId = parseInt(id);
  const facility = facilities.find((f) => f.id === facilityId);

  // ログインしていない場合はログインページへリダイレクト
  useEffect(() => {
    if (!isAuthenticated) {
      alert('レビューを投稿するにはログインが必要です');
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // ログインしていない、またはユーザー情報がない場合は何も表示しない
  if (!isAuthenticated || !user) {
    return null;
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>施設が見つかりません</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      alert('総合評価を選択してください');
      return;
    }

    if (!formData.period) {
      alert('勤務期間を選択してください');
      return;
    }

    if (!formData.goodPoints) {
      alert('良かった点を入力してください');
      return;
    }

    if (!formData.improvements) {
      alert('改善点を入力してください');
      return;
    }

    // 実際にはここでAPIにデータを送信
    alert('レビューを投稿しました！');
    router.push(`/facilities/${facilityId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">レビュー投稿</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* 施設情報 */}
      <div className="bg-white p-4 mb-4">
        <h2 className="font-bold text-lg mb-2">{facility.name}</h2>
        <p className="text-sm text-gray-600">{facility.address}</p>
      </div>

      {/* ログインユーザー情報表示 */}
      <div className="bg-gray-50 p-4 mb-4 mx-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-1">投稿者情報</p>
        <div className="flex gap-3 text-sm">
          <span className="text-gray-700">{user.age}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-700">{user.gender}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-700">{user.occupation}</span>
        </div>
      </div>

      {/* レビューフォーム */}
      <form onSubmit={handleSubmit} className="bg-white p-4 mb-4">
        {/* 総合評価 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">
            総合評価 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    value <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-lg font-semibold text-primary">
                {rating}.0
              </span>
            )}
          </div>
        </div>

        {/* 勤務期間 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            勤務期間 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.period}
            onChange={(e) =>
              setFormData({ ...formData, period: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
            <option value="">選択してください</option>
            <option value="1ヶ月以内">1ヶ月以内</option>
            <option value="3ヶ月以内">3ヶ月以内</option>
            <option value="6ヶ月以内">6ヶ月以内</option>
            <option value="1年以内">1年以内</option>
            <option value="1年以上">1年以上</option>
          </select>
        </div>

        {/* 良かった点 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            良かった点 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.goodPoints}
            onChange={(e) =>
              setFormData({ ...formData, goodPoints: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            rows={5}
            placeholder="この施設で働いて良かった点を具体的に教えてください"
            required
          />
        </div>

        {/* 改善点 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            改善点 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.improvements}
            onChange={(e) =>
              setFormData({ ...formData, improvements: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            rows={5}
            placeholder="改善が必要だと感じた点を具体的に教えてください"
            required
          />
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          レビューを投稿する
        </button>
      </form>

      {/* 注意事項 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mx-4">
        <h3 className="font-semibold text-sm text-yellow-800 mb-2">
          投稿時の注意事項
        </h3>
        <ul className="text-xs text-yellow-700 space-y-1">
          <li>• 個人を特定できる情報は記載しないでください</li>
          <li>• 誹謗中傷や不適切な表現は控えてください</li>
          <li>• 投稿内容は運営側で確認後、公開されます</li>
          <li>• 一度投稿したレビューは編集・削除できません</li>
        </ul>
      </div>
    </div>
  );
}
