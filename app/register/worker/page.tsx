'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { isValidEmail, isValidPhoneNumber } from '@/utils/inputValidation';
import { PhoneNumberInput } from '@/components/ui/PhoneNumberInput';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { WORKER_TERMS_OF_SERVICE, TERMS_LAST_UPDATED } from '@/constants/terms';

export default function WorkerRegisterPage() {
  const router = useRouter();
  const { showDebugError } = useDebugError();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    emailConfirm: '',
    phoneNumber: '',
    password: '',
    passwordConfirm: '',
  });

  // LP経由登録情報（localStorageから取得）
  const [lpInfo, setLpInfo] = useState<{ lpId: string | null; campaignCode: string | null; genrePrefix: string | null }>({
    lpId: null,
    campaignCode: null,
    genrePrefix: null,
  });

  // ページロード時にlocalStorageからLP情報を取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const trackingDataStr = localStorage.getItem('lp_tracking_data');
        if (trackingDataStr) {
          const trackingData = JSON.parse(trackingDataStr);
          if (trackingData.expiry && Date.now() <= trackingData.expiry) {
            setLpInfo({
              lpId: trackingData.lpId || null,
              campaignCode: trackingData.campaignCode || null,
              genrePrefix: trackingData.genrePrefix || null,
            });
            return;
          }
        }
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
        }
      } catch (e) {
        console.error('Failed to get LP info from localStorage:', e);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);

    // 必須フィールドのバリデーション
    const errors: string[] = [];
    if (!formData.email) errors.push('メールアドレス');
    if (!formData.emailConfirm) errors.push('メールアドレス（確認）');
    if (!formData.phoneNumber) errors.push('電話番号');
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

    // 電話番号形式チェック
    if (!isValidPhoneNumber(formData.phoneNumber)) {
      toast.error('電話番号は10桁または11桁の数字で入力してください');
      return;
    }

    // 利用規約同意チェック
    if (!agreedToTerms) {
      toast.error('利用規約に同意してください');
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
          // LP経由登録情報
          registrationLpId: lpInfo.lpId,
          registrationCampaignCode: lpInfo.campaignCode,
          registrationGenrePrefix: lpInfo.genrePrefix,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '登録に失敗しました');
      }

      // 登録成功 - メール認証待ちページへリダイレクト
      toast.success('登録が完了しました。メールをご確認ください。');
      router.push(`/auth/verify-pending?email=${encodeURIComponent(formData.email)}`);
      router.refresh();
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

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">新規ワーカー登録</h1>
          <p className="text-gray-600 mb-6">
            まずはアカウントを作成しましょう。詳しいプロフィールは登録後に入力できます。
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* メールアドレス */}
            <div className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                電話番号 <span className="text-red-500">*</span>
              </label>
              <PhoneNumberInput
                required
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
            <div className="space-y-4">
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

            {/* 利用規約同意 */}
            <div id="terms-section" className={`p-4 bg-gray-50 rounded-lg border ${showErrors && !agreedToTerms ? 'border-red-500' : 'border-gray-200'}`}>
              <div className="space-y-3">
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
            </div>

            {/* 案内文 */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                📝 氏名・住所・資格などの詳細情報は、登録後にマイページから入力できます。求人に応募する際に必要となります。
              </p>
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
                disabled={isSubmitting}
                className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
              >
                {isSubmitting && <LoadingSpinner size="sm" color="white" />}
                {isSubmitting ? '登録中...' : '登録'}
              </button>
            </div>
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
    </div>
  );
}
