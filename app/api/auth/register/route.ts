import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendAdminNewWorkerNotification } from '@/src/lib/actions/notification';
import { sendVerificationEmail } from '@/src/lib/auth/email-verification';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';

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
  // LP経由登録情報
  registrationLpId?: string;
  registrationCampaignCode?: string;
  registrationGenrePrefix?: string;
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
      registrationLpId,
      registrationCampaignCode,
      registrationGenrePrefix,
    } = body;

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

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 400 }
      );
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12);

    // 職歴を配列として保存（空文字を除外）
    const workHistoriesArray = workHistories && Array.isArray(workHistories)
      ? workHistories.filter((h: string) => h && h.trim() !== '')
      : [];

    // ユーザー作成（name は空文字許容）
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        name: resolvedName,
        phone_number: phoneNumber,
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
        // LP経由登録情報
        registration_lp_id: registrationLpId || null,
        registration_campaign_code: registrationCampaignCode || null,
        registration_genre_prefix: registrationGenrePrefix || null,
      },
    });

    // 操作ログを記録（ユーザー登録成功）
    await logActivity({
      userType: 'WORKER',
      userId: user.id,
      userEmail: user.email,
      action: 'REGISTER',
      targetType: 'User',
      targetId: user.id,
      requestData: { name, email, phoneNumber, prefecture, city },
      result: 'SUCCESS',
      url: '/api/auth/register',
    });

    // 認証メールを送信（エラーがあっても登録は成功とする）
    let emailError: string | null = null;
    try {
      const verificationResult = await sendVerificationEmail(
        user.id,
        user.email,
        user.name || 'TASTASユーザー'
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

    return NextResponse.json({
      message: '登録が完了しました。確認メールをお送りしましたので、メール内のリンクをクリックして認証を完了してください。',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      requiresVerification: true,
      emailSent: !emailError,
    });
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

    // デバッグ用：エラー詳細を返す（本番運用開始後は削除）
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: '登録中にエラーが発生しました',
        debug: {
          message: errorMessage,
          stack: errorStack?.split('\n').slice(0, 5).join('\n'),
        }
      },
      { status: 500 }
    );
  }
}
