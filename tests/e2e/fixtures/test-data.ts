/**
 * E2Eテスト用の共通データ定義
 */

// 新規ワーカー登録用データ
export const NEW_WORKER_DATA = {
  lastName: 'テスト',
  firstName: '太郎',
  lastNameKana: 'テスト',
  firstNameKana: 'タロウ',
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123',
  phoneNumber: '09012345678',
  birthDate: '1990-01-01',
  gender: '男性',
  nationality: '日本',
  postalCode: '1500001',
  prefecture: '東京都',
  city: '渋谷区',
  address: '神宮前1-1-1',
};

// 求人検索フィルター用データ
export const JOB_FILTERS = {
  minWage: 1500,
  maxWage: 3000,
  serviceTypes: ['介護老人保健施設', '特別養護老人ホーム', '有料老人ホーム'],
  prefectures: ['東京都', '神奈川県', '埼玉県', '千葉県'],
};

// メッセージテスト用データ
export const TEST_MESSAGE = {
  text: 'E2Eテストからの自動送信メッセージです。',
  longText: 'これは長文のテストメッセージです。'.repeat(10),
};

// レビューテスト用データ
export const TEST_REVIEW = {
  overallRating: 5,
  comment: 'E2Eテストからのレビューコメントです。とても良い経験でした。',
  detailRatings: {
    attendance: 5,
    skill: 4,
    execution: 5,
    communication: 4,
    attitude: 5,
  },
};

// 求人作成用データ（施設側）
export const NEW_JOB_DATA = {
  title: 'E2Eテスト求人',
  description: 'E2Eテスト用の求人です。',
  hourlyWage: 1800,
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: 60,
  requiredCapacity: 2,
  deadline: 3, // 勤務日の3日前
};

// 待機時間設定
export const TIMEOUTS = {
  navigation: 10000,
  animation: 500,
  api: 5000,
  toast: 3000,
  modal: 1000,
};

// セレクター定義（よく使うもの）
export const SELECTORS = {
  // 共通
  toast: '[data-testid="toast"], .Toastify__toast, [role="alert"]',
  modal: '[role="dialog"], .modal',
  loadingSpinner: '[data-testid="loading"], .loading, .spinner',

  // ワーカー側
  worker: {
    loginForm: 'form',
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
    jobCard: 'a[href^="/jobs/"]',
    myJobCard: 'a[href^="/my-jobs/"]',
  },

  // 施設側
  facility: {
    loginForm: 'form',
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
    jobCard: 'a[href^="/admin/jobs/"]',
    workerCard: 'a[href^="/admin/workers/"]',
  },
};

// ステータスラベル
export const STATUS_LABELS = {
  application: {
    APPLIED: '審査中',
    SCHEDULED: '勤務予定',
    WORKING: '勤務中',
    COMPLETED_PENDING: '評価待ち',
    COMPLETED_RATED: '完了',
    CANCELLED: 'キャンセル',
  },
  job: {
    DRAFT: '下書き',
    RECRUITING: '公開中',
    PAUSED: '一時停止',
    CLOSED: '終了',
  },
};

// バリデーションエラーメッセージ
export const VALIDATION_MESSAGES = {
  // 必須項目
  required: '必須項目です',
  requiredField: '入力してください',
  requiredSelect: '選択してください',

  // メール
  invalidEmail: '有効なメールアドレスを入力してください',
  emailFormat: 'メールアドレスの形式が正しくありません',

  // 電話番号
  invalidPhone: '有効な電話番号を入力してください',
  phoneFormat: '電話番号の形式が正しくありません',

  // パスワード
  passwordMismatch: 'パスワードが一致しません',
  passwordTooShort: 'パスワードは8文字以上で入力してください',
  passwordRequirements: '英数字を含む8文字以上',

  // 名前・フリガナ
  katakanaOnly: 'カタカナで入力してください',
  invalidKatakana: 'カタカナのみ入力可能です',

  // 日付関連
  pastDateNotAllowed: '過去の日付は選択できません',
  invalidDate: '有効な日付を入力してください',
  jobStartTooSoon: '勤務開始4時間前を過ぎた求人には応募できません',

  // 画像アップロード
  imageSizeExceeded: 'ファイルサイズが大きすぎます',
  imageRequired: '画像をアップロードしてください',
  certificateRequired: '資格証明書をアップロードしてください',

  // 郵便番号
  invalidPostalCode: '郵便番号の形式が正しくありません',
};

// 無効な入力データ（バリデーションテスト用）
export const INVALID_INPUT_DATA = {
  // メール
  invalidEmails: [
    'invalid',
    'invalid@',
    '@example.com',
    'invalid@.com',
    'invalid@example',
    'あいうえお@example.com',
  ],

  // 電話番号
  invalidPhones: [
    '123',
    'abcdefghijk',
    '090-1234-567',
    '0901234567890',
  ],

  // パスワード
  weakPasswords: [
    '1234567',      // 8文字未満
    'password',     // 数字なし
    '12345678',     // 英字なし
  ],

  // フリガナ（カタカナ以外）
  invalidKatakana: [
    'ひらがな',
    '漢字',
    'alphabet',
    '123',
    'テスト123',
    'テストabc',
  ],

  // 郵便番号
  invalidPostalCodes: [
    '123',
    '1234567890',
    'abc-defg',
  ],
};

// 有効な入力データ（正常系テスト用）
export const VALID_INPUT_DATA = {
  emails: [
    'test@example.com',
    'user.name@example.co.jp',
  ],

  phones: [
    '09012345678',
    '090-1234-5678',
    '03-1234-5678',
  ],

  passwords: [
    'Password123',
    'TestPass1',
    'Secure123!',
  ],

  katakana: [
    'タナカ',
    'ヤマダタロウ',
    'サトウハナコ',
  ],

  postalCodes: [
    '1500001',
    '150-0001',
  ],
};

// CSSクラス・スタイル（バリデーションエラー表示確認用）
export const ERROR_STYLES = {
  // エラー時の赤枠（Tailwind CSS）
  borderError: 'border-red',
  ringError: 'ring-red',
  textError: 'text-red',

  // フォーカス時のエラースタイル
  focusError: 'focus:border-red',
  focusRingError: 'focus:ring-red',
};
