import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendAdminNewWorkerNotification } from '@/src/lib/actions/notification';
import { sendVerificationEmail } from '@/src/lib/auth/email-verification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      name,
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
    } = body;

    // バリデーション
    if (!email || !password || !name || !phoneNumber) {
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

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        name,
        phone_number: phoneNumber,
        birth_date: birthDate ? new Date(birthDate) : null,
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
        experience_fields: experienceFields && Object.keys(experienceFields).length > 0 ? experienceFields : Prisma.DbNull,
        work_histories: workHistoriesArray,
        qualification_certificates: qualificationCertificates && Object.keys(qualificationCertificates).length > 0 ? qualificationCertificates : Prisma.DbNull,
      },
    });

    // 認証メールを送信
    const verificationResult = await sendVerificationEmail(
      user.id,
      user.email,
      user.name
    );

    if (!verificationResult.success) {
      console.error('Failed to send verification email:', verificationResult.error);
      // 認証メール送信に失敗してもユーザー登録は成功とする
    }

    // 管理者に新規ワーカー登録を通知
    await sendAdminNewWorkerNotification(
      user.id,
      user.name,
      user.email
    );

    return NextResponse.json({
      message: '登録が完了しました。確認メールをお送りしましたので、メール内のリンクをクリックして認証を完了してください。',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Registration error:', error);
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
