import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const settings = await prisma.errorMessageSetting.findMany({
            orderBy: { id: 'asc' },
        });
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error feching error message settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch error message settings' },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, title, banner_message, detail_message, banner_enabled, chat_enabled, email_enabled, push_enabled } = body;

        if (!id || !title || !banner_message) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const updatedSetting = await prisma.errorMessageSetting.update({
            where: { id: Number(id) },
            data: {
                title,
                banner_message,
                detail_message,
                banner_enabled,
                chat_enabled,
                email_enabled,
                push_enabled,
            },
        });

        return NextResponse.json(updatedSetting);
    } catch (error) {
        console.error('Error updating error message setting:', error);
        return NextResponse.json(
            { error: 'Failed to update error message setting' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, enable_field, value } = body;

        if (!id || !enable_field || typeof value !== 'boolean') {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 許可されたフィールドのみ更新可能
        const allowedFields = ['banner_enabled', 'chat_enabled', 'email_enabled', 'push_enabled'];
        if (!allowedFields.includes(enable_field)) {
            return NextResponse.json(
                { error: 'Invalid field' },
                { status: 400 }
            );
        }

        const updatedSetting = await prisma.errorMessageSetting.update({
            where: { id: Number(id) },
            data: {
                [enable_field]: value,
            },
        });

        return NextResponse.json(updatedSetting);
    } catch (error) {
        console.error('Error patching error message setting:', error);
        return NextResponse.json(
            { error: 'Failed to update error message setting' },
            { status: 500 }
        );
    }
}
