import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // システム管理者テーブルの確認
        const admins = await prisma.systemAdmin.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        });

        return NextResponse.json({
            success: true,
            count: admins.length,
            admins,
            env: {
                hasSessionSecret: !!process.env.SYSTEM_ADMIN_SESSION_SECRET,
                secretLength: process.env.SYSTEM_ADMIN_SESSION_SECRET?.length || 0,
            },
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        const admin = await prisma.systemAdmin.findUnique({
            where: { email },
        });

        if (!admin) {
            return NextResponse.json({
                success: false,
                error: 'Admin not found',
                email,
            });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password_hash);

        return NextResponse.json({
            success: true,
            adminFound: true,
            passwordValid: isValidPassword,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            },
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
