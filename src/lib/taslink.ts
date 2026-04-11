/**
 * TasLink 外部API連携クライアント
 * ワーカー（求職者）情報をTasLinkへ同期するサーバーサイドモジュール
 *
 * NOTE for TasLink developers:
 * - externalId にはタスタス側の user.id（数値→文字列）を使用
 * - POST /api/v1/external/workers で upsert（同じexternalIdなら更新）
 * - レスポンスの id フィールドをタスタス側DBに保存している
 *   → レスポンス形式が { data: { id: "xxx" } } 等の場合はパース処理の調整が必要
 * - qualifications → jobTypes/qualifications のマッピングは暫定実装
 *   → TasLink側マスタと完全一致しない値は "その他" にフォールバックしている
 */

import prisma from '@/lib/prisma';

const API_URL = process.env.TASLINK_API_URL;
const API_KEY = process.env.TASLINK_API_KEY;

// --- 型定義 ---

/** TasLink Worker APIに送信するペイロード */
export interface TasLinkWorkerPayload {
  externalId: string;
  lastName: string;
  firstName: string;
  lastNameKana?: string;
  firstNameKana?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  jobTypes?: string[];
  qualifications?: string[];
  availableDays?: string[];
  workPreference?: 'ONE_TIME' | 'ONGOING' | 'BOTH';
  workHistory?: string;
  notes?: string;
  registrationSource?: string;
}

/** TasLink API同期結果 */
export interface TasLinkSyncResult {
  success: boolean;
  tasLinkId?: string;
  error?: string;
}

/** Userモデルからマッピングに必要なフィールド */
export interface UserDataForSync {
  id: number;
  name: string;
  last_name_kana?: string | null;
  first_name_kana?: string | null;
  gender?: string | null;
  birth_date?: Date | null;
  phone_number?: string | null;
  email?: string | null;
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address_line?: string | null;
  qualifications?: string[];
  desired_work_days?: string[];
  desired_work_style?: string | null;
  work_histories?: string[];
  self_pr?: string | null;
}

// --- マッピング定数 ---

/**
 * タスタス資格名 → TasLink職種マスタ (jobTypes)
 * NOTE: TasLink側の職種マスタにないものは "その他" にフォールバック
 */
const JOB_TYPE_MAP: Record<string, string> = {
  '看護師': '看護師',
  '准看護師': '准看護師',
  '介護士': '介護士',
  '介護福祉士': '介護福祉士',
  '初任者研修': '初任者研修',
  '実務者研修': '実務者研修',
  '理学療法士': '理学療法士',
  '作業療法士': '作業療法士',
};

/**
 * タスタス資格名 → TasLink資格マスタ (qualifications)
 * NOTE: TasLink側の資格マスタと名称が異なるものは変換が必要
 */
const QUALIFICATION_MAP: Record<string, string> = {
  '看護師': '看護師免許',
  '准看護師': '准看護師免許',
  '介護福祉士': '介護福祉士',
  '初任者研修': '介護職員初任者研修',
  '実務者研修': '介護職員実務者研修',
  '社会福祉士': '社会福祉士',
  '理学療法士': '理学療法士',
  '作業療法士': '作業療法士',
  '言語聴覚士': '言語聴覚士',
  '管理栄養士': '管理栄養士',
  '栄養士': '栄養士',
  '保育士': '保育士',
};

// --- マッピング関数 ---

/** 性別をTasLink形式に変換 */
function mapGender(gender: string | null | undefined): TasLinkWorkerPayload['gender'] {
  if (!gender) return 'UNSPECIFIED';
  const mapping: Record<string, TasLinkWorkerPayload['gender']> = {
    '男性': 'MALE',
    '女性': 'FEMALE',
    'その他': 'OTHER',
    'MALE': 'MALE',
    'FEMALE': 'FEMALE',
    'OTHER': 'OTHER',
  };
  return mapping[gender] || 'UNSPECIFIED';
}

/** 就業形態希望をTasLink形式に変換 */
function mapWorkPreference(style: string | null | undefined): TasLinkWorkerPayload['workPreference'] | undefined {
  if (!style) return undefined;
  const mapping: Record<string, TasLinkWorkerPayload['workPreference']> = {
    '単発': 'ONE_TIME',
    '単発希望': 'ONE_TIME',
    '継続': 'ONGOING',
    '継続希望': 'ONGOING',
    'どちらも': 'BOTH',
    'どちらも可': 'BOTH',
  };
  return mapping[style] || undefined;
}

/** タスタス資格配列 → TasLink jobTypes 配列に変換（重複排除） */
function mapToJobTypes(qualifications: string[]): string[] {
  const mapped = qualifications.map(q => JOB_TYPE_MAP[q] || 'その他');
  return Array.from(new Set(mapped));
}

/** タスタス資格配列 → TasLink qualifications 配列に変換（重複排除） */
function mapToQualifications(qualifications: string[]): string[] {
  const mapped = qualifications.map(q => QUALIFICATION_MAP[q] || 'その他');
  return Array.from(new Set(mapped));
}

