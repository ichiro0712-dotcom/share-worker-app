'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { SmsVerification } from '@/components/ui/SmsVerification';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getLegalDocument } from '@/src/lib/content-actions';
import { trackGA4Event } from '@/src/lib/ga4-events';
import RegistrationPageTracker from '@/components/tracking/RegistrationPageTracker';

type StepId = '1' | '2' | '2b' | '3' | '4' | '5' | '6' | '7' | '8';

// 資格オプション：表示ラベルとDB保存値のマッピング
const QUALIFICATION_OPTIONS: { label: string; value: string }[] = [
  { label: '正看護師', value: '看護師' },
  { label: '准看護師', value: '准看護師' },
  { label: '介護福祉士', value: '介護福祉士' },
  { label: '実務者研修（ヘルパー1級）', value: '実務者研修' },
  { label: '初任者研修（ヘルパー2級）', value: '初任者研修' },
  { label: 'その他', value: 'その他' },
];

const DESIRED_WORK_STYLE_OPTIONS = [
  '単発・スポット',
  '常勤・正社員',
  '非常勤・パート（扶養内）',
  '非常勤・パート（扶養外）',
  '派遣',
  'こだわらない',
];

const WORK_FREQUENCY_OPTIONS = ['週1回', '週2〜3回', '週4〜5回', '週5回'];
const JOB_TIMING_OPTIONS = ['いますぐ', '1ヶ月以内', '3ヶ月以内', 'いまは情報収集のみ'];
const EMPLOYMENT_STATUS_OPTIONS = [
  '就業中（常勤・正社員）',
  '就業中（非常勤・パート）',
  '離職中',
  '学生',
];

// step2 で「どのくらい働きたいですか？」を見せる条件
function shouldShowStep2b(desiredWorkStyle: string[]): boolean {
  return desiredWorkStyle.some(v =>
    v === '単発・スポット' ||
    v === '非常勤・パート（扶養内）' ||
    v === '非常勤・パート（扶養外）' ||
    v === '派遣' ||
    v === 'こだわらない'
  );
}

export default function WorkerRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <RegistrationPageTracker />
      <WorkerRegisterPageInner />
    </Suspense>
  );
}

function WorkerRegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showDebugError } = useDebugError();

  const [currentStep, setCurrentStep] = useState<StepId>('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 利用規約・PP
  const [termsContent, setTermsContent] = useState<string>('');
  const [privacyContent, setPrivacyContent] = useState<string>('');

  // フォームデータ
  const [form, setForm] = useState({
    qualifications: [] as string[],       // DB 保存値の配列
    qualificationOther: '',                // その他自由記述
    desiredWorkStyle: [] as string[],     // 複数選択
    workFrequency: '',                     // step 2b（条件付き）
    jobTiming: '',
    employmentStatus: '',
    postalCode: '',
    prefecture: '',
    city: '',
    gender: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    phoneNumber: '',
    email: '',
    password: '',
  });

  // LP 情報（localStorage / URL params）
  const [lpInfo, setLpInfo] = useState<{
    lpId: string | null;
    campaignCode: string | null;
    genrePrefix: string | null;
    source: 'localStorage' | 'urlParams' | 'none';
  }>({ lpId: null, campaignCode: null, genrePrefix: null, source: 'none' });

  useEffect(() => {
    // localStorage 優先、次に URL パラメータ
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('lpInfo') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.lpId) {
          setLpInfo({
            lpId: parsed.lpId,
            campaignCode: parsed.campaignCode ?? null,
            genrePrefix: parsed.genrePrefix ?? null,
            source: 'localStorage',
          });
          return;
        }
      }
    } catch {
      // noop
    }
    const lp = searchParams?.get('lp') ?? null;
    const c = searchParams?.get('c') ?? null;
    const g = searchParams?.get('g') ?? null;
    if (lp) {
      setLpInfo({ lpId: lp, campaignCode: c, genrePrefix: g, source: 'urlParams' });
    }
  }, [searchParams]);

  // 利用規約・PP取得（表示時）
  useEffect(() => {
    (async () => {
      try {
        const [terms, privacy] = await Promise.all([
          getLegalDocument('TERMS', 'WORKER'),
          getLegalDocument('PRIVACY', 'WORKER'),
        ]);
        if (terms?.content) setTermsContent(terms.content);
        if (privacy?.content) setPrivacyContent(privacy.content);
      } catch {
        // 取得失敗しても登録は継続可能
      }
    })();
  }, []);

  // ステップ順序（条件付きで 2b を挿入）
  const stepSequence = useMemo<StepId[]>(() => {
    const base: StepId[] = ['1', '2'];
    if (shouldShowStep2b(form.desiredWorkStyle)) base.push('2b');
    base.push('3', '4', '5', '6', '7', '8');
    return base;
  }, [form.desiredWorkStyle]);

  const stepIndex = stepSequence.indexOf(currentStep);
  const totalSteps = stepSequence.length;

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const toggleArrayValue = (field: 'qualifications' | 'desiredWorkStyle', value: string) => {
    setForm(prev => {
      const curr = prev[field];
      return {
        ...prev,
        [field]: curr.includes(value) ? curr.filter(v => v !== value) : [...curr, value],
      };
    });
  };

  // 各ステップのバリデーション
  const isStepValid = (): boolean => {
    switch (currentStep) {
      case '1': {
        if (form.qualifications.length === 0) return false;
        if (form.qualifications.includes('その他') && !form.qualificationOther.trim()) return false;
        return true;
      }
      case '2':
        return form.desiredWorkStyle.length > 0;
      case '2b':
        return !!form.workFrequency;
      case '3':
        return !!form.jobTiming;
      case '4':
        return !!form.employmentStatus;
      case '5':
        return !!form.postalCode && form.postalCode.replace(/[^0-9]/g, '').length === 7;
      case '6':
        return !!form.gender && !!form.birthYear && !!form.birthMonth && !!form.birthDay;
      case '7':
        return !!form.lastName.trim() && !!form.firstName.trim() && !!form.lastNameKana.trim() && !!form.firstNameKana.trim();
      case '8':
        return (
          !!form.phoneNumber &&
          !!phoneVerificationToken &&
          !!form.email &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
          !!form.password &&
          form.password.length >= 8 &&
          agreedToTerms &&
          agreedToPrivacy
        );
    }
  };

  const goNext = () => {
    if (!isStepValid()) return;
    if (currentStep === '8') {
      handleSubmit();
      return;
    }
    const nextIdx = stepIndex + 1;
    if (nextIdx < stepSequence.length) {
      setCurrentStep(stepSequence[nextIdx]);
      setSubmitError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(stepSequence[prevIdx]);
      setSubmitError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 郵便番号 → 住所自動入力（zipcloud）
  const handlePostalLookup = async (code: string) => {
    const digits = code.replace(/[^0-9]/g, '');
    if (digits.length !== 7) return;
    setIsLoadingAddress(true);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
      const data = await res.json();
      if (data.results?.length > 0) {
        const r = data.results[0];
        setForm(prev => ({
          ...prev,
          postalCode: digits,
          prefecture: r.address1 || '',
          city: `${r.address2 || ''}${r.address3 || ''}`,
        }));
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 資格: mock ラベル → DB 値にマッピング、「その他」自由記述は追記
      const qualificationsToSave = [...form.qualifications];
      if (form.qualifications.includes('その他') && form.qualificationOther.trim()) {
        qualificationsToSave.push(form.qualificationOther.trim());
      }

      // 生年月日 YYYY-MM-DD
      const birthDate = `${form.birthYear}-${String(form.birthMonth).padStart(2, '0')}-${String(form.birthDay).padStart(2, '0')}`;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          lastName: form.lastName,
          firstName: form.firstName,
          phoneNumber: form.phoneNumber,
          phoneVerificationToken,
          birthDate,
          qualifications: qualificationsToSave,
          lastNameKana: form.lastNameKana,
          firstNameKana: form.firstNameKana,
          gender: form.gender,
          postalCode: form.postalCode,
          prefecture: form.prefecture,
          city: form.city,
          desiredWorkStyle: form.desiredWorkStyle,
          workFrequency: form.workFrequency || undefined,
          jobTiming: form.jobTiming,
          employmentStatus: form.employmentStatus,
          registrationLpId: lpInfo.lpId,
          registrationCampaignCode: lpInfo.campaignCode,
          registrationGenrePrefix: lpInfo.genrePrefix,
          lpAttributionSource: lpInfo.source,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // debug.message があれば詳細な原因も表示（ステージング診断用）
        const detailMessage = data?.debug?.message
          ? `${data.error || '登録に失敗しました'}（原因: ${data.debug.message}）`
          : (data.error || '登録に失敗しました');
        showDebugError({
          type: 'other',
          operation: '会員登録',
          message: detailMessage,
          details: data?.debug?.stack,
          context: { status: res.status, debug: data?.debug },
        });
        // インライン永続表示（toast はすぐ消えるため）
        setSubmitError(detailMessage);
        toast.error(detailMessage);
        setIsSubmitting(false);
        return;
      }

      // GA4 登録完了イベント
      try {
        trackGA4Event('worker_register_complete', {
          lp_id: lpInfo.lpId || '',
          genre: lpInfo.genrePrefix || '',
        });
      } catch {}

      router.replace(data.redirect || '/register/worker/thanks');
    } catch (err) {
      const info = extractDebugInfo(err);
      showDebugError({
        type: 'other',
        operation: '会員登録（例外）',
        message: info.message,
        details: info.details,
        stack: info.stack,
      });
      setSubmitError('登録中にエラーが発生しました。ネットワーク接続を確認して再度お試しください。');
      toast.error('登録中にエラーが発生しました');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FCFE]">
      <form
        className="max-w-md mx-auto bg-white min-h-screen relative"
        onSubmit={(e) => {
          e.preventDefault();
          goNext();
        }}
      >
        {/* ヘッダー */}
        <div className="bg-gradient-to-br from-[#E8F7FB] via-[#D4F1F9] to-[#E8F0FE] px-5 pt-6 pb-8 text-center">
          <div className="text-[#2AADCF] font-bold text-lg">タスタス</div>
          <h1 className="text-xl font-bold text-gray-800 mt-1">あなたの現状を教えてください</h1>
        </div>

        {/* プログレスバー */}
        <div className="flex items-center justify-center gap-2 py-5">
          {stepSequence.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i === stepIndex
                  ? 'bg-[#2AADCF] scale-125 shadow-[0_2px_8px_rgba(42,173,207,0.3)]'
                  : i < stepIndex
                  ? 'bg-[#2AADCF]'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* ステップコンテンツ */}
        <div className="px-5 pb-32">
          {currentStep === '1' && (
            <StepContainer question="どんな資格をお持ちですか？" hint="複数選択できます">
              <div className="grid grid-cols-2 gap-2.5">
                {QUALIFICATION_OPTIONS.map(opt => (
                  <CardOption
                    key={opt.value}
                    label={opt.label}
                    selected={form.qualifications.includes(opt.value)}
                    onClick={() => toggleArrayValue('qualifications', opt.value)}
                  />
                ))}
              </div>
              {form.qualifications.includes('その他') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={form.qualificationOther}
                    onChange={e => setField('qualificationOther', e.target.value)}
                    placeholder="資格名を入力してください"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                  />
                </div>
              )}
            </StepContainer>
          )}

          {currentStep === '2' && (
            <StepContainer question="希望の働き方" hint="複数選択できます">
              <div className="grid grid-cols-2 gap-2.5">
                {DESIRED_WORK_STYLE_OPTIONS.map(opt => (
                  <CardOption
                    key={opt}
                    label={opt}
                    selected={form.desiredWorkStyle.includes(opt)}
                    onClick={() => toggleArrayValue('desiredWorkStyle', opt)}
                  />
                ))}
              </div>
            </StepContainer>
          )}

          {currentStep === '2b' && (
            <StepContainer question="どのくらい働きたいですか？">
              <div className="grid grid-cols-2 gap-2.5">
                {WORK_FREQUENCY_OPTIONS.map(opt => (
                  <CardOption
                    key={opt}
                    label={opt}
                    selected={form.workFrequency === opt}
                    onClick={() => setField('workFrequency', opt)}
                  />
                ))}
                {form.desiredWorkStyle.includes('単発・スポット') && (
                  <CardOption
                    label="不定期/決まっていない"
                    fullWidth
                    selected={form.workFrequency === '不定期/決まっていない'}
                    onClick={() => setField('workFrequency', '不定期/決まっていない')}
                  />
                )}
              </div>
            </StepContainer>
          )}

          {currentStep === '3' && (
            <StepContainer question="いつ頃の求人をお探しですか？">
              <div className="grid grid-cols-2 gap-2.5">
                {JOB_TIMING_OPTIONS.map(opt => (
                  <CardOption
                    key={opt}
                    label={opt}
                    selected={form.jobTiming === opt}
                    onClick={() => setField('jobTiming', opt)}
                  />
                ))}
              </div>
            </StepContainer>
          )}

          {currentStep === '4' && (
            <StepContainer question="お仕事のご状況">
              <div className="grid grid-cols-2 gap-2.5">
                {EMPLOYMENT_STATUS_OPTIONS.map(opt => (
                  <CardOption
                    key={opt}
                    label={opt}
                    selected={form.employmentStatus === opt}
                    onClick={() => setField('employmentStatus', opt)}
                  />
                ))}
              </div>
            </StepContainer>
          )}

          {currentStep === '5' && (
            <StepContainer question="お住まいの地域">
              <FieldLabel required>郵便番号</FieldLabel>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={8}
                value={form.postalCode}
                onChange={e => {
                  const v = e.target.value;
                  setField('postalCode', v);
                  if (v.replace(/[^0-9]/g, '').length === 7) {
                    handlePostalLookup(v);
                  }
                }}
                placeholder="例：1500022"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
              />
              {isLoadingAddress && <p className="text-xs text-gray-500 mt-1">住所を取得中...</p>}
              {form.prefecture && (
                <div className="mt-4 space-y-3">
                  <div>
                    <FieldLabel>都道府県</FieldLabel>
                    <input
                      type="text"
                      readOnly
                      value={form.prefecture}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] bg-gray-50"
                    />
                  </div>
                  <div>
                    <FieldLabel>市区町村</FieldLabel>
                    <input
                      type="text"
                      readOnly
                      value={form.city}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] bg-gray-50"
                    />
                  </div>
                </div>
              )}
            </StepContainer>
          )}

          {currentStep === '6' && (
            <StepContainer question="性別・生年月日">
              <div className="mb-5">
                <FieldLabel required>性別</FieldLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  {['男性', '女性'].map(g => (
                    <CardOption
                      key={g}
                      label={g}
                      selected={form.gender === g}
                      onClick={() => setField('gender', g)}
                    />
                  ))}
                </div>
              </div>
              <FieldLabel required>生年月日</FieldLabel>
              <div className="flex gap-2">
                <select
                  value={form.birthYear}
                  onChange={e => setField('birthYear', e.target.value)}
                  className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                >
                  <option value="">年</option>
                  {Array.from({ length: 2008 - 1950 + 1 }, (_, i) => 2008 - i).map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
                <select
                  value={form.birthMonth}
                  onChange={e => setField('birthMonth', e.target.value)}
                  className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                >
                  <option value="">月</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <select
                  value={form.birthDay}
                  onChange={e => setField('birthDay', e.target.value)}
                  className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                >
                  <option value="">日</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
              </div>
            </StepContainer>
          )}

          {currentStep === '7' && (
            <StepContainer question="おなまえ">
              <div className="mb-4">
                <FieldLabel required>姓</FieldLabel>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  placeholder="例：山田"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                />
              </div>
              <div className="mb-4">
                <FieldLabel required>名</FieldLabel>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  placeholder="例：花子"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                />
              </div>
              <div className="mb-4">
                <FieldLabel required>せい（カナ）</FieldLabel>
                <input
                  type="text"
                  value={form.lastNameKana}
                  onChange={e => setField('lastNameKana', e.target.value)}
                  placeholder="例：ヤマダ"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                />
              </div>
              <div>
                <FieldLabel required>めい（カナ）</FieldLabel>
                <input
                  type="text"
                  value={form.firstNameKana}
                  onChange={e => setField('firstNameKana', e.target.value)}
                  placeholder="例：ハナコ"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                />
              </div>
            </StepContainer>
          )}

          {currentStep === '8' && (
            <StepContainer question="ご連絡先・パスワード">
              {submitError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  {submitError}
                </div>
              )}
              <div className="mb-4">
                <FieldLabel required>電話番号（SMS認証が必要です）</FieldLabel>
                <SmsVerification
                  phoneNumber={form.phoneNumber}
                  onPhoneNumberChange={v => {
                    // 電話番号を変更したら既存の認証トークンを破棄（未認証状態に戻す）
                    setField('phoneNumber', v);
                    setPhoneVerificationToken(null);
                  }}
                  onVerified={token => setPhoneVerificationToken(token)}
                />
              </div>
              <div className="mb-4">
                <FieldLabel required>メールアドレス</FieldLabel>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder="例：example@mail.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                />
              </div>
              <div className="mb-4">
                <FieldLabel required>パスワード（8文字以上）</FieldLabel>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  placeholder="8文字以上"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-[10px] focus:border-[#2AADCF] focus:outline-none"
                />
              </div>
              <div className="space-y-1 mt-6">
                <div className="flex items-start gap-3 py-2 px-1 min-h-[44px] select-none">
                  <input
                    id="agree-terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 flex-shrink-0 accent-[#2AADCF] cursor-pointer"
                  />
                  <div className="leading-relaxed text-sm flex-1">
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-[#2AADCF] underline font-medium"
                    >
                      利用規約
                    </button>
                    <label htmlFor="agree-terms" className="cursor-pointer">に同意する</label>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2 px-1 min-h-[44px] select-none">
                  <input
                    id="agree-privacy"
                    type="checkbox"
                    checked={agreedToPrivacy}
                    onChange={e => setAgreedToPrivacy(e.target.checked)}
                    className="mt-1 w-5 h-5 flex-shrink-0 accent-[#2AADCF] cursor-pointer"
                  />
                  <div className="leading-relaxed text-sm flex-1">
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-[#2AADCF] underline font-medium"
                    >
                      プライバシーポリシー
                    </button>
                    <label htmlFor="agree-privacy" className="cursor-pointer">に同意する</label>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-6 text-xs text-gray-500">
                <span>🔒 SSL暗号化通信</span>
                <span>🛡️ 個人情報保護</span>
              </div>
            </StepContainer>
          )}
        </div>

        {/* フッターナビ */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#F0F3F5] p-4 flex gap-3 items-center z-50" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {currentStep !== '1' && (
            <button
              type="button"
              onClick={goBack}
              className="w-14 h-14 flex-shrink-0 rounded-full border-2 border-[#2AADCF] text-[#2AADCF] bg-white flex items-center justify-center text-xl"
              disabled={isSubmitting}
            >
              ←
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={!isStepValid() || isSubmitting}
            className={`flex-1 py-4 rounded-full font-semibold text-white shadow-[0_4px_16px_rgba(42,173,207,0.3)] transition-all ${
              isStepValid() && !isSubmitting
                ? 'bg-[#2AADCF] hover:bg-[#1A8FAD]'
                : 'bg-[#C8E4ED] cursor-not-allowed'
            }`}
          >
            {isSubmitting
              ? '送信中...'
              : currentStep === '8'
              ? '同意して登録する'
              : '次へ'}
          </button>
        </div>

        {/* 利用規約モーダル */}
        {showTermsModal && (
          <LegalModal
            title="利用規約"
            content={termsContent}
            onClose={() => setShowTermsModal(false)}
          />
        )}
        {showPrivacyModal && (
          <LegalModal
            title="プライバシーポリシー"
            content={privacyContent}
            onClose={() => setShowPrivacyModal(false)}
          />
        )}
      </form>
    </div>
  );
}

// --- 共通コンポーネント ---

function StepContainer({
  question,
  hint,
  children,
}: {
  question: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-5 text-center leading-relaxed">{question}</h2>
      {hint && <p className="text-xs text-gray-500 text-center mb-4">{hint}</p>}
      {children}
    </div>
  );
}

function CardOption({
  label,
  selected,
  onClick,
  fullWidth = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center text-center p-4 min-h-[72px] rounded-2xl transition-all select-none ${
        fullWidth ? 'col-span-2' : ''
      } ${
        selected
          ? 'bg-[#2AADCF] text-white shadow-[0_4px_16px_rgba(42,173,207,0.35)]'
          : 'bg-gray-100 text-gray-800'
      } active:scale-95`}
    >
      <span className="text-sm font-semibold leading-snug whitespace-pre-line">{label}</span>
    </button>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
      {children}
      {required && (
        <span className="text-[10px] bg-[#FF6B8A] text-white px-2 py-0.5 rounded font-semibold">必須</span>
      )}
    </div>
  );
}

function LegalModal({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="legal-modal-title" className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 text-2xl leading-none px-2"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content || '<p>読み込み中...</p>' }}
        />
      </div>
    </div>
  );
}
