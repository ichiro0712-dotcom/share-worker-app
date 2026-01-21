/**
 * 緊急時出退勤番号・QRトークン生成ユーティリティ
 * Server Actionsから使用可能な非'use server'モジュール
 */

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * 全施設でユニークな4桁の緊急時出退勤番号を生成
 * @returns 4桁の数字文字列（例: "1234"）
 */
export async function generateUniqueEmergencyCode(): Promise<string> {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 0000〜9999のランダムな4桁番号を生成
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    // 既存の施設で使用されていないか確認
    const existing = await prisma.facility.findFirst({
      where: { emergency_attendance_code: code },
    });

    if (!existing) {
      return code;
    }
  }

  // 100回試行しても見つからない場合（極めて稀）
  throw new Error('ユニークな緊急時出退勤番号を生成できませんでした');
}

/**
 * 新しいQRコードシークレットトークンを生成
 */
export function generateQRSecretToken(): string {
  return randomBytes(32).toString('hex');
}
