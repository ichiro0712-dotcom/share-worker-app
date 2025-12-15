import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await prisma.notificationSetting.findMany({
            orderBy: [
                { target_type: 'asc' },
                { id: 'asc' },
            ],
        });
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Failed to fetch notification settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}
