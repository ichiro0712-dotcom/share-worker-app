import { NextResponse } from 'next/server';
import { PrismaClient, ErrorMessageSetting } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const settings = await prisma.errorMessageSetting.findMany({
            where: { is_active: true },
        });

        // Convert array to object map for easier lookup on frontend
        // Map banner_message to message for backward compatibility
        const paramMap = settings.reduce((acc: Record<string, any>, curr: ErrorMessageSetting) => {
            acc[curr.key] = {
                ...curr,
                message: curr.banner_message, // Map for frontend compatibility
            };
            return acc;
        }, {} as Record<string, any>);

        return NextResponse.json(paramMap);
    } catch (error) {
        console.error('Error feching error message settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch error message settings' },
            { status: 500 }
        );
    }
}
