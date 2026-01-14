import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 本番環境でのアクセスを拒否
 */
function rejectInProduction(): NextResponse | null {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Debug API is disabled in production' },
            { status: 403 }
        );
    }
    return null;
}

export async function GET() {
    const rejected = rejectInProduction();
    if (rejected) return rejected;

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                profile_image: true,
            },
            orderBy: {
                id: 'asc',
            },
        });

        return NextResponse.json({
            success: true,
            count: users.length,
            users: users.map((user) => ({
                id: user.id,
                email: user.email,
                name: user.name,
                profileImage: user.profile_image,
            })),
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
