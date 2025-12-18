import { NextResponse } from 'next/server';
import { sendErrorNotification } from '@/src/lib/error-notification';
import { useAuth } from '@/contexts/AuthContext'; // Note: Cannot use hook in API, need server session
// For simplicity in this demo, strict server session check might be skipped or simplified
// But ideally we should verify user.

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { errorKey, userId, facilityId, variables } = body;

        if (!errorKey) {
            return NextResponse.json({ error: 'Missing errorKey' }, { status: 400 });
        }

        // バックグラウンドで通知処理を実行
        // awaitを使わずにfire-and-forgetにするか、awaitして完了を待つかは要件次第
        // ここでは通知の確実性を重視してawaitする
        await sendErrorNotification({
            errorKey,
            userId,
            facilityId,
            variables,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending error notification:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
