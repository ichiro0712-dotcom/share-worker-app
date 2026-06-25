/**
 * 施設の地図表示クエリを決定する純粋関数
 *
 * 背景:
 * - 求人詳細の地図ピンは Google Maps Embed/Search の `q=` に文字列を渡して表示する。
 * - 通常は住所文字列をそのまま渡し、Google のジオコーディングに位置決めを委ねる。
 * - ただし住所が正しくてもジオコーディングが誤った地点を返すケースがあるため、
 *   管理画面でピンを手動調整した施設（pin_adjusted=true）は調整済み座標を優先する。
 * - 自動ジオコーディング由来の座標は信頼性が低いため、pin_adjusted のときのみ座標を採用する。
 *
 * 戻り値が空文字のときは「地図情報なし」を意味する（呼び出し側で地図を非表示にする）。
 */

export interface MapQueryFacility {
  pinAdjusted?: boolean | null;
  lat?: number | null;
  lng?: number | null;
}

export interface MapQueryJob {
  address?: string | null;
}

/**
 * lat/lng が地図表示に使える有効な座標かを判定する。
 * - 数値型かつ有限（NaN/Infinity を除外）
 * - 0,0（未設定のデフォルト値）を除外
 * - 緯度 -90〜90 / 経度 -180〜180 の範囲内
 */
export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * 地図表示用クエリ文字列を返す。
 * - pin_adjusted かつ座標が有効 → "lat,lng"
 * - それ以外 → 住所文字列（前後空白を除去）。無ければ空文字
 */
export function buildFacilityMapQuery(
  facility: MapQueryFacility | null | undefined,
  job: MapQueryJob | null | undefined,
): string {
  if (facility?.pinAdjusted && isValidCoord(facility.lat, facility.lng)) {
    return `${facility.lat},${facility.lng}`;
  }
  const address = typeof job?.address === 'string' ? job.address.trim() : '';
  return address;
}
