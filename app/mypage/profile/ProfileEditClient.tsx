'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, ArrowLeft, Plus, X, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { updateUserProfile } from '@/src/lib/actions';
import { savePhoneVerification } from '@/src/lib/actions/user-profile';
import { validateFile, getSafeImageUrl, isValidImageUrl } from '@/utils/fileValidation';
import { useBadge } from '@/contexts/BadgeContext';
import { isKatakanaOnly, isKatakanaWithSpaceOnly } from '@/utils/inputValidation';
import toast from 'react-hot-toast';
import AddressSelector from '@/components/ui/AddressSelector';
import { KatakanaInput, KatakanaWithSpaceInput } from '@/components/ui/KatakanaInput';
import { PhoneNumberInput } from '@/components/ui/PhoneNumberInput';
import { HOUR_TIME_OPTIONS } from '@/constants/time-options';
import { SmsVerification } from '@/components/ui/SmsVerification';
import { QUALIFICATION_GROUPS, WORKER_QUALIFICATIONS } from '@/constants/qualifications';
import {
  DESIRED_WORK_STYLE_OPTIONS,
  LEGACY_DESIRED_WORK_STYLE_OPTIONS,
  WORK_FREQUENCY_OPTIONS,
  WORK_FREQUENCY_SPOT_OPTION,
  LEGACY_WORK_FREQUENCY_OPTIONS,
  DESIRED_WORK_PERIOD_OPTIONS,
  JOB_TIMING_OPTIONS,
  LEGACY_JOB_TIMING_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  LEGACY_EMPLOYMENT_STATUS_OPTIONS,
} from '@/constants/worker-registration-options';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import BankSelector from '@/components/ui/BankSelector';
import BranchSelector from '@/components/ui/BranchSelector';
import { generateBankAccountName } from '@/lib/string-utils';
import { convertYuchoToZengin, isYuchoBankCode, yuchoBranchName } from '@/lib/bank/yucho';

/**
 * 署名付きURLを使用してファイルをSupabase Storageに直接アップロード
 * Vercel 6MB制限を回避するため、クライアントから直接Storageにアップロード
 * @param file アップロードするファイル
 * @param uploadType アップロード種別（'profile'固定）
 * @returns 成功時はpublicUrl、失敗時はnull
 */
async function uploadFileWithPresignedUrl(
  file: File,
  uploadType: string = 'profile'
): Promise<string | null> {
  try {
    // 1. 署名付きURL取得
    const response = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        uploadType
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[uploadFileWithPresignedUrl] Failed to get presigned URL:', error);
      return null;
    }

    const { presignedUrl, publicUrl } = await response.json();

    // 2. Supabase Storageに直接アップロード
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    if (!uploadResponse.ok) {
      console.error('[uploadFileWithPresignedUrl] Failed to upload file:', uploadResponse.status);
      return null;
    }

    return publicUrl;
  } catch (error) {
    console.error('[uploadFileWithPresignedUrl] Error:', error);
    return null;
  }
}

interface UserProfile {
  id: number;
  email: string;
  name: string;
  birth_date: string | null;
  phone_number: string;
  profile_image: string | null;
  qualifications: string[];
  // 追加フィールド
  last_name_kana: string | null;
  first_name_kana: string | null;
  gender: string | null;
  nationality: string | null;
  // 住所
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line: string | null;
  building: string | null;
  // 緊急連絡先
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  emergency_address: string | null;
  // 働き方・希望
  current_work_style: string | null;
  desired_work_style: string | null;
  job_change_desire: string | null;
  desired_work_days_week: string | null;
  desired_work_period: string | null;
  desired_work_days: string[];
  desired_start_time: string | null;
  desired_end_time: string | null;
  // 経験
  experience_fields: Record<string, string> | null;
  work_histories: string[];
  // 自己PR
  self_pr: string | null;
  // 銀行口座
  bank_code: string | null;
  bank_name: string | null;
  branch_code: string | null;
  branch_name: string | null;
  account_name: string | null;
  account_number: string | null;
  // ゆうちょ: 口座種別と記号・番号(原本)
  bank_account_kind?: string | null;
  yucho_symbol?: string | null;
  yucho_number?: string | null;
  // その他
  pension_number: string | null;
  id_document: string | null;
  bank_book_image: string | null;
  // 資格証明書
  qualification_certificates: Record<string, string> | null;
  // 電話番号認証
  phone_verified: boolean;
}

interface ExperienceFieldGroup {
  id: number;
  name: string;
  fields: { id: number; name: string }[];
}

interface ProfileEditClientProps {
  userProfile: UserProfile;
  experienceFieldGroups?: ExperienceFieldGroup[];
}

