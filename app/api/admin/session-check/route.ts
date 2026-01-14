import { NextResponse } from 'next/server';
import { getFacilityAdminSessionData } from '@/lib/admin-session-server';

export const dynamic = 'force-dynamic';

/**
 * 施設管理者セッション確認API
 *
 * フロントエンドの初期化時にサーバーサイドセッションの有効性を確認するためのエンドポイント。
 * localStorageにセッション情報があっても、サーバーサイドセッションがない場合は
 * 再ログインが必要であることを検知するために使用。
 *
 * レスポンス:
 * - 200: セッション有効 { valid: true, facilityId, name, email }
 * - 401: セッション無効 { valid: false }
 */
export async function GET() {
    try {
        const session = await getFacilityAdminSessionData();

        if (!session || !session.isLoggedIn || !session.facilityId) {
            return NextResponse.json(
                { valid: false },
                {
                    status: 401,
                    headers: { 'Cache-Control': 'no-store, max-age=0' },
                }
            );
        }

        return NextResponse.json(
            {
                valid: true,
                facilityId: session.facilityId,
                adminId: session.adminId,
                name: session.name,
                email: session.email,
            },
            {
                headers: { 'Cache-Control': 'no-store, max-age=0' },
            }
        );
    } catch (error) {
        console.error('[API /api/admin/session-check] Error:', error);
        return NextResponse.json(
            { valid: false, error: 'Session check failed' },
            {
                status: 500,
                headers: { 'Cache-Control': 'no-store, max-age=0' },
            }
        );
    }
}
