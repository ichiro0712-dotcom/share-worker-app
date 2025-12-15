import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // DB接続テスト
        const userCount = await prisma.user.count();
        const firstUser = await prisma.user.findFirst({
            select: {
                id: true,
                email: true,
                name: true,
            }
        });

        return NextResponse.json({
            success: true,
            database: 'connected',
            userCount,
            firstUser,
            env: {
                hasDbUrl: !!process.env.DATABASE_URL,
                dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 50) + '...',
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            errorName: error.name,
            env: {
                hasDbUrl: !!process.env.DATABASE_URL,
                dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 50) + '...',
            }
        }, { status: 500 });
    }
}