export default function ProfileEditClient({ userProfile, experienceFieldGroups = [] }: ProfileEditClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showDebugError } = useDebugError();
  const { refreshBadges } = useBadge();
  const { update: updateSession } = useSession();

  // 戻り先URL（求人ページから来た場合）
  const returnUrl = searchParams?.get('returnUrl');

  // ユーザー名を姓と名に分割
  const nameParts = userProfile.name.split(' ');
  const lastName = nameParts[0] || '';
  const firstName = nameParts[1] || '';

  // 安全に画像URLを取得（[object Object]などの無効な値を防ぐ）
  // fallbackを渡さない: 表示用フォールバックはUI側で処理（UserIconを表示）
  // fallback URLをサーバーに送信するとSupabase URLバリデーションでエラーになる
  const [profileImage, setProfileImage] = useState<string | null>(
    getSafeImageUrl(userProfile.profile_image)
  );
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);

  // 身分証明書（安全に取得）
  const [idDocument, setIdDocument] = useState<string | null>(
    getSafeImageUrl(userProfile.id_document)
  );
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null);

  // 通帳コピー（安全に取得）
  const [bankBookImage, setBankBookImage] = useState<string | null>(
    getSafeImageUrl(userProfile.bank_book_image)
  );
  const [bankBookImageFile, setBankBookImageFile] = useState<File | null>(null);

  const [workHistories, setWorkHistories] = useState<string[]>(
    userProfile.work_histories?.length > 0 ? userProfile.work_histories : []
  );

  // DBの経験データからexperienceFieldsとexperienceYearsを初期化
  // 古い形式のデータ（years, histories）はフィルタリングして除外
  const invalidKeys = ['years', 'histories'];
  const initialExperienceFields = userProfile.experience_fields
    ? Object.keys(userProfile.experience_fields).filter(key => !invalidKeys.includes(key))
    : [];
  const initialExperienceYears = userProfile.experience_fields
    ? Object.fromEntries(
      Object.entries(userProfile.experience_fields).filter(([key]) => !invalidKeys.includes(key))
    )
    : {};

  // 経験分野: カイテク式の「種別＋経験年数」の行として保持
  const initialExperienceRows: { field: string; years: string }[] =
    initialExperienceFields.length > 0
      ? initialExperienceFields.map((name) => ({ field: name, years: initialExperienceYears[name] || '' }))
      : [{ field: '', years: '' }];

  // 希望の働き方: CSV → 配列に変換し、新値と旧値を分離
  const initialDesiredWorkStyleArray = (userProfile.desired_work_style || '')
    .split(',')
    .map(v => v.trim())
    .filter(v => v.length > 0);
  const initialDesiredWorkStyleNew = initialDesiredWorkStyleArray.filter(v =>
    (DESIRED_WORK_STYLE_OPTIONS as ReadonlyArray<string>).includes(v)
  );
  const initialDesiredWorkStyleLegacy = initialDesiredWorkStyleArray.filter(v =>
    (LEGACY_DESIRED_WORK_STYLE_OPTIONS as ReadonlyArray<string>).includes(v)
  );

  // 資格: マスタ49項目に含まれない値を「その他」として抽出
  const knownQualifications = WORKER_QUALIFICATIONS as ReadonlyArray<string>;
  const initialOtherQualifications = userProfile.qualifications.filter(
    q => !knownQualifications.includes(q)
  );
  const initialKnownQualifications = userProfile.qualifications.filter(q =>
    knownQualifications.includes(q)
  );

  const [formData, setFormData] = useState({
    // 1. 基本情報（データベースから取得）
    lastName,
    firstName,
    lastNameKana: userProfile.last_name_kana || '',
    firstNameKana: userProfile.first_name_kana || '',
    birthDate: userProfile.birth_date ? userProfile.birth_date.split('T')[0] : '',
    gender: userProfile.gender || '',
    nationality: userProfile.nationality || '',

    // 2. 働き方と希望
    currentWorkStyle: userProfile.current_work_style || '',
    // 希望の働き方: 新値の配列のみ formData で管理（旧値は別 state で保持）
    desiredWorkStyle: initialDesiredWorkStyleNew as string[],
    jobChangeDesire: userProfile.job_change_desire || '',
    desiredWorkDaysPerWeek: userProfile.desired_work_days_week || '',
    desiredWorkPeriod: userProfile.desired_work_period || '',
    desiredWorkDays: userProfile.desired_work_days || [] as string[],
    desiredStartTime: userProfile.desired_start_time || '',
    desiredEndTime: userProfile.desired_end_time || '',

    // 3. 連絡先情報（データベースから取得）
    phone: userProfile.phone_number,
    email: userProfile.email,
    postalCode: userProfile.postal_code || '',
    prefecture: userProfile.prefecture || '',
    city: userProfile.city || '',
    address: userProfile.address_line || '',
    building: userProfile.building || '',

    // 緊急連絡先
    emergencyContactName: userProfile.emergency_name || '',
    emergencyContactRelation: userProfile.emergency_relation || '',
    emergencyContactPhone: userProfile.emergency_phone || '',
    emergencyContactAddress: userProfile.emergency_address || '',

    // 4. 資格・経験（データベースから取得）
    qualifications: initialKnownQualifications as string[],
    // その他資格（マスタにない値を自由記述として表示）
    hasOtherQualification: initialOtherQualifications.length > 0,
    otherQualification: initialOtherQualifications.join(', '),
    experienceFields: initialExperienceFields as string[],
    experienceYears: initialExperienceYears as Record<string, string>,

    // 5. 自己PR
    selfPR: userProfile.self_pr || '',

    // 6. 銀行口座情報
    bankCode: userProfile.bank_code || '',
    bankName: userProfile.bank_name || '',
    branchCode: userProfile.branch_code || '',
    branchName: userProfile.branch_name || '',
    // 口座名義は姓名カナから自動生成（既存データがあれば維持）
    accountName: userProfile.account_name || generateBankAccountName(
      userProfile.last_name_kana || '',
      userProfile.first_name_kana || ''
    ),
    accountNumber: userProfile.account_number || '',
    // ゆうちょ: 記号・番号(原本)
    yuchoSymbol: userProfile.yucho_symbol || '',
    yuchoNumber: userProfile.yucho_number || '',

    // 7. その他
    pensionNumber: userProfile.pension_number || '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  // ゆうちょ: 自動計算した振込用(店番・口座番号)が通帳の「振込用のご案内」と一致する旨の本人確認チェック
  const [yuchoConfirmed, setYuchoConfirmed] = useState(false);
  // 銀行=ゆうちょ(9900)か。選択時は記号・番号入力に切替える。
  const isYucho = isYuchoBankCode(formData.bankCode);
  // 記号・番号 → 振込用(店番・口座番号) の自動計算結果（表示・本人確認用）。
  const yuchoConv = isYucho && formData.yuchoSymbol && formData.yuchoNumber
    ? convertYuchoToZengin(formData.yuchoSymbol, formData.yuchoNumber)
    : null;
  // 記号・番号を保存値から変更したか。変更時のみ本人確認チェックを必須にする
  // （未変更の再保存で毎回チェックを強いるUXを避ける）。
  const yuchoChanged =
    isYucho &&
    (formData.yuchoSymbol !== (userProfile.yucho_symbol || '') ||
      formData.yuchoNumber !== (userProfile.yucho_number || ''));
  const [isSaving, setIsSaving] = useState(false);
  // バリデーションエラー表示用（送信時にtrueになる）
  const [showErrors, setShowErrors] = useState(false);
  // 希望の働き方: 旧値（画面非表示の選択肢で保存されている値）を読み取り専用で保持。
  // ユーザーが明示的に削除しない限り CSV に残し続ける（データ消失防止）
  const [legacyDesiredWorkStyle, setLegacyDesiredWorkStyle] = useState<string[]>(
    initialDesiredWorkStyleLegacy
  );
  // 電話番号SMS認証トークン
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  // 電話番号が変更されたかどうか
  const phoneChanged = formData.phone !== userProfile.phone_number;

  // バリデーション関数
  const validateKatakana = (value: string): boolean => {
    return /^[ァ-ヶー　\s]*$/.test(value);
  };

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const validatePhone = (value: string): boolean => {
    return /^[0-9\-]+$/.test(value);
  };

  const validatePostalCode = (value: string): boolean => {
    return /^[0-9]{3}-?[0-9]{4}$/.test(value);
  };

  const validateField = (field: string, value: string): string => {
    if (!value) return '';

    switch (field) {
      case 'lastNameKana':
      case 'firstNameKana':
      case 'accountName':
        if (!validateKatakana(value)) {
          return 'カタカナで入力してください';
        }
        break;
      case 'email':
        if (!validateEmail(value)) {
          return '正しいメールアドレス形式で入力してください';
        }
        break;
      case 'phone':
      case 'emergencyContactPhone':
        if (!validatePhone(value)) {
          return '電話番号は10桁または11桁の数字で入力してください';
        }
        break;
      case 'postalCode':
        if (!validatePostalCode(value)) {
          return '郵便番号は「123-4567」または「1234567」の形式で入力してください';
        }
        break;
    }
    return '';
  };

  // 資格証明書の状態管理（データベースから初期化、安全にURLを取得）
  const [qualificationCertificates, setQualificationCertificates] = useState<Record<string, string | null>>(() => {
    const certs: Record<string, string | null> = {};
    userProfile.qualifications.forEach((qual) => {
      // DBから読み込んだ証明書があれば安全に設定
      const certData = userProfile.qualification_certificates?.[qual];

      // ネストされたオブジェクト形式の場合（旧形式: {acquired_date, certificate_image}）
      if (certData && typeof certData === 'object' && 'certificate_image' in certData) {
        certs[qual] = getSafeImageUrl((certData as { certificate_image?: string }).certificate_image);
      } else {
        // 文字列URL形式（新形式）または無効な値
        certs[qual] = getSafeImageUrl(certData);
      }
    });
    return certs;
  });

  const [qualificationCertificateFiles, setQualificationCertificateFiles] = useState<Record<string, File>>({});

  // 経験分野（カイテク式：種別プルダウン＋経験年数プルダウン＋行追加）
  const [experienceRows, setExperienceRows] = useState<{ field: string; years: string }[]>(
    initialExperienceRows
  );

  // マスタに存在する全項目名の集合（重複選択防止・非公開項目の判定用）
  const masterFieldNames = new Set(
    experienceFieldGroups.flatMap((g) => g.fields.map((f) => f.name))
  );

  // 選択済みの種別（他行での重複選択を防ぐ）
  const selectedExperienceFields = new Set(
    experienceRows.map((r) => r.field).filter((f) => f !== '')
  );

  // 経験分野の入力があるか（バリデーション用）
  const hasExperienceInput = experienceRows.some((r) => r.field.trim() !== '');

  const addExperienceRow = () => {
    setExperienceRows((prev) => [...prev, { field: '', years: '' }]);
  };

  const removeExperienceRow = (index: number) => {
    setExperienceRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ field: '', years: '' }];
    });
  };

  const changeExperienceRowField = (index: number, field: string) => {
    setExperienceRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, field } : row))
    );
  };

  const changeExperienceRowYears = (index: number, years: string) => {
    setExperienceRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, years } : row))
    );
  };

  const experienceYearOptions = [
    '1年未満',
    '1〜2年',
    '3〜5年',
    '5〜10年',
    '10年以上',
  ];

  const weekDays = ['月', '火', '水', '木', '金', '土', '日', '特になし'];

  const timeOptions = HOUR_TIME_OPTIONS;

  // 希望の働き方: 複数選択トグル
  const toggleDesiredWorkStyle = (value: string) => {
    setFormData(prev => {
      const curr = prev.desiredWorkStyle;
      return {
        ...prev,
        desiredWorkStyle: curr.includes(value)
          ? curr.filter(v => v !== value)
          : [...curr, value],
      };
    });
  };

  // 希望の働き方の「単発・スポット」を外したら、「不定期/決まっていない」を自動クリア
  // （登録フォームと同じ挙動）
  useEffect(() => {
    if (
      !formData.desiredWorkStyle.includes('単発・スポット') &&
      formData.desiredWorkDaysPerWeek === WORK_FREQUENCY_SPOT_OPTION
    ) {
      setFormData(prev => ({ ...prev, desiredWorkDaysPerWeek: '' }));
    }
  }, [formData.desiredWorkStyle, formData.desiredWorkDaysPerWeek]);

  // 旧値ラベルを削除
  const removeLegacyDesiredWorkStyle = (value: string) => {
    setLegacyDesiredWorkStyle(prev => prev.filter(v => v !== value));
  };

  const handleCheckboxChange = (field: 'qualifications' | 'experienceFields' | 'desiredWorkDays', value: string) => {
    setFormData(prev => {
      // 希望曜日で「特になし」がチェックされた場合
      if (field === 'desiredWorkDays' && value === '特になし') {
        if (prev.desiredWorkDays.includes('特になし')) {
          // 「特になし」を解除
          return { ...prev, desiredWorkDays: [] };
        } else {
          // 「特になし」のみにする
          return { ...prev, desiredWorkDays: ['特になし'] };
        }
      }

      // 希望曜日で「特になし」以外がチェックされた場合、「特になし」を外す
      if (field === 'desiredWorkDays' && value !== '特になし') {
        const filtered = prev.desiredWorkDays.filter(d => d !== '特になし');
        const isRemoving = filtered.includes(value);
        return {
          ...prev,
          desiredWorkDays: isRemoving
            ? filtered.filter(item => item !== value)
            : [...filtered, value]
        };
      }

      const isRemoving = prev[field].includes(value);
      const newFormData = {
        ...prev,
        [field]: isRemoving
          ? prev[field].filter(item => item !== value)
          : [...prev[field], value]
      };

      // 経験分野が削除された場合、対応する経験年数も削除
      if (field === 'experienceFields' && isRemoving) {
        const newExperienceYears = { ...prev.experienceYears };
        delete newExperienceYears[value];
        newFormData.experienceYears = newExperienceYears;
      }

      return newFormData;
    });
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = validateFile(file, 'image');
      if (!result.isValid) {
        toast.error(result.error!);
        return;
      }

      // ファイルオブジェクトを保存（サーバーアップロード用）
      setProfileImageFile(file);

      // プレビュー用にDataURLを生成
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQualificationCertificateChange = (qualification: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = validateFile(file, 'all'); // 画像+PDF
      if (!result.isValid) {
        toast.error(result.error!);
        return;
      }

      // ファイルオブジェクトを保存（サーバーアップロード用）
      setQualificationCertificateFiles(prev => ({
        ...prev,
        [qualification]: file
      }));

      // プレビュー用にDataURLを生成
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

  const handleIdDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = validateFile(file, 'all'); // 画像+PDF
      if (!result.isValid) {
        toast.error(result.error!);
        return;
      }

      setIdDocumentFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdDocument(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBankBookImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = validateFile(file, 'all'); // 画像+PDF
      if (!result.isValid) {
        toast.error(result.error!);
        return;
      }

      setBankBookImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBankBookImage(reader.result as string);
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

  // アップロード進捗表示用state
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーションエラー表示を有効化
    setShowErrors(true);

    // 既に保存中の場合は何もしない
    if (isSaving) return;

    // バリデーション: フォーマットチェックのみ（部分保存を許可）
    // 応募時の必須チェックは checkProfileComplete() で行う
    const errors: string[] = [];

    // 姓名: どちらか入力されたら両方必須
    if ((formData.lastName || formData.firstName) && (!formData.lastName || !formData.firstName)) {
      errors.push('姓名は両方入力してください');
    }

    // フリガナのカタカナチェック（入力されている場合のみ）
    if (formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana)) {
      errors.push('姓（カナ）はカタカナで入力してください');
    }
    if (formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana)) {
      errors.push('名（カナ）はカタカナで入力してください');
    }

    // 口座名義のカタカナチェック（入力されている場合のみ）
    if (formData.accountName && !isKatakanaWithSpaceOnly(formData.accountName)) {
      errors.push('口座名義はカタカナで入力してください');
    }

    // 電話番号変更時のSMS認証チェック
    if (phoneChanged && !phoneVerificationToken) {
      errors.push('電話番号を変更する場合はSMS認証を完了してください');
    }

    // ゆうちょ: 記号・番号を「変更した」ときのみ、変換可能＋本人確認を必須にする。
    // 未変更の再保存ではチェック不要（保存済み＝確認済みとみなす）。
    if (isYucho && yuchoChanged && (formData.yuchoSymbol || formData.yuchoNumber)) {
      if (!formData.yuchoSymbol || !formData.yuchoNumber) {
        errors.push('ゆうちょ口座は記号と番号の両方を入力してください');
      } else if (!yuchoConv || !yuchoConv.ok) {
        errors.push(yuchoConv && !yuchoConv.ok ? `ゆうちょ口座: ${yuchoConv.error}` : 'ゆうちょの記号・番号をご確認ください');
      } else if (!yuchoConfirmed) {
        errors.push('ゆうちょ口座: 振込用の内容を確認してチェックを入れてください');
      }
    }

    if (errors.length > 0) {
      toast.error(errors.join('、'));
      return;
    }

    setIsSaving(true);
    setUploadProgress('アップロード準備中...');

    try {
      // === Phase 1: ファイルを個別にアップロード（署名付きURL経由）===
      // 既存URLを維持（新しいファイルがなければ変更しない）
      // フォールバック画像やローカルパスはサーバーに送信しない（Supabase URLバリデーション対策）
      let newProfileImageUrl = (profileImage && (profileImage.startsWith('http') || profileImage.startsWith('data:')))
        ? profileImage
        : null;
      let newIdDocumentUrl = idDocument;
      let newBankBookImageUrl = bankBookImage;

      // プロフィール画像
      if (profileImageFile) {
        setUploadProgress('プロフィール画像をアップロード中...');
        const url = await uploadFileWithPresignedUrl(profileImageFile, 'profile');
        if (!url) {
          toast.error('プロフィール画像のアップロードに失敗しました');
          return;
        }
        newProfileImageUrl = url;
      }

      // 身分証明書
      if (idDocumentFile) {
        setUploadProgress('身分証明書をアップロード中...');
        const url = await uploadFileWithPresignedUrl(idDocumentFile, 'profile');
        if (!url) {
          toast.error('身分証明書のアップロードに失敗しました');
          return;
        }
        newIdDocumentUrl = url;
      }

      // 通帳コピー
      if (bankBookImageFile) {
        setUploadProgress('通帳コピーをアップロード中...');
        const url = await uploadFileWithPresignedUrl(bankBookImageFile, 'profile');
        if (!url) {
          toast.error('通帳コピーのアップロードに失敗しました');
          return;
        }
        newBankBookImageUrl = url;
      }

      // 資格証明書（複数）- 既存URLをマージ（base64は除外、サーバー側で既存データを維持）
      const existingCertUrls: Record<string, string> = {};
      for (const [qual, certUrl] of Object.entries(qualificationCertificates)) {
        // base64データは送信しない（サーバー側で既存データを維持する）
        // 新規アップロードはqualificationCertificateFilesで処理される
        if (certUrl && isValidImageUrl(certUrl) && certUrl.startsWith('http')) {
          existingCertUrls[qual] = certUrl;
        }
      }
      const newCertificates: Record<string, string> = { ...existingCertUrls };

      for (const [qualification, file] of Object.entries(qualificationCertificateFiles)) {
        setUploadProgress(`資格証明書（${qualification}）をアップロード中...`);
        const url = await uploadFileWithPresignedUrl(file, 'profile');
        if (!url) {
          toast.error(`資格証明書（${qualification}）のアップロードに失敗しました`);
          return;
        }
        newCertificates[qualification] = url;
      }

      // === Phase 2: Server ActionにURLのみ送信 ===
      setUploadProgress('プロフィールを保存中...');

      // FormDataを作成
      const form = new FormData();
      // 基本情報
      form.append('name', `${formData.lastName} ${formData.firstName}`);
      form.append('email', formData.email);
      form.append('phoneNumber', formData.phone);
      if (phoneVerificationToken) {
        form.append('phoneVerificationToken', phoneVerificationToken);
      }
      form.append('birthDate', formData.birthDate);

      // 資格: マスタ選択値 + その他自由記述 を結合してCSV保存
      const otherQualValues = formData.hasOtherQualification && formData.otherQualification.trim()
        ? formData.otherQualification.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : [];
      const qualificationsToSave = [...formData.qualifications, ...otherQualValues];
      form.append('qualifications', qualificationsToSave.join(','));
      form.append('lastNameKana', formData.lastNameKana);
      form.append('firstNameKana', formData.firstNameKana);
      form.append('gender', formData.gender);
      form.append('nationality', formData.nationality);

      // 住所
      form.append('postalCode', formData.postalCode);
      form.append('prefecture', formData.prefecture);
      form.append('city', formData.city);
      form.append('addressLine', formData.address);
      form.append('building', formData.building);

      // 緊急連絡先
      form.append('emergencyName', formData.emergencyContactName);
      form.append('emergencyRelation', formData.emergencyContactRelation);
      form.append('emergencyPhone', formData.emergencyContactPhone);
      form.append('emergencyAddress', formData.emergencyContactAddress);

      // 働き方・希望
      form.append('currentWorkStyle', formData.currentWorkStyle);
      // 希望の働き方: 新値（複数選択）+ 残存している旧値 を CSV 連結して保存
      // 旧値はユーザーが明示的に削除しない限り維持（データ消失防止）
      const desiredWorkStyleCsv = [
        ...formData.desiredWorkStyle,
        ...legacyDesiredWorkStyle,
      ].join(',');
      form.append('desiredWorkStyle', desiredWorkStyleCsv);
      // 複数選択化により単一値潰しの判定不要 → 常にユーザー編集後の値で上書き
      form.append('desiredWorkStyleChanged', 'true');
      form.append('jobChangeDesire', formData.jobChangeDesire);
      form.append('desiredWorkDaysPerWeek', formData.desiredWorkDaysPerWeek);
      form.append('desiredWorkPeriod', formData.desiredWorkPeriod);
      form.append('desiredWorkDays', formData.desiredWorkDays.join(','));
      form.append('desiredStartTime', formData.desiredStartTime);
      form.append('desiredEndTime', formData.desiredEndTime);

      // 経験（種別→経験年数のマップ。種別未選択の行は除外。同一種別は後勝ちで1件に集約）
      const experienceMap: Record<string, string> = {};
      for (const row of experienceRows) {
        if (row.field.trim() !== '') {
          experienceMap[row.field] = row.years;
        }
      }
      form.append('experienceFields', JSON.stringify(experienceMap));
      form.append('workHistories', workHistories.join('|||'));

      // 自己PR
      form.append('selfPR', formData.selfPR);

      // 銀行口座
      form.append('bankCode', formData.bankCode);
      form.append('bankName', formData.bankName);
      form.append('branchCode', formData.branchCode);
      form.append('branchName', formData.branchName);
      form.append('accountName', formData.accountName);
      form.append('accountNumber', formData.accountNumber);
      // ゆうちょ: 記号・番号(原本)。サーバ側で全銀の店番・口座番号に変換して保存する。
      form.append('yuchoSymbol', formData.yuchoSymbol);
      form.append('yuchoNumber', formData.yuchoNumber);

      // その他
      form.append('pensionNumber', formData.pensionNumber);

      // ファイルURLを追加（署名付きURLでアップロード済み）
      form.append('profileImageUrl', newProfileImageUrl || '');
      form.append('idDocumentUrl', newIdDocumentUrl || '');
      form.append('bankBookImageUrl', newBankBookImageUrl || '');
      form.append('qualificationCertificates', JSON.stringify(newCertificates));

      console.log('[ProfileEditClient] Sending URLs to server:', {
        profileImageUrl: newProfileImageUrl ? 'set' : 'empty',
        idDocumentUrl: newIdDocumentUrl ? 'set' : 'empty',
        bankBookImageUrl: newBankBookImageUrl ? 'set' : 'empty',
        qualificationCertificates: Object.keys(newCertificates),
      });

      // サーバーアクションを呼び出し
      const result = await updateUserProfile(form);

      // resultがundefinedの場合のエラーハンドリング
      if (!result) {
        showDebugError({
          type: 'save',
          operation: 'プロフィール更新',
          message: 'サーバーからの応答がありませんでした。認証セッションが切れている可能性があります。',
          context: {
            formDataKeys: Array.from(form.keys()),
            hasProfileImage: !!newProfileImageUrl,
            hasIdDocument: !!newIdDocumentUrl,
            hasBankBookImage: !!newBankBookImageUrl,
            qualificationCertificateCount: Object.keys(newCertificates).length,
          }
        });
        toast.error('セッションが切れた可能性があります。再度ログインしてください。');
        return;
      }

      if (result.success) {
        toast.success(result.message || 'プロフィールを更新しました');
        // NextAuthセッションを更新して新しい画像URLを反映
        await updateSession();
        // クライアントナビゲーション + サーバーコンポーネント再取得
        const redirectUrl = returnUrl || '/mypage';
        router.push(redirectUrl);
        router.refresh();
        return;
      } else {
        // デバッグ用エラー通知を表示
        showDebugError({
          type: 'save',
          operation: 'プロフィール更新',
          message: result.error || 'プロフィールの更新に失敗しました',
          context: {
            formDataKeys: Array.from(form.keys()),
            hasProfileImage: !!newProfileImageUrl,
            hasIdDocument: !!newIdDocumentUrl,
            hasBankBookImage: !!newBankBookImageUrl,
            qualificationCertificateCount: Object.keys(newCertificates).length,
          }
        });
        toast.error(result.error || 'プロフィールの更新に失敗しました');
      }
    } catch (error) {
      // 予期しないエラーの場合
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: 'プロフィール更新（例外）',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: {
          userId: userProfile.id,
          formDataLastName: formData.lastName,
          formDataFirstName: formData.firstName,
        }
      });
      toast.error('予期しないエラーが発生しました');
    } finally {
      setIsSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-gray-50 pb-8">
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
        {/* 必須項目の説明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <span className="text-red-500 font-bold">*</span> が付いている項目は、求人に応募する際に必要な情報です。
            プロフィールは少しずつ登録できますが、応募時にはこれらの項目が入力されている必要があります。
          </p>
        </div>

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
            <p className="text-xs text-gray-500 mt-2">10MB以下 / JPG, PNG, HEIC形式</p>

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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {showErrors && !formData.lastName && (
                <p className="text-red-500 text-xs mt-1">姓を入力してください</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {showErrors && !formData.firstName && (
                <p className="text-red-500 text-xs mt-1">名を入力してください</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">姓（カナ） <span className="text-red-500">*</span></label>
              <KatakanaInput
                value={formData.lastNameKana}
                onChange={(value) => setFormData({
                  ...formData,
                  lastNameKana: value,
                  // 口座名義を自動更新
                  accountName: generateBankAccountName(value, formData.firstNameKana)
                })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.lastNameKana ? 'border-red-500 bg-red-50' : formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                placeholder="ヤマダ"
              />
              {showErrors && !formData.lastNameKana && (
                <p className="text-red-500 text-xs mt-1">姓（カナ）を入力してください</p>
              )}
              {formData.lastNameKana && !isKatakanaOnly(formData.lastNameKana) && (
                <p className="text-red-500 text-xs mt-1">カタカナで入力してください</p>
              )}
              <p className="text-xs text-gray-500 mt-1">※カタカナで入力（ひらがなは自動変換）</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">名（カナ） <span className="text-red-500">*</span></label>
              <KatakanaInput
                value={formData.firstNameKana}
                onChange={(value) => setFormData({
                  ...formData,
                  firstNameKana: value,
                  // 口座名義を自動更新
                  accountName: generateBankAccountName(formData.lastNameKana, value)
                })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.firstNameKana ? 'border-red-500 bg-red-50' : formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                placeholder="タロウ"
              />
              {showErrors && !formData.firstNameKana && (
                <p className="text-red-500 text-xs mt-1">名（カナ）を入力してください</p>
              )}
              {formData.firstNameKana && !isKatakanaOnly(formData.firstNameKana) && (
                <p className="text-red-500 text-xs mt-1">カタカナで入力してください</p>
              )}
              <p className="text-xs text-gray-500 mt-1">※カタカナで入力（ひらがなは自動変換）</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">生年月日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.birthDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {showErrors && !formData.birthDate && (
                <p className="text-red-500 text-xs mt-1">生年月日を入力してください</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">性別 <span className="text-red-500">*</span></label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.gender ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              >
                <option value="">選択してください</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
              </select>
              {showErrors && !formData.gender && (
                <p className="text-red-500 text-xs mt-1">性別を選択してください</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">国籍 <span className="text-red-500">*</span></label>
              <select
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.nationality ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
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
        </section>

        {/* 2. 働き方と希望 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">2. 働き方と希望 <span className="text-red-500">*</span></h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">お仕事のご状況 <span className="text-red-500">*</span></label>
              <select
                value={formData.currentWorkStyle}
                onChange={(e) => setFormData({ ...formData, currentWorkStyle: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.currentWorkStyle ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              >
                <option value="">選択してください</option>
                {EMPLOYMENT_STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                {/* 旧値を保持しているユーザーのみ「（旧）xxx」形式で復活表示（候補2方針） */}
                {(LEGACY_EMPLOYMENT_STATUS_OPTIONS as ReadonlyArray<string>).includes(formData.currentWorkStyle) && (
                  <option value={formData.currentWorkStyle}>（旧）{formData.currentWorkStyle}</option>
                )}
              </select>
              {showErrors && !formData.currentWorkStyle && (
                <p className="text-red-500 text-xs mt-1">お仕事のご状況を選択してください</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">希望の働き方 <span className="text-red-500">*</span></label>
              <p className="text-xs text-gray-500 mb-3">※複数選択できます</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {DESIRED_WORK_STYLE_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.desiredWorkStyle.includes(opt)}
                      onChange={() => toggleDesiredWorkStyle(opt)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
              {/* 旧値（読み取り専用ラベル）: ユーザーが明示的に削除しない限りCSVに残し続ける */}
              {legacyDesiredWorkStyle.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">登録時に保存された旧仕様の値（×ボタンで削除可能）</p>
                  <div className="flex flex-wrap gap-2">
                    {legacyDesiredWorkStyle.map(value => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        （旧）{value}
                        <button
                          type="button"
                          onClick={() => removeLegacyDesiredWorkStyle(value)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`${value}を削除`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {showErrors && formData.desiredWorkStyle.length === 0 && legacyDesiredWorkStyle.length === 0 && (
                <p className="text-red-500 text-xs mt-1">希望の働き方を選択してください</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">いつ頃の求人をお探しですか？ <span className="text-red-500">*</span></label>
              <select
                value={formData.jobChangeDesire}
                onChange={(e) => setFormData({ ...formData, jobChangeDesire: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.jobChangeDesire ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              >
                <option value="">選択してください</option>
                {JOB_TIMING_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                {/* 旧値復活表示 */}
                {(LEGACY_JOB_TIMING_OPTIONS as ReadonlyArray<string>).includes(formData.jobChangeDesire) && (
                  <option value={formData.jobChangeDesire}>（旧）{formData.jobChangeDesire}</option>
                )}
              </select>
              {showErrors && !formData.jobChangeDesire && (
                <p className="text-red-500 text-xs mt-1">求人を探している時期を選択してください</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">どのくらい働きたいですか？</label>
                <select
                  value={formData.desiredWorkDaysPerWeek}
                  onChange={(e) => setFormData({ ...formData, desiredWorkDaysPerWeek: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">特になし</option>
                  {WORK_FREQUENCY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {/* 「単発・スポット」を含む場合のみ表示（登録フォームと同じ条件付き表示） */}
                  {formData.desiredWorkStyle.includes('単発・スポット') && (
                    <option value={WORK_FREQUENCY_SPOT_OPTION}>{WORK_FREQUENCY_SPOT_OPTION}</option>
                  )}
                  {/* 旧値復活表示 */}
                  {(LEGACY_WORK_FREQUENCY_OPTIONS as ReadonlyArray<string>).includes(formData.desiredWorkDaysPerWeek) && (
                    <option value={formData.desiredWorkDaysPerWeek}>（旧）{formData.desiredWorkDaysPerWeek}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">希望勤務期間</label>
                <select
                  value={formData.desiredWorkPeriod}
                  onChange={(e) => setFormData({ ...formData, desiredWorkPeriod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">特になし</option>
                  {DESIRED_WORK_PERIOD_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
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
                <select
                  value={formData.desiredStartTime}
                  onChange={(e) => setFormData({ ...formData, desiredStartTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">特になし</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">希望終了時刻</label>
                <select
                  value={formData.desiredEndTime}
                  onChange={(e) => setFormData({ ...formData, desiredEndTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">特になし</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 連絡先情報 */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">3. 連絡先情報 <span className="text-red-500">*</span></h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">電話番号 <span className="text-red-500">*</span></label>
              <SmsVerification
                phoneNumber={formData.phone}
                onPhoneNumberChange={(value) => {
                  setFormData({ ...formData, phone: value });
                  setPhoneVerificationToken(null);
                }}
                onVerified={async (token) => {
                  setPhoneVerificationToken(token);
                  const result = await savePhoneVerification(formData.phone, token);
                  if (result.success) {
                    refreshBadges();
                  } else {
                    toast.error(result.error || '電話番号の保存に失敗しました');
                  }
                }}
                initialVerified={!phoneChanged && userProfile.phone_verified}
                showError={showErrors && !formData.phone}
                errorMessage="電話番号を入力してください"
                inputClassName={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">メールアドレス <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, email: value });
                  const error = validateField('email', value);
                  setValidationErrors(prev => ({ ...prev, email: error }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.email ? 'border-red-500 bg-red-50' : validationErrors.email ? 'border-red-500' : 'border-gray-300'}`}
              />
              {showErrors && !formData.email && (
                <p className="text-red-500 text-xs mt-1">メールアドレスを入力してください</p>
              )}
              {validationErrors.email && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
              )}
            </div>
            {/* 住所入力（AddressSelectorを使用） */}
            <div className="md:col-span-2 mt-4 space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900">住所 <span className="text-red-500">*</span></h3>
              <AddressSelector
                prefecture={formData.prefecture}
                city={formData.city}
                addressLine={formData.address}
                building={formData.building}
                postalCode={formData.postalCode}
                onChange={(data) => {
                  setFormData(prev => ({
                    ...prev,
                    prefecture: data.prefecture,
                    city: data.city,
                    address: data.addressLine || '',
                    building: data.building || '',
                    postalCode: data.postalCode || ''
                  }));
                  // 郵便番号のバリデーションがある場合
                  if (data.postalCode) {
                    const error = validateField('postalCode', data.postalCode);
                    setValidationErrors(prev => ({ ...prev, postalCode: error }));
                  }
                }}
                required={true}
                showErrors={showErrors}
              />
              {validationErrors.postalCode && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.postalCode}</p>
              )}
            </div>
          </div>

          {/* 区切り線 */}
          <div className="border-t border-gray-200 my-6"></div>

          {/* 緊急連絡先 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <h3 className="text-md font-semibold mb-3">緊急連絡先 <span className="text-red-500">*</span></h3>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">氏名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.emergencyContactName ? 'border-red-500' : 'border-gray-300'}`}
              />
              {showErrors && !formData.emergencyContactName && (
                <p className="text-red-500 text-xs mt-1">緊急連絡先氏名は必須です</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">続柄</label>
              <input
                type="text"
                value={formData.emergencyContactRelation}
                onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">電話番号 <span className="text-red-500">*</span></label>
              <PhoneNumberInput
                value={formData.emergencyContactPhone}
                onChange={(value) => setFormData({ ...formData, emergencyContactPhone: value })}
                placeholder="09012345678"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.emergencyContactPhone ? 'border-red-500' : 'border-gray-300'}`}
              />
              <p className="text-xs text-gray-500 mt-1">※数字のみ（10桁または11桁）</p>
              {showErrors && !formData.emergencyContactPhone && (
                <p className="text-red-500 text-xs mt-1">緊急連絡先電話番号は必須です</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">住所</label>
              <input
                type="text"
                value={formData.emergencyContactAddress}
                onChange={(e) => setFormData({ ...formData, emergencyContactAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* 4. 資格 */}
        <section className={`bg-white rounded-lg shadow-sm p-6 mb-6 ${showErrors && formData.qualifications.length === 0 ? 'ring-2 ring-red-500' : ''}`}>
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">4. 資格 <span className="text-red-500">*</span></h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1">保有資格 <span className="text-red-500">*</span></label>
              <p className="text-sm text-gray-600 mb-3">
                ※保有している資格にチェックを入れ、<span className="font-bold text-red-500">必ず</span>資格証明書の写真を添付してください。
              </p>
              {QUALIFICATION_GROUPS.map((group) => (
                <div key={group.name} className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {group.qualifications.map((qual) => (
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
              ))}

              {/* その他資格（自由記述） - 登録フォームと同じ仕様 */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">その他</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasOtherQualification}
                    onChange={(e) => setFormData({
                      ...formData,
                      hasOtherQualification: e.target.checked,
                      // チェックを外したら自由記述も空にする
                      otherQualification: e.target.checked ? formData.otherQualification : '',
                    })}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm">その他（リストにない資格）</span>
                </label>
                {formData.hasOtherQualification && (
                  <input
                    type="text"
                    value={formData.otherQualification}
                    onChange={(e) => setFormData({ ...formData, otherQualification: e.target.value })}
                    placeholder="資格名を入力してください（複数の場合はカンマ区切り）"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                )}
              </div>

              {showErrors && formData.qualifications.length === 0 && !(formData.hasOtherQualification && formData.otherQualification.trim()) && (
                <p className="text-red-500 text-xs mt-2">少なくとも1つの資格を選択してください</p>
              )}
            </div>

            {/* 資格証明書アップロード - 選択された資格（その他以外）の数だけ表示 */}
            {formData.qualifications.filter(qual => qual !== 'その他').length > 0 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium">資格証明書アップロード <span className="text-red-500">*</span></label>
                {formData.qualifications.filter(qual => qual !== 'その他').map((qual) => (
                  <div key={qual} className={`border rounded-lg p-4 ${showErrors && !qualificationCertificates[qual] ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                    <label className="block text-sm font-medium text-gray-700 mb-3">{qual} <span className="text-red-500">*</span></label>

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
                          <p className="text-xs text-gray-500">10MB以下 / JPG, PNG, HEIC, PDF形式（自動圧縮）</p>
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
                          />
                        </label>
                        <p className="text-xs text-gray-500 text-center">10MB以下 / JPG, PNG, HEIC, PDF形式（自動圧縮）</p>
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
        </section>

        {/* 5. 経験・職歴 */}
        <section className={`bg-white rounded-lg shadow-sm p-6 mb-6 ${showErrors && !hasExperienceInput ? 'ring-2 ring-red-500' : ''}`}>
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">5. 経験・職歴 <span className="text-red-500">*</span></h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">経験分野 <span className="text-red-500">*</span></label>
              <p className="text-xs text-gray-500 mb-3">※「種別」と「経験年数」を選び、「＋経験を追加」で複数登録できます</p>

              <div className="space-y-3">
                {experienceRows.map((row, index) => {
                  // この行で選べる種別: 未選択の項目 ＋ この行が現在選んでいる項目
                  const isCurrentInMaster = row.field === '' || masterFieldNames.has(row.field);
                  return (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {/* 種別（カテゴリ見出し付き） */}
                      <select
                        value={row.field}
                        onChange={(e) => changeExperienceRowField(index, e.target.value)}
                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      >
                        <option value="">種別を選択</option>
                        {experienceFieldGroups.map((group) => (
                          <optgroup key={group.id} label={group.name}>
                            {group.fields.map((f) => (
                              <option
                                key={f.id}
                                value={f.name}
                                disabled={f.name !== row.field && selectedExperienceFields.has(f.name)}
                              >
                                {f.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        {/* マスタから外れた（非表示化された）既存の登録値を保持して表示 */}
                        {!isCurrentInMaster && (
                          <option value={row.field}>{row.field}</option>
                        )}
                      </select>

                      {/* 経験年数 */}
                      <select
                        value={row.years}
                        onChange={(e) => changeExperienceRowYears(index, e.target.value)}
                        className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      >
                        <option value="">経験年数</option>
                        {experienceYearOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>

                      {/* 行削除 */}
                      <button
                        type="button"
                        onClick={() => removeExperienceRow(index)}
                        className="self-end sm:self-auto p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="この経験を削除"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 行追加ボタン */}
              <button
                type="button"
                onClick={addExperienceRow}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
                経験を追加
              </button>

              {showErrors && !hasExperienceInput && (
                <p className="text-red-500 text-xs mt-2">少なくとも1つの経験分野を選択してください</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">職歴（任意）</label>
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

                {/* 職歴追加ボタン - 最後の職歴の下に配置 */}
                {workHistories.length < 5 && (
                  <button
                    type="button"
                    onClick={addWorkHistory}
                    className="w-full px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    職歴を追加
                  </button>
                )}
              </div>
            </div>
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

        {/* 7. 銀行口座情報・身分証明書 (ID-5: 身分証明書を必須セクションに移動) */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">7. 銀行口座情報・身分証明書 <span className="text-red-500">*</span></h2>

          <div className="space-y-4">
            {/* 銀行検索UI */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">銀行名 <span className="text-red-500">*</span></label>
                <BankSelector
                  value={formData.bankCode ? { code: formData.bankCode, name: formData.bankName } : null}
                  onChange={(bank) => {
                    if (bank) {
                      setFormData({
                        ...formData,
                        bankCode: bank.code,
                        bankName: bank.name,
                        // 銀行変更時は支店をリセット
                        branchCode: '',
                        branchName: ''
                      });
                    } else {
                      setFormData({
                        ...formData,
                        bankCode: '',
                        bankName: '',
                        branchCode: '',
                        branchName: ''
                      });
                    }
                  }}
                  required
                  showErrors={showErrors}
                  legacyName={!formData.bankCode ? formData.bankName : ''}
                />
              </div>
              {isYucho ? (
                /* ゆうちょ: 通帳の記号・番号を入力。振込用(店番・口座番号)は自動計算し本人確認してもらう。 */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">記号（5桁） <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.yuchoSymbol}
                        onChange={(e) => {
                          // 全角→半角・数字のみ・5桁に強制（maxLengthだけだと貼付け等ですり抜けるため）
                          const value = e.target.value
                            .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                            .replace(/[^0-9]/g, '')
                            .slice(0, 5);
                          setFormData({ ...formData, yuchoSymbol: value });
                          setYuchoConfirmed(false);
                        }}
                        maxLength={5}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.yuchoSymbol ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        placeholder="12345"
                      />
                      <p className="text-xs text-gray-500 mt-1">※通帳の「記号」（5桁）</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">番号（最大8桁） <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.yuchoNumber}
                        onChange={(e) => {
                          // 全角→半角・数字のみ・8桁に強制
                          const value = e.target.value
                            .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                            .replace(/[^0-9]/g, '')
                            .slice(0, 8);
                          setFormData({ ...formData, yuchoNumber: value });
                          setYuchoConfirmed(false);
                        }}
                        maxLength={8}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.yuchoNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        placeholder="12345671"
                      />
                      <p className="text-xs text-gray-500 mt-1">※通帳の「番号」</p>
                    </div>
                  </div>
                  {/* 自動計算結果（振込用）＋本人確認 */}
                  {formData.yuchoSymbol && formData.yuchoNumber && (
                    yuchoConv && yuchoConv.ok ? (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <p className="text-sm font-medium text-gray-800">振込用（自動計算）</p>
                        <p className="text-sm text-gray-700">店番 <span className="font-mono font-bold">{yuchoConv.branchCode}</span>（支店名 <span className="font-bold">{yuchoBranchName(yuchoConv.branchCode)}</span>） ／ 預金種目 普通 ／ 口座番号 <span className="font-mono font-bold">{yuchoConv.accountNumber}</span></p>
                        {yuchoChanged ? (
                          /* 記号・番号を変更したときのみ本人確認を求める */
                          <>
                            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={yuchoConfirmed}
                                onChange={(e) => setYuchoConfirmed(e.target.checked)}
                                className="mt-1"
                              />
                              <span>通帳の「振込用の店名・預金種目・口座番号のご案内」と一致していることを確認しました</span>
                            </label>
                            {showErrors && !yuchoConfirmed && (
                              <p className="text-red-500 text-xs">振込用の内容を確認してチェックを入れてください</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-green-600">✓ 登録済み（記号・番号を変更する場合のみ再確認が必要です）</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-red-500 text-sm">{yuchoConv && !yuchoConv.ok ? yuchoConv.error : '記号・番号をご確認ください'}</p>
                    )
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">支店名 <span className="text-red-500">*</span></label>
                  <BranchSelector
                    bankCode={formData.bankCode || null}
                    value={formData.branchCode ? { code: formData.branchCode, name: formData.branchName } : null}
                    onChange={(branch) => {
                      if (branch) {
                        setFormData({
                          ...formData,
                          branchCode: branch.code,
                          branchName: branch.name
                        });
                      } else {
                        setFormData({
                          ...formData,
                          branchCode: '',
                          branchName: ''
                        });
                      }
                    }}
                    required
                    showErrors={showErrors}
                    legacyName={!formData.branchCode ? formData.branchName : ''}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">口座名義（カナ） <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.accountName}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700 border-gray-300 cursor-not-allowed"
                    placeholder="姓名（カナ）を入力すると自動生成されます"
                  />
                  {showErrors && !formData.accountName && (
                    <p className="text-red-500 text-xs mt-1">口座名義を生成するには姓名（カナ）を入力してください</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">※姓名（カナ）から自動生成されます</p>
                </div>
                {!isYucho && (
                  <div>
                    <label className="block text-sm font-medium mb-2">口座番号 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.accountNumber}
                      onChange={(e) => {
                        // 数字のみ許可（全角数字は半角に変換）
                        const value = e.target.value
                          .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                          .replace(/[^0-9]/g, '');
                        setFormData({ ...formData, accountNumber: value });
                      }}
                      maxLength={7}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${showErrors && !formData.accountNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      placeholder="1234567"
                    />
                    {showErrors && !formData.accountNumber && (
                      <p className="text-red-500 text-xs mt-1">口座番号を入力してください</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">※半角数字で入力（7桁）</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div>
                <label className="block text-sm font-medium mb-2">通帳コピーアップロード <span className="text-red-500">*</span></label>
                {bankBookImage ? (
                  <div className="flex flex-col gap-3">
                    {/* 画像プレビュー */}
                    <div className="relative w-full h-48 sm:h-40 border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                      <img src={bankBookImage} alt="通帳コピー" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-xs text-green-600">✓ 登録済み</p>
                    {/* 変更ボタン */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-center text-sm font-medium">
                        画像を変更
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleBankBookImageChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500">10MB以下 / JPG, PNG, HEIC, PDF形式</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className={`block w-full px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer text-center text-sm font-medium border-2 border-dashed ${showErrors ? 'bg-red-50 text-red-700 border-red-300' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      📷 ファイルを選択
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleBankBookImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 text-center">10MB以下 / JPG, PNG, HEIC, PDF形式</p>
                    {showErrors && (
                      <p className="text-red-500 text-xs text-center">通帳コピーをアップロードしてください</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 身分証明書 - ID-5: 必須セクション内に移動 */}
            <div>
              <label className="block text-sm font-medium mb-2">身分証明書アップロード <span className="text-red-500">*</span></label>
              {idDocument ? (
                <div className="flex flex-col gap-3">
                  {/* 画像プレビュー */}
                  <div className="relative w-full h-48 sm:h-40 border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                    <img src={idDocument} alt="身分証明書" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-xs text-green-600">✓ 登録済み</p>
                  {/* 変更ボタン */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-center text-sm font-medium">
                      画像を変更
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleIdDocumentChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500">10MB以下 / JPG, PNG, HEIC, PDF形式</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`block w-full px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer text-center text-sm font-medium border-2 border-dashed ${showErrors ? 'bg-red-50 text-red-700 border-red-300' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    📷 ファイルを選択
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleIdDocumentChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 text-center">10MB以下 / JPG, PNG, HEIC, PDF形式</p>
                  {showErrors && (
                    <p className="text-red-500 text-xs text-center">身分証明書をアップロードしてください</p>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">運転免許証、マイナンバーカードなど</p>
            </div>
          </div>
        </section>

        {/* 8. その他（任意） - ID-5: 身分証明書を上のセクションに移動したため、年金番号のみ */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 pb-3 border-b">8. その他（任意）</h2>

          <div className="space-y-4">
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
          </div>
        </section>

        {/* ボタン */}
        <div className="flex gap-4">
          <Link
            href="/mypage"
            className={`flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-bold transition-colors text-center ${isSaving ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'}`}
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (uploadProgress || '保存中...') : '保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}
