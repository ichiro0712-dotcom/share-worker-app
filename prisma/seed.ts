import { PrismaClient, JobStatus, WorkerStatus, ReviewStatus, ReviewerType, BookmarkType, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// パスワードをハッシュ化するヘルパー関数
const hashPassword = (password: string) => bcrypt.hashSync(password, 10);

// ========================================
// 定数データ
// ========================================

// サービス種別
const facilityTypes = [
  'デイサービス',
  '訪問介護',
  '特別養護老人ホーム',
  'グループホーム',
  '有料老人ホーム',
  '介護老人保健施設',
  '小規模多機能型居宅介護',
  'サービス付き高齢者向け住宅',
  'ショートステイ',
  '訪問看護',
];

// 名字リスト
const lastNames = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '松本', '井上', '木村'];
// 名前リスト
const firstNames = {
  male: ['太郎', '一郎', '健太', '大輔', '翔太', '拓也', '直樹', '和也', '雄介', '俊介'],
  female: ['花子', '美咲', '由美', '恵子', '理恵', '直子', '麻衣', '綾', '沙織', '優子'],
};

// 資格リスト
const qualifications = [
  '介護福祉士',
  '初任者研修',
  '実務者研修',
  '正看護師',
  '准看護師',
  'ケアマネージャー',
  '社会福祉士',
  'ホームヘルパー2級',
];

// 都道府県と市区町村
const addressData = [
  { pref: '東京都', cities: ['新宿区', '渋谷区', '世田谷区', '練馬区', '杉並区', '豊島区', '中野区', '板橋区', '北区', '足立区'] },
  { pref: '神奈川県', cities: ['横浜市港北区', '横浜市青葉区', '川崎市中原区', '川崎市高津区', '相模原市中央区', '藤沢市', '茅ヶ崎市'] },
  { pref: '埼玉県', cities: ['さいたま市大宮区', 'さいたま市浦和区', '川口市', '所沢市', '越谷市', '草加市', '春日部市'] },
  { pref: '千葉県', cities: ['千葉市中央区', '船橋市', '柏市', '松戸市', '市川市', '浦安市', '習志野市'] },
];

// 法人名パターン
const corporationPatterns = ['社会福祉法人', '医療法人', '株式会社', '合同会社', 'NPO法人'];
const corporationNames = ['ひかり', 'あおぞら', 'さくら', 'みどり', 'ゆうわ', 'けやき', 'つばさ', 'はなみずき', 'あすなろ', 'わかば'];

// 画像URL（実在するサンプル画像を使用）
const facilityImages = [
  '/images/samples/facility_top_1.png',
  '/images/samples/facility_top_2.png',
  '/images/samples/facility_top_3.png',
  '/images/samples/facility_top_4.png',
];

// ========================================
// ユーティリティ関数
// ========================================
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 日付関連
const today = new Date();
function addDays(days: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date;
}

function addHours(hours: number): Date {
  return new Date(today.getTime() + hours * 60 * 60 * 1000);
}

function subtractDays(days: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
}

// ========== 通知設定の初期データ ==========

const notificationSettings = [
  // ワーカー向け
  {
    notification_key: 'WORKER_MATCHED',
    name: 'マッチング成立',
    description: '応募が承認され、マッチングが成立した時に送信',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{worker_name}}さん、マッチングが成立しました！

勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}
報酬: {{wage}}円

当日はよろしくお願いいたします。`,
    email_subject: '【+TASTAS】マッチング成立のお知らせ',
    email_body: `{{worker_name}}様

お仕事のマッチングが成立しました。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}
報酬: {{wage}}円

詳細はマイページよりご確認ください。
{{job_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: 'マッチング成立',
    push_body: '{{facility_name}}の勤務が確定しました',
  },
  {
    notification_key: 'WORKER_INTERVIEW_ACCEPTED',
    name: '審査あり求人：採用決定',
    description: '審査後に採用が決定した時に送信',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{worker_name}}さん、採用が決定しました！

勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

当日はよろしくお願いいたします。`,
    email_subject: '【+TASTAS】採用決定のお知らせ',
    email_body: `{{worker_name}}様

{{facility_name}}への応募が承認され、採用が決定しました。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}
報酬: {{wage}}円

