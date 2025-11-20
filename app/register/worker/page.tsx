'use client';

import { useState } from 'react';
import { Upload, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WorkerRegisterPage() {
  const [formData, setFormData] = useState({
    // 1. 基本情報
    lastName: '山田',
    firstName: '太郎',
    lastNameKana: 'ヤマダ',
    firstNameKana: 'タロウ',
    birthDate: '1990-04-15',
    gender: '男性',
    nationality: '日本',

    // 2. 連絡先情報
    phone: '090-1234-5678',
    email: 'yamada.taro@example.com',
    postalCode: '123-4567',
    prefecture: '東京都',
    city: '新宿区',
    address: '西新宿1-2-3',
    building: 'サンプルマンション101',

    // 3. 資格・経験
    qualifications: ['介護福祉士', '介護職員実務者研修'] as string[],
    experienceFields: ['特別養護老人ホーム', 'デイサービス'] as string[],
    currentWorkStyle: '正社員',
    desiredWorkStyle: 'パート・アルバイト',
    jobChangeMotivation: 'より柔軟な働き方を求めて転職を希望しています。',

    // 4. 職歴（任意）
    workHistory1: '2018年4月〜2021年3月 特別養護老人ホームさくら 介護職員',
    workHistory2: '2021年4月〜2023年12月 デイサービスひまわり 介護福祉士',
    workHistory3: '',

    // 5. 自己PR（任意）
    selfPR: '介護福祉士として5年以上の経験があります。利用者様一人ひとりに寄り添った介護を心がけています。',

    // 6. 銀行口座情報（任意）
    bankName: 'サンプル銀行',
    branchName: '新宿支店',
    accountName: 'ヤマダ タロウ',
    accountNumber: '1234567',

    // 7. その他（任意）
    pensionNumber: '1234-567890',
    loginEmail: 'yamada.taro@example.com',

    // 8. ざっくり登録情報（任意）
    desiredWorkDaysPerWeek: '3',
    desiredWorkHoursPerDay: '6',
    desiredWorkDays: ['月', '水', '金'] as string[],
    desiredStartTime: '09:00',
    desiredEndTime: '15:00',

    // 10. 同意事項
    agreeElectronicDelivery: true,
    agreeTerms: true,
    agreeConsent: true,

    // 11. 担当情報
    staffNumber: 'ST001',
    staffName: '佐藤 花子',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // TODO: API送信処理
    alert('登録が完了しました');
  };

  const handleCancel = () => {
    if (confirm('入力内容が失われますが、よろしいですか？')) {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">新規ワーカー登録</h1>
          <p className="text-gray-600 mb-8">
            新しいワーカーを登録します
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. 基本情報 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">基本情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓（カナ） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastNameKana}
                    onChange={(e) => setFormData({ ...formData, lastNameKana: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名（カナ） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstNameKana}
                    onChange={(e) => setFormData({ ...formData, firstNameKana: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    生年月日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    性別 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    国籍 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 2. 連絡先情報 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">連絡先情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    郵便番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    都道府県 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.prefecture}
                    onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    市区町村 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    番地・号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    建物名
                  </label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 3. 資格・経験 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">資格・経験</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  保有資格 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {qualificationsList.map((qual) => (
                    <label key={qual} className="flex items-center gap-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  経験分野 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {experienceFieldsList.map((field) => (
                    <label key={field} className="flex items-center gap-2">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    現在の働き方
                  </label>
                  <select
                    value={formData.currentWorkStyle}
                    onChange={(e) => setFormData({ ...formData, currentWorkStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    <option value="fulltime">正社員</option>
                    <option value="parttime">パート・アルバイト</option>
                    <option value="contract">契約社員</option>
                    <option value="unemployed">無職</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    希望の働き方
                  </label>
                  <select
                    value={formData.desiredWorkStyle}
                    onChange={(e) => setFormData({ ...formData, desiredWorkStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    <option value="fulltime">正社員</option>
                    <option value="parttime">パート・アルバイト</option>
                    <option value="contract">契約社員</option>
                    <option value="dispatch">派遣</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    転職意欲
                  </label>
                  <select
                    value={formData.jobChangeMotivation}
                    onChange={(e) => setFormData({ ...formData, jobChangeMotivation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    <option value="high">高い</option>
                    <option value="medium">中程度</option>
                    <option value="low">低い</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. 職歴（任意） */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">職歴（任意）</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">職歴1</label>
                  <input
                    type="text"
                    value={formData.workHistory1}
                    onChange={(e) => setFormData({ ...formData, workHistory1: e.target.value })}
                    placeholder="例：○○介護施設 介護職員（2020年4月〜2022年3月）"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">職歴2</label>
                  <input
                    type="text"
                    value={formData.workHistory2}
                    onChange={(e) => setFormData({ ...formData, workHistory2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">職歴3</label>
                  <input
                    type="text"
                    value={formData.workHistory3}
                    onChange={(e) => setFormData({ ...formData, workHistory3: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 5. 自己PR（任意） */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">自己PR（任意）</h3>
              <div>
                <textarea
                  value={formData.selfPR}
                  onChange={(e) => setFormData({ ...formData, selfPR: e.target.value })}
                  rows={5}
                  placeholder="自己PRを入力してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* 6. 銀行口座情報（任意） */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">銀行口座情報（任意）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">支店名</label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">口座名義</label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 7. その他（任意） */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">その他（任意）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年金番号</label>
                  <input
                    type="text"
                    value={formData.pensionNumber}
                    onChange={(e) => setFormData({ ...formData, pensionNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ログイン用メール</label>
                  <input
                    type="email"
                    value={formData.loginEmail}
                    onChange={(e) => setFormData({ ...formData, loginEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 8. ざっくり登録情報（任意） */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">ざっくり登録情報（任意）</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">週の希望勤務日数</label>
                  <select
                    value={formData.desiredWorkDaysPerWeek}
                    onChange={(e) => setFormData({ ...formData, desiredWorkDaysPerWeek: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    <option value="1">週1日</option>
                    <option value="2">週2日</option>
                    <option value="3">週3日</option>
                    <option value="4">週4日</option>
                    <option value="5">週5日</option>
                    <option value="6">週6日</option>
                    <option value="7">週7日</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1日の希望勤務時間</label>
                  <select
                    value={formData.desiredWorkHoursPerDay}
                    onChange={(e) => setFormData({ ...formData, desiredWorkHoursPerDay: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    <option value="4">4時間</option>
                    <option value="6">6時間</option>
                    <option value="8">8時間</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">希望勤務曜日</label>
                <div className="flex flex-wrap gap-3">
                  {weekDays.map((day) => (
                    <label key={day} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.desiredWorkDays.includes(day)}
                        onChange={() => handleCheckboxChange('desiredWorkDays', day)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm">{day}曜日</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">希望開始時間</label>
                  <input
                    type="time"
                    value={formData.desiredStartTime}
                    onChange={(e) => setFormData({ ...formData, desiredStartTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">希望終了時間</label>
                  <input
                    type="time"
                    value={formData.desiredEndTime}
                    onChange={(e) => setFormData({ ...formData, desiredEndTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 9. 書類アップロード（任意） */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-gray-700" />
                <h3 className="font-bold text-gray-900">書類アップロード（任意）</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">通帳コピー</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">資格証明写真</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">身分証明書1</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">身分証明書2</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 10. 同意事項 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">同意事項</h3>
              <div className="space-y-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    required
                    checked={formData.agreeElectronicDelivery}
                    onChange={(e) => setFormData({ ...formData, agreeElectronicDelivery: e.target.checked })}
                    className="w-4 h-4 mt-1 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm">
                    電子交付に同意します <span className="text-red-500">*</span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    required
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    className="w-4 h-4 mt-1 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm">
                    <Link href="/admin/terms" target="_blank" className="text-primary hover:underline">利用規約</Link>に同意します <span className="text-red-500">*</span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    required
                    checked={formData.agreeConsent}
                    onChange={(e) => setFormData({ ...formData, agreeConsent: e.target.checked })}
                    className="w-4 h-4 mt-1 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm">
                    同意書を確認しました <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>
            </div>

            {/* 11. 担当情報 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">担当情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.staffNumber}
                    onChange={(e) => setFormData({ ...formData, staffNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.staffName}
                    onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md transition-colors"
              >
                登録
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
