import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Supabase Storageにアップロード
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'ストレージの設定がありません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ファイル名を生成（facility-{id}-{timestamp}.png でキャッシュバスティング）
    const timestamp = Date.now();
    const fileName = `maps/facility-${facilityId}-${timestamp}.png`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, Buffer.from(imageBuffer), {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      console.error('[Maps API] Supabase Storage Error:', error);
      return NextResponse.json(
        { error: '地図画像の保存に失敗しました' },
        { status: 500 }
      );
    }

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      mapImage: urlData.publicUrl,
    });
  } catch (error) {
    console.error('[Maps API] Error:', error);
    return NextResponse.json(
      { error: '地図画像の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