詳細はマイページよりご確認ください。
{{job_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '採用決定',
    push_body: '{{facility_name}}への応募が承認されました',
  },
  {
    notification_key: 'WORKER_INTERVIEW_REJECTED',
    name: '審査あり求人：不採用',
    description: '審査後に不採用となった時に送信',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: false,
    chat_message: `{{worker_name}}さん、この度は{{facility_name}}へのご応募ありがとうございました。

選考の結果、今回はご縁がありませんでした。
また別の求人でお会いできることを楽しみにしております。`,
    email_subject: '【+TASTAS】選考結果のお知らせ',
    email_body: `{{worker_name}}様

この度は{{facility_name}}へのご応募ありがとうございました。

選考の結果、今回はご縁がありませんでした。
また別の求人でお会いできることを楽しみにしております。

引き続き+TASTASをよろしくお願いいたします。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'WORKER_CANCELLED_BY_FACILITY',
    name: '施設からのキャンセル',
    description: '施設が予約をキャンセルした時に送信',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{worker_name}}さん、残念なお知らせです。

{{facility_name}}の{{work_date}}の勤務がキャンセルされました。

ご不便をおかけして申し訳ございません。
他の求人をお探しください。`,
    email_subject: '【+TASTAS】勤務キャンセルのお知らせ',
    email_body: `{{worker_name}}様

ご予約いただいていた勤務がキャンセルされました。

━━━━━━━━━━━━━━━━━━━━━━
■ キャンセルされた勤務
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

ご不便をおかけして申し訳ございません。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '勤務キャンセル',
    push_body: '{{facility_name}}の勤務がキャンセルされました',
  },
  {
    notification_key: 'WORKER_REMINDER_DAY_BEFORE',
    name: '勤務前日リマインド',
    description: '勤務前日に送信するリマインダー',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{worker_name}}さん、明日の勤務リマインドです。

勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

持ち物や服装をご確認の上、お気をつけてお越しください。`,
    email_subject: '【+TASTAS】明日の勤務リマインド',
    email_body: `{{worker_name}}様

明日の勤務についてお知らせいたします。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
勤務先: {{facility_name}}
日時: {{work_date}} {{start_time}}〜{{end_time}}

持ち物や服装をご確認の上、お気をつけてお越しください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '明日の勤務',
    push_body: '{{facility_name}} {{start_time}}〜',
  },
  {
    notification_key: 'WORKER_REMINDER_SAME_DAY',
    name: '勤務当日リマインド',
    description: '勤務当日朝に送信するリマインダー',
    target_type: 'WORKER',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】本日の勤務リマインド',
    email_body: `{{worker_name}}様

本日の勤務リマインドです。

勤務先: {{facility_name}}
開始時間: {{start_time}}

お気をつけてお越しください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '本日の勤務',
    push_body: '{{facility_name}} {{start_time}}〜 お気をつけて！',
  },
  {
    notification_key: 'WORKER_REVIEW_REQUEST',
    name: 'レビュー依頼',
    description: '勤務終了後にレビュー投稿を依頼',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: false,
    chat_message: `{{worker_name}}さん、お疲れ様でした！

{{facility_name}}での勤務はいかがでしたか？
ぜひレビューを投稿してください。

{{review_url}}`,
    email_subject: '【+TASTAS】レビューのお願い',
    email_body: `{{worker_name}}様

{{facility_name}}での勤務お疲れ様でした。

勤務の感想をぜひレビューとしてお寄せください。
{{review_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'WORKER_REVIEW_REMINDER',
    name: 'レビュー催促',
    description: '未投稿のレビューがある場合に催促',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: false,
    chat_message: `{{worker_name}}さん、レビューの投稿はお済みですか？

{{facility_name}}でのお仕事について、ぜひご感想をお聞かせください。

{{review_url}}`,
    email_subject: '【+TASTAS】レビュー投稿のリマインド',
    email_body: `{{worker_name}}様

{{facility_name}}でのお仕事のレビューはお済みですか？

ご感想をお寄せいただくことで、サービスの向上に役立てさせていただきます。
{{review_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'WORKER_REVIEW_RECEIVED',
    name: '施設からレビューが届いた',
    description: '施設からレビューが投稿された時に送信',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: false,
    chat_message: `{{worker_name}}さん、{{facility_name}}からレビューが届きました！

マイページでご確認ください。`,
    email_subject: '【+TASTAS】レビューが届きました',
    email_body: `{{worker_name}}様

{{facility_name}}からレビューが届きました。

マイページよりご確認ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'WORKER_ANNOUNCEMENT',
    name: 'お知らせ（運営から）',
    description: '運営からのお知らせを送信',
    target_type: 'WORKER',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】運営からのお知らせ',
    email_body: '{{announcement_title}}\n\n{{announcement_body}}',
    push_title: '+TASTASからのお知らせ',
    push_body: '{{announcement_title}}',
  },
  {
    notification_key: 'WORKER_FAVORITE_DEADLINE',
    name: '応募締切間近のお気に入り求人',
    description: 'お気に入り求人の締切が近い時に送信',
    target_type: 'WORKER',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】お気に入り求人の締切間近',
    email_body: '{{facility_name}}の求人があと{{remaining_hours}}時間で締切です。\n\nマイページをご確認ください。',
    push_title: '締切間近',
    push_body: '{{facility_name}}の求人があと{{remaining_hours}}時間で締切です',
  },
  {
    notification_key: 'WORKER_FAVORITE_NEW_JOB',
    name: 'お気に入り施設の新着求人',
    description: 'お気に入り施設に新しい求人が出た時に送信',
    target_type: 'WORKER',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】新着求人のお知らせ',
    email_body: '{{facility_name}}に新しい求人が追加されました。\n\nマイページをご確認ください。',
    push_title: '新着求人',
    push_body: '{{facility_name}}に新しい求人が追加されました',
  },
  {
    notification_key: 'WORKER_NEARBY_NEW_JOB',
    name: '近隣エリアの新着求人',
    description: '登録住所の近くで新しい求人が出た時に送信',
    target_type: 'WORKER',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】近くで新着求人があります',
    email_body: `{{worker_last_name}}様

近くのエリアで新しい求人が追加されました。

━━━━━━━━━━━━━━━━━━━━━━
■ 求人詳細
━━━━━━━━━━━━━━━━━━━━━━
施設名: {{facility_name}}
求人名: {{job_title}}
勤務日: {{work_date}}

詳細はこちらからご確認ください。
{{job_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '近くで新着求人',
    push_body: '{{facility_name}}で新しい求人が追加されました',
  },
  {
    notification_key: 'WORKER_NEARBY_CANCEL_AVAILABLE',
    name: '近隣エリアのキャンセル枠発生',
    description: '近くの求人でキャンセルが発生し空きが出た時に送信',
    target_type: 'WORKER',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】近くで空き枠が出ました',
    email_body: `{{worker_last_name}}様

近くのエリアでキャンセル枠が発生しました。

━━━━━━━━━━━━━━━━━━━━━━
■ 求人詳細
━━━━━━━━━━━━━━━━━━━━━━
施設名: {{facility_name}}
求人名: {{job_title}}
勤務日: {{work_date}}

詳細はこちらからご確認ください。
{{job_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '近くで空き枠発生',
    push_body: '{{facility_name}}でキャンセル枠が出ました',
  },
  {
    notification_key: 'WORKER_NEW_MESSAGE',
    name: '施設からのメッセージ',
    description: '施設から新しいメッセージが届いた時に送信',
    target_type: 'WORKER',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{facility_name}}からメッセージが届きました。

メッセージを確認してください。`,
    email_subject: '【+TASTAS】新しいメッセージが届きました',
    email_body: `{{worker_name}}様

{{facility_name}}から新しいメッセージが届きました。

━━━━━━━━━━━━━━━━━━━━━━
■ メッセージ
━━━━━━━━━━━━━━━━━━━━━━
{{message_content}}

メッセージ画面でご確認・ご返信ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '新着メッセージ',
    push_body: '{{facility_name}}からメッセージが届きました',
  },

  // 施設向け
  {
    notification_key: 'FACILITY_NEW_APPLICATION',
    name: '新規応募',
    description: 'ワーカーから新しい応募があった時に送信',
    target_type: 'FACILITY',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `新しい応募がありました！

求人: {{job_title}}
応募者: {{worker_name}}さん
勤務希望日: {{work_date}}

応募管理画面でご確認ください。`,
    email_subject: '【+TASTAS】新しい応募がありました',
    email_body: `{{facility_name}}様

新しい応募がありました。

━━━━━━━━━━━━━━━━━━━━━━
■ 応募詳細
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
応募者: {{worker_name}}さん
勤務希望日: {{work_date}}

応募管理画面でご確認ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '新規応募',
    push_body: '{{worker_name}}さんから応募がありました',
  },
  {
    notification_key: 'FACILITY_CANCELLED_BY_WORKER',
    name: 'ワーカーからのキャンセル',
    description: 'ワーカーが予約をキャンセルした時に送信',
    target_type: 'FACILITY',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{worker_name}}さんから勤務キャンセルの連絡がありました。

求人: {{job_title}}
日時: {{work_date}}

代わりのワーカーをお探しください。`,
    email_subject: '【+TASTAS】勤務キャンセルのお知らせ',
    email_body: `{{facility_name}}様

ワーカーから勤務キャンセルの連絡がありました。

━━━━━━━━━━━━━━━━━━━━━━
■ キャンセル詳細
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
ワーカー: {{worker_name}}さん
日時: {{work_date}}

代わりのワーカーをお探しください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: 'キャンセル通知',
    push_body: '{{worker_name}}さんが勤務をキャンセルしました',
  },
  {
    notification_key: 'FACILITY_REMINDER_DAY_BEFORE',
    name: '勤務前日リマインド',
    description: '勤務前日に送信するリマインダー',
    target_type: 'FACILITY',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `明日の勤務リマインドです。

求人: {{job_title}}
ワーカー: {{worker_name}}さん
日時: {{work_date}} {{start_time}}〜{{end_time}}

ワーカーの受け入れ準備をお願いいたします。`,
    email_subject: '【+TASTAS】明日の勤務リマインド',
    email_body: `{{facility_name}}様

明日の勤務についてお知らせいたします。

━━━━━━━━━━━━━━━━━━━━━━
■ 勤務詳細
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
ワーカー: {{worker_name}}さん
日時: {{work_date}} {{start_time}}〜{{end_time}}

ワーカーの受け入れ準備をお願いいたします。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '明日の勤務',
    push_body: '{{worker_name}}さんが出勤予定です',
  },
  {
    notification_key: 'FACILITY_REVIEW_REQUEST',
    name: 'レビュー依頼',
    description: '勤務終了後にレビュー投稿を依頼',
    target_type: 'FACILITY',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: false,
    chat_message: `{{worker_name}}さんの勤務が完了しました。

ぜひワーカーのレビューを投稿してください。
今後のマッチングの参考になります。

{{review_url}}`,
    email_subject: '【+TASTAS】レビューのお願い',
    email_body: `{{facility_name}}様

{{worker_name}}さんの勤務が完了しました。

ワーカーのレビューをぜひお寄せください。
{{review_url}}

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'FACILITY_REVIEW_RECEIVED',
    name: 'ワーカーからレビューが届いた',
    description: 'ワーカーからレビューが投稿された時に送信',
    target_type: 'FACILITY',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: false,
    chat_message: `{{worker_name}}さんからレビューが届きました！

管理画面でご確認ください。`,
    email_subject: '【+TASTAS】レビューが届きました',
    email_body: `{{facility_name}}様

{{worker_name}}さんからレビューが届きました。

管理画面よりご確認ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'FACILITY_NEW_MESSAGE',
    name: 'ワーカーからのメッセージ',
    description: 'ワーカーから新しいメッセージが届いた時に送信',
    target_type: 'FACILITY',
    chat_enabled: true,
    email_enabled: true,
    push_enabled: true,
    chat_message: `{{worker_name}}さんからメッセージが届きました。

メッセージを確認してください。`,
    email_subject: '【+TASTAS】新しいメッセージが届きました',
    email_body: `{{facility_name}}様

{{worker_name}}さんから新しいメッセージが届きました。

━━━━━━━━━━━━━━━━━━━━━━
■ メッセージ
━━━━━━━━━━━━━━━━━━━━━━
{{message_content}}

管理画面でご確認・ご返信ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: '新着メッセージ',
    push_body: '{{worker_name}}さんからメッセージが届きました',
  },
  {
    notification_key: 'FACILITY_DEADLINE_WARNING',
    name: '求人締切間近（応募少ない）',
    description: '締切が近く応募が少ない求人を通知',
    target_type: 'FACILITY',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: false,
    chat_message: null,
    email_subject: '【+TASTAS】求人の締切が近づいています',
    email_body: `{{facility_name}}様

以下の求人の締切が近づいています。

━━━━━━━━━━━━━━━━━━━━━━
■ 求人情報
━━━━━━━━━━━━━━━━━━━━━━
求人: {{job_title}}
勤務日: {{work_date}}
締切: {{deadline}}
応募状況: {{applied_count}}/{{recruitment_count}}名

まだ募集枠に空きがあります。
必要に応じて求人内容の見直しをご検討ください。

──────────────────────────
+TASTAS 運営
──────────────────────────`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'FACILITY_SLOTS_FILLED',
    name: '募集枠が埋まった',
    description: '求人の募集枠が全て埋まった時に送信',
    target_type: 'FACILITY',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】募集枠が埋まりました',
    email_body: '{{job_title}}の募集枠が全て埋まりました。\n\n管理画面をご確認ください。',
    push_title: '募集完了',
    push_body: '{{job_title}}の募集枠が埋まりました',
  },
  {
    notification_key: 'FACILITY_ANNOUNCEMENT',
    name: 'お知らせ（運営から）',
    description: '運営からのお知らせを送信',
    target_type: 'FACILITY',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: true,
    chat_message: null,
    email_subject: '【+TASTAS】運営からのお知らせ',
    email_body: '{{announcement_title}}\n\n{{announcement_body}}',
    push_title: '+TASTASからのお知らせ',
    push_body: '{{announcement_title}}',
  },

  // システム管理者向け
  {
    notification_key: 'ADMIN_NEW_FACILITY',
    name: '新規施設登録（要審査）',
    description: '新しい施設が登録された時に送信',
    target_type: 'SYSTEM_ADMIN',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: false,
    chat_message: null,
    email_subject: '【+TASTAS管理】新規施設登録',
    email_body: `新しい施設が登録されました。

施設名: {{facility_name}}
法人名: {{corporation_name}}
登録日時: {{registered_at}}

審査をお願いします。`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'ADMIN_NEW_WORKER',
    name: '新規ワーカー登録',
    description: '新しいワーカーが登録された時に送信',
    target_type: 'SYSTEM_ADMIN',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: false,
    chat_message: null,
    email_subject: '【+TASTAS管理】新規ワーカー登録',
    email_body: '新しいワーカーが登録されました。\n\n氏名: {{user_name}}\nメール: {{user_email}}\n登録日時: {{registered_at}}\n\n確認をお願いします。',
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'ADMIN_HIGH_CANCEL_RATE',
    name: 'キャンセル率異常',
    description: 'ユーザーのキャンセル率が閾値を超えた時に送信',
    target_type: 'SYSTEM_ADMIN',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: false,
    chat_message: null,
    email_subject: '【+TASTAS管理】キャンセル率アラート',
    email_body: `キャンセル率が高いユーザーを検知しました。

ユーザー: {{user_name}}
キャンセル率: {{cancel_rate}}%
直近キャンセル数: {{recent_cancels}}件

対応をご検討ください。`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'ADMIN_LOW_RATING_STREAK',
    name: '低評価レビュー連続',
    description: 'ユーザーが連続で低評価を受けた時に送信',
    target_type: 'SYSTEM_ADMIN',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: false,
    chat_message: null,
    email_subject: '【+TASTAS管理】低評価アラート',
    email_body: `連続で低評価を受けているユーザーを検知しました。

ユーザー: {{user_name}}
平均評価: {{average_rating}}
直近の低評価数: {{low_rating_count}}件

対応をご検討ください。`,
    push_title: null,
    push_body: null,
  },
  {
    notification_key: 'ADMIN_SUSPICIOUS_ACCESS',
    name: '不正アクセス検知',
    description: '不審なアクセスを検知した時に送信',
    target_type: 'SYSTEM_ADMIN',
    chat_enabled: false,
    email_enabled: true,
    push_enabled: false,
    chat_message: null,
    email_subject: '【+TASTAS管理】不正アクセスアラート',
    email_body: `不審なアクセスを検知しました。

ユーザー: {{user_name}}
IPアドレス: {{ip_address}}
検知日時: {{detected_at}}
詳細: {{details}}

確認をお願いします。`,
    push_title: null,
    push_body: null,
  },
];

async function seedNotificationSettings() {
  console.log('Seeding notification settings...');

  for (const setting of notificationSettings) {
    await prisma.notificationSetting.upsert({
      where: { notification_key: setting.notification_key },
      update: setting,
      create: setting,
    });
  }

  console.log(`Seeded ${notificationSettings.length} notification settings`);
}

// ========================================
// メイン処理
// ========================================
async function main() {
  console.log('🌱 完全版シードデータの投入を開始します...');

  // ========================================
  // 1. ユーザー（ワーカー）の作成 - 10名
  // ========================================
  console.log('\n👤 ユーザー（ワーカー）を作成中...');

  const usersData = [
    // プロフィール充実ユーザー
    {
      email: 'yamada@example.com',
      password_hash: hashPassword('password123'),
      name: '山田 太郎',
      birth_date: new Date('1990-05-15'),
      phone_number: '090-1234-5678',
      profile_image: null, // テスト用ダミー画像は使用しない
      qualifications: ['介護福祉士', '実務者研修'],
      last_name_kana: 'ヤマダ',
      first_name_kana: 'タロウ',
      gender: '男性',
      nationality: '日本',
      postal_code: '150-0001',
      prefecture: '東京都',
      city: '渋谷区',
      address_line: '神宮前1-1-1',
      building: '',

      emergency_name: '山田 花子',
      emergency_relation: '妻',
      emergency_phone: '090-8765-4321',
      emergency_address: '東京都渋谷区神宮前1-1-1',
      experience_fields: { "特別養護老人ホーム": "3年以上", "デイサービス": "3年以上" },
      id_document: null, // テスト用ダミー画像は使用しない
      bank_book_image: null, // テスト用ダミー画像は使用しない
      bank_name: 'テスト銀行',
      branch_name: 'テスト支店',
      account_number: '1234567',
      account_name: 'ヤマダ タロウ',
      // 資格証明書は文字列URL形式で保存（旧形式のネストされたオブジェクトは使用しない）
      // qualification_certificatesはJson型なので省略するとnullになる
    },
    {
      email: 'sato@example.com',
      password_hash: hashPassword('password123'),
      name: '佐藤 花子',
      birth_date: new Date('1990-08-20'),
      phone_number: '090-2345-6789',
      profile_image: '/images/users/user2.svg',
      qualifications: ['正看護師', 'ケアマネージャー'],
    },
    {
      email: 'suzuki@example.com',
      password_hash: hashPassword('password123'),
      name: '鈴木 一郎',
      birth_date: new Date('1988-03-10'),
      phone_number: '090-3456-7890',
      profile_image: '/images/users/user3.svg',
      qualifications: ['介護福祉士'],
    },
    // プロフィール一部空白のユーザー
    {
      email: 'takahashi@example.com',
      password_hash: hashPassword('password123'),
      name: '高橋 美咲',
      birth_date: new Date('1995-11-25'),
      phone_number: '090-4567-8901',
      profile_image: null,
      qualifications: ['初任者研修'],
    },
    {
      email: 'tanaka@example.com',
      password_hash: hashPassword('password123'),
      name: '田中 健太',
      birth_date: null,
      phone_number: '090-5678-9012',
      profile_image: null,
      qualifications: ['実務者研修', '初任者研修'],
      last_name_kana: 'タナカ',
      first_name_kana: 'ケンタ',
      experience_fields: { "特別養護老人ホーム": "1年未満" },
    },
    // 資格なし新人ユーザー
    {
      email: 'ito@example.com',
      password_hash: hashPassword('password123'),
      name: '伊藤 直子',
      birth_date: new Date('2000-01-05'),
      phone_number: '090-6789-0123',
      profile_image: '/images/samples/20s_female_1.png',
      qualifications: [],
    },
    // 経験豊富なベテラン
    {
      email: 'watanabe@example.com',
      password_hash: hashPassword('password123'),
      name: '渡辺 大輔',
      birth_date: new Date('1975-07-18'),
      phone_number: '090-7890-1234',
      profile_image: '/images/samples/40s_male_1.png',
      qualifications: ['介護福祉士', 'ケアマネージャー', '社会福祉士'],
    },
    {
      email: 'yamamoto@example.com',
      password_hash: hashPassword('password123'),
      name: '山本 理恵',
      birth_date: new Date('1992-04-30'),
      phone_number: '090-8901-2345',
      profile_image: '/images/samples/40s_female_1.png',
      qualifications: ['准看護師', '実務者研修'],
    },
    {
      email: 'nakamura@example.com',
      password_hash: hashPassword('password123'),
      name: '中村 翔太',
      birth_date: new Date('1998-09-12'),
      phone_number: '090-9012-3456',
      profile_image: null,
      qualifications: ['初任者研修'],
    },
    {
      email: 'kobayashi@example.com',
      password_hash: hashPassword('password123'),
      name: '小林 麻衣',
      birth_date: new Date('1993-12-08'),
      phone_number: '090-0123-4567',
      profile_image: '/images/samples/40s_female_2.png',
      qualifications: ['介護福祉士', '正看護師'],
    },
  ];

  const createdUsers = [];
  for (const userData of usersData) {
    const user = await prisma.user.create({ data: userData });
    createdUsers.push(user);
  }
  console.log(`✅ ${createdUsers.length}名のユーザーを作成しました`);

  // ========================================
  // 2. 施設の作成 - 15施設
  // ========================================
  console.log('\n🏢 施設を作成中...');

  const facilitiesData = [
    {
      corporation_name: '社会福祉法人ひかり会',
      facility_name: 'ひかり介護センター',
      facility_type: 'デイサービス',
      address: '東京都新宿区西新宿1-2-3',
      lat: 35.6896,
      lng: 139.6921,
      phone_number: '03-1234-5678',
      description: '開設15年の実績があるデイサービスです。明るく家庭的な雰囲気で、利用者様一人ひとりに寄り添ったケアを提供しています。経験豊富なスタッフが多数在籍しており、新人さんへのサポート体制も万全です。',
      images: ['/images/samples/facility_top_1.png', '/images/samples/facility_top_2.png'],
      rating: 4.5,
      review_count: 28,
      initial_message: `[ワーカー名字]様

この度は、ひかり介護センターの求人にご応募いただき、誠にありがとうございます。
施設長の田中と申します。

当施設では、働きやすい環境づくりを大切にしております。
初めての方でも安心して勤務いただけるよう、丁寧にサポートいたします。

ご不明な点がございましたら、お気軽にお問い合わせください。
お会いできることを楽しみにしております。`,
    },
    {
      corporation_name: '医療法人あおぞら会',
      facility_name: 'あおぞら訪問看護ステーション',
      facility_type: '訪問看護',
      address: '東京都渋谷区代々木2-5-6',
      lat: 35.6831,
      lng: 139.7001,
      phone_number: '03-2345-6789',
      description: '地域密着型の訪問看護ステーションです。24時間対応可能で、利用者様の在宅生活を全力でサポートしています。看護師・療法士が連携し、質の高いケアを提供しています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.8,
      review_count: 15,
      initial_message: `ご応募ありがとうございます。あおぞら訪問看護ステーションの管理者です。

訪問看護に興味をお持ちいただき嬉しく思います。
当ステーションでは、同行訪問から丁寧に指導いたします。

勤務について何かご質問があればお気軽にどうぞ。`,
    },
    {
      corporation_name: '社会福祉法人さくら福祉会',
      facility_name: 'さくらの里特別養護老人ホーム',
      facility_type: '特別養護老人ホーム',
      address: '神奈川県横浜市港北区日吉1-10-20',
      lat: 35.5534,
      lng: 139.6467,
      phone_number: '045-123-4567',
      description: '定員100名の大型特養です。ユニットケアを導入し、家庭的な雰囲気の中で個別ケアを実践しています。夜勤体制も充実しており、安心して働ける環境です。',
      images: ['/images/samples/facility_top_3.png', '/images/samples/facility_top_4.png'],
      rating: 4.2,
      review_count: 42,
      initial_message: null,
    },
    {
      corporation_name: '株式会社みどりケア',
      facility_name: 'グループホームみどりの家',
      facility_type: 'グループホーム',
      address: '東京都世田谷区桜新町3-8-12',
      lat: 35.6298,
      lng: 139.6455,
      phone_number: '03-3456-7890',
      description: '認知症ケア専門のグループホームです。定員18名の小規模で、利用者様と密に関わりながら、その人らしい生活をサポートしています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.6,
      review_count: 19,
      initial_message: `この度はご応募ありがとうございます。
グループホームみどりの家では、認知症ケアに興味のある方を歓迎しています。
アットホームな雰囲気で、スタッフ同士の仲も良いのが自慢です！`,
    },
    {
      corporation_name: '医療法人ゆうわ会',
      facility_name: 'ゆうわ老人保健施設',
      facility_type: '介護老人保健施設',
      address: '埼玉県さいたま市大宮区桜木町4-15-8',
      lat: 35.9065,
      lng: 139.6283,
      phone_number: '048-234-5678',
      description: 'リハビリテーションに力を入れている老健施設です。在宅復帰を目標に、医師・看護師・理学療法士・作業療法士・介護士がチームで支援しています。',
      images: ['/images/samples/facility_top_5.png', '/images/samples/facility_top_6.png'],
      rating: 4.3,
      review_count: 31,
      initial_message: null,
    },
    {
      corporation_name: '株式会社けやきサービス',
      facility_name: 'けやきデイサービス',
      facility_type: 'デイサービス',
      address: '千葉県船橋市本町5-2-10',
      lat: 35.7014,
      lng: 139.9856,
      phone_number: '047-345-6789',
      description: '機能訓練に特化したデイサービスです。理学療法士による個別機能訓練で、利用者様の身体機能維持・向上をサポートしています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.4,
      review_count: 12,
      initial_message: `ご応募いただきありがとうございます！
当施設は機能訓練に力を入れており、リハビリに興味のある方大歓迎です。
未経験の方も丁寧に指導しますので、安心してください。`,
    },
    {
      corporation_name: 'NPO法人つばさ',
      facility_name: 'つばさ小規模多機能ホーム',
      facility_type: '小規模多機能型居宅介護',
      address: '東京都練馬区石神井町7-3-15',
      lat: 35.7435,
      lng: 139.6020,
      phone_number: '03-4567-8901',
      description: '通い・訪問・泊まりを一体的に提供する小規模多機能ホームです。なじみのスタッフが様々な場面で関わり、利用者様の安心につなげています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.7,
      review_count: 8,
      initial_message: null,
    },
    {
      corporation_name: '社会福祉法人はなみずき会',
      facility_name: 'はなみずき有料老人ホーム',
      facility_type: '有料老人ホーム',
      address: '神奈川県川崎市中原区新丸子東2-1-5',
      lat: 35.5768,
      lng: 139.6614,
      phone_number: '044-456-7890',
      description: '介護付き有料老人ホームです。入居者様のニーズに合わせた個別ケアを提供し、充実した日々を過ごしていただけるよう努めています。',
      images: ['/images/samples/facility_top_1.png', '/images/samples/facility_top_2.png'],
      rating: 4.1,
      review_count: 25,
      initial_message: `ご応募ありがとうございます。
はなみずき有料老人ホームでは、入居者様お一人おひとりに寄り添ったケアを大切にしています。
働きやすい環境づくりにも力を入れていますので、ぜひ一緒に働きましょう。`,
    },
    {
      corporation_name: '株式会社あすなろ介護',
      facility_name: 'あすなろサービス付き高齢者向け住宅',
      facility_type: 'サービス付き高齢者向け住宅',
      address: '東京都杉並区阿佐谷南1-7-8',
      lat: 35.7045,
      lng: 139.6361,
      phone_number: '03-5678-9012',
      description: '自立度の高い方向けのサ高住です。必要に応じた介護サービスを提供しながら、入居者様の自立した生活をサポートしています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.0,
      review_count: 9,
      initial_message: null,
    },
    {
      corporation_name: '医療法人わかば会',
      facility_name: 'わかばショートステイ',
      facility_type: 'ショートステイ',
      address: '埼玉県川口市栄町3-5-10',
      lat: 35.8069,
      lng: 139.7240,
      phone_number: '048-567-8901',
      description: 'ご家族のレスパイトケアを支援するショートステイです。短期間でも自宅にいるような安心感を提供できるよう、細やかなケアを心がけています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.4,
      review_count: 17,
      initial_message: `この度はご応募いただき、ありがとうございます。
わかばショートステイは、利用者様に安心してお過ごしいただける環境づくりを大切にしています。
勤務についてご質問があれば、お気軽にメッセージください。`,
    },
    // 追加施設
    {
      corporation_name: '社会福祉法人こすもす会',
      facility_name: 'こすもす訪問介護ステーション',
      facility_type: '訪問介護',
      address: '東京都豊島区池袋2-15-8',
      lat: 35.7295,
      lng: 139.7109,
      phone_number: '03-6789-0123',
      description: '池袋エリアを中心に訪問介護サービスを提供しています。利用者様の在宅生活を支え、住み慣れた地域で安心して暮らせるようサポートしています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.5,
      review_count: 22,
      initial_message: null,
    },
    {
      corporation_name: '株式会社すみれケア',
      facility_name: 'すみれデイケアセンター',
      facility_type: 'デイサービス',
      address: '千葉県柏市柏5-1-20',
      lat: 35.8617,
      lng: 139.9751,
      phone_number: '04-7890-1234',
      description: 'リハビリ特化型のデイケアセンターです。専門職による機能訓練で、利用者様のQOL向上を目指しています。',
      images: ['/images/samples/facility_top_3.png', '/images/samples/facility_top_4.png'],
      rating: 4.6,
      review_count: 14,
      initial_message: `ご応募ありがとうございます！
すみれデイケアセンターでは、利用者様の笑顔を大切にしています。
チームワークの良い職場です。一緒に働けることを楽しみにしています。`,
    },
    {
      corporation_name: '医療法人たんぽぽ会',
      facility_name: 'たんぽぽ病院併設老健',
      facility_type: '介護老人保健施設',
      address: '神奈川県相模原市中央区相模原4-8-15',
      lat: 35.5719,
      lng: 139.3715,
      phone_number: '042-890-1234',
      description: '病院併設の老健施設です。医療連携が強みで、安心してご利用いただけます。看護師・介護士の連携も良好です。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.2,
      review_count: 30,
      initial_message: null,
    },
    {
      corporation_name: '合同会社ひまわり',
      facility_name: 'ひまわりグループホーム',
      facility_type: 'グループホーム',
      address: '東京都中野区中野5-2-3',
      lat: 35.7078,
      lng: 139.6657,
      phone_number: '03-7890-1234',
      description: '定員18名のアットホームなグループホームです。認知症の方が穏やかに過ごせる環境づくりに力を入れています。',
      images: ['/images/samples/facility_top_7.png'],
      rating: 4.8,
      review_count: 11,
      initial_message: `ご応募いただきありがとうございます！
ひまわりグループホームは家庭的な雰囲気が自慢です。
認知症ケアに興味のある方、ぜひお待ちしています！`,
    },
    {
      corporation_name: '株式会社オリーブケア',
      facility_name: 'オリーブ有料老人ホーム',
      facility_type: '有料老人ホーム',
      address: '埼玉県越谷市南越谷1-20-5',
      lat: 35.8782,
      lng: 139.7891,
      phone_number: '048-901-2345',
      description: '2020年オープンの新しい有料老人ホームです。最新設備と快適な環境で、入居者様・スタッフ双方にとって過ごしやすい施設を目指しています。',
      images: ['/images/samples/facility_top_5.png', '/images/samples/facility_top_6.png'],
      rating: 4.9,
      review_count: 6,
      initial_message: `この度はご応募ありがとうございます。
オリーブ有料老人ホームは2020年オープンの新しい施設です。
設備も新しく、働きやすい環境です。一緒にこの施設を盛り上げていきましょう！`,
    },
  ];

  const createdFacilities = [];
  for (const facilityData of facilitiesData) {
    const facility = await prisma.facility.create({
      data: {
        ...facilityData,
        manager_phone: '03-1234-5678',
        manager_email: 'manager@example.com',
        staff_photo: getRandomItem(['👨', '👩', '🧑']),
        staff_greeting: `${facilityData.facility_name}で一緒に働きませんか？`,
      }
    });
    createdFacilities.push(facility);
  }
  console.log(`✅ ${createdFacilities.length}施設を作成しました`);

  // ========================================
  // 3. 施設管理者の作成
  // ========================================
  console.log('\n👨‍💼 施設管理者を作成中...');

  // 固定の管理者名リスト（施設ごとに1名）
  const adminNames = [
    '木村 一郎',     // ひかり介護センター
    '山田 健太',     // あおぞら訪問看護ステーション
    '佐藤 大輔',     // さくらの里特別養護老人ホーム
    '田中 直樹',     // グループホームみどりの家
    '高橋 翔太',     // ゆうわ老人保健施設
    '伊藤 和也',     // けやきデイサービス
    '渡辺 雄介',     // つばさ小規模多機能ホーム
    '中村 俊介',     // はなみずき有料老人ホーム
    '小林 拓也',     // あすなろサービス付き高齢者向け住宅
    '加藤 太郎',     // わかばショートステイ
    '吉田 健太',     // こすもす訪問介護ステーション
    '松本 一郎',     // すみれデイケアセンター
    '井上 大輔',     // たんぽぽ病院併設老健
    '山本 直樹',     // ひまわりグループホーム
    '鈴木 翔太',     // オリーブ有料老人ホーム
  ];

  const adminsData = createdFacilities.map((facility, index) => ({
    email: `admin${index + 1}@facility.com`,
    password_hash: hashPassword('password123'),
    facility_id: facility.id,
    name: adminNames[index] || `管理者 ${index + 1}`,
    phone_number: `03-${String(1000 + index).padStart(4, '0')}-${String(1000 + index).padStart(4, '0')}`,
    role: 'admin',
  }));

  for (const adminData of adminsData) {
    await prisma.facilityAdmin.create({ data: adminData });
  }
  console.log(`✅ ${adminsData.length}名の管理者を作成しました`);

  // ========================================
  // 4. 求人テンプレートの作成
  // ========================================
  console.log('\n📝 求人テンプレートを作成中...');

  const templateData = [
    {
      facility_id: createdFacilities[0].id,
      name: '日勤スタッフ（デイサービス）',
      title: '【デイサービス】日勤スタッフ募集',
      start_time: '09:00',
      end_time: '18:00',
      break_time: 60,
      hourly_wage: 1500,
      transportation_fee: 1000,
      recruitment_count: 2,
      qualifications: ['介護福祉士', '介護職員初任者研修'],
      work_content: ['入浴介助(全般)', '食事介助', 'レク・体操', '送迎(運転)'],
      description: 'デイサービスでの日勤業務です。入浴介助、食事介助、レクリエーションなどを担当していただきます。明るく元気に利用者様と接していただける方を募集しています。',
      skills: ['介護経験1年以上', 'コミュニケーション能力'],
      dresscode: ['動きやすい服装', '運動靴'],
      belongings: ['筆記用具', '上履き'],
      images: ['/images/samples/facility_top_7.png'],
      notes: '初めての方も丁寧に指導します',
      tags: ['制服貸与', '+TASTAS初心者歓迎', '交通費支給'],
    },
    {
      facility_id: createdFacilities[2].id,
      name: '夜勤専従（特養）',
      title: '【特養】夜勤専従スタッフ募集',
      start_time: '17:00',
      end_time: '09:00',
      break_time: 120,
      hourly_wage: 1800,
      transportation_fee: 1500,
      recruitment_count: 1,
      qualifications: ['介護福祉士'],
      work_content: ['対話・見守り', '排泄介助', '就寝介助', '起床介助'],
      description: '特別養護老人ホームでの夜勤業務です。見守り、排泄介助、就寝介助などを担当していただきます。夜勤経験者の方優遇いたします。',
      skills: ['夜勤経験あり', '介護経験3年以上'],
      dresscode: ['動きやすい服装'],
      belongings: ['筆記用具', '上履き', '仮眠用着替え'],
      images: ['/images/samples/facility_top_7.png'],
      notes: '夜勤手当あり。仮眠時間2時間確保',
      tags: ['制服貸与', '交通費支給', '夜勤専従'],
    },
    {
      facility_id: createdFacilities[1].id,
      name: '訪問看護スタッフ（日勤）',
      title: '【訪問看護】日勤スタッフ募集',
      start_time: '08:30',
      end_time: '17:30',
      break_time: 60,
      hourly_wage: 2000,
      transportation_fee: 1200,
      recruitment_count: 2,
      qualifications: ['看護師', '准看護師'],
      work_content: ['バイタル測定', '服薬介助', '記録業務', '利用者家族対応'],
      description: '訪問看護ステーションでのお仕事です。利用者様のご自宅を訪問し、医療的ケアや健康管理を行います。在宅医療に興味のある方、ブランクのある方も歓迎します。',
      skills: ['訪問看護経験者歓迎', '普通自動車免許'],
      dresscode: ['清潔感のある服装', 'スニーカー'],
      belongings: ['筆記用具', '運転免許証', 'マスク'],
      images: ['/images/samples/facility_top_7.png'],
      notes: '訪問用の車両は施設で用意します',
      tags: ['ブランク歓迎', '交通費支給', '制服貸与'],
    },
    {
      facility_id: createdFacilities[3].id,
      name: 'グループホーム日勤',
      title: '【グループホーム】日勤介護スタッフ募集',
      start_time: '07:00',
      end_time: '16:00',
      break_time: 60,
      hourly_wage: 1400,
      transportation_fee: 800,
      recruitment_count: 3,
      qualifications: ['介護職員初任者研修', '実務者研修', '介護福祉士'],
      work_content: ['食事介助', '調理', '対話・見守り', 'レク・体操'],
      description: 'アットホームな雰囲気のグループホームです。認知症の方のケアに興味がある方、少人数でじっくり関わりたい方にぴったりのお仕事です。調理補助や生活支援がメインとなります。',
      skills: ['認知症ケア経験者歓迎', '調理補助可能な方'],
      dresscode: ['動きやすい服装', 'エプロン'],
      belongings: ['筆記用具', '上履き', 'エプロン'],
      images: ['/images/samples/facility_top_7.png'],
      notes: 'まかない付き。未経験者でも研修制度が充実しています',
      tags: ['制服貸与', '+TASTAS初心者歓迎', '交通費支給'],
    },
    {
      facility_id: createdFacilities[4].id,
      name: '老健リハビリ補助',
      title: '【老健】リハビリ補助スタッフ募集',
      start_time: '09:00',
      end_time: '17:00',
      break_time: 60,
      hourly_wage: 1600,
      transportation_fee: 1000,
      recruitment_count: 2,
      qualifications: ['介護職員初任者研修', '実務者研修', '介護福祉士'],
      work_content: ['機能訓練補助', '移動介助', '食事介助', '入浴介助(全般)'],
      description: '介護老人保健施設でのリハビリ補助業務です。理学療法士・作業療法士と連携し、利用者様の在宅復帰をサポートします。リハビリに興味のある方、身体介護のスキルを磨きたい方におすすめです。',
      skills: ['リハビリに興味がある方', '体力に自信のある方'],
      dresscode: ['動きやすい服装', 'スニーカー'],
      belongings: ['筆記用具', '上履き', '動きやすい服装予備'],
      images: ['/images/samples/facility_top_7.png'],
      notes: '医療連携が強みの施設です。スキルアップしたい方歓迎',
      tags: ['制服貸与', '未経験者歓迎', '交通費支給'],
    },
  ];

  for (const template of templateData) {
    await prisma.jobTemplate.create({ data: template });
  }
  console.log(`✅ ${templateData.length}件のテンプレートを作成しました`);

  // ========================================
  // 5. 求人の作成 - 求人ごとに複数の勤務日を設定
  // ========================================
  console.log('\n💼 求人を作成中...');

  const workPatterns = [
    { start: '09:00', end: '18:00', break: '12:00-13:00', type: 'day' },
    { start: '07:00', end: '16:00', break: '12:00-13:00', type: 'day_early' },
    { start: '10:00', end: '19:00', break: '13:00-14:00', type: 'day_late' },
    { start: '17:00', end: '09:00', break: '01:00-02:00', type: 'night' },
    { start: '10:00', end: '14:00', break: 'なし', type: 'short' },
    { start: '08:00', end: '12:00', break: 'なし', type: 'short_morning' },
    { start: '14:00', end: '18:00', break: 'なし', type: 'short_evening' },
  ];

  const createdJobs: any[] = [];
  const createdWorkDates: any[] = [];

  // 15件の求人を作成（各施設1つずつ）、各求人に複数の勤務日を設定
  for (let i = 0; i < 15; i++) {
    const facility = createdFacilities[i];
    const workPattern = workPatterns[i % workPatterns.length];
    const hourlyWage = getRandomInt(1200, 2000);

    // 勤務時間計算
    const startHour = parseInt(workPattern.start.split(':')[0]);
    const endHour = parseInt(workPattern.end.split(':')[0]);
    let workHours = endHour >= startHour ? endHour - startHour : (24 - startHour) + endHour;
    if (workPattern.break !== 'なし') workHours -= 1;

    const wage = hourlyWage * workHours;

    // ステータス設定
    let status: JobStatus;
    if (i < 3) {
      status = 'COMPLETED'; // 完了済み
    } else if (i < 5) {
      status = 'STOPPED'; // 停止中
    } else {
      status = 'PUBLISHED'; // 公開中
    }

    const tags: string[] = [];
    if (workPattern.type === 'night') tags.push('夜勤');
    if (workPattern.type.startsWith('short')) tags.push('短時間');
    if (i % 3 === 0) tags.push('未経験OK');
    if (i % 4 === 0) tags.push('高時給');
    if (facility.facility_type.includes('デイ')) tags.push('デイ');
    if (facility.facility_type.includes('特養')) tags.push('特養');

    const titles = [
      `【${facility.facility_type}】${workPattern.type === 'night' ? '夜勤' : '日勤'}スタッフ募集`,
      `【急募】${facility.facility_name}でのお仕事`,
      `${workPattern.type.startsWith('short') ? '短時間OK！' : ''}介護スタッフ募集`,
    ];

    const recruitmentCount = getRandomInt(1, 5);
    const transportationFee = getRandomInt(500, 1500);

    const job = await prisma.job.create({
      data: {
        facility_id: facility.id,
        template_id: null,
        status: status,
        title: titles[i % titles.length],
        start_time: workPattern.start,
        end_time: workPattern.end,
        break_time: workPattern.break,
        wage: wage,
        hourly_wage: hourlyWage,
        transportation_fee: transportationFee,
        deadline_days_before: getRandomInt(1, 3), // 勤務日の1〜3日前に締切
        tags: tags,
        address: facility.address,
        access: `最寄り駅から徒歩${getRandomInt(3, 15)}分`,
        recruitment_count: recruitmentCount,
        overview: `${facility.facility_name}（${facility.facility_type}）での介護業務です。${i % 3 === 0 ? '未経験の方も歓迎します。' : '経験者優遇。'}丁寧に指導しますので安心してご応募ください。`,
        work_content: ['見守り', '記録業務', '食事介助', '排泄介助', 'レクリエーション'],
        required_qualifications: i % 4 === 0 ? [] : ['介護福祉士', '初任者研修'],
        required_experience: i % 3 === 0 ? ['未経験OK'] : ['実務経験1年以上'],
        dresscode: ['動きやすい服装', '運動靴'],
        belongings: ['筆記用具', '上履き'],
        manager_name: `${getRandomItem(lastNames)} ${getRandomItem(firstNames.male)}`,
        manager_message: `${facility.facility_name}で一緒に働きませんか？お待ちしています！`,
        manager_avatar: getRandomItem(['👨', '👩', '🧑']),
        images: ['/images/samples/facility_top_7.png'],
        inexperienced_ok: i % 3 === 0,
        blank_ok: Math.random() > 0.5,
        hair_style_free: Math.random() > 0.7,
        nail_ok: Math.random() > 0.85,
        uniform_provided: Math.random() > 0.4,
        allow_car: Math.random() > 0.3,
        meal_support: Math.random() > 0.6,
      },
    });
    createdJobs.push(job);

    // 各求人に複数の勤務日を作成（5〜15日分）
    const numWorkDates = getRandomInt(5, 15);
    const jobWorkDates: any[] = [];
    const usedDates = new Set<string>();

    for (let d = 0; d < numWorkDates; d++) {
      let workDate: Date;
      let deadline: Date;

      if (status === 'COMPLETED') {
        // 完了済み求人は過去の日付（重複を避けるため連番）
        workDate = subtractDays(7 + d);
        deadline = new Date(workDate);
        deadline.setDate(deadline.getDate() - 1);
      } else {
        // 公開中・停止中は将来の日付（重複を避けるため連番）
        workDate = addDays(3 + d);
        deadline = new Date(workDate);
        deadline.setDate(deadline.getDate() - job.deadline_days_before);
      }

      // 日付の重複チェック
      const dateKey = workDate.toISOString().split('T')[0];
      if (usedDates.has(dateKey)) {
        continue;
      }
      usedDates.add(dateKey);

      const workDateRecord = await prisma.jobWorkDate.create({
        data: {
          job_id: job.id,
          work_date: workDate,
          deadline: deadline,
          recruitment_count: recruitmentCount,
          applied_count: 0,
        },
      });
      jobWorkDates.push(workDateRecord);
      createdWorkDates.push({ ...workDateRecord, job_id: job.id, facility_id: facility.id });
    }
  }
  console.log(`✅ ${createdJobs.length}件の求人、${createdWorkDates.length}件の勤務日を作成しました`);

  // ========================================
  // 6. 応募の作成 - 様々なステータス
  // ========================================
  console.log('\n📋 応募を作成中...');

  // 勤務日ベースで応募を作成
  // 完了済み求人（index 0-2）の勤務日を取得
  const completedWorkDates = createdWorkDates.filter(wd => {
    const job = createdJobs.find(j => j.id === wd.job_id);
    return job && job.status === 'COMPLETED';
  });

  // 公開中求人（index 5-14）の勤務日を取得
  const publishedWorkDates = createdWorkDates.filter(wd => {
    const job = createdJobs.find(j => j.id === wd.job_id);
    return job && job.status === 'PUBLISHED';
  });

  const createdApplications: any[] = [];

  // 完了済み勤務日に対する応募（評価完了）
  for (let i = 0; i < Math.min(6, completedWorkDates.length); i++) {
    const workDate = completedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.COMPLETED_RATED,
        worker_review_status: ReviewStatus.COMPLETED,
        facility_review_status: ReviewStatus.COMPLETED,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    // applied_countを更新
    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // 公開中勤務日に対する様々なステータスの応募
  // APPLIED（応募中）
  for (let i = 0; i < 5 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.APPLIED,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: '初めて応募させていただきます。よろしくお願いいたします。',
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // SCHEDULED（勤務予定・マッチング成立）
  for (let i = 5; i < 9 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.SCHEDULED,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // WORKING（勤務中）
  for (let i = 9; i < 11 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.WORKING,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // COMPLETED_PENDING（完了・評価待ち）
  for (let i = 11; i < 15 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.COMPLETED_PENDING,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // CANCELLED（キャンセル）
  for (let i = 15; i < 17 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.CANCELLED,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });
  }

  console.log(`✅ ${createdApplications.length}件の応募を作成しました`);

  // ========================================
  // 7. レビューの作成（各施設に15件ずつテストデータ）
  // ========================================
  console.log('\n⭐ レビューを作成中...');

  const reviewComments = {
    good: [
      'とても丁寧に対応していただきました。初めての勤務でも安心して働けました。',
      'スタッフの方々がとても親切で、働きやすい環境でした。',
      '利用者様への対応が素晴らしく、勉強になりました。',
      '設備が整っていて、仕事がしやすかったです。',
      'チームワークが良く、楽しく働けました。',
      '研修がしっかりしていて、安心して業務に臨めました。',
      '明るい雰囲気で、とても居心地が良かったです。',
      '先輩スタッフが丁寧に教えてくれて助かりました。',
      'シフトの融通が利いて、働きやすかったです。',
      '休憩時間もしっかり取れて、無理なく働けました。',
      '利用者様との関わりが多く、やりがいを感じました。',
      '清潔感があり、気持ちよく働ける環境でした。',
      'スタッフ間の連携がしっかりしていて安心でした。',
      '業務の流れがしっかり決まっていて分かりやすかったです。',
      '困ったときにすぐに相談できる雰囲気がありました。',
    ],
    neutral: [
      '普通に働けました。特に問題はありませんでした。',
      '忙しかったですが、やりがいを感じました。',
      '思っていたより大変でしたが、良い経験になりました。',
      '淡々と業務をこなすことができました。',
      '特筆すべき点はありませんが、問題もありませんでした。',
    ],
    improvement: [
      '休憩室がもう少し広いとありがたいです。',
      '駐車場が狭いので、改善されると嬉しいです。',
      '引き継ぎの時間がもう少しあると助かります。',
      '備品がもう少し整っているといいなと思いました。',
      '更衣室がもう少し広いと助かります。',
      '記録システムがもう少し使いやすいといいですね。',
      null,
      null,
      null,
      null,
    ],
    facilityGood: [
      '時間通りに出勤され、利用者様への対応も丁寧でした。またぜひお願いしたいです。',
      '経験豊富で即戦力として活躍していただきました。',
      'コミュニケーション能力が高く、利用者様からも好評でした。',
      '真面目に取り組んでいただき、信頼できる方でした。',
      '笑顔が素敵で、施設の雰囲気が明るくなりました。',
    ],
    facilityImprovement: [
      '記録の書き方をもう少し覚えていただければ完璧です。',
      '積極性がもう少しあると良いと思います。',
      null,
      null,
    ],
  };

  // COMPLETED_RATED の応募に対してレビューを作成（ワーカー→施設、施設→ワーカー両方）
  const ratedApplications = createdApplications.filter(app => app.status === WorkerStatus.COMPLETED_RATED);

  let reviewCount = 0;
  for (const app of ratedApplications) {
    const user = createdUsers.find(u => u.id === app.user_id)!;
    const facility = createdFacilities.find(f => f.id === app.facility_id)!;

    // ワーカー→施設のレビュー
    const workerRating = getRandomInt(3, 5);
    await prisma.review.create({
      data: {
        facility_id: facility.id,
        user_id: user.id,
        job_id: app.work_date.job_id,
        work_date_id: app.work_date.id,
        application_id: app.id,
        reviewer_type: ReviewerType.WORKER,
        rating: workerRating,
        good_points: workerRating >= 4 ? getRandomItem(reviewComments.good) : getRandomItem(reviewComments.neutral),
        improvements: getRandomItem(reviewComments.improvement),
      },
    });
    reviewCount++;

    // 施設→ワーカーのレビュー
    const facilityRating = getRandomInt(3, 5);
    await prisma.review.create({
      data: {
        facility_id: facility.id,
        user_id: user.id,
        job_id: app.work_date.job_id,
        work_date_id: app.work_date.id,
        application_id: app.id,
        reviewer_type: ReviewerType.FACILITY,
        rating: facilityRating,
        good_points: getRandomItem(reviewComments.facilityGood),
        improvements: getRandomItem(reviewComments.facilityImprovement),
      },
    });
    reviewCount++;
  }

  console.log(`✅ ${reviewCount}件のレビューを作成しました`);

  // ========================================
  // 8. メッセージの作成（会話のラリー）
  // ========================================
  console.log('\n💬 メッセージを作成中...');

  // SCHEDULED状態の応募に対してメッセージを作成
  const scheduledApplications = createdApplications.filter(app => app.status === WorkerStatus.SCHEDULED);

  let messageCount = 0;
  for (const app of scheduledApplications) {
    const user = createdUsers.find(u => u.id === app.user_id)!;
    const facility = createdFacilities.find(f => f.id === app.facility_id)!;
    const job = createdJobs.find(j => j.id === app.work_date.job_id)!;

    const userName = user.name.split(' ')[0];

    // 施設からの初回メッセージ
    await prisma.message.create({
      data: {
        from_facility_id: facility.id,
        to_user_id: user.id,
        application_id: app.id,
        job_id: job.id,
        content: `${userName}様

この度は、${facility.facility_name}の求人にご応募いただき、誠にありがとうございます。
${facility.facility_type}での勤務となります。

当施設では、働きやすい環境づくりを大切にしております。
初めての方でも安心して勤務いただけるよう、丁寧にサポートいたします。

ご不明な点がございましたら、お気軽にお問い合わせください。
お会いできることを楽しみにしております。`,
        created_at: subtractDays(3),
      },
    });
    messageCount++;

    // ワーカーからの返信
    await prisma.message.create({
      data: {
        from_user_id: user.id,
        to_facility_id: facility.id,
        application_id: app.id,
        job_id: job.id,
        content: `ご連絡ありがとうございます。
${facility.facility_name}でのお仕事、楽しみにしています。

当日は何時頃に到着すればよろしいでしょうか？
また、持ち物で特に必要なものがあれば教えてください。

よろしくお願いいたします。`,
        created_at: subtractDays(2),
      },
    });
    messageCount++;

    // 施設からの返信
    await prisma.message.create({
      data: {
        from_facility_id: facility.id,
        to_user_id: user.id,
        application_id: app.id,
        job_id: job.id,
        content: `ご質問ありがとうございます。

勤務開始の15分前にお越しください。
持ち物は上履きと筆記用具をお持ちください。
${Math.random() > 0.5 ? '制服は当施設でご用意いたします。' : '動きやすい服装でお越しください。'}

当日お会いできることを楽しみにしております！`,
        created_at: subtractDays(1),
      },
    });
    messageCount++;

    // ワーカーからの最終確認
    await prisma.message.create({
      data: {
        from_user_id: user.id,
        to_facility_id: facility.id,
        application_id: app.id,
        job_id: job.id,
        content: `ご丁寧にありがとうございます。
承知いたしました。

当日、よろしくお願いいたします！`,
        created_at: new Date(),
      },
    });
    messageCount++;
  }

  // WORKING/COMPLETED_PENDING状態の応募にも簡単なメッセージを追加
  const workingApplications = createdApplications.filter(app =>
    app.status === WorkerStatus.WORKING || app.status === WorkerStatus.COMPLETED_PENDING
  );

  for (const app of workingApplications) {
    const user = createdUsers.find(u => u.id === app.user_id)!;
    const facility = createdFacilities.find(f => f.id === app.facility_id)!;
    const job = createdJobs.find(j => j.id === app.work_date.job_id)!;

    await prisma.message.create({
      data: {
        from_facility_id: facility.id,
        to_user_id: user.id,
        application_id: app.id,
        job_id: job.id,
        content: `本日はお忙しい中ありがとうございます。
何かご不明な点があればお気軽にお声がけください。`,
        created_at: new Date(),
      },
    });
    messageCount++;
  }
  console.log(`✅ ${messageCount}件のメッセージを作成しました`);

  // ========================================
  // 9. 通知の作成
  // ========================================
  console.log('\n🔔 通知を作成中...');

  const notifications = [];

  // ワーカー向け通知（Notificationはuser_idのみ対応）
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];

    // 応募承認通知（マッチング成立の代わり）
    if (i < 5) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.APPLICATION_APPROVED,
        title: '応募が承認されました！',
        message: `${createdFacilities[i % createdFacilities.length].facility_name}の求人に応募が承認されました。勤務日をご確認ください。`,
        link: '/my-jobs',
        created_at: subtractDays(getRandomInt(1, 5)),
      });
    }

    // メッセージ受信通知
    if (i < 6) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.NEW_MESSAGE,
        title: '新しいメッセージが届きました',
        message: `${createdFacilities[i % createdFacilities.length].facility_name}からメッセージが届きました。`,
        link: '/messages',
        created_at: subtractDays(getRandomInt(0, 3)),
      });
    }

    // レビュー依頼通知
    if (i < 4) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.REVIEW_REQUEST,
        title: 'レビューをお願いします',
        message: `${createdFacilities[i % createdFacilities.length].facility_name}での勤務が完了しました。施設の評価をお願いします。`,
        link: '/mypage/reviews',
        created_at: subtractDays(getRandomInt(1, 7)),
      });
    }

    // システム通知（勤務リマインダーの代わり）
    if (i < 3) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.SYSTEM,
        title: '明日の勤務のお知らせ',
        message: `明日は${createdFacilities[i % createdFacilities.length].facility_name}での勤務があります。お忘れなく！`,
        link: '/my-jobs',
        created_at: subtractDays(1),
      });
    }
  }

  // 注意: 現在のスキーマではNotificationはuser_idのみ対応のため、施設向け通知は作成しない

  for (const notif of notifications) {
    await prisma.notification.create({ data: notif });
  }
  console.log(`✅ ${notifications.length}件の通知を作成しました`);

  // ========================================
  // 10. ブックマークの作成
  // ========================================
  console.log('\n🔖 ブックマークを作成中...');

  const bookmarks = [];

  // ワーカーが求人をお気に入り登録
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const favJobIndices = getRandomItems(Array.from({ length: 30 }, (_, i) => i + 10), getRandomInt(2, 5));

    for (const idx of favJobIndices) {
      if (createdJobs[idx]) {
        bookmarks.push({
          type: BookmarkType.FAVORITE,
          user_id: user.id,
          target_job_id: createdJobs[idx].id,
        });
      }
    }
  }

  // ワーカーが求人を「あとで見る」
  for (let i = 0; i < 5; i++) {
    const user = createdUsers[i];
    const watchJobIndices = getRandomItems(Array.from({ length: 20 }, (_, i) => i + 20), getRandomInt(1, 3));

    for (const idx of watchJobIndices) {
      if (createdJobs[idx]) {
        bookmarks.push({
          type: BookmarkType.WATCH_LATER,
          user_id: user.id,
          target_job_id: createdJobs[idx].id,
        });
      }
    }
  }

  // ワーカーが施設をお気に入り登録
  for (let i = 0; i < 7; i++) {
    const user = createdUsers[i];
    const favFacilityIndices = getRandomItems(Array.from({ length: createdFacilities.length }, (_, i) => i), getRandomInt(1, 4));

    for (const idx of favFacilityIndices) {
      bookmarks.push({
        type: BookmarkType.FAVORITE,
        user_id: user.id,
        target_facility_id: createdFacilities[idx].id,
      });
    }
  }

  // 施設がワーカーをお気に入り登録
  for (let i = 0; i < 8; i++) {
    const facility = createdFacilities[i];
    const favUserIndices = getRandomItems(Array.from({ length: createdUsers.length }, (_, i) => i), getRandomInt(1, 3));

    for (const idx of favUserIndices) {
      bookmarks.push({
        type: BookmarkType.FAVORITE,
        facility_id: facility.id,
        target_user_id: createdUsers[idx].id,
      });
    }
  }

  for (const bookmark of bookmarks) {
    try {
      await prisma.bookmark.create({ data: bookmark });
    } catch (e) {
      // 重複は無視
    }
  }
  console.log(`✅ ${bookmarks.length}件のブックマークを作成しました`);

  // ========================================
  // システム管理者の作成
  // ========================================
  console.log('\n🔐 システム管理者を作成中...');

  const systemAdminsData = [
    {
      email: 'admin@tastas.jp',
      password_hash: hashPassword('password123'),
      name: 'システム管理者',
      role: 'super_admin',
    },
    {
      email: 'editor@+tastas.com',
      password_hash: hashPassword('password123'),
      name: '編集者',
      role: 'editor',
    },
  ];

  for (const adminData of systemAdminsData) {
    const existingAdmin = await prisma.systemAdmin.findUnique({
      where: { email: adminData.email },
    });
    if (!existingAdmin) {
      await prisma.systemAdmin.create({ data: adminData });
    }
  }
  console.log(`✅ ${systemAdminsData.length}名のシステム管理者を作成しました`);
  console.log('   ログイン情報:');
  console.log('   - admin@tastas.jp / password123 (super_admin)');
  console.log('   - editor@+tastas.com / password123 (editor)');

  // ========================================
  // 11. 通知設定のシード
  // ========================================
  await seedNotificationSettings();
  await seedErrorMessageSettings();

  // ========================================
  // 完了
  // ========================================
  console.log('\n========================================');
  console.log('🎉 完全版シードデータの投入が完了しました！');
  console.log('========================================');
  console.log(`
📊 作成されたデータ:
  - ユーザー: ${createdUsers.length}名
  - 施設: ${createdFacilities.length}施設
  - 施設管理者: ${adminsData.length}名
  - システム管理者: ${systemAdminsData.length}名
  - 求人テンプレート: ${templateData.length}件
  - 求人: ${createdJobs.length}件
  - 応募: ${createdApplications.length}件
  - レビュー: ${reviewCount}件
  - メッセージ: ${messageCount}件
  - 通知: ${notifications.length}件
  - ブックマーク: ${bookmarks.length}件

🔐 システム管理者ログイン情報:
  - admin@tastas.jp / password123 (super_admin)
  - editor@+tastas.com / password123 (editor)
  `);
}

