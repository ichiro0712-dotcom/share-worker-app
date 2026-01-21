import { NextResponse } from 'next/server';
import { validateFacilityAccess } from './admin-session-server';

/**
 * 施設管理者API認証ヘルパー
 *
 * Admin APIエンドポイントで使用する認証・認可ラッパー関数。
 * サーバーサイドセッション（iron-session）を使用して:
 * 1. 認証状態を確認（未認証なら401）
 * 2. facilityId所有権を検証（不一致なら403）
 * 3. 検証済みfacilityIdでハンドラーを実行
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const facilityId = parseInt(searchParams.get('facilityId') || '0');
 *   return withFacilityAuth(facilityId, async (validatedFacilityId) => {
 *     const data = await getData(validatedFacilityId);
 *     return data;
 *   });
 * }
 */
export async function withFacilityAuth<T>(
  requestedFacilityId: number,
  handler: (facilityId: number) => Promise<T>,
  options?: {
    headers?: HeadersInit;
  }
): Promise<NextResponse> {
  try {
    // facilityIdが不正な場合
    if (!requestedFacilityId || isNaN(requestedFacilityId)) {
      return NextResponse.json(
        { error: 'Facility ID is required' },
        { status: 400 }
      );
    }

    // 認証・認可チェック
    const { valid, error } = await validateFacilityAccess(requestedFacilityId);

    if (!valid) {
      if (error === 'unauthorized') {
        return NextResponse.json(
          { error: '認証が必要です', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error === 'forbidden') {
        return NextResponse.json(
          { error: 'この施設のデータにアクセスする権限がありません', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // ハンドラー実行
    const result = await handler(requestedFacilityId);

    // デフォルトヘッダー
    const defaultHeaders: HeadersInit = {
      'Cache-Control': 'no-store, max-age=0',
    };

    return NextResponse.json(result, {
      headers: { ...defaultHeaders, ...options?.headers },
    });
  } catch (error) {
    console.error('[withFacilityAuth] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 認証のみチェック（facilityId検証なし）
 *
 * セッション確認APIなど、facilityIdを必要としないエンドポイント用
 */
export async function withFacilityAuthOnly<T>(
  handler: (session: { adminId: number; facilityId: number; name: string; email: string }) => Promise<T>
): Promise<NextResponse> {
  try {
    const { valid, session, error } = await validateFacilityAccess(0); // ダミーのfacilityId

    // 認証チェックのみ（validateFacilityAccessのロジックを利用するため再チェック）
    if (!session || !session.isLoggedIn || !session.adminId || !session.facilityId) {
      return NextResponse.json(
        { error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const result = await handler({
      adminId: session.adminId,
      facilityId: session.facilityId,
      name: session.name || '',
      email: session.email || '',
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('[withFacilityAuthOnly] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
