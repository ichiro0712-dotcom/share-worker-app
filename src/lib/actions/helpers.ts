import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentTime, getTodayStart } from '@/utils/debugTime';
export { getCurrentTime, getTodayStart };

/**
 * FormDataから受け取るファイルはBlob互換（name, typeプロパティを持つ）
 * サーバーサイド（Node.js）ではFile型が存在しないため、この型を使用
 */
export interface FileBlob extends Blob {
  name: string;
  type: string;
}

/**
 * 認証済みユーザーを取得する共通ヘルパー関数
 * NextAuthセッションがある場合はそのユーザーを使用
 * 開発環境: セッションがない場合はID=1のテストユーザーにフォールバック（自動作成しない）
 * 本番環境: セッションがない場合はエラーをスロー
 */
export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    const userId = parseInt(session.user.id, 10);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      return user;
    }
  }

  // 本番環境ではセッションがない場合はエラーをスロー
  if (process.env.NODE_ENV === 'production') {
    throw new Error('認証が必要です');
  }

  // 開発環境のみ: セッションがない場合はID=1のテストユーザーにフォールバック
  const user = await prisma.user.findUnique({
    where: { id: 1 },
  });

  if (!user) {
    console.error('[getAuthenticatedUser] DEV MODE: User with ID=1 not found. Run `npx prisma db seed` first.');
    throw new Error('開発用テストユーザー(ID=1)が見つかりません。npx prisma db seed を実行してください。');
  }

  return user;
}

/**
 * 日付をフォーマットする（M/D 形式）
 */
export function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 日付をフォーマットする（M月D日(曜) 形式）
 */
export function formatDateWithDay(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
}

/**
 * メッセージ時間をフォーマット
 */
export function formatMessageTime(date: Date): string {
  const now = getCurrentTime();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    // 今日
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return '昨日';
  } else if (days < 7) {
    return `${days}日前`;
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  }
}

/**
 * 年齢層を計算
 */
export function calculateAgeGroup(birthDate: Date | null): string {
  if (!birthDate) return '不明';

  const today = getCurrentTime();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 20) return '10代';
  if (age < 30) return '20代';
  if (age < 40) return '30代';
  if (age < 50) return '40代';
  if (age < 60) return '50代';
  return '60代以上';
}

/**
 * 時間重複判定: 2つの時間帯が重なっているかチェック
 * @param start1 HH:MM形式
 * @param end1 HH:MM形式
 * @param start2 HH:MM形式
 * @param end2 HH:MM形式
 * @returns 重複している場合はtrue
 */
export function isTimeOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
  // HH:MM形式を分単位に変換
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  // 時間帯が重なるかチェック
  return e1 > s2 && e2 > s1;
}

/**
 * 2点間の距離をHaversine公式で計算（km単位）
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 地球の半径（km）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 求人検索パラメータの型定義
 */
export interface JobSearchParams {
  query?: string;
  prefecture?: string;
  city?: string;
  minWage?: number;
  serviceTypes?: string[];
  transportations?: string[];
  otherConditions?: string[];
  jobTypes?: string[]; // 「看護の仕事のみ」「説明会を除く」
  workTimeTypes?: string[]; // 「日勤」「夜勤」「1日4時間以下」
  // 時間帯パラメータ
  timeRangeFrom?: string; // HH:MM形式
  timeRangeTo?: string;   // HH:MM形式
  // 距離検索パラメータ
  distanceKm?: number;
  distanceLat?: number;
  distanceLng?: number;
}

/**
 * 管理者用: 求人を作成（複数の勤務日に対応）
 */
export interface CreateJobInput {
  facilityId: number;
  templateId?: number | null;
  title: string;
  workDates: string[]; // YYYY-MM-DD形式の配列
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakTime: number; // 休憩時間（分）
  hourlyWage: number;
  transportationFee: number;
  recruitmentCount: number;
  workContent: string[];
  jobDescription: string;
  qualifications: string[];
  skills: string[];
  dresscode: string[];
  belongings: string[];
  icons: string[]; // こだわり条件
  images?: string[]; // 求人画像URL配列
  dresscodeImages?: string[]; // 服装サンプル画像URL配列
  attachments?: string[]; // 添付ファイルURL配列
  // 募集期間設定
  recruitmentStartDay: number;
  recruitmentStartTime?: string;
  recruitmentEndDay: number;
  recruitmentEndTime?: string;
  // 募集条件
  weeklyFrequency?: number | null; // 週N回以上
  // マッチング方法
  requiresInterview?: boolean; // 面接してからマッチング
  // 住所情報
  prefecture?: string;
  city?: string;
  addressLine?: string;
  address?: string;
}

export type WorkerListStatus = 'NOT_STARTED' | 'WORKING' | 'COMPLETED' | 'CANCELLED';

export interface WorkerListItem {
  userId: number;
  name: string;
  profileImage: string | null;
  qualifications: string[];
  prefecture: string | null;
  city: string | null;
  // ステータス
  statuses: WorkerListStatus[];
  hasCompleted: boolean;
  hasCancelled: boolean;
  // 統計（自社）
  ourWorkCount: number;          // この施設での勤務回数
  lastOurWorkDate: string | null; // この施設での最終勤務日
  // 統計（他社）
  otherWorkCount: number;        // 他社での勤務回数
  lastOtherWorkDate: string | null; // 他社での最終勤務日
  // 統計（合計）
  totalWorkCount: number;        // 総勤務回数
  lastWorkDate: string | null;   // 最終勤務日（自社/他社問わず）
  lastWorkFacilityType: 'our' | 'other' | null; // 最終勤務が自社か他社か
  // キャンセル率
  cancelRate: number;            // キャンセル率（%）
  lastMinuteCancelRate: number;  // 直前キャンセル率（%）
  // 経験分野
  experienceFields: Record<string, string> | null; // {"特養": "3年", ...}
  // 評価
  avgRating: number | null;
  reviewCount: number;
  // ブックマーク状態
  isFavorite: boolean;
  isBlocked: boolean;
}

export interface WorkerListSearchParams {
  keyword?: string;
  status?: string;
  jobCategory?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

/**
 * アプリ内通知を作成
 */
export async function createNotification(data: {
  userId: number;
  type: 'APPLICATION_APPROVED' | 'APPLICATION_REJECTED' | 'APPLICATION_CANCELLED' | 'NEW_MESSAGE' | 'REVIEW_REQUEST' | 'SYSTEM';
  title: string;
  message: string;
  link?: string;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
    console.log('[createNotification] Notification created:', notification.id);
    return notification;
  } catch (error) {
    console.error('[createNotification] Error:', error);
    return null;
  }
}
