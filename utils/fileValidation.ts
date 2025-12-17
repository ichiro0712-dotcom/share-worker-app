/**
 * ファイルアップロードのクライアント側バリデーション
 * サーバー側の設定と同期（app/api/upload/route.ts）
 */

/**
 * 画像URLが有効かどうかを検証する
 * [object Object]などの無効な値を防ぐ
 */
export function isValidImageUrl(url: unknown): url is string {
  // nullまたはundefinedは無効
  if (url === null || url === undefined) {
    return false;
  }

  // 文字列でなければ無効（オブジェクトなど）
  if (typeof url !== 'string') {
    console.warn('[isValidImageUrl] Invalid image URL type:', typeof url, url);
    return false;
  }

  // 空文字列は無効
  if (url.trim() === '') {
    return false;
  }

  // [object Object]などの文字列化されたオブジェクトを検出
  if (url.includes('[object') || url === 'undefined' || url === 'null') {
    console.warn('[isValidImageUrl] Invalid image URL value:', url);
    return false;
  }

  return true;
}

/**
 * 画像URLを安全に取得する
 * 無効な場合はnullまたはフォールバックを返す
 */
export function getSafeImageUrl(url: unknown, fallback?: string): string | null {
  if (isValidImageUrl(url)) {
    return url;
  }
  return fallback ?? null;
}

// 最大ファイルサイズ（20MB）
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

// 圧縮後の目標サイズ（2MB）
export const TARGET_COMPRESSED_SIZE = 2 * 1024 * 1024;

// 許可する画像拡張子
export const ALLOWED_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif', 'svg'
];

// 許可するドキュメント拡張子
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'
];

// 全ての許可する拡張子
export const ALLOWED_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_DOCUMENT_EXTENSIONS];

// バリデーションタイプ
export type ValidationType = 'image' | 'document' | 'all';

// バリデーション結果
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  errorType?: 'size' | 'extension' | 'type';
}

// 複数ファイルのバリデーション結果
export interface FilesValidationResult {
  isValid: boolean;
  validFiles: File[];
  invalidFiles: { file: File; error: string; errorType: 'size' | 'extension' | 'type' }[];
  errors: string[];
}

/**
 * ファイルサイズをフォーマット（MB表示）
 */
export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

/**
 * ファイルの拡張子を取得
 */
export function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext;
}

/**
 * 単一ファイルのバリデーション
 */
export function validateFile(
  file: File,
  type: ValidationType = 'all'
): FileValidationResult {
  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `「${file.name}」のファイルサイズが大きすぎます（${formatFileSize(file.size)}）。20MB以下にしてください。`,
      errorType: 'size'
    };
  }

  // 拡張子チェック
  const ext = getFileExtension(file.name);

  let allowedExtensions: string[];
  let allowedDescription: string;

  switch (type) {
    case 'image':
      allowedExtensions = ALLOWED_IMAGE_EXTENSIONS;
      allowedDescription = 'JPG, PNG, HEIC, GIF等の画像';
      break;
    case 'document':
      allowedExtensions = ALLOWED_DOCUMENT_EXTENSIONS;
      allowedDescription = 'PDF, Word, Excel, テキスト';
      break;
    case 'all':
    default:
      allowedExtensions = ALLOWED_EXTENSIONS;
      allowedDescription = '画像またはPDF, Word, Excel, テキスト';
      break;
  }

  if (!allowedExtensions.includes(ext)) {
    return {
      isValid: false,
      error: `「${file.name}」は許可されていないファイル形式です（.${ext}）。${allowedDescription}形式のファイルを選択してください。`,
      errorType: 'extension'
    };
  }

  return { isValid: true };
}

/**
 * 複数ファイルのバリデーション
 */
export function validateFiles(
  files: File[],
  type: ValidationType = 'all'
): FilesValidationResult {
  const validFiles: File[] = [];
  const invalidFiles: { file: File; error: string; errorType: 'size' | 'extension' | 'type' }[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = validateFile(file, type);
    if (result.isValid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({
        file,
        error: result.error!,
        errorType: result.errorType!
      });
      errors.push(result.error!);
    }
  }

  return {
    isValid: invalidFiles.length === 0,
    validFiles,
    invalidFiles,
    errors
  };
}

/**
 * ファイル選択時のハンドラーヘルパー
 * @returns 有効なファイルの配列。無効なファイルがある場合はエラーメッセージを返す
 */
export function handleFileSelection(
  files: File[],
  type: ValidationType = 'all',
  onError: (message: string) => void
): File[] {
  const result = validateFiles(files, type);

  if (!result.isValid) {
    // 最初のエラーを表示（複数ある場合は個別に）
    for (const error of result.errors) {
      onError(error);
    }
  }

  return result.validFiles;
}

/**
 * 画像ファイル専用のバリデーション
 */
export function validateImageFile(file: File): FileValidationResult {
  return validateFile(file, 'image');
}

/**
 * 画像ファイル複数のバリデーション
 */
export function validateImageFiles(files: File[]): FilesValidationResult {
  return validateFiles(files, 'image');
}

/**
 * ドキュメントも含むファイルのバリデーション（添付ファイル用）
 */
export function validateAttachmentFile(file: File): FileValidationResult {
  return validateFile(file, 'all');
}

/**
 * ドキュメントも含む複数ファイルのバリデーション
 */
export function validateAttachmentFiles(files: File[]): FilesValidationResult {
  return validateFiles(files, 'all');
}

/**
 * 画像を圧縮する（クライアントサイド）
 * @param file 圧縮する画像ファイル
 * @param maxWidth 最大幅（デフォルト: 1920px）
 * @param quality 圧縮品質（0-1、デフォルト: 0.8）
 * @returns 圧縮されたファイルのBase64データ
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // PDFはそのまま返す
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    // 画像でない場合もそのまま返す
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // キャンバスを作成
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 最大幅を超える場合はリサイズ
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // JPEG形式で圧縮（PNG/その他の場合も一旦JPEGに）
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // 2MB以下になるまで品質を下げる
        let currentQuality = quality;
        while (compressedDataUrl.length > TARGET_COMPRESSED_SIZE * 1.37 && currentQuality > 0.1) {
          currentQuality -= 0.1;
          compressedDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }

        resolve(compressedDataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * ファイルを読み込んで圧縮済みBase64を返す（20MB以下のみ受付）
 */
export async function processFileWithCompression(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ success: boolean; data?: string; error?: string }> {
  // バリデーション
  const validation = validateFile(file, 'image');
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }

  try {
    onProgress?.('圧縮中...');
    const compressedData = await compressImage(file);
    onProgress?.('完了');
    return { success: true, data: compressedData };
  } catch (error) {
    return {
      success: false,
      error: `ファイルの処理中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
    };
  }
}
