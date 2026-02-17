'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { isValidEmail, isValidPhoneNumber } from '@/utils/inputValidation';
import { isKatakanaOnly } from '@/utils/inputValidation';
import { PhoneNumberInput } from '@/components/ui/PhoneNumberInput';
import { KatakanaInput } from '@/components/ui/KatakanaInput';
import { NameWithKanaInput } from '@/components/ui/NameWithKanaInput';
import AddressSelector from '@/components/ui/AddressSelector';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { WORKER_TERMS_OF_SERVICE, TERMS_LAST_UPDATED, WORKER_PRIVACY_POLICY, PRIVACY_LAST_UPDATED } from '@/constants/terms';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';

export default function WorkerRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 py-8"><div className="max-w-xl mx-auto px-4 text-center text-gray-500">読み込み中...</div></div>}>
      <WorkerRegisterPageInner />
    </Suspense>
  );
}

function WorkerRegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showDebugError } = useDebugError();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [formData, setFormData] = useState({
    // ステップ1: アカウント情報・基本情報
    email: '',
    emailConfirm: '',
    phoneNumber: '',
    password: '',
    passwordConfirm: '',
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    birthDate: '',
    // ステップ2: 住所・資格
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    building: '',
    qualifications: [] as string[],
  });

  // LP経由登録情報（localStorage → URLパラメータ のフォールバックチェーン）
  const [lpInfo, setLpInfo] = useState<{ lpId: string | null; campaignCode: string | null; genrePrefix: string | null }>({
    lpId: null,
    campaignCode: null,
    genrePrefix: null,
  });
  const [lpSource, setLpSource] = useState<'localStorage' | 'urlParams' | 'none'>('none');

  // ページロード時にLP情報を取得（localStorage優先、URLパラメータフォールバック）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let fromLocalStorage = false;

      try {
        // 第1優先: localStorage（lp_tracking_data）
        const trackingDataStr = localStorage.getItem('lp_tracking_data');
        if (trackingDataStr) {
          const trackingData = JSON.parse(trackingDataStr);
          if (trackingData.expiry && Date.now() <= trackingData.expiry) {
            setLpInfo({
              lpId: trackingData.lpId || null,
              campaignCode: trackingData.campaignCode || null,
              genrePrefix: trackingData.genrePrefix || null,
            });
            fromLocalStorage = true;
          }
        }
        // 第1優先: localStorage（個別キー）
        if (!fromLocalStorage) {
          const storedLpId = localStorage.getItem('lp_id');
          const storedCampaignCode = localStorage.getItem('lp_campaign_code');
          if (storedLpId) {
            let genrePrefix = null;
            if (storedCampaignCode) {
              const match = storedCampaignCode.match(/^([A-Z]{3})-/);
              if (match) {
                genrePrefix = match[1];
              }
            }
            setLpInfo({
              lpId: storedLpId,
              campaignCode: storedCampaignCode,
              genrePrefix,
            });
            fromLocalStorage = true;
          }
        }
      } catch (e) {
        console.error('Failed to get LP info from localStorage:', e);
      }

      if (fromLocalStorage) {
        setLpSource('localStorage');
        return;
      }

      // 第2優先: URLクエリパラメータ（CTAリンク経由で引き継がれた情報）
      const urlLp = searchParams?.get('lp');
      if (urlLp) {
        setLpInfo({
          lpId: urlLp,
          campaignCode: searchParams?.get('c') || null,
          genrePrefix: searchParams?.get('g') || null,
        });
        setLpSource('urlParams');
      }
    }
  }, [searchParams]);

  // 資格チェックボックスのトグル
  const handleQualificationToggle = (qualification: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(qualification)
        ? prev.qualifications.filter(q => q !== qualification)
        : [...prev.qualifications, qualification],
    }));
  };

  // ステップ1のバリデーション
  const validateStep1 = (): boolean => {
    const errors: string[] = [];

    if (!formData.email) errors.push('メールアドレス');
    if (!formData.emailConfirm) errors.push('メールアドレス（確認）');
    if (!formData.phoneNumber) errors.push('電話番号');
    if (!formData.password) errors.push('パスワード');
    if (!formData.passwordConfirm) errors.push('パスワード（確認）');
    if (!formData.lastName) errors.push('姓');
    if (!formData.firstName) errors.push('名');
    if (!formData.lastNameKana) errors.push('姓（カナ）');
    if (!formData.firstNameKana) errors.push('名（カナ）');
    if (!formData.birthDate) errors.push('生年月日');

    if (errors.length > 0) {
      toast.error(`以下の項目を入力してください: ${errors.join('、')}`);
      return false;
    }

    if (!isValidEmail(formData.email)) {
      toast.error('メールアドレスの形式が正しくありません');
      return false;
    }

    if (formData.email !== formData.emailConfirm) {
      toast.error('メールアドレスが一致しません');
      return false;
    }

    if (!isValidPhoneNumber(formData.phoneNumber)) {
      toast.error('有効な日本の電話番号を入力してください（例: 09012345678）');
      return false;
    }

    if (formData.password.length < 8) {
      toast.error('パスワードは8文字以上で入力してください');
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      toast.error('パスワードが一致しません');
      return false;
    }

    if (formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana)) {
      toast.error('姓（カナ）はカタカナで入力してください');
      return false;
    }

    if (formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana)) {
      toast.error('名（カナ）はカタカナで入力してください');
      return false;
    }

    return true;
  };

  // ステップ1→2への遷移
  const handleNextStep = () => {
    setShowErrors(true);
    if (validateStep1()) {
      setShowErrors(false);
      setCurrentStep(2);
      window.scrollTo(0, 0);
    }
  };

  // ステップ2→1への戻り
  const handlePrevStep = () => {
    setShowErrors(false);
    setCurrentStep(1);
    window.scrollTo(0, 0);
  };

  // 登録送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);

    // ステップ2のバリデーション
    const errors: string[] = [];
    if (!formData.prefecture) errors.push('都道府県');
    if (!formData.city) errors.push('市区町村');
    if (!formData.addressLine) errors.push('番地');
    if (formData.qualifications.length === 0) errors.push('保有資格');

    if (errors.length > 0) {
      toast.error(`以下の項目を入力してください: ${errors.join('、')}`);
      return;
    }

    if (!agreedToTerms) {
      toast.error('利用規約に同意してください');
      const termsSection = document.getElementById('terms-section');
      if (termsSection) {
        termsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!agreedToPrivacy) {
      toast.error('プライバシーポリシーに同意してください');
      const termsSection = document.getElementById('terms-section');
      if (termsSection) {
        termsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          phoneNumber: formData.phoneNumber,
          // 新規追加フィールド
          lastName: formData.lastName,
          firstName: formData.firstName,
          lastNameKana: formData.lastNameKana,
          firstNameKana: formData.firstNameKana,
          birthDate: formData.birthDate,
          postalCode: formData.postalCode,
          prefecture: formData.prefecture,
          city: formData.city,
          addressLine: formData.addressLine,
          building: formData.building,
          qualifications: formData.qualifications,
          // LP経由登録情報（フォールバックチェーン: localStorage → URLパラメータ → サーバーサイドIP照合）
          registrationLpId: lpInfo.lpId,
          registrationCampaignCode: lpInfo.campaignCode,
          registrationGenrePrefix: lpInfo.genrePrefix,
          lpAttributionSource: lpSource,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '登録に失敗しました');
      }

      toast.success('登録が完了しました。メールをご確認ください。');

      // 登録後はLIFF URLへリダイレクト
      window.location.href = 'https://liff.line.me/2009053059-NTgazj13';
      return;
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
      <div className="max-w-xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/job-list" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-0">
            {/* ステップ1 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 1 ? 'bg-primary text-white' : currentStep > 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep === 1 ? 'text-primary' : 'text-gray-500'}`}>
                アカウント・基本情報
              </span>
            </div>
            {/* 接続線 */}
            <div className={`w-12 h-0.5 mx-2 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
            {/* ステップ2 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
              <span className={`ml-2 text-sm font-medium ${currentStep === 2 ? 'text-primary' : 'text-gray-500'}`}>
                住所・資格
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">新規ワーカー登録</h1>
          <p className="text-gray-600 mb-6">
            {currentStep === 1
              ? 'アカウント情報と基本情報を入力してください。'
              : '住所と保有資格を入力してください。'}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* ============ ステップ1: アカウント・基本情報 ============ */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* アカウント情報セクション */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">アカウント情報</h2>
                  <div className="space-y-4">
                    {/* メールアドレス */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        メールアドレス <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.email ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        placeholder="example@email.com"
                      />
                      {showErrors && !formData.email && (
                        <p className="text-red-500 text-xs mt-1">メールアドレスを入力してください</p>
                      )}
                    </div>
                    {/* メールアドレス（確認） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        メールアドレス（確認） <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
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
                    {/* 電話番号 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        電話番号 <span className="text-red-500">*</span>
                      </label>
                      <PhoneNumberInput
                        value={formData.phoneNumber}
                        onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
                        placeholder="09012345678"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.phoneNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                      {showErrors && !formData.phoneNumber && (
                        <p className="text-red-500 text-xs mt-1">電話番号を入力してください</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">※数字のみ（10桁または11桁）</p>
                    </div>
                    {/* パスワード */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        パスワード <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
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
                    {/* パスワード（確認） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        パスワード（確認） <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
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

                {/* 基本情報セクション */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">基本情報</h2>
                  <div className="space-y-4">
                    {/* 氏名 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          姓 <span className="text-red-500">*</span>
                        </label>
                        <NameWithKanaInput
                          value={formData.lastName}
                          onChange={(value) => setFormData(prev => ({ ...prev, lastName: value }))}
                          onKanaChange={(kana) => setFormData(prev => ({ ...prev, lastNameKana: kana }))}
                          kanaValue={formData.lastNameKana}
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
                        <NameWithKanaInput
                          value={formData.firstName}
                          onChange={(value) => setFormData(prev => ({ ...prev, firstName: value }))}
                          onKanaChange={(kana) => setFormData(prev => ({ ...prev, firstNameKana: kana }))}
                          kanaValue={formData.firstNameKana}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                          placeholder="太郎"
                        />
                        {showErrors && !formData.firstName && (
                          <p className="text-red-500 text-xs mt-1">名を入力してください</p>
                        )}
                      </div>
                    </div>
                    {/* 氏名カナ */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          姓（カナ） <span className="text-red-500">*</span>
                        </label>
                        <KatakanaInput
                          value={formData.lastNameKana}
                          onChange={(value) => setFormData({ ...formData, lastNameKana: value })}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.lastNameKana ? 'border-red-500 bg-red-50' : formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                          placeholder="ヤマダ"
                        />
                        {showErrors && !formData.lastNameKana && (
                          <p className="text-red-500 text-xs mt-1">姓（カナ）を入力してください</p>
                        )}
                        {formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana) && (
                          <p className="text-red-500 text-xs mt-1">カタカナで入力してください</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">※漢字入力で自動変換・ひらがなも変換可</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          名（カナ） <span className="text-red-500">*</span>
                        </label>
                        <KatakanaInput
                          value={formData.firstNameKana}
                          onChange={(value) => setFormData({ ...formData, firstNameKana: value })}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.firstNameKana ? 'border-red-500 bg-red-50' : formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                          placeholder="タロウ"
                        />
                        {showErrors && !formData.firstNameKana && (
                          <p className="text-red-500 text-xs mt-1">名（カナ）を入力してください</p>
                        )}
                        {formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana) && (
                          <p className="text-red-500 text-xs mt-1">カタカナで入力してください</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">※漢字入力で自動変換・ひらがなも変換可</p>
                      </div>
                    </div>
                    {/* 生年月日 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        生年月日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${showErrors && !formData.birthDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                      {showErrors && !formData.birthDate && (
                        <p className="text-red-500 text-xs mt-1">生年月日を入力してください</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ステップ1ボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors font-bold"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            {/* ============ ステップ2: 住所・資格・同意 ============ */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* 住所セクション */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">住所</h2>
                  <AddressSelector
                    prefecture={formData.prefecture}
                    city={formData.city}
                    addressLine={formData.addressLine}
                    building={formData.building}
                    postalCode={formData.postalCode}
                    onChange={(data) => {
                      setFormData(prev => ({
                        ...prev,
                        prefecture: data.prefecture,
                        city: data.city,
                        addressLine: data.addressLine || '',
                        building: data.building || '',
                        postalCode: data.postalCode || '',
                      }));
                    }}
                    required={true}
                    showErrors={showErrors}
                  />
                </div>

                {/* 保有資格セクション */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">保有資格</h2>
                  <p className="text-sm text-gray-600 mb-2">
                    保有している資格にチェックを入れてください。
                  </p>
                  <p className="text-sm text-red-600 font-medium mb-4">
                    ※応募するには会員登録後、資格証明書の写真の提出が必要です
                  </p>
                  {showErrors && formData.qualifications.length === 0 && (
                    <p className="text-red-500 text-xs mb-3">少なくとも1つの資格を選択してください</p>
                  )}
                  <div className={`space-y-4 ${showErrors && formData.qualifications.length === 0 ? 'ring-2 ring-red-500 rounded-lg p-3' : ''}`}>
                    {QUALIFICATION_GROUPS.map((group) => (
                      <div key={group.name}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {group.qualifications.map((qual) => (
                            <label key={qual} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={formData.qualifications.includes(qual)}
                                onChange={() => handleQualificationToggle(qual)}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                              <span>{qual}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 利用規約・プライバシーポリシー同意 */}
                <div id="terms-section" className={`p-4 bg-gray-50 rounded-lg border ${showErrors && (!agreedToTerms || !agreedToPrivacy) ? 'border-red-500' : 'border-gray-200'}`}>
                  <div className="space-y-4">
                    {/* 利用規約 */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        利用規約を確認する
                      </button>
                      <label className="flex items-start gap-3 cursor-pointer p-3 bg-white rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mt-0.5"
                        />
                        <span className="text-sm">
                          <span className="font-medium">利用規約に同意します</span>
                          <span className="text-red-500 ml-1">*</span>
                          <span className="text-gray-500 block text-xs mt-1">
                            （最終更新日: {TERMS_LAST_UPDATED}）
                          </span>
                        </span>
                      </label>
                      {showErrors && !agreedToTerms && (
                        <p className="text-red-500 text-xs">利用規約に同意してください</p>
                      )}
                    </div>

                    {/* プライバシーポリシー */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        プライバシーポリシーを確認する
                      </button>
                      <label className="flex items-start gap-3 cursor-pointer p-3 bg-white rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          checked={agreedToPrivacy}
                          onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                          className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mt-0.5"
                        />
                        <span className="text-sm">
                          <span className="font-medium">プライバシーポリシーに同意します</span>
                          <span className="text-red-500 ml-1">*</span>
                          <span className="text-gray-500 block text-xs mt-1">
                            （最終更新日: {PRIVACY_LAST_UPDATED}）
                          </span>
                        </span>
                      </label>
                      {showErrors && !agreedToPrivacy && (
                        <p className="text-red-500 text-xs">プライバシーポリシーに同意してください</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 案内文 */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    登録後、求人に応募する際には追加の情報（緊急連絡先、銀行口座、身分証明書、資格証明書など）が必要です。マイページからいつでも入力できます。
                  </p>
                </div>

                {/* ステップ2ボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
                  >
                    {isSubmitting && <LoadingSpinner size="sm" color="white" />}
                    {isSubmitting ? '登録中...' : '登録する'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* 利用規約モーダル */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">利用規約</h2>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-gray-500 mb-4">最終更新日: {TERMS_LAST_UPDATED}</p>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {WORKER_TERMS_OF_SERVICE}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreedToTerms(true);
                  setShowTermsModal(false);
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                同意して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* プライバシーポリシーモーダル */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">プライバシーポリシー</h2>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-gray-500 mb-4">最終更新日: {PRIVACY_LAST_UPDATED}</p>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {WORKER_PRIVACY_POLICY}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreedToPrivacy(true);
                  setShowPrivacyModal(false);
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
              >
                同意して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
