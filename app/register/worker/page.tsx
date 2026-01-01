'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage, MAX_FILE_SIZE, formatFileSize } from '@/utils/fileValidation';
import { formatKatakana, formatPhoneNumber, isValidEmail, isValidPhoneNumber, isKatakanaOnly } from '@/utils/inputValidation';
import AddressSelector from '@/components/ui/AddressSelector';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

export default function WorkerRegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showDebugError } = useDebugError();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // バリデーションエラー表示用（送信時にtrueになる）
  const [showErrors, setShowErrors] = useState(false);
  const [formData, setFormData] = useState({
    // 基本情報
    lastName: '',
    firstName: '',
    birthDate: '1980-01-01',
    gender: '',
    nationality: '',

    // メールアドレス
    email: '',
    emailConfirm: '',  // メールアドレス確認用

    // 郵便番号
    postalCode: '',
    prefecture: '',
    city: '',
    address: '',
    building: '',

    // 電話番号
    phoneNumber: '',

    // 資格情報
    qualifications: [] as string[],

    // パスワード
    password: '',
    passwordConfirm: '',

    // フリガナ
    lastNameKana: '',
    firstNameKana: '',
  });

  // 経験情報（プロフィール編集と同じ形式）
  const [experienceFields, setExperienceFields] = useState<string[]>([]);
  const [experienceYearsMap, setExperienceYearsMap] = useState<Record<string, string>>({});
  const [workHistories, setWorkHistories] = useState<string[]>(['']);

  // 経験分野リスト
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

  // 経験年数オプション
  const experienceYearOptions = [
    '1年未満',
    '1〜2年',
    '3〜5年',
    '5〜10年',
    '10年以上',
  ];

  // 経験分野チェックボックスハンドラ
  const handleExperienceFieldChange = (field: string) => {
    if (experienceFields.includes(field)) {
      setExperienceFields(experienceFields.filter(f => f !== field));
      const newYears = { ...experienceYearsMap };
      delete newYears[field];
      setExperienceYearsMap(newYears);
    } else {
      setExperienceFields([...experienceFields, field]);
    }
  };

  // 経験年数変更ハンドラ
  const handleExperienceYearChange = (field: string, value: string) => {
    setExperienceYearsMap(prev => ({ ...prev, [field]: value }));
  };

  // 職歴追加
  const addWorkHistory = () => {
    if (workHistories.length < 5) {
      setWorkHistories([...workHistories, '']);
    }
  };

  // 職歴削除
  const removeWorkHistory = (index: number) => {
    setWorkHistories(workHistories.filter((_, i) => i !== index));
  };

  // 職歴更新
  const updateWorkHistory = (index: number, value: string) => {
    const newHistories = [...workHistories];
    newHistories[index] = value;
    setWorkHistories(newHistories);
  };

  // 資格証明書の状態管理
  const [qualificationCertificates, setQualificationCertificates] = useState<Record<string, string | null>>({});

  const handleCheckboxChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(value)
        ? prev.qualifications.filter(item => item !== value)
        : [...prev.qualifications, value]
    }));
  };

  // 圧縮中の状態管理
  const [compressingQual, setCompressingQual] = useState<string | null>(null);

  const handleQualificationCertificateChange = async (qualification: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（20MB）
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`ファイルサイズが大きすぎます（${formatFileSize(file.size)}）。20MB以下にしてください。`);
      return;
    }

    try {
      setCompressingQual(qualification);
      toast.loading('画像を圧縮中...', { id: 'compress' });

      const compressedData = await compressImage(file);

      setQualificationCertificates(prev => ({
        ...prev,
        [qualification]: compressedData
      }));

      toast.success('画像を圧縮しました', { id: 'compress' });
    } catch (error) {
      toast.error('画像の処理中にエラーが発生しました', { id: 'compress' });
    } finally {
      setCompressingQual(null);
    }
  };

  // バリデーション関数はutils/inputValidation.tsからインポート

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーションエラー表示を有効化
    setShowErrors(true);

    // 画像圧縮中は送信しない
    if (compressingQual) {
      toast.error('画像を圧縮中です。完了までお待ちください。');
      return;
    }

    // 必須フィールドのバリデーション
    const errors: string[] = [];

    if (!formData.lastName) errors.push('姓');
    if (!formData.firstName) errors.push('名');
    if (!formData.lastNameKana) errors.push('セイ（フリガナ）');
    if (!formData.firstNameKana) errors.push('メイ（フリガナ）');
    if (!formData.gender) errors.push('性別');
    if (!formData.nationality) errors.push('国籍');
    if (!formData.email) errors.push('メールアドレス');
    if (!formData.emailConfirm) errors.push('メールアドレス（確認）');
    if (!formData.phoneNumber) errors.push('電話番号');
    if (!formData.prefecture) errors.push('都道府県');
    if (!formData.city) errors.push('市区町村');
    if (!formData.password) errors.push('パスワード');
    if (!formData.passwordConfirm) errors.push('パスワード（確認）');

    if (errors.length > 0) {
      toast.error(`以下の項目を入力してください: ${errors.join('、')}`);
      return;
    }

    // パスワード確認
    if (formData.password !== formData.passwordConfirm) {
      toast.error('パスワードが一致しません');
      return;
    }

    // メールアドレス一致確認
    if (formData.email !== formData.emailConfirm) {
      toast.error('メールアドレスが一致しません');
      return;
    }

    // メールアドレス形式チェック
    if (!isValidEmail(formData.email)) {
      toast.error('メールアドレスの形式が正しくありません');
      return;
    }

    // 資格が選択されているか確認
    if (formData.qualifications.length === 0) {
      toast.error('少なくとも1つの資格を選択してください');
      return;
    }

    // 電話番号形式チェック
    if (!isValidPhoneNumber(formData.phoneNumber)) {
      toast.error('電話番号は10桁または11桁の数字で入力してください（ハイフン可）');
      return;
    }

    // フリガナのカタカナチェック
    if (!isKatakanaOnly(formData.lastNameKana)) {
      toast.error('セイ（フリガナ）はカタカナで入力してください');
      return;
    }
    if (!isKatakanaOnly(formData.firstNameKana)) {
      toast.error('メイ（フリガナ）はカタカナで入力してください');
      return;
    }

    // 経験分野確認
    if (experienceFields.length === 0) {
      toast.error('少なくとも1つの経験分野を選択してください');
      return;
    }

    // 資格証明書の確認（「その他」以外の資格は証明書必須）
    const qualificationsNeedingCertificates = formData.qualifications.filter(qual => qual !== 'その他');
    const missingCertificates = qualificationsNeedingCertificates.filter(qual => !qualificationCertificates[qual]);
    if (missingCertificates.length > 0) {
      toast.error(`以下の資格の証明書をアップロードしてください: ${missingCertificates.join('、')}`);
      return;
    }

    setIsSubmitting(true);

    // 経験分野と経験年数をexperience_fieldsの形式に変換
    const experienceFieldsData: Record<string, string> = {};
    experienceFields.forEach(field => {
      experienceFieldsData[field] = experienceYearsMap[field] || '';
    });

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: `${formData.lastName} ${formData.firstName}`,
          phoneNumber: formData.phoneNumber,
          birthDate: formData.birthDate,
          qualifications: formData.qualifications,
          lastNameKana: formData.lastNameKana,
          firstNameKana: formData.firstNameKana,
          gender: formData.gender,
          nationality: formData.nationality,
          postalCode: formData.postalCode,
          prefecture: formData.prefecture,
          city: formData.city,
          addressLine: formData.address,
          building: formData.building,
          experienceFields: experienceFieldsData,
          workHistories: workHistories.filter(h => h.trim() !== ''),
          qualificationCertificates: qualificationCertificates,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '登録に失敗しました');
      }

      // 自動ログイン
      const loginResult = await login(formData.email, formData.password);
      console.log('[Registration] Auto-login result:', loginResult);

      if (loginResult.success) {
        toast.success('登録完了！求人を検索できます');
        router.push('/');
        router.refresh();
      } else {
        console.error('[Registration] Auto-login failed:', loginResult.error);
        toast.error('登録は完了しましたが、自動ログインに失敗しました。ログイン画面からログインしてください。');
        router.push('/login');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: 'ワーカー新規登録',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: {
          email: formData.email,
          name: `${formData.lastName} ${formData.firstName}`,
          qualificationsCount: formData.qualifications.length,
          experienceFieldsCount: experienceFields.length,
        }
      });
      toast.error(error instanceof Error ? error.message : '登録中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
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
                {/* 姓名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="山田"
                  />
                  {showErrors && !formData.lastName && (
                    <p className="text-red-500 text-xs mt-1">姓を入力してください</p>
                  )}
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="太郎"
                  />
                  {showErrors && !formData.firstName && (
                    <p className="text-red-500 text-xs mt-1">名を入力してください</p>
                  )}
                </div>
                {/* フリガナ（姓名の直後） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    セイ（フリガナ） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastNameKana}
                    onChange={(e) => setFormData({ ...formData, lastNameKana: formatKatakana(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.lastNameKana ? 'border-red-500 bg-red-50' : formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="ヤマダ"
                  />
                  {showErrors && !formData.lastNameKana && (
                    <p className="text-red-500 text-xs mt-1">セイ（フリガナ）を入力してください</p>
                  )}
                  {formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana) && (
                    <p className="text-red-500 text-xs mt-1">カタカナで入力してください</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">※カタカナで入力（ひらがなは自動変換）</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メイ（フリガナ） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstNameKana}
                    onChange={(e) => setFormData({ ...formData, firstNameKana: formatKatakana(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.firstNameKana ? 'border-red-500 bg-red-50' : formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="タロウ"
                  />
                  {showErrors && !formData.firstNameKana && (
                    <p className="text-red-500 text-xs mt-1">メイ（フリガナ）を入力してください</p>
                  )}
                  {formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana) && (
                    <p className="text-red-500 text-xs mt-1">カタカナで入力してください</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">※カタカナで入力（ひらがなは自動変換）</p>
                </div>
                {/* 生年月日・性別 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    生年月日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.birthDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    性別（出生時） <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.gender ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  >
                    <option value="">選択してください</option>
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                  </select>
                  {showErrors && !formData.gender && (
                    <p className="text-red-500 text-xs mt-1">性別を選択してください</p>
                  )}
                </div>
                {/* 国籍（ドロップダウン） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    国籍 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.nationality ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  >
                    <option value="">選択してください</option>
                    <option value="日本">日本</option>
                    <option value="その他">その他</option>
                  </select>
                  {showErrors && !formData.nationality && (
                    <p className="text-red-500 text-xs mt-1">国籍を選択してください</p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. 連絡先情報 */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900">連絡先情報 <span className="text-red-500">*</span></h3>

              {/* メールアドレス（2段構成） */}
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.email ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="example@email.com"
                  />
                  {showErrors && !formData.email && (
                    <p className="text-red-500 text-xs mt-1">メールアドレスを入力してください</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス（確認） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.emailConfirm}
                    onChange={(e) => setFormData({ ...formData, emailConfirm: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.emailConfirm ? 'border-red-500 bg-red-50' : formData.emailConfirm && formData.email !== formData.emailConfirm ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="確認のため再入力"
                  />
                  {showErrors && !formData.emailConfirm && (
                    <p className="text-red-500 text-xs mt-1">メールアドレス（確認）を入力してください</p>
                  )}
                  {formData.emailConfirm && formData.email !== formData.emailConfirm && (
                    <p className="text-red-500 text-xs mt-1">メールアドレスが一致しません</p>
                  )}
                  {formData.emailConfirm && formData.email === formData.emailConfirm && (
                    <p className="text-green-600 text-xs mt-1">✓ 一致しています</p>
                  )}
                </div>
              </div>

              {/* 電話番号 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: formatPhoneNumber(e.target.value) })}
                    placeholder="090-1234-5678"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.phoneNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  />
                  {showErrors && !formData.phoneNumber && (
                    <p className="text-red-500 text-xs mt-1">電話番号を入力してください</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">※数字のみ入力（ハイフンは自動挿入）</p>
                </div>
              </div>

              {/* 住所は独立したセクション */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  住所 <span className="text-red-500">*</span>
                </label>
                <AddressSelector
                  prefecture={formData.prefecture}
                  city={formData.city}
                  addressLine={formData.address}
                  building={formData.building}
                  postalCode={formData.postalCode}
                  onChange={(data) => setFormData({
                    ...formData,
                    prefecture: data.prefecture,
                    city: data.city,
                    address: data.addressLine || '',
                    building: data.building || '',
                    postalCode: data.postalCode || ''
                  })}
                  required={true}
                  showErrors={showErrors}
                />
              </div>
            </div>

            {/* 3. 資格情報 */}
            <div className={`p-4 bg-gray-50 rounded-lg border space-y-4 ${showErrors && formData.qualifications.length === 0 ? 'border-red-500' : 'border-gray-200'}`}>
              <h3 className="font-bold text-gray-900">資格情報 <span className="text-red-500">*</span></h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  保有資格 <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  ※保有している資格にチェックを入れ、<span className="font-bold text-red-500">必ず</span>資格証明書の写真を添付してください。
                </p>
                {QUALIFICATION_GROUPS.map((group) => (
                  <div key={group.name} className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {group.qualifications.map((qual) => (
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
                ))}
                {showErrors && formData.qualifications.length === 0 && (
                  <p className="text-red-500 text-xs mt-1">少なくとも1つの資格を選択してください</p>
                )}
              </div>

              {/* 資格証明書アップロード - 選択された資格（その他以外）の数だけ表示 */}
              {formData.qualifications.filter(qual => qual !== 'その他').length > 0 && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">資格証明書アップロード <span className="text-red-500">*</span></label>
                  {formData.qualifications.filter(qual => qual !== 'その他').map((qual) => (
                    <div key={qual} className={`border rounded-lg p-4 ${showErrors && !qualificationCertificates[qual] ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                      <label className="block text-sm font-medium text-gray-700 mb-3">{qual}</label>

                      {/* 既存の証明書がある場合はプレビュー表示 */}
                      {qualificationCertificates[qual] ? (
                        <div className="flex flex-col gap-3">
                          {/* 画像プレビュー */}
                          <div className="relative w-full h-48 sm:h-40 border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={qualificationCertificates[qual]!}
                              alt={`${qual}の証明書`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <p className="text-xs text-green-600">✓ 登録済み</p>
                          {/* 変更ボタン */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-center text-sm font-medium">
                              画像を変更
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => handleQualificationCertificateChange(qual, e)}
                                className="hidden"
                              />
                            </label>
                            <p className="text-xs text-gray-500">20MB以下 / JPG, PNG, HEIC, PDF形式（自動圧縮）</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className={`block w-full px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer text-center text-sm font-medium border-2 border-dashed ${showErrors ? 'bg-red-50 text-red-700 border-red-300' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            📷 ファイルを選択
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleQualificationCertificateChange(qual, e)}
                              className="hidden"
                              required
                            />
                          </label>
                          <p className="text-xs text-gray-500 text-center">20MB以下 / JPG, PNG, HEIC, PDF形式（自動圧縮）</p>
                          {showErrors && (
                            <p className="text-red-500 text-xs text-center">資格証明書をアップロードしてください</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 経験セクション */}
            <div className={`p-4 bg-gray-50 rounded-lg border space-y-4 ${showErrors && experienceFields.length === 0 ? 'border-red-500' : 'border-gray-200'}`}>
              <h3 className="font-bold text-gray-900">経験・職歴 <span className="text-red-500">*</span></h3>

              {/* 経験分野チェックボックス */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  経験分野 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">※複数選択できます</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {experienceFieldsList.map((field) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={experienceFields.includes(field)}
                        onChange={() => handleExperienceFieldChange(field)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm">{field}</span>
                    </label>
                  ))}
                </div>
                {showErrors && experienceFields.length === 0 && (
                  <p className="text-red-500 text-xs mt-2">少なくとも1つの経験分野を選択してください</p>
                )}
              </div>

              {/* 選択された経験分野の経験年数入力 */}
              {experienceFields.length > 0 && (
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">経験年数</label>
                  <div className="space-y-3">
                    {experienceFields.map((field) => (
                      <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <span className="text-sm sm:min-w-[180px] font-medium">{field}</span>
                        <select
                          value={experienceYearsMap[field] || ''}
                          onChange={(e) => handleExperienceYearChange(field, e.target.value)}
                          className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        >
                          <option value="">選択してください</option>
                          {experienceYearOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 職歴（任意） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  職歴 <span className="text-gray-500 text-xs">（任意）</span>
                </label>
                <div className="space-y-3">
                  {workHistories.map((history, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={history}
                        onChange={(e) => updateWorkHistory(index, e.target.value)}
                        placeholder="例：2018年4月〜2021年3月 ◯◯施設 介護職員"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      {workHistories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorkHistory(index)}
                          className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {workHistories.length < 5 && (
                  <button
                    type="button"
                    onClick={addWorkHistory}
                    className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary hover:text-primary transition-colors text-sm"
                  >
                    + 職歴を追加
                  </button>
                )}
              </div>
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.password ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="8文字以上"
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">8文字以上で入力してください</p>
                  {showErrors && !formData.password && (
                    <p className="text-red-500 text-xs mt-1">パスワードを入力してください</p>
                  )}
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.passwordConfirm ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    placeholder="パスワードを再入力"
                    minLength={8}
                  />
                  {showErrors && !formData.passwordConfirm && (
                    <p className="text-red-500 text-xs mt-1">パスワード（確認）を入力してください</p>
                  )}
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
                disabled={isSubmitting || !!compressingQual}
                className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {compressingQual ? '画像圧縮中...' : isSubmitting ? '登録中...' : '登録'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
