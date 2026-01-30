import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getPublicUrl, STORAGE_BUCKETS } from '@/lib/supabase';

// 許可するファイル拡張子
const ALLOWED_EXTENSIONS = [
  // 画像（スマホ撮影・スキャナー対応）
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif', 'svg',
  // ドキュメント
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
];

// 許可するMIMEタイプ
const ALLOWED_MIME_TYPES = [
  // 画像
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'image/bmp', 'image/tiff', 'image/svg+xml',
  // ドキュメント
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

// 最大ファイルサイズ（10MB）
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// ご利用ガイド用最大ファイルサイズ（100MB）
const MAX_USER_GUIDE_FILE_SIZE = 100 * 1024 * 1024;

// メッセージ添付用最大ファイルサイズ（15MB）
const MAX_MESSAGE_FILE_SIZE = 15 * 1024 * 1024;

// S3 Client for presigned URL generation
const s3Client = new S3Client({
  region: process.env.SUPABASE_S3_REGION!,
  endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/s3`,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

/**
 * ファイル名をサニタイズ（パストラバーサル対策 + S3用ASCII化）
 */
function sanitizeFileName(filename: string): string {
  // 拡張子を抽出
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  // 非ASCII文字を除去し、安全な文字のみ残す
  const sanitizedName = filename
    .replace(/\.[^.]+$/, '') // 拡張子を除去
    .replace(/[^\x00-\x7F]/g, '') // 非ASCII文字を除去
    .replace(/[^a-zA-Z0-9._-]/g, '_') // 安全でない文字をアンダースコアに
    .replace(/_+/g, '_') // 連続するアンダースコアを1つに
    .replace(/^_|_$/g, '') // 先頭・末尾のアンダースコアを除去
    || 'file';

  return ext ? `${sanitizedName}.${ext}` : sanitizedName;
}

/**
 * 署名付きURL生成API
 * クライアントから直接Supabase Storageにアップロードするための署名付きURLを生成
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（ワーカー、施設管理者、システム管理者）
    const session = await getServerSession(authOptions);
    const adminCookie = request.cookies.get('admin_session');
    const systemAdminCookie = request.cookies.get('system_admin_session');

    // ヘッダーベース認証（localStorageからの送信用）
    const adminHeaderEncoded = request.headers.get('X-Admin-Session');
    let adminHeader: string | null = null;
    if (adminHeaderEncoded) {
      try {
        adminHeader = decodeURIComponent(escape(atob(adminHeaderEncoded)));
        const parsed = JSON.parse(adminHeader);
        if (!parsed.adminId || !parsed.facilityId) {
          adminHeader = null;
        }
      } catch {
        adminHeader = null;
      }
    }

    if (!session?.user && !adminCookie && !systemAdminCookie && !adminHeader) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, contentType, fileSize, uploadType } = body;

    if (!fileName || !contentType || !fileSize) {
      return NextResponse.json(
        { error: 'fileName, contentType, fileSize は必須です' },
        { status: 400 }
      );
    }

    // ファイルサイズ上限を決定
    const maxFileSize = uploadType === 'user-guide'
      ? MAX_USER_GUIDE_FILE_SIZE
      : uploadType === 'message'
        ? MAX_MESSAGE_FILE_SIZE
        : MAX_FILE_SIZE;

    // ファイルサイズチェック
    if (fileSize > maxFileSize) {
      return NextResponse.json(
        { error: `ファイルサイズは${maxFileSize / 1024 / 1024}MB以下にしてください` },
        { status: 400 }
      );
    }

    // 拡張子チェック
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: '許可されていないファイル形式です' },
        { status: 400 }
      );
    }

    // MIMEタイプチェック
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: '許可されていないファイル形式です' },
        { status: 400 }
      );
    }

    // アップロード先のフォルダを決定
    let folder = 'jobs';
    if (uploadType === 'user-guide') {
      folder = 'user-guides';
    } else if (uploadType === 'message') {
      folder = 'messages';
    } else if (uploadType === 'profile') {
      folder = 'profiles';
    } else if (uploadType === 'facility') {
      folder = 'facilities';
    }

    // ユニークなファイル名を生成
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sanitizedName = sanitizeFileName(fileName);
    const fileExt = sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${folder}/${timestamp}-${randomStr}.${fileExt}`;

    // 署名付きURLを生成（有効期限: 5分）
    const command = new PutObjectCommand({
      Bucket: STORAGE_BUCKETS.UPLOADS,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // 公開URLを生成
    const publicUrl = getPublicUrl(STORAGE_BUCKETS.UPLOADS, key);

    return NextResponse.json({
      success: true,
      presignedUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    console.error('署名付きURL生成エラー:', error);
    return NextResponse.json(
      { error: '署名付きURLの生成に失敗しました' },
      { status: 500 }
    );
  }
}
