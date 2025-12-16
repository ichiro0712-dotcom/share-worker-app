import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// サーバーサイド用クライアント（Service Role Key使用）
// ファイルアップロードなどの管理操作に使用
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Storage bucket名
export const STORAGE_BUCKETS = {
  UPLOADS: 'uploads',
} as const;

// ファイルの公開URLを取得
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ファイルをアップロード
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true, // 同名ファイルは上書き
    });

  if (error) {
    console.error('[Supabase Storage] Upload error:', error);
    return { error: error.message };
  }

  const publicUrl = getPublicUrl(bucket, data.path);
  return { url: publicUrl };
}

// ファイルを削除
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);

  if (error) {
    console.error('[Supabase Storage] Delete error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
