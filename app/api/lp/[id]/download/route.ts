import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STORAGE_BUCKETS } from '@/lib/supabase';
import JSZip from 'jszip';

/**
 * LP ZIPダウンロードAPI
 * /api/lp/1/download → LP番号1の全ファイルをZIPでダウンロード
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lpNumber = parseInt(id, 10);

  if (isNaN(lpNumber)) {
    return new NextResponse('Invalid LP number', { status: 400 });
  }

  // DBからLP情報を取得
  const lp = await prisma.landingPage.findUnique({
    where: { lp_number: lpNumber },
  });

  if (!lp) {
    return new NextResponse('LP not found', { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[LP Download] Missing Supabase credentials');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  try {
    console.log('[LP Download] Starting download for LP:', lpNumber);
    console.log('[LP Download] Supabase URL:', supabaseUrl);
    console.log('[LP Download] Bucket:', STORAGE_BUCKETS.LP_ASSETS);

    // Supabase Storage APIでフォルダ内のファイル一覧を取得
    const listUrl = `${supabaseUrl}/storage/v1/object/list/${STORAGE_BUCKETS.LP_ASSETS}`;
    console.log('[LP Download] List URL:', listUrl);

    const listResponse = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: `${lpNumber}/`,
        limit: 1000,
      }),
    });

    console.log('[LP Download] List response status:', listResponse.status);

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('[LP Download] Failed to list files:', errorText);
      return new NextResponse(`Failed to list LP files: ${errorText}`, { status: 500 });
    }

    const files = await listResponse.json();
    console.log('[LP Download] Files found in root:', JSON.stringify(files, null, 2));

    if (!files || files.length === 0) {
      console.log('[LP Download] No files found for LP:', lpNumber);
      return new NextResponse('No files found for this LP', { status: 404 });
    }

    // ZIPファイルを作成
    const zip = new JSZip();

    // 各ファイルをダウンロードしてZIPに追加
    for (const file of files) {
      if (!file.name || file.name.endsWith('/')) continue; // フォルダはスキップ

      const filePath = `${lpNumber}/${file.name}`;
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${filePath}`;

      try {
        const fileResponse = await fetch(`${fileUrl}?t=${Date.now()}`, { cache: 'no-store' });
        if (fileResponse.ok) {
          const fileBuffer = await fileResponse.arrayBuffer();
          // LP番号プレフィックスを除去してZIPに追加
          const zipPath = file.name;
          zip.file(zipPath, fileBuffer);
        } else {
          console.warn(`[LP Download] Failed to fetch file: ${filePath}`);
        }
      } catch (err) {
        console.warn(`[LP Download] Error fetching file ${filePath}:`, err);
      }
    }

    // サブフォルダ内のファイルも取得（images, tastas_logo など）
    const subfolders = ['images', 'tastas_logo', 'css', 'js', 'fonts', 'qr'];
    for (const subfolder of subfolders) {
      const subListResponse = await fetch(listUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: `${lpNumber}/${subfolder}/`,
          limit: 1000,
        }),
      });

      if (subListResponse.ok) {
        const subFiles = await subListResponse.json();
        for (const file of subFiles) {
          if (!file.name || file.name.endsWith('/')) continue;

          const filePath = `${lpNumber}/${subfolder}/${file.name}`;
          const fileUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.LP_ASSETS}/${filePath}`;

          try {
            const fileResponse = await fetch(`${fileUrl}?t=${Date.now()}`, { cache: 'no-store' });
            if (fileResponse.ok) {
              const fileBuffer = await fileResponse.arrayBuffer();
              zip.file(`${subfolder}/${file.name}`, fileBuffer);
            }
          } catch (err) {
            console.warn(`[LP Download] Error fetching subfolder file ${filePath}:`, err);
          }
        }
      }
    }

    // ZIPを生成
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    // ファイル名をASCIIのみにサニタイズ（HTTPヘッダー用）
    const asciiName = lp.name
      .replace(/[^\x00-\x7F]/g, '') // 非ASCII文字を除去
      .replace(/[^a-zA-Z0-9_-]/g, '_') // 安全でない文字をアンダースコアに
      .replace(/_+/g, '_') // 連続するアンダースコアを1つに
      .replace(/^_|_$/g, '') // 先頭・末尾のアンダースコアを除去
      || 'download'; // 空になった場合のフォールバック

    // RFC 5987に準拠したContent-Dispositionヘッダー
    // ASCII版とUTF-8版の両方を提供
    const encodedName = encodeURIComponent(lp.name);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="LP${lpNumber}_${asciiName}.zip"; filename*=UTF-8''LP${lpNumber}_${encodedName}.zip`,
      },
    });
  } catch (error) {
    console.error('[LP Download] Error:', error);
    console.error('[LP Download] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return new NextResponse(`Failed to create ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