const errorMessageSettings = [
  {
    key: 'APPLY_ERROR',
    title: '応募エラー',
    banner_message: '応募に失敗しました。再度お試しください。',
    detail_message: 'システムエラーにより応募処理が完了しませんでした。ネットワーク環境をご確認の上、再度お試しください。',
  },
  {
    key: 'MATCH_ERROR',
    title: 'マッチングエラー',
    banner_message: 'マッチングに失敗しました。再度お試しください。',
    detail_message: 'マッチング処理中にエラーが発生しました。相手方の状況が変わった可能性があります。',
  },
  {
    key: 'SAVE_ERROR',
    title: '保存エラー',
    banner_message: '保存に失敗しました。再度お試しください。',
    detail_message: 'データの保存中にエラーが発生しました。入力内容をご確認ください。',
  },
  {
    key: 'SYSTEM_ERROR',
    title: 'システムエラー',
    banner_message: 'システムエラーが発生しました。しばらく経ってから再度お試しください。',
    detail_message: '予期せぬエラーが発生しました。管理者にお問い合わせください。',
  },
  {
    key: 'DUPLICATE_ERROR',
    title: '重複エラー',
    banner_message: 'すでに登録されているデータです。',
    detail_message: 'このデータは既にシステムに登録されています。重複登録はできません。',
  },
];

async function seedErrorMessageSettings() {
  console.log('\n⚠️ エラーメッセージ設定を作成中...');
  for (const setting of errorMessageSettings) {
    await prisma.errorMessageSetting.upsert({
      where: { key: setting.key },
      update: {
        banner_enabled: true,
        chat_enabled: false,
        email_enabled: false,
        push_enabled: false,
      },
      create: {
        key: setting.key,
        title: setting.title,
        banner_message: setting.banner_message,
        detail_message: setting.detail_message,
        banner_enabled: true,
        chat_enabled: false,
        email_enabled: false,
        push_enabled: false,
      },
    });
  }
  console.log(`✅ ${errorMessageSettings.length}件のエラーメッセージ設定を作成しました`);
}


main()
  .catch((e) => {
    console.error('❌ シードの実行に失敗しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