/**
 * nameフィールドを姓名に分割
 * 全角・半角スペース両対応
 */
function splitName(name: string): { lastName: string; firstName: string } | null {
  if (!name.trim()) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  }
  // 姓のみ（スペースなし）の場合
  return { lastName: parts[0], firstName: '' };
}

/** Date → JST基準のISO 8601日付文字列 (YYYY-MM-DD) */
function toJSTDateStr(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/** UserデータをTasLink APIペイロードに変換。名前が空の場合はnullを返す */
export function mapUserToTasLinkPayload(user: UserDataForSync): TasLinkWorkerPayload | null {
  const nameResult = splitName(user.name);
  if (!nameResult || !nameResult.lastName) {
    // lastName が空の場合、TasLink APIの必須フィールドを満たせないため同期スキップ
    return null;
  }

  const payload: TasLinkWorkerPayload = {
    externalId: String(user.id),
    lastName: nameResult.lastName,
    firstName: nameResult.firstName,
  };

  if (user.last_name_kana) payload.lastNameKana = user.last_name_kana;
  if (user.first_name_kana) payload.firstNameKana = user.first_name_kana;
  payload.gender = mapGender(user.gender);
  if (user.birth_date) payload.dateOfBirth = toJSTDateStr(user.birth_date);
  if (user.phone_number) payload.phone = user.phone_number;
  if (user.email) payload.email = user.email;
  if (user.postal_code) payload.postalCode = user.postal_code;
  if (user.prefecture) payload.prefecture = user.prefecture;
  if (user.city) payload.city = user.city;
  if (user.address_line) payload.address = user.address_line;
  if (user.qualifications && user.qualifications.length > 0) {
    payload.jobTypes = mapToJobTypes(user.qualifications);
    payload.qualifications = mapToQualifications(user.qualifications);
  }
  if (user.desired_work_days && user.desired_work_days.length > 0) {
    payload.availableDays = user.desired_work_days;
  }
  const workPref = mapWorkPreference(user.desired_work_style);
  if (workPref) payload.workPreference = workPref;
  if (user.work_histories && user.work_histories.length > 0) {
    payload.workHistory = user.work_histories.join('\n');
  }
  if (user.self_pr) payload.notes = user.self_pr;

  return payload;
}

// --- API呼び出し ---

/**
 * ワーカー情報をTasLinkに同期
 * POST /api/v1/external/workers（externalIdによるupsert）
 *
 * 成功時はtaslink_idとtaslink_synced_atをDBに保存する。
 * エラー時はログ出力のみ、例外はスローしない。
 * awaitで呼び出すため、TasLink APIの応答を待ってからレスポンスを返す。
 */
export async function syncWorkerToTasLink(
  userId: number,
  payload: TasLinkWorkerPayload,
): Promise<TasLinkSyncResult> {
  if (!API_URL || !API_KEY) {
    console.warn('[TasLink] Not configured (TASLINK_API_URL or TASLINK_API_KEY missing), skipping sync');
    return { success: false, error: 'TasLink not configured' };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/external/workers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 200 || response.status === 201) {
      const data = await response.json();
      // NOTE: TasLink APIのレスポンス形式に応じてパスを調整すること
      const tasLinkId = String(data.id ?? data.data?.id ?? '');

      // DB に TasLink ID と同期日時を保存
      if (tasLinkId) {
        try {
          await prisma.user.update({
            where: { id: userId },
            data: {
              taslink_id: tasLinkId,
              taslink_synced_at: new Date(),
            },
          });
        } catch (dbError) {
          console.error('[TasLink] DB update failed (API sync succeeded):', dbError instanceof Error ? dbError.message : String(dbError));
          return { success: true, tasLinkId, error: 'API sync succeeded but DB update failed' };
        }
      }

      console.log('[TasLink] Worker synced successfully:', { userId, tasLinkId });
      return { success: true, tasLinkId };
    }

    if (response.status === 400) {
      const errorBody = await response.text();
      console.error('[TasLink] Validation error:', { userId, status: 400, body: errorBody.slice(0, 500) });
      return { success: false, error: `Validation error (400): ${errorBody.slice(0, 200)}` };
    }

    if (response.status === 401) {
      console.error('[TasLink] Authentication failed: invalid API key');
      return { success: false, error: 'Authentication failed (401)' };
    }

    if (response.status === 429) {
      console.warn('[TasLink] Rate limited:', { userId });
      return { success: false, error: 'Rate limited (429)' };
    }

    const errorBody = await response.text();
    console.error('[TasLink] Sync failed:', { userId, status: response.status, body: errorBody.slice(0, 500) });
    return { success: false, error: `Sync failed (${response.status}): ${errorBody.slice(0, 200)}` };
  } catch (error) {
    console.error('[TasLink] Network error:', error instanceof Error ? error.message : String(error));
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}
