import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 許可するファイルタイプ（MIMEタイプ）
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

// 許可するファイル拡張子
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];

// 最大ファイルサイズ（5MB）
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

export async function POST(request: NextRequest) {
  try {
    // 認証チェック（ワーカーまたは施設管理者）
    const session = await getServerSession(authOptions);

    // 施設管理者の認証チェック（Cookieベース）
    const adminCookie = request.cookies.get('admin_session');

    if (!session?.user && !adminCookie) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

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

    // 各ファイルの検証
    for (const file of files) {
      // ファイルサイズチェック
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `ファイルサイズは${MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください: ${file.name}` },
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

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jobs');

    // ディレクトリが存在しない場合は作成
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // ファイル名をユニークにする
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const sanitizedName = sanitizeFileName(file.name);
      const ext = sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${timestamp}-${randomStr}.${ext}`;

      // パストラバーサル対策: ファイル名にパス区切りが含まれていないことを確認
      if (fileName.includes('/') || fileName.includes('\\')) {
        return NextResponse.json(
          { error: '不正なファイル名です' },
          { status: 400 }
        );
      }

      const filePath = path.join(uploadDir, fileName);

      // 最終的なパスがuploadDir内にあることを確認（パストラバーサル対策）
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(uploadDir);
      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        return NextResponse.json(
          { error: '不正なファイルパスです' },
          { status: 400 }
        );
      }

      // ファイルをバッファとして読み込み
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // ファイルを保存
      await writeFile(filePath, buffer);

      // 公開URLを生成
      uploadedUrls.push(`/uploads/jobs/${fileName}`);
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
