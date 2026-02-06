/**
 * 都道府県の正規化・変換ユーティリティ
 */

import { PREFECTURES, type Prefecture } from '@/constants/prefectureCities';

/**
 * 都道府県名から接尾辞を除去するマッピング
 * "東京都" → "東京", "大阪府" → "大阪", "北海道" → "北海道", "京都府" → "京都"
 */
const PREFECTURE_SHORT_NAMES: Record<string, string> = {
  北海道: '北海道',
  青森県: '青森',
  岩手県: '岩手',
  宮城県: '宮城',
  秋田県: '秋田',
  山形県: '山形',
  福島県: '福島',
  茨城県: '茨城',
  栃木県: '栃木',
  群馬県: '群馬',
  埼玉県: '埼玉',
  千葉県: '千葉',
  東京都: '東京',
  神奈川県: '神奈川',
  新潟県: '新潟',
  富山県: '富山',
  石川県: '石川',
  福井県: '福井',
  山梨県: '山梨',
  長野県: '長野',
  岐阜県: '岐阜',
  静岡県: '静岡',
  愛知県: '愛知',
  三重県: '三重',
  滋賀県: '滋賀',
  京都府: '京都',
  大阪府: '大阪',
  兵庫県: '兵庫',
  奈良県: '奈良',
  和歌山県: '和歌山',
  鳥取県: '鳥取',
  島根県: '島根',
  岡山県: '岡山',
  広島県: '広島',
  山口県: '山口',
  徳島県: '徳島',
  香川県: '香川',
  愛媛県: '愛媛',
  高知県: '高知',
  福岡県: '福岡',
  佐賀県: '佐賀',
  長崎県: '長崎',
  熊本県: '熊本',
  大分県: '大分',
  宮崎県: '宮崎',
  鹿児島県: '鹿児島',
  沖縄県: '沖縄',
};

/**
 * 省略形から正式名称へのマッピング
 * "東京" → "東京都", "大阪" → "大阪府"
 */
const SHORT_TO_FULL: Record<string, Prefecture> = {};

// マッピングを構築
for (const pref of PREFECTURES) {
  const short = PREFECTURE_SHORT_NAMES[pref];
  if (short && short !== pref) {
    SHORT_TO_FULL[short] = pref;
  }
}
// 北海道は特殊ケース（省略形なし）
SHORT_TO_FULL['北海道'] = '北海道';

/**
 * 都道府県名を正規化（"東京" → "東京都"）
 * @param input 都道府県名（省略形または正式名称）
 * @returns 正規化された都道府県名、または null（無効な入力）
 */
export function normalizePrefecture(input: string): Prefecture | null {
  if (!input) return null;

  const trimmed = input.trim();

  // すでに正式名称の場合
  if (PREFECTURES.includes(trimmed as Prefecture)) {
    return trimmed as Prefecture;
  }

  // 省略形の場合
  if (SHORT_TO_FULL[trimmed]) {
    return SHORT_TO_FULL[trimmed];
  }

  return null;
}

/**
 * 都道府県名が有効かどうかをチェック
 * @param input 都道府県名
 * @returns 有効な都道府県名かどうか
 */
export function isValidPrefecture(input: string): boolean {
  return normalizePrefecture(input) !== null;
}

/**
 * CSVの時給値をパース（カンマ区切り対応）
 * "1,163" → 1163, "1163" → 1163
 * @param value 時給文字列
 * @returns パースされた整数値、または null（無効な入力）
 */
export function parseWageValue(value: string): number | null {
  if (!value) return null;

  // カンマを除去してパース
  const cleaned = value.trim().replace(/,/g, '');
  const parsed = parseInt(cleaned, 10);

  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * 日付文字列（YYYY-MM-DD）のバリデーション
 * @returns 有効な日付文字列か
 */
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00+09:00');
  if (isNaN(date.getTime())) return false;
  // パースした結果が元の日付と一致するか（2026-02-30 などの無効日付を弾く）
  const [y, m, d] = value.split('-').map(Number);
  return date.getFullYear() === y
    && date.getMonth() + 1 === m
    && date.getDate() === d;
}

/**
 * CSVの1行をパースして最低賃金データに変換
 * @param row CSV行（都道府県,時給[,適用開始日]）
 * @returns パースされたデータ、または null（無効な行）。invalidDate が true の場合は日付が不正。
 */
