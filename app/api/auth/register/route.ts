import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendAdminNewWorkerNotification } from '@/src/lib/actions/notification';
import { sendVerificationEmail } from '@/src/lib/auth/email-verification';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { findLpByIpAddress } from '@/src/lib/lp-attribution';
import { getClientIpAddress } from '@/src/lib/device-info';
import { validatePhoneVerificationToken } from '@/src/lib/auth/phone-verification';
import { syncWorkerToTasLink, mapUserToTasLinkPayload } from '@/src/lib/taslink';
import { issueSessionCookie } from '@/src/lib/auth/session-cookie';
import { normalizePhoneDigits, phoneLockKey } from '@/src/lib/auth/identifier';

interface RegisterBody {
  email: string;
  password: string;
  name?: string;
  lastName?: string;
  firstName?: string;
  phoneNumber: string;
  birthDate?: string;
  qualifications?: string[];
  lastNameKana?: string;
  firstNameKana?: string;
  gender?: string;
  nationality?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  addressLine?: string;
  building?: string;
  experienceFields?: Record<string, unknown>;
  workHistories?: string[];
  qualificationCertificates?: Record<string, unknown>;
  // 新登録フロー（モック8ステップ）項目
  desiredWorkStyle?: string[];     // 希望の働き方（複数選択）
  workFrequency?: string;           // 週の頻度（step 2b）
  jobTiming?: string;               // いつ頃探しているか
  employmentStatus?: string;        // 現在の就業状況
  // LP経由登録情報
  registrationLpId?: string;
  registrationCampaignCode?: string;
  registrationGenrePrefix?: string;
  // LP帰属ソース（クライアント側で判定: 'localStorage' | 'urlParams' | 'none'）
  lpAttributionSource?: string;
  // 電話番号SMS認証トークン
  phoneVerificationToken?: string;
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  let body: RegisterBody | null = null;
  try {
    body = await request.json() as RegisterBody;
    const {
      email,
      password,
      name,
      lastName,
      firstName,
      phoneNumber,
      birthDate,
      qualifications,
      lastNameKana,
      firstNameKana,
      gender,
      nationality,
      postalCode,
      prefecture,
      city,
      addressLine,
      building,
      experienceFields,
      workHistories,
      qualificationCertificates,
      desiredWorkStyle,
      workFrequency,
      jobTiming,
      employmentStatus,
      registrationLpId,
      registrationCampaignCode,
      registrationGenrePrefix,
      lpAttributionSource: clientLpSource,
      phoneVerificationToken,
    } = body;

    // LP帰属のフォールバックチェーン
    // 1. localStorage / URLパラメータ（クライアントから送信）
    // 2. IPアドレス照合（サーバーサイド）
    let resolvedLpId = registrationLpId || null;
    let resolvedCampaignCode = registrationCampaignCode || null;
    let resolvedGenrePrefix = registrationGenrePrefix || null;
    let lpAttributionSource = clientLpSource || (resolvedLpId ? 'client' : 'none');

    if (!resolvedLpId) {
      try {
        const clientIp = await getClientIpAddress();
        const ipResult = await findLpByIpAddress(clientIp);
        if (ipResult) {
          resolvedLpId = ipResult.lpId;
          resolvedCampaignCode = ipResult.campaignCode;
          resolvedGenrePrefix = ipResult.genrePrefix;
          lpAttributionSource = 'ipFallback';
        }
      } catch (e) {
        // IPフォールバックのエラーは登録処理に影響させない
        console.error('LP IP fallback error (non-blocking):', e);
      }
    }

    // lastName/firstNameが渡された場合はnameに結合
    const resolvedName = (lastName && firstName)
      ? `${lastName} ${firstName}`
      : name?.trim() || '';

    // バリデーション（name は任意）
    if (!email || !password || !phoneNumber) {
      return NextResponse.json(
        { error: '必須項目を入力してください' },
        { status: 400 }
      );
    }

    // パスワード: 最低 8 文字
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で入力してください' },
        { status: 400 }
      );
    }

    // メール形式チェック
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { error: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhoneDigits(phoneNumber);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      return NextResponse.json(
        { error: '電話番号の形式が正しくありません' },
        { status: 400 }
      );
    }

    // 電話番号SMS認証トークンの検証
    if (!phoneVerificationToken) {
      return NextResponse.json(
        { error: '電話番号のSMS認証が必要です' },
        { status: 400 }
      );
    }

    const isPhoneVerified = await validatePhoneVerificationToken(phoneVerificationToken, normalizedPhone);
    if (!isPhoneVerified) {
      return NextResponse.json(
        { error: '電話番号の認証トークンが無効または期限切れです。再度認証を行ってください。' },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック（case-insensitive、既存レガシーデータ対応）
    const existingEmailUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existingEmailUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      );
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12);

    // 職歴を配列として保存（空文字を除外）
    const workHistoriesArray = workHistories && Array.isArray(workHistories)
      ? workHistories.filter((h: string) => h && h.trim() !== '')
      : [];

    // 希望の働き方（複数選択）は CSV で保存（既存 String? カラム踏襲）
    const desiredWorkStyleCsv = Array.isArray(desiredWorkStyle) && desiredWorkStyle.length > 0
      ? desiredWorkStyle.filter(s => s && s.trim() !== '').join(',')
      : null;

    // 電話番号の race 軽減: Postgres advisory xact lock で同一電話番号の同時登録を直列化
    const lockKey = phoneLockKey(normalizedPhone);

    // ユーザー作成（name は空文字許容）。P2002 (email unique 衝突) で email race を検出
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        // 電話番号に対する advisory lock（トランザクション終了まで保持、他セッションは待機）
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`
        );

        // ロック取得後の再チェック（race safe）
        // 既存データにハイフンや全角数字が残っている可能性に備え、SQL 側で正規化比較
        // translate で全角数字 → 半角数字、regexp_replace で非数字除去
        const phoneExists = await tx.$queryRaw<{ id: number }[]>(
          Prisma.sql`SELECT id FROM users
            WHERE regexp_replace(translate(phone_number, '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g') = ${normalizedPhone}
            AND phone_verified = true
            AND deleted_at IS NULL
            LIMIT 1`
        );
        if (phoneExists.length > 0) {
          throw new Error('PHONE_ALREADY_REGISTERED');
        }

        return tx.user.create({
          data: {
            email: normalizedEmail,
            password_hash: hashedPassword,
            name: resolvedName,
            phone_number: normalizedPhone,
            phone_verified: true,
            phone_verified_at: new Date(),
            birth_date: birthDate ? new Date(birthDate + 'T00:00:00+09:00') : null,
            qualifications: qualifications || [],
            last_name_kana: lastNameKana || null,
            first_name_kana: firstNameKana || null,
            gender: gender || null,
            nationality: nationality || null,
            postal_code: postalCode || null,
            prefecture: prefecture || null,
            city: city || null,
            address_line: addressLine || null,
            building: building || null,
            experience_fields: experienceFields && Object.keys(experienceFields).length > 0 ? experienceFields as Prisma.InputJsonValue : Prisma.DbNull,
            work_histories: workHistoriesArray,
            qualification_certificates: qualificationCertificates && Object.keys(qualificationCertificates).length > 0 ? qualificationCertificates as Prisma.InputJsonValue : Prisma.DbNull,
            // 新登録フロー項目（既存カラムに対応）
            desired_work_style: desiredWorkStyleCsv,
            desired_work_days_week: workFrequency || null,
            job_change_desire: jobTiming || null,
            current_work_style: employmentStatus || null,
            // LP経由登録情報（フォールバックチェーン適用済み）
            registration_lp_id: resolvedLpId,
            registration_campaign_code: resolvedCampaignCode,
            registration_genre_prefix: resolvedGenrePrefix,
          },
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'PHONE_ALREADY_REGISTERED') {
        return NextResponse.json(
          { error: 'この電話番号は既に登録されています' },
          { status: 409 }
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined)?.join(',') || '';
        if (target.includes('email')) {
          return NextResponse.json(
            { error: 'このメールアドレスは既に登録されています' },
            { status: 409 }
          );
        }
      }
      throw e;
    }

    // 操作ログを記録（ユーザー登録成功）
    await logActivity({
      userType: 'WORKER',
      userId: user.id,
      userEmail: user.email,
      action: 'REGISTER',
      targetType: 'User',
      targetId: user.id,
      requestData: { name, email, phoneNumber, prefecture, city, lpAttributionSource, lpId: resolvedLpId },
      result: 'SUCCESS',
      url: '/api/auth/register',
    });

    // 認証メールを送信（エラーがあっても登録は成功とする）
    let emailError: string | null = null;
    try {
      const verificationResult = await sendVerificationEmail(
        user.id,
        user.email,
        user.name || '+タスタスユーザー'
      );

      if (!verificationResult.success) {
        emailError = verificationResult.error || 'Unknown email error';
        console.error('Failed to send verification email:', emailError);
      }
    } catch (emailErr) {
      emailError = getErrorMessage(emailErr);
      console.error('Exception sending verification email:', emailError, getErrorStack(emailErr));
    }

    // 管理者に新規ワーカー登録を通知（エラーがあってもスキップ）
    try {
      await sendAdminNewWorkerNotification(
        user.id,
        user.name || '名前未設定',
        user.email
      );
    } catch (notifyErr) {
      console.error('Failed to notify admin:', getErrorMessage(notifyErr));
    }

    // TasLinkへワーカー情報を同期（同期完了を待つが、失敗しても登録は成功させる）
    try {
      const tasLinkPayload = mapUserToTasLinkPayload(user);
      if (tasLinkPayload) {
        await syncWorkerToTasLink(user.id, tasLinkPayload);
      }
    } catch (tasLinkErr) {
      console.error('[TasLink] Registration sync failed:', getErrorMessage(tasLinkErr));
    }

    // 登録完了と同時に NextAuth セッション Cookie を発行（サンクスページ到達時点でログイン済みに）
    const response = NextResponse.json({
      message: '登録が完了しました。',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      redirect: '/register/worker/thanks',
      emailSent: !emailError,
    });
    await issueSessionCookie(response, {
      id: user.id,
      email: user.email,
      name: user.name,
    });
    return response;
  } catch (error) {
    console.error('Registration error:', error);

    // 操作ログを記録（ユーザー登録失敗）
    await logActivity({
      userType: 'GUEST',
      userEmail: null,
      action: 'REGISTER_FAILED',
      targetType: 'User',
      requestData: { email: body?.email },
      result: 'ERROR',
      errorMessage: getErrorMessage(error),
      errorStack: getErrorStack(error),
      url: '/api/auth/register',
    }).catch(logErr => console.error('Failed to log activity:', logErr));

    // 本番環境では詳細情報を秘匿（開発・EXPOSE_DEBUG_ERRORS=true の場合のみ公開）
    const exposeDebug =
      process.env.NODE_ENV !== 'production' ||
      process.env.EXPOSE_DEBUG_ERRORS === 'true';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: '登録中にエラーが発生しました',
        ...(exposeDebug ? {
          debug: {
            message: errorMessage,
            stack: errorStack?.split('\n').slice(0, 5).join('\n'),
          },
        } : {}),
      },
      { status: 500 }
    );
  }
}
