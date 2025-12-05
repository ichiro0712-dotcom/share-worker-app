import { NextRequest, NextResponse } from 'next/server';

/**
 * プレビュー用の地図画像を取得
 * GET /api/maps/preview?lat={lat}&lng={lng}
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: '緯度と経度が必要です' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // Google Maps Static API URL
    const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
    mapUrl.searchParams.set('center', `${lat},${lng}`);
    mapUrl.searchParams.set('zoom', '16');
    mapUrl.searchParams.set('size', '600x300');
    mapUrl.searchParams.set('scale', '2');
    mapUrl.searchParams.set('markers', `color:red|${lat},${lng}`);
    mapUrl.searchParams.set('key', apiKey);

    // 画像を取得してプロキシとして返す
    const response = await fetch(mapUrl.toString());

    if (!response.ok) {
      console.error('[Maps Preview API] Error:', response.status, response.statusText);
      return NextResponse.json(
        { error: '地図画像の取得に失敗しました' },
        { status: 500 }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    // 画像をそのまま返す
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[Maps Preview API] Error:', error);
    return NextResponse.json(
      { error: '地図画像の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
