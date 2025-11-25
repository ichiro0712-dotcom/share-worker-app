'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

type QualificationType =
  | '介護福祉士'
  | '実務者研修修了者'
  | '介護職員初任者研修修了者（旧ヘルパー2級）'
  | '介護職員基礎研修修了者'
  | '正看護師'
  | '准看護師'
  | '資格なし';

export default function Qualifications() {
  const router = useRouter();
  const [selectedQualifications, setSelectedQualifications] = useState<QualificationType[]>([]);
  const [experienceYears, setExperienceYears] = useState('');
  const [specialSkills, setSpecialSkills] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const qualifications: QualificationType[] = [
    '介護福祉士',
    '実務者研修修了者',
    '介護職員初任者研修修了者（旧ヘルパー2級）',
    '介護職員基礎研修修了者',
    '正看護師',
    '准看護師',
    '資格なし',
  ];

  const skills = [
    '移乗介助',
    '入浴介助',
    '食事介助',
    '排泄介助',
    'バイタル測定',
    '服薬管理',
    '記録作成',
    'レクリエーション',
    '認知症ケア',
    '看取りケア',
  ];

  const handleQualificationToggle = (qualification: QualificationType) => {
    if (qualification === '資格なし') {
      // 「資格なし」を選択した場合は他の資格をクリア
      setSelectedQualifications(['資格なし']);
    } else {
      setSelectedQualifications(prev => {
        // 「資格なし」が含まれていたら除外
        const filtered = prev.filter(q => q !== '資格なし');

        if (filtered.includes(qualification)) {
          return filtered.filter(q => q !== qualification);
        } else {
          return [...filtered, qualification];
        }
      });
    }

    // エラーをクリア
    if (errors.qualifications) {
      setErrors(prev => ({ ...prev, qualifications: '' }));
    }
  };

  const handleSkillToggle = (skill: string) => {
    setSpecialSkills(prev => {
      if (prev.includes(skill)) {
        return prev.filter(s => s !== skill);
      } else {
        return [...prev, skill];
      }
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (selectedQualifications.length === 0) {
      newErrors.qualifications = '資格を選択してください（資格がない場合は「資格なし」を選択）';
    }

    if (!experienceYears) {
      newErrors.experienceYears = '経験年数を選択してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      // 実際のアプリでは、ここでAPIを呼び出してユーザー登録を完了します
      toast.success('会員登録が完了しました！');
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold">新規会員登録</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="max-w-md mx-auto px-4 py-6">
        {/* ステップインジケーター */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                ✓
              </div>
              <span className="ml-2 text-sm text-gray-500">基本情報</span>
            </div>
            <div className="flex-1 h-0.5 bg-primary mx-2"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <span className="ml-2 text-sm font-bold text-primary">資格情報</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 資格選択 */}
          <div>
            <label className="block text-sm font-bold mb-3">
              保有資格 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {qualifications.map((qualification) => (
                <label
                  key={qualification}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedQualifications.includes(qualification)
                      ? 'border-primary bg-primary-light/20'
                      : 'border-gray-300 hover:border-primary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedQualifications.includes(qualification)}
                    onChange={() => handleQualificationToggle(qualification)}
                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="ml-3 text-sm">{qualification}</span>
                </label>
              ))}
            </div>
            {errors.qualifications && (
              <p className="mt-2 text-sm text-red-500">{errors.qualifications}</p>
            )}
          </div>

          {/* 経験年数 */}
          <div>
            <label htmlFor="experienceYears" className="block text-sm font-bold mb-2">
              経験年数 <span className="text-red-500">*</span>
            </label>
            <select
              id="experienceYears"
              value={experienceYears}
              onChange={(e) => {
                setExperienceYears(e.target.value);
                if (errors.experienceYears) {
                  setErrors(prev => ({ ...prev, experienceYears: '' }));
                }
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.experienceYears ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">選択してください</option>
              <option value="未経験">未経験</option>
              <option value="1年未満">1年未満</option>
              <option value="1年以上3年未満">1年以上3年未満</option>
              <option value="3年以上5年未満">3年以上5年未満</option>
              <option value="5年以上10年未満">5年以上10年未満</option>
              <option value="10年以上">10年以上</option>
            </select>
            {errors.experienceYears && (
              <p className="mt-1 text-sm text-red-500">{errors.experienceYears}</p>
            )}
          </div>

          {/* 得意なスキル（任意） */}
          <div>
            <label className="block text-sm font-bold mb-3">
              得意なスキル・業務内容 <span className="text-gray-500 text-xs">（任意）</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSkillToggle(skill)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    specialSkills.includes(skill)
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          {/* 登録完了ボタン */}
          <Button type="submit" size="lg" className="w-full">
            登録完了
          </Button>
        </form>

        {/* 注意事項 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-gray-600">
            ※ 資格情報は後から変更・追加することができます
          </p>
          <p className="text-xs text-gray-600 mt-1">
            ※ より正確な情報を登録いただくことで、適切な求人をご紹介できます
          </p>
        </div>
      </div>
    </div>
  );
}
