import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const body = await request.json();

        const updated = await prisma.notificationSetting.update({
            where: { id },
            data: body,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Failed to update notification setting:', error);
        return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }
}
