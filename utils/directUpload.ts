/**
 * Supabase Storage直接アップロードユーティリティ
 *
 * Netlify Functionsの6MB制限を回避するため、署名付きURLを使って
 * クライアントから直接Supabase Storageにアップロードする
 */

// 最大ファイルサイズ（20MB）
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

// ご利用ガイド用最大ファイルサイズ（100MB）
export const MAX_USER_GUIDE_FILE_SIZE = 100 * 1024 * 1024;

// メッセージ添付用最大ファイルサイズ（15MB）
export const MAX_MESSAGE_FILE_SIZE = 15 * 1024 * 1024;

export type UploadType = 'job' | 'profile' | 'facility' | 'message' | 'user-guide';

interface UploadOptions {
  /** アップロードタイプ（フォルダ決定に使用） */
  uploadType?: UploadType;
  /** 施設管理者セッション（localStorageから取得したもの） */
  adminSession?: string;
  /** 進捗コールバック */
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * ファイルサイズの上限を取得
 */
export function getMaxFileSize(uploadType?: UploadType): number {
  switch (uploadType) {
    case 'user-guide':
      return MAX_USER_GUIDE_FILE_SIZE;
    case 'message':
      return MAX_MESSAGE_FILE_SIZE;
    default:
      return MAX_FILE_SIZE;
  }
}

/**
 * ファイルサイズを人間が読める形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * ファイルを直接Supabase Storageにアップロード
 *
 * 1. サーバーから署名付きURLを取得
 * 2. 署名付きURLを使って直接S3にアップロード
 * 3. 公開URLを返す
 */
export async function directUpload(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { uploadType = 'job', adminSession, onProgress } = options;

  // ファイルサイズチェック
  const maxSize = getMaxFileSize(uploadType);
  if (file.size > maxSize) {
    return {
      success: false,
      error: `ファイルサイズが大きすぎます（${formatFileSize(file.size)}）。${formatFileSize(maxSize)}以下のファイルをお使いください。`,
    };
  }

  try {
    // 1. 署名付きURLを取得
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 施設管理者セッションがある場合はヘッダーに追加
    if (adminSession) {
      const encodedSession = btoa(unescape(encodeURIComponent(adminSession)));
      headers['X-Admin-Session'] = encodedSession;
    }

    const presignedResponse = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        uploadType,
      }),
    });

    if (!presignedResponse.ok) {
      const contentType = presignedResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await presignedResponse.json();
        return { success: false, error: errorData.error || 'アップロードに失敗しました' };
      }
      return { success: false, error: 'サーバーエラーが発生しました' };
    }

    const { presignedUrl, publicUrl } = await presignedResponse.json();

    // 2. 署名付きURLを使って直接アップロード
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      console.error('Direct upload failed:', uploadResponse.status, uploadResponse.statusText);
      return { success: false, error: 'ファイルのアップロードに失敗しました' };
    }

    // 進捗コールバック（完了時）
    if (onProgress) {
      onProgress(100);
    }

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('Direct upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アップロードに失敗しました',
    };
  }
}

/**
 * 複数ファイルを直接アップロード
 */
export async function directUploadMultiple(
  files: File[],
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  const results = await Promise.all(
    files.map(file => directUpload(file, options))
  );
  return results;
}
