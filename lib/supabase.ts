import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.SUPABASE_S3_REGION!,
  endpoint: `${supabaseUrl}/storage/v1/s3`,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for Supabase S3
});

// サーバーサイド用クライアント（Service Role Key使用）
// DB操作などの管理操作に使用
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export { s3Client };

// Storage bucket名
export const STORAGE_BUCKETS = {
  UPLOADS: 'uploads',
  USER_ASSETS: 'user-assets',
  LP_ASSETS: 'lp-assets', // LP用バケット
} as const;

/**
 * S3キー（ファイルパス）をサニタイズ
 * S3はASCII文字のみ対応のため、日本語等のマルチバイト文字を除去
 */
function sanitizeS3Key(key: string): string {
  // パスを分解してファイル名部分のみサニタイズ
  const parts = key.split('/');
  const sanitizedParts = parts.map((part, index) => {
    // 最後の部分（ファイル名）のみ厳格にサニタイズ
    if (index === parts.length - 1) {
      // 拡張子を保持
      const extMatch = part.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : '';
      const nameWithoutExt = ext ? part.slice(0, -ext.length - 1) : part;

      // 非ASCII文字を除去し、安全な文字のみ残す
      const sanitizedName = nameWithoutExt
        .replace(/[^\x00-\x7F]/g, '') // 非ASCII文字を除去
        .replace(/[^a-zA-Z0-9._-]/g, '_') // 安全でない文字をアンダースコアに
        .replace(/_+/g, '_') // 連続するアンダースコアを1つに
        .replace(/^_|_$/g, ''); // 先頭・末尾のアンダースコアを除去

      return ext ? `${sanitizedName || 'file'}.${ext}` : (sanitizedName || 'file');
    }
    // フォルダ名も非ASCII文字を除去
    return part.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  });

  return sanitizedParts.join('/');
}

// ファイルの公開URLを取得
export function getPublicUrl(bucket: string, path: string): string {
  // Supabase Storageの公開URL形式
  // https://<project_ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// ファイルをアップロード
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<{ url: string } | { error: string }> {
  try {
    // S3キーをサニタイズ（日本語等の非ASCII文字を除去）
    const sanitizedPath = sanitizeS3Key(path);

    let body;
    if (file instanceof Blob) {
      // Blobの場合はArrayBufferに変換してからBufferにする（Node.js環境用）
      const arrayBuffer = await file.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } else {
      body = file;
    }

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: sanitizedPath,
        Body: body,
        ContentType: contentType,
        // ACLはSupabase S3互換APIでサポートされていない可能性があるため削除
        // バケットのポリシーで公開設定を行う
      },
    });

    await upload.done();

    const publicUrl = getPublicUrl(bucket, sanitizedPath);
    return { url: publicUrl };
  } catch (error: any) {
    console.error('[S3 Storage] Upload error:', error);
    console.error('[S3 Storage] Upload error details:', {
      bucket,
      path,
      contentType,
      errorName: error?.name,
      errorCode: error?.Code || error?.$metadata?.httpStatusCode,
      errorMessage: error?.message,
    });
    return { error: error.message || 'Upload failed' };
  }
}

// ファイルを削除
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error: any) {
    console.error('[S3 Storage] Delete error:', error);
    return { success: false, error: error.message };
  }
}

// フォルダ内のファイル一覧を取得
export async function listFiles(
  bucket: string,
  folder: string
): Promise<{ files: string[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, {
      limit: 1000, // 十分な数
    });

    if (error) {
      console.error('[Storage] List files error:', error);
      return { files: [], error: error.message };
    }

    // ファイルパスを構築（フォルダ名 + ファイル名）
    const files = (data || [])
      .filter((item) => item.name) // 空の名前を除外
      .map((item) => `${folder}/${item.name}`);

    return { files };
  } catch (error: any) {
    console.error('[Storage] List files error:', error);
    return { files: [], error: error.message };
  }
}

// フォルダ内の全ファイルを削除
export async function deleteFolder(
  bucket: string,
  folder: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    // フォルダ内のファイル一覧を取得
    const { files, error: listError } = await listFiles(bucket, folder);

    if (listError) {
      return { success: false, deletedCount: 0, error: listError };
    }

    if (files.length === 0) {
      console.log(`[Storage] No files found in folder: ${folder}`);
      return { success: true, deletedCount: 0 };
    }

    // Supabase Storage APIで一括削除
    const { error } = await supabaseAdmin.storage.from(bucket).remove(files);

    if (error) {
      console.error('[Storage] Delete folder error:', error);
      return { success: false, deletedCount: 0, error: error.message };
    }

    console.log(`[Storage] Deleted ${files.length} files from folder: ${folder}`);
    return { success: true, deletedCount: files.length };
  } catch (error: any) {
    console.error('[Storage] Delete folder error:', error);
    return { success: false, deletedCount: 0, error: error.message };
  }
}
