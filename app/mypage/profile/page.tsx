'use client';

import { useState, useRef } from 'react';
import { Upload, ArrowLeft, Plus, X, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfileEditPage() {
  const [profileImage, setProfileImage] = useState<string | null>('/images/sample-profile.jpg');
  const profileImageInputRef = useRef<HTMLInputElement>(null);

  const [workHistories, setWorkHistories] = useState<string[]>([
    '2018年4月〜2021年3月 特別養護老人ホームさくら 介護職員',
    '2021年4月〜2023年12月 デイサービスひまわり 介護福祉士',
  ]);

  const [formData, setFormData] = useState({
    // 1. 基本情報
    lastName: '山田',
    firstName: '太郎',
    lastNameKana: 'ヤマダ',
    firstNameKana: 'タロウ',
    birthDate: '1990-04-15',
    gender: '男性',
    nationality: '日本',

    // 2. 働き方と希望
    currentWorkStyle: '正社員',
    desiredWorkStyle: 'パート・アルバイト',
    jobChangeMotivation: 'より柔軟な働き方を求めて転職を希望しています。',

    // 3. 連絡先情報
    phone: '090-1234-5678',
    email: 'yamada.taro@example.com',
    postalCode: '123-4567',
    prefecture: '東京都',
    city: '新宿区',
    address: '西新宿1-2-3',
    building: 'サンプルマンション101',

    // 4. 資格・経験
    qualifications: ['介護福祉士', '介護職員実務者研修'] as string[],
    experienceFields: ['特別養護老人ホーム', 'デイサービス'] as string[],

    // 5. 自己PR
    selfPR: '介護福祉士として5年以上の経験があります。利用者様一人ひとりに寄り添った介護を心がけています。',

    // 6. 銀行口座情報
    bankName: 'サンプル銀行',
    branchName: '新宿支店',
    accountName: 'ヤマダ タロウ',
    accountNumber: '1234567',

    // 7. その他
    pensionNumber: '1234-567890',
    loginEmail: 'yamada.taro@example.com',

    // 8. ざっくり登録情報
    desiredWorkDaysPerWeek: '3',
    desiredWorkHoursPerDay: '6',
    desiredWorkDays: ['月', '水', '金'] as string[],
    desiredStartTime: '09:00',
    desiredEndTime: '15:00',
  });

  const qualificationsList = [
    '介護福祉士',
    '介護職員初任者研修',
    '介護職員実務者研修',
    'ケアマネージャー',
    '社会福祉士',
    '看護師',
    '准看護師',
    'その他',
  ];

  const experienceFieldsList = [
    '特別養護老人ホーム',
    '介護老人保健施設',
    'グループホーム',
    'デイサービス',
    '訪問介護',
    '有料老人ホーム',
    'サービス付き高齢者向け住宅',
    'その他',
  ];

  const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

  const handleCheckboxChange = (field: 'qualifications' | 'experienceFields' | 'desiredWorkDays', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addWorkHistory = () => {
    if (workHistories.length < 5) {
      setWorkHistories([...workHistories, '']);
    }
  };

  const removeWorkHistory = (index: number) => {
    setWorkHistories(workHistories.filter((_, i) => i !== index));
  };

  const updateWorkHistory = (index: number, value: string) => {
    const newHistories = [...workHistories];
    newHistories[index] = value;
    setWorkHistories(newHistories);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('プロフィールを更新しました');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/mypage" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold">プロフィール編集</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-6">
        {/* プロフィール画像 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">プロフィール画像</h2>

          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-16 h-16 text-gray-400" />
              )}
            </div>

            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfileImageChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => profileImageInputRef.current?.click()}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              画像を変更
            </button>

            <p className="text-xs text-gray-500">推奨サイズ: 400x400px、ファイル形式: JPG, PNG</p>
          </div>
        </section>

        {/* 1. 基本情報 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">1. 基本情報 <span className="text-red-500">*</span></h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">姓 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">姓（カナ） <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.lastNameKana}
                onChange={(e) => setFormData({ ...formData, lastNameKana: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">名（カナ） <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.firstNameKana}
                onChange={(e) => setFormData({ ...formData, firstNameKana: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">生年月日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">性別 <span className="text-red-500">*</span></label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="">選択してください</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">国籍 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>
        </section>

        {/* 2. 働き方と希望 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">2. 働き方と希望 <span className="text-red-500">*</span></h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">現在の働き方 <span className="text-red-500">*</span></label>
                <select
                  value={formData.currentWorkStyle}
                  onChange={(e) => setFormData({ ...formData, currentWorkStyle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">選択してください</option>
                  <option value="正社員">正社員</option>
                  <option value="パート・アルバイト">パート・アルバイト</option>
                  <option value="派遣">派遣</option>
                  <option value="契約社員">契約社員</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">希望の働き方 <span className="text-red-500">*</span></label>
                <select
                  value={formData.desiredWorkStyle}
                  onChange={(e) => setFormData({ ...formData, desiredWorkStyle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">選択してください</option>
                  <option value="正社員">正社員</option>
                  <option value="パート・アルバイト">パート・アルバイト</option>
                  <option value="派遣">派遣</option>
                  <option value="契約社員">契約社員</option>
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">転職動機 <span className="text-red-500">*</span></label>
              <textarea
                value={formData.jobChangeMotivation}
                onChange={(e) => setFormData({ ...formData, jobChangeMotivation: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>
        </section>

        {/* 3. 連絡先情報 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">3. 連絡先情報 <span className="text-red-500">*</span></h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">電話番号 <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">メールアドレス <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">郵便番号 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="123-4567"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">都道府県 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.prefecture}
                onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">市区町村 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">番地 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">建物名・部屋番号</label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* 4. 資格・経験 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">4. 資格・経験 <span className="text-red-500">*</span></h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">保有資格 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {qualificationsList.map((qual) => (
                  <label key={qual} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.qualifications.includes(qual)}
                      onChange={() => handleCheckboxChange('qualifications', qual)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm">{qual}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">経験分野 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {experienceFieldsList.map((field) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.experienceFields.includes(field)}
                      onChange={() => handleCheckboxChange('experienceFields', field)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm">{field}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">資格証明書アップロード</label>
              <input
                type="file"
                accept="image/*,.pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">ファイル形式: JPG, PNG, PDF</p>
            </div>
          </div>
        </section>

        {/* 5. 職歴 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <h2 className="text-lg font-bold">5. 職歴（任意）</h2>
            {workHistories.length < 5 && (
              <button
                type="button"
                onClick={addWorkHistory}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                職歴を追加
              </button>
            )}
          </div>

          <div className="space-y-4">
            {workHistories.map((history, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">職歴{index + 1}</label>
                  <input
                    type="text"
                    value={history}
                    onChange={(e) => updateWorkHistory(index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例：2018年4月〜2021年3月 ◯◯施設 介護職員"
                  />
                </div>
                {workHistories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWorkHistory(index)}
                    className="mt-7 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            {workHistories.length === 0 && (
              <p className="text-sm text-gray-500">職歴を追加してください</p>
            )}
          </div>
        </section>

        {/* 6. 自己PR */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">6. 自己PR（任意）</h2>

          <textarea
            value={formData.selfPR}
            onChange={(e) => setFormData({ ...formData, selfPR: e.target.value })}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="あなたの強みや経験をアピールしてください"
          />
        </section>

        {/* 7. 銀行口座情報 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">7. 銀行口座情報（任意）</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">銀行名</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">支店名</label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">口座名義（カナ）</label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">口座番号</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">通帳コピーアップロード</label>
              <input
                type="file"
                accept="image/*,.pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">ファイル形式: JPG, PNG, PDF</p>
            </div>
          </div>
        </section>

        {/* 8. その他 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">8. その他（任意）</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">年金番号</label>
                <input
                  type="text"
                  value={formData.pensionNumber}
                  onChange={(e) => setFormData({ ...formData, pensionNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="1234-567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">ログイン用メールアドレス</label>
                <input
                  type="email"
                  value={formData.loginEmail}
                  onChange={(e) => setFormData({ ...formData, loginEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">身分証明書アップロード</label>
              <input
                type="file"
                accept="image/*,.pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">運転免許証、マイナンバーカードなど（ファイル形式: JPG, PNG, PDF）</p>
            </div>
          </div>
        </section>

        {/* 9. ざっくり登録情報 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">9. ざっくり登録情報（任意）</h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">希望勤務日数（週）</label>
                <input
                  type="number"
                  value={formData.desiredWorkDaysPerWeek}
                  onChange={(e) => setFormData({ ...formData, desiredWorkDaysPerWeek: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="3"
                  min="1"
                  max="7"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">希望勤務時間（日）</label>
                <input
                  type="number"
                  value={formData.desiredWorkHoursPerDay}
                  onChange={(e) => setFormData({ ...formData, desiredWorkHoursPerDay: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="6"
                  min="1"
                  max="24"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">希望勤務曜日</label>
              <div className="flex gap-3 flex-wrap">
                {weekDays.map((day) => (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.desiredWorkDays.includes(day)}
                      onChange={() => handleCheckboxChange('desiredWorkDays', day)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">希望開始時刻</label>
                <input
                  type="time"
                  value={formData.desiredStartTime}
                  onChange={(e) => setFormData({ ...formData, desiredStartTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">希望終了時刻</label>
                <input
                  type="time"
                  value={formData.desiredEndTime}
                  onChange={(e) => setFormData({ ...formData, desiredEndTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ボタン */}
        <div className="flex gap-4">
          <Link
            href="/mypage"
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors text-center"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors"
          >
            保存する
          </button>
        </div>
      </form>
    </div>
  );
}
