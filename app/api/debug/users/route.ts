import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
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
