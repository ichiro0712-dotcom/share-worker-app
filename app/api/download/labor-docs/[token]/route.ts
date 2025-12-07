import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/download/labor-docs/[token]
 * トークンを使用して労働条件通知書ZIPをダウンロード
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // トークンを検証
    const tokenRecord = await prisma.laborDocumentDownloadToken.findUnique({
      where: { token },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: '無効なダウンロードリンクです' },
        { status: 404 }
      );
    }

    // 有効期限をチェック
    if (new Date() > tokenRecord.expires_at) {
      return NextResponse.json(
        { error: 'ダウンロードリンクの有効期限が切れています' },
        { status: 410 }
      );
    }

    // 処理状態をチェック
    if (tokenRecord.status === 'PENDING') {
      return NextResponse.json(
        { error: 'ファイルを準備中です。しばらくお待ちください。', status: 'PENDING' },
        { status: 202 }
      );
    }

    if (tokenRecord.status === 'FAILED') {
      return NextResponse.json(
        { error: `ファイル生成に失敗しました: ${tokenRecord.error_message}` },
        { status: 500 }
      );
    }

    if (!tokenRecord.zip_path) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 404 }
      );
    }

    // ZIPファイルを読み込む
    const filePath = join(process.cwd(), 'public', tokenRecord.zip_path);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(filePath);
    } catch {
      return NextResponse.json(
        { error: 'ファイルの読み込みに失敗しました' },
        { status: 500 }
      );
    }

    // ダウンロード済みとしてマーク
    await prisma.laborDocumentDownloadToken.update({
      where: { id: tokenRecord.id },
      data: {
        downloaded: true,
        downloaded_at: new Date(),
      },
    });

    // ワーカー名を取得してファイル名を生成
    const worker = await prisma.user.findUnique({
      where: { id: tokenRecord.worker_id },
      select: { name: true },
    });

    const startDate = tokenRecord.start_date.toISOString().split('T')[0];
    const endDate = tokenRecord.end_date.toISOString().split('T')[0];
    const safeName = (worker?.name || 'worker').replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `労働条件通知書_${safeName}_${startDate}_${endDate}.zip`;

    // ZIPファイルをレスポンスとして返す
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/download/labor-docs/[token]] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/download/labor-docs/[token]
 * トークンのステータスを確認（ダウンロード準備完了かどうか）
 */
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const tokenRecord = await prisma.laborDocumentDownloadToken.findUnique({
      where: { token },
    });

    if (!tokenRecord) {
      return new NextResponse(null, { status: 404 });
    }

    if (new Date() > tokenRecord.expires_at) {
      return new NextResponse(null, { status: 410 });
    }

    if (tokenRecord.status === 'PENDING') {
      return new NextResponse(null, {
        status: 202,
        headers: { 'X-Status': 'PENDING' },
      });
    }

    if (tokenRecord.status === 'FAILED') {
      return new NextResponse(null, {
        status: 500,
        headers: { 'X-Status': 'FAILED' },
      });
    }

    return new NextResponse(null, {
      status: 200,
      headers: { 'X-Status': 'COMPLETED' },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
