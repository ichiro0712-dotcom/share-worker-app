import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase';

// 許可するファイルタイプ（MIMEタイプ）
const ALLOWED_MIME_TYPES = [
  // 画像（スマホ撮影・スキャナー対応）
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',  // iPhone
  'image/heif',  // iPhone
  'image/bmp',   // Windows標準
  'image/tiff',  // スキャナー
  'image/svg+xml', // ベクター画像
  // ドキュメント
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain', // .txt
  'text/csv', // .csv
];

// 許可するファイル拡張子
const ALLOWED_EXTENSIONS = [
  // 画像（スマホ撮影・スキャナー対応）
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif', 'svg',
  // ドキュメント
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
];

// 最大ファイルサイズ（通常: 10MB）
// クライアント側バリデーション（utils/fileValidation.ts）と同期
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// ご利用ガイド用最大ファイルサイズ（100MB）
const MAX_USER_GUIDE_FILE_SIZE = 100 * 1024 * 1024;

// メッセージ添付用最大ファイルサイズ（15MB）
const MAX_MESSAGE_FILE_SIZE = 15 * 1024 * 1024;

// 最大アップロード数
const MAX_FILES = 10;

/**
 * ファイル拡張子を検証
 */
function isValidExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ALLOWED_EXTENSIONS.includes(ext) : false;
}

/**
 * MIMEタイプを検証
 */
function isValidMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * ファイル名をサニタイズ（パストラバーサル対策）
 */
function sanitizeFileName(filename: string): string {
  // パス区切り文字と危険な文字を除去
  return filename.replace(/[/\\:*?"<>|]/g, '').replace(/\.\./g, '');
}

/**
 * S3 Compatible Storageにファイルをアップロード
 * FormDataから受け取るファイルはBlob互換（name, typeプロパティを持つ）
 */
interface FileBlob extends Blob {
  name: string;
  type: string;
}

async function uploadToSupabase(
  file: FileBlob,
  folder: string
): Promise<string> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const sanitizedName = sanitizeFileName(file.name);
  const ext = sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${folder}/${timestamp}-${randomStr}.${ext}`;

  // BlobをBufferに変換してからアップロード
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await uploadFile(
    STORAGE_BUCKETS.UPLOADS,
    fileName,
    buffer,
    file.type
  );

  if ('error' in result) {
    console.error('[S3 Storage] Upload error:', result.error);
    throw new Error(`アップロードに失敗しました: ${result.error}`);
  }

  return result.url;
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック（ワーカーまたは施設管理者）
    const session = await getServerSession(authOptions);

    // 施設管理者の認証チェック（Cookieベース）
    const adminCookie = request.cookies.get('admin_session');
    // システム管理者の認証チェック（Cookieベース）
    const systemAdminCookie = request.cookies.get('system_admin_session');
    // 施設管理者の認証チェック（ヘッダーベース - localStorageからの送信用）
    // Base64エンコードされているのでデコードして検証
    const adminHeaderEncoded = request.headers.get('X-Admin-Session');
    let adminHeader: string | null = null;
    if (adminHeaderEncoded) {
      try {
        // Base64デコード
        adminHeader = decodeURIComponent(escape(atob(adminHeaderEncoded)));
        // JSONとして解析できるか検証
        const parsed = JSON.parse(adminHeader);
        if (!parsed.adminId || !parsed.facilityId) {
          adminHeader = null;
        }
      } catch {
        adminHeader = null;
      }
    }

    if (!session?.user && !adminCookie && !systemAdminCookie && !adminHeader) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const uploadType = formData.get('type') as string;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'ファイルがアップロードされていません' },
        { status: 400 }
      );
    }

    // ファイル数の制限チェック
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `一度にアップロードできるファイルは${MAX_FILES}件までです` },
        { status: 400 }
      );
    }

    // ファイルサイズ上限を決定
    const maxFileSize = uploadType === 'user-guide'
      ? MAX_USER_GUIDE_FILE_SIZE
      : uploadType === 'message'
        ? MAX_MESSAGE_FILE_SIZE
        : MAX_FILE_SIZE;

    // 各ファイルの検証
    for (const file of files) {
      // ファイルサイズチェック
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { error: `ファイルサイズは${maxFileSize / 1024 / 1024}MB以下にしてください: ${file.name}` },
          { status: 400 }
        );
      }

      // 拡張子チェック
      if (!isValidExtension(file.name)) {
        return NextResponse.json(
          { error: `許可されていないファイル形式です: ${file.name}` },
          { status: 400 }
        );
      }

      // MIMEタイプチェック
      if (!isValidMimeType(file.type)) {
        return NextResponse.json(
          { error: `許可されていないファイル形式です: ${file.name}` },
          { status: 400 }
        );
      }
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // アップロード先のフォルダを決定
      let folder = 'jobs';
      if (uploadType === 'user-guide') {
        folder = 'user-guides';
      } else if (uploadType === 'message') {
        folder = 'messages';
      }

      // Supabase Storageにアップロード
      const publicUrl = await uploadToSupabase(file, folder);
      uploadedUrls.push(publicUrl);
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}
