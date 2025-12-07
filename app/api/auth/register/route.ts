import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

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
        experience_fields: experienceFields && Object.keys(experienceFields).length > 0 ? experienceFields : Prisma.DbNull,
        work_histories: workHistoriesArray,
        qualification_certificates: qualificationCertificates && Object.keys(qualificationCertificates).length > 0 ? qualificationCertificates : Prisma.DbNull,
      },
    });

    return NextResponse.json({
      message: '登録が完了しました',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '登録中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
