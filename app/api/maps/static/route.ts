import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase';

/**
 * Google Maps Static APIから地図画像を取得してSupabase Storageに保存
 * POST /api/maps/static
 * Body: { address: string, facilityId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { address, facilityId } = await request.json();

    if (!address || !facilityId) {
      return NextResponse.json(
        { error: '住所と施設IDが必要です' },
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
    mapUrl.searchParams.set('center', address);
    mapUrl.searchParams.set('zoom', '16');
    mapUrl.searchParams.set('size', '600x300');
    mapUrl.searchParams.set('scale', '2'); // 高解像度
    mapUrl.searchParams.set('markers', `color:red|${address}`);
    mapUrl.searchParams.set('key', apiKey);

    // 画像を取得
    const response = await fetch(mapUrl.toString());

    if (!response.ok) {
      console.error('[Maps API] Error:', response.status, response.statusText);
      return NextResponse.json(
        { error: '地図画像の取得に失敗しました' },
        { status: 500 }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    // ファイル名を生成（facility-{id}-{timestamp}.png でキャッシュバスティング）
    const timestamp = Date.now();
    const fileName = `maps/facility-${facilityId}-${timestamp}.png`;

    const result = await uploadFile(
      STORAGE_BUCKETS.UPLOADS,
      fileName,
      Buffer.from(imageBuffer),
      'image/png'
    );

    if ('error' in result) {
      console.error('[Maps API] Storage Error:', result.error);
      return NextResponse.json(
        { error: '地図画像の保存に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mapImage: result.url,
    });
  } catch (error) {
    console.error('[Maps API] Error:', error);
    return NextResponse.json(
      { error: '地図画像の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
