'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WorkerRegisterPage() {
  const [formData, setFormData] = useState({
    // 基本情報
    lastName: '',
    firstName: '',
    birthDate: '',
    gender: '',
    nationality: '',

    // メールアドレス
    email: '',

    // 郵便番号
    postalCode: '',

    // 資格情報
    qualifications: [] as string[],

    // パスワード
    password: '',
    passwordConfirm: '',
  });

  // 資格証明書の状態管理
  const [qualificationCertificates, setQualificationCertificates] = useState<Record<string, string | null>>({});

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

  const handleCheckboxChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(value)
        ? prev.qualifications.filter(item => item !== value)
        : [...prev.qualifications, value]
    }));
  };

  const handleQualificationCertificateChange = (qualification: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setQualificationCertificates(prev => ({
          ...prev,
          [qualification]: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // パスワード確認
    if (formData.password !== formData.passwordConfirm) {
      alert('パスワードが一致しません');
      return;
    }

    // 資格が選択されているか確認
    if (formData.qualifications.length === 0) {
      alert('少なくとも1つの資格を選択してください');
      return;
    }

    console.log('Form submitted:', formData, qualificationCertificates);
    // TODO: API送信処理
    alert('登録が完了しました。ログインして求人検索ができます。');
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
          <Link href="/job-list" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">新規ワーカー登録</h1>
          <p className="text-gray-600 mb-8">
            以下の情報を入力して登録してください。登録後、ログインして求人検索ができます。
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. 基本情報 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">基本情報 <span className="text-red-500">*</span></h3>

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
                    placeholder="山田"
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
                    placeholder="太郎"
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
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                    <option value="その他">その他</option>
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
                    placeholder="日本"
                  />
                </div>
              </div>
            </div>

            {/* 2. メールアドレスと郵便番号 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">連絡先情報 <span className="text-red-500">*</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder="example@email.com"
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
              </div>
            </div>

            {/* 3. 資格情報 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">資格情報 <span className="text-red-500">*</span></h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  保有資格 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {qualificationsList.map((qual) => (
                    <label key={qual} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.qualifications.includes(qual)}
                        onChange={() => handleCheckboxChange(qual)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm">{qual}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 資格証明書アップロード - 選択された資格（その他以外）の数だけ表示 */}
              {formData.qualifications.filter(qual => qual !== 'その他').length > 0 && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">資格証明書アップロード <span className="text-red-500">*</span></label>
                  {formData.qualifications.filter(qual => qual !== 'その他').map((qual) => (
                    <div key={qual} className="border border-gray-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">{qual}</label>

                      {/* 既存の証明書がある場合はプレビュー表示（横並び） */}
                      {qualificationCertificates[qual] ? (
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="relative w-full h-40 border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                              <img
                                src={qualificationCertificates[qual]!}
                                alt={`${qual}の証明書`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-xs text-green-600 mt-1">✓ 登録済み</p>
                          </div>
                          <div className="flex flex-col justify-start">
                            <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-center text-sm font-medium whitespace-nowrap">
                              画像を変更
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => handleQualificationCertificateChange(qual, e)}
                                className="hidden"
                              />
                            </label>
                            <p className="text-xs text-gray-500 mt-2">ファイル形式: JPG, PNG, PDF</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleQualificationCertificateChange(qual, e)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">ファイル形式: JPG, PNG, PDF</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. パスワード設定 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">パスワード設定 <span className="text-red-500">*</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="8文字以上"
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">8文字以上で入力してください</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.passwordConfirm}
                    onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="パスワードを再入力"
                    minLength={8}
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
                className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors font-bold"
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
