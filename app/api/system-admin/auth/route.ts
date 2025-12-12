import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  createSystemAdminServerSession,
  clearSystemAdminServerSession,
  getSystemAdminSessionData,
} from '@/lib/system-admin-session-server';

/**
 * POST /api/system-admin/auth - ログイン
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      );
    }

    // システム管理者を検索
    const admin = await prisma.systemAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // パスワード検証
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // セッション作成
    await createSystemAdminServerSession({
      adminId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('System Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'ログイン中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/system-admin/auth - ログアウト
 */
export async function DELETE() {
  try {
    await clearSystemAdminServerSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('System Admin logout error:', error);
    return NextResponse.json(
      { success: false, error: 'ログアウト中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system-admin/auth - セッション確認
 */
export async function GET() {
  try {
    const sessionData = await getSystemAdminSessionData();

    if (!sessionData) {
      return NextResponse.json({ isLoggedIn: false });
    }

    return NextResponse.json({
      isLoggedIn: true,
      admin: {
        id: sessionData.adminId,
        name: sessionData.name,
        email: sessionData.email,
        role: sessionData.role,
      },
    });
  } catch (error) {
    console.error('System Admin session check error:', error);
    return NextResponse.json({ isLoggedIn: false });
  }
}
