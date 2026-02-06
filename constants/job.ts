/**
 * 求人関連の定数定義
 */

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
] as const;

export const FACILITY_TYPES = [
  '介護施設', '医療機関', '保育施設', '障がい者支援施設'
] as const;

// 旧定数（後方互換性のため維持、非推奨）
export const JOB_TYPES = ['通常業務', '説明会'] as const;

// 求人種別（DB保存用の値）
export type JobTypeValue = 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'ORIENTATION' | 'OFFER';

// 求人種別の選択肢（オファーを除く4種類）
export const JOB_TYPE_OPTIONS: { value: JobTypeValue; label: string; description: string }[] = [
  {
    value: 'NORMAL',
    label: '通常求人',
    description: 'すべてのワーカーが閲覧・応募できる求人です。',
  },
  {
    value: 'LIMITED_WORKED',
    label: '限定求人（勤務済みの方）',
    description: '過去にあなたの施設で勤務したワーカーのみが閲覧・応募できます。',
  },
  {
    value: 'LIMITED_FAVORITE',
    label: '限定求人（お気に入りのみ）',
    description: 'あなたがお気に入り登録しているワーカーのみが閲覧・応募できます。',
  },
  {
    value: 'ORIENTATION',
    label: '説明会',
    description: '施設の説明会として求人を作成します。「説明会」バッジが表示されます。',
  },
];

// 求人種別ラベルのマップ（表示用）
export const JOB_TYPE_LABELS: Record<JobTypeValue, string> = {
  NORMAL: '通常求人',
  LIMITED_WORKED: '限定求人（勤務済み）',
  LIMITED_FAVORITE: '限定求人（お気に入り）',
  ORIENTATION: '説明会',
  OFFER: 'オファー',
};

// 通常求人切り替え日数の選択肢
export const SWITCH_TO_NORMAL_OPTIONS = [
  { value: 0, label: '切り替えない' },
  { value: 1, label: '1日前' },
  { value: 3, label: '3日前' },
  { value: 7, label: '7日前' },
  { value: 14, label: '14日前' },
] as const;

export const WORK_CONTENT_OPTIONS = [
  '対話・見守り', '移動介助', '排泄介助', '食事介助', '入浴介助(全般)',
  '入浴介助(大浴場)', '入浴介助(個浴)', '入浴介助(機械浴)', 'バイタル測定',
  '記録業務', 'レク・体操', '送迎(運転)', '送迎(同乗)', '配膳下膳',
  '口腔ケア', '環境整備', '起床介助', '就寝介助', '体位変換', '清拭',
  'おむつ交換', 'コール対応', '服薬介助', '薬・軟膏塗布', '更衣介助',
  '外出介助', '買い物代行', '調理', '清掃', '洗濯', 'リネン交換',
  '夜勤(全般)', '巡視・巡回', '緊急時対応', '申し送り', 'カンファレンス',
  '事務作業', '物品管理', '利用者家族対応', 'イベント企画', '機能訓練補助',
  '趣味活動支援', '生活相談',
  // 医療・看護系業務
  '点滴', 'インスリン注射', '採血', '血糖測定',
  '褥瘡・スキントラブル予防', '排便コントロール', '生活指導',
  '爪切り', '整容', '足浴', '陰洗', '入浴可否判断',
  '服薬管理', '痰吸引', '経管栄養', '胃ろうケア',
  '膀胱留置カテーテル管理', 'ストマケア',
] as const;

// 資格定数のインポート
export { JOB_QUALIFICATION_OPTIONS, QUALIFICATION_GROUPS } from './qualifications';
export type { JobQualificationOption } from './qualifications';

// 後方互換性のためにエイリアスとしてエクスポート
import { JOB_QUALIFICATION_OPTIONS } from './qualifications';
export const QUALIFICATION_OPTIONS = JOB_QUALIFICATION_OPTIONS;

export const ICON_OPTIONS = [
  '未経験者歓迎',
  'ブランク歓迎',
  '髪型・髪色自由',
  'ネイルOK',
  '制服貸与',
  '車通勤OK',
  '食事補助',
] as const;

// 勤務日条件のラベル（N回以上勤務）
export const WORK_FREQUENCY_LABELS = {
  2: '2回以上勤務',
  3: '3回以上勤務',
  4: '4回以上勤務',
  5: '5回以上勤務',
} as const;

// 後方互換性のためのエイリアス（非推奨：WORK_FREQUENCY_LABELSを使用してください）
export const WORK_FREQUENCY_ICONS = WORK_FREQUENCY_LABELS;

export type JobType = typeof JOB_TYPES[number];
export type WorkContentOption = typeof WORK_CONTENT_OPTIONS[number];
export type QualificationOption = typeof QUALIFICATION_OPTIONS[number];
export type IconOption = typeof ICON_OPTIONS[number];