export function parseMinimumWageCsvRow(
  row: string
): { prefecture: Prefecture; hourlyWage: number; effectiveFrom?: string; invalidDate?: boolean } | null {
  if (!row || !row.trim()) return null;

  // CSV引用符を正しく処理するパース
  // Excel出力で "1,163" のようにカンマ入り数値がダブルクォートで囲まれるケースに対応
  const parts = parseCsvFields(row);

  if (parts.length < 2) return null;

  const prefecture = normalizePrefecture(parts[0]);
  const hourlyWage = parseWageValue(parts[1]);

  if (!prefecture || !hourlyWage) return null;

  // 3列目: 適用開始日（省略可能）
  let effectiveFrom: string | undefined;
  let invalidDate = false;
  if (parts.length >= 3 && parts[2]) {
    const dateStr = parts[2].trim();
    if (dateStr) {
      if (isValidDateString(dateStr)) {
        effectiveFrom = dateStr;
      } else {
        invalidDate = true;
      }
    }
  }

  return { prefecture, hourlyWage, effectiveFrom, invalidDate };
}

/**
 * CSV行をフィールドに分割（ダブルクォート内のカンマを正しく処理）
 * "東京都","1,163" → ["東京都", "1,163"]
 * 東京都,1163 → ["東京都", "1163"]
 */
function parseCsvFields(row: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());

  return fields;
}

/**
 * CSV文字列全体をパースして最低賃金データの配列に変換
 * @param csvContent CSV文字列
 * @param skipHeader ヘッダー行をスキップするか（デフォルト: 自動判定）
 * @returns パース結果（成功データとエラー行）
 */
export function parseMinimumWageCsv(
  csvContent: string,
  skipHeader?: boolean
): {
  data: { prefecture: Prefecture; hourlyWage: number; effectiveFrom?: string }[];
  errors: { line: number; content: string; reason: string }[];
} {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  const data: { prefecture: Prefecture; hourlyWage: number; effectiveFrom?: string }[] = [];
  const errors: { line: number; content: string; reason: string }[] = [];

  // ヘッダー行の自動判定
  let startIndex = 0;
  if (skipHeader === undefined && lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    // "都道府県" や "prefecture" などが含まれていればヘッダーとみなす
    if (firstLine.includes('都道府県') || firstLine.includes('prefecture') || firstLine.includes('時給') || firstLine.includes('wage') || firstLine.includes('適用開始日') || firstLine.includes('effective') || firstLine.includes('date')) {
      startIndex = 1;
    }
  } else if (skipHeader) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseMinimumWageCsvRow(line);

    if (parsed) {
      // 日付が不正な場合はエラー
      if (parsed.invalidDate) {
        errors.push({
          line: i + 1,
          content: line,
          reason: '適用開始日の形式が不正です（YYYY-MM-DD形式で入力してください）',
        });
        continue;
      }
      // 重複チェック
      const existing = data.find(d => d.prefecture === parsed.prefecture);
      if (existing) {
        errors.push({
          line: i + 1,
          content: line,
          reason: `都道府県「${parsed.prefecture}」が重複しています`,
        });
      } else {
        data.push({
          prefecture: parsed.prefecture,
          hourlyWage: parsed.hourlyWage,
          effectiveFrom: parsed.effectiveFrom,
        });
      }
    } else {
      errors.push({
        line: i + 1,
        content: line,
        reason: '都道府県名または時給が不正です',
      });
    }
  }

  return { data, errors };
}

/**
 * 最低賃金データをCSV形式の文字列に変換
 * @param data 最低賃金データ
 * @returns CSV文字列
 */
export function generateMinimumWageCsv(
  data: { prefecture: string; hourlyWage: number; effectiveFrom?: Date | string }[]
): string {
  const headers = ['都道府県', '時給', '適用開始日'];

  const rows = data.map(d => {
    const row = [d.prefecture, d.hourlyWage.toString()];
    if (d.effectiveFrom) {
      if (typeof d.effectiveFrom === 'string') {
        row.push(d.effectiveFrom);
      } else {
        row.push(formatDateISO(d.effectiveFrom));
      }
    } else {
      row.push('');
    }
    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * ArrayBufferからCSVテキストをデコード（UTF-8 / Shift-JIS 自動判定）
 * UTF-8でデコードして日本語の都道府県名が見つからなければShift-JISとして再デコード
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  // まずUTF-8でデコード
  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  // BOM除去
  const cleanUtf8 = utf8Text.replace(/^\uFEFF/, '');

  // 日本語文字（ひらがな・カタカナ・漢字）が含まれていればUTF-8で正しくデコードできている
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(cleanUtf8)) {
    return cleanUtf8;
  }

  // Shift-JISとしてデコード
  try {
    const sjisText = new TextDecoder('shift-jis').decode(buffer);
    return sjisText.replace(/^\uFEFF/, '');
  } catch {
    // Shift-JISデコード失敗時はUTF-8のまま返す
    return cleanUtf8;
  }
}

/**
 * 日付をフォーマット（yyyy/MM/dd）
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * 日付をISO形式でフォーマット（YYYY-MM-DD）
 */
function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
