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
} as const;

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
        Key: path,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read', // 公開アクセス設定
      },
    });

    await upload.done();

    const publicUrl = getPublicUrl(bucket, path);
    return { url: publicUrl };
  } catch (error: any) {
    console.error('[S3 Storage] Upload error:', error);
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
