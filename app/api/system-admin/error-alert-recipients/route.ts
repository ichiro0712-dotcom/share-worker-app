import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

// GET: 通知先一覧を取得
export async function GET() {
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const recipients = await prisma.errorAlertRecipient.findMany({
            orderBy: { created_at: 'desc' },
        });

        // 最終チェック日時を取得
        const lastChecked = await prisma.systemSetting.findUnique({
            where: { key: 'error_alert_last_checked_at' },
        });

        return NextResponse.json({
            recipients,
            lastChecked,
        });
    } catch (error) {
        console.error('Failed to fetch error alert recipients:', error);
        return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }
}

// POST: 通知先を追加
export async function POST(request: NextRequest) {
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { email, name } = body;

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
        }

        // 重複チェック
        const existing = await prisma.errorAlertRecipient.findUnique({
            where: { email },
        });

        if (existing) {
            return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 });
        }

        const recipient = await prisma.errorAlertRecipient.create({
            data: {
                email,
                name: name || null,
                is_active: true,
            },
        });

        return NextResponse.json({ success: true, recipient });
    } catch (error) {
        console.error('Failed to create error alert recipient:', error);
        return NextResponse.json({ error: 'Failed to create recipient' }, { status: 500 });
    }
}

// PATCH: 有効/無効を切り替え
export async function PATCH(request: NextRequest) {
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, is_active } = body;

        if (typeof id !== 'number' || typeof is_active !== 'boolean') {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const recipient = await prisma.errorAlertRecipient.update({
            where: { id },
            data: { is_active },
        });

        return NextResponse.json({ success: true, recipient });
    } catch (error) {
        console.error('Failed to update error alert recipient:', error);
        return NextResponse.json({ error: 'Failed to update recipient' }, { status: 500 });
    }
}

// DELETE: 通知先を削除
export async function DELETE(request: NextRequest) {
    const session = await getSystemAdminSessionData();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id } = body;

        if (typeof id !== 'number') {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        await prisma.errorAlertRecipient.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete error alert recipient:', error);
        return NextResponse.json({ error: 'Failed to delete recipient' }, { status: 500 });
    }
}
