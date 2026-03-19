import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import { Prisma } from '@prisma/client';

function checkSuperAdmin() {
  return getSystemAdminSessionData().then((session) => {
    if (!session) return { error: '認証が必要です', status: 401 } as const;
    if (session.role !== 'super_admin') return { error: 'この操作には特権管理者権限が必要です', status: 403 } as const;
    return null;
  });
}

function parseIntStrict(value: string): number | null {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

// GET: フォーム送信先一覧を取得
export async function GET() {
  const authError = await checkSuperAdmin();
  if (authError) {
    return NextResponse.json({ error: authError.error }, { status: authError.status });
  }

  try {
    const destinations = await prisma.formDestination.findMany({
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(destinations);
  } catch (error) {
    console.error('[API /api/system-admin/form-destinations] GET error:', error);
    return NextResponse.json({ error: '送信先の取得に失敗しました' }, { status: 500 });
  }
}

// POST: フォーム送信先を作成
export async function POST(request: NextRequest) {
  const authError = await checkSuperAdmin();
  if (authError) {
    return NextResponse.json({ error: authError.error }, { status: authError.status });
  }

  try {
    const { name, email, description } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
    }
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
    }

    const destination = await prisma.formDestination.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(destination, { status: 201 });
  } catch (error) {
    console.error('[API /api/system-admin/form-destinations] POST error:', error);
    return NextResponse.json({ error: '送信先の作成に失敗しました' }, { status: 500 });
  }
}

// PUT: フォーム送信先を更新
export async function PUT(request: NextRequest) {
  const authError = await checkSuperAdmin();
  if (authError) {
    return NextResponse.json({ error: authError.error }, { status: authError.status });
  }

  try {
    const { id, name, email, description, is_active } = await request.json();

    if (!id || typeof id !== 'number' || !Number.isInteger(id)) {
      return NextResponse.json({ error: 'IDは正の整数で指定してください' }, { status: 400 });
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        return NextResponse.json({ error: 'メールアドレスを空にすることはできません' }, { status: 400 });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
      }
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: '名前を空にすることはできません' }, { status: 400 });
    }

    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_activeはboolean型で指定してください' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = (name as string).trim();
    if (email !== undefined) updateData.email = (email as string).trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const destination = await prisma.formDestination.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(destination);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された送信先が見つかりません' }, { status: 404 });
    }
    console.error('[API /api/system-admin/form-destinations] PUT error:', error);
    return NextResponse.json({ error: '送信先の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE: フォーム送信先を無効化（ソフトデリート）
// フォームがIDで参照しているため、物理削除ではなく無効化する
export async function DELETE(request: NextRequest) {
  const authError = await checkSuperAdmin();
  if (authError) {
    return NextResponse.json({ error: authError.error }, { status: authError.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });
    }

    const id = parseIntStrict(idParam);
    if (id === null) {
      return NextResponse.json({ error: 'IDは正の整数で指定してください' }, { status: 400 });
    }

    await prisma.formDestination.update({
      where: { id },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '指定された送信先が見つかりません' }, { status: 404 });
    }
    console.error('[API /api/system-admin/form-destinations] DELETE error:', error);
    return NextResponse.json({ error: '送信先の削除に失敗しました' }, { status: 500 });
  }
}
