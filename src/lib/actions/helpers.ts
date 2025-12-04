'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * 認証済みユーザーを取得する共通ヘルパー関数
 * NextAuthセッションがある場合はそのユーザーを使用
 * 開発環境のみ: セッションがない場合はID=1のテストユーザーにフォールバック
 * 本番環境: セッションがない場合はエラーをスロー
 */
export async function getAuthenticatedUser() {
  // NextAuthセッションからユーザーを取得
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
  let user = await prisma.user.findUnique({
    where: { id: 1 },
  });

  // ユーザーが存在しない場合は作成
  if (!user) {
    console.log('[getAuthenticatedUser] DEV MODE: User with ID=1 not found, creating...');
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password_hash: 'test_password',
        name: 'テストユーザー',
        phone_number: '090-0000-0000',
        qualifications: [],
      },
    });
    console.log('[getAuthenticatedUser] DEV MODE: Test user created with ID:', user.id);
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
  const now = new Date();
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

  const today = new Date();
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
  jobTypes?: string[];
  workTimeTypes?: string[];
}

/**
 * 求人作成入力の型定義
 */
export interface CreateJobInput {
  facilityId: number;
  templateId?: number | null;
  title: string;
  startTime: string;
  endTime: string;
  breakTime: string;
  wage: number;
  hourlyWage: number;
  transportationFee: number;
  tags: string[];
  access: string;
  recruitmentCount: number;
  overview: string;
  workContent: string[];
  requiredQualifications: string[];
  requiredExperience: string[];
  dresscode: string[];
  dresscodeImages: string[];
  belongings: string[];
  attachments: string[];
  managerName: string;
  managerMessage: string;
  managerAvatar: string;
  images: string[];
  workDates: Array<{
    date: string;
    recruitmentCount: number;
    deadline: string;
  }>;
  allowCar: boolean;
  allowBike: boolean;
  allowBicycle: boolean;
  allowPublicTransit: boolean;
  hasParking: boolean;
  noBathingAssist: boolean;
  hasDriver: boolean;
  hairStyleFree: boolean;
  nailOk: boolean;
  uniformProvided: boolean;
  inexperiencedOk: boolean;
  beginnerOk: boolean;
  facilityWithin5years: boolean;
  weeklyFrequency: number | null;
  monthlyCommitment: boolean;
  deadlineDaysBefore: number;
}
