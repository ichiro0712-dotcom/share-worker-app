/**
 * 施設地図クエリ決定ロジックのユニットテスト
 *
 * 実行: `npx tsx tests/unit/facilityMapQuery.test.ts`
 *
 * テスト対象:
 * - src/lib/mapQuery.ts
 *   - buildFacilityMapQuery() — 純粋関数（DBアクセスなし）
 *   - isValidCoord()         — 座標の妥当性判定
 *
 * カバー範囲:
 * 1. 通常ケース（pin_adjusted=true/false × 座標あり/なし × 住所あり/なし）
 * 2. 境界値（緯度経度の範囲端、0,0、limit付近）
 * 3. イレギュラー入力（NaN, Infinity, 文字列座標, null/undefined, 範囲外, 空白住所）
 * 4. isValidCoord() の網羅
 */

import { buildFacilityMapQuery, isValidCoord } from '../../src/lib/mapQuery';

let passCount = 0;
let failCount = 0;
const failures: { name: string; expected: unknown; actual: unknown }[] = [];

function assertEq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    failures.push({ name, expected, actual });
    console.log(`  ✗ ${name}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
  }
}

function group(title: string, fn: () => void) {
  console.log(`\n${title}`);
  fn();
}

// エルケア ヒーローを想定した正常系の座標（添付スクショの地点イメージ）
const VALID_LAT = 34.123456;
const VALID_LNG = 135.123456;

// =============================================================================
// 1. 通常ケース
// =============================================================================
group('[1] 通常ケース', () => {
  assertEq(
    'pin_adjusted=true かつ有効座標 → 座標を採用',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: VALID_LAT, lng: VALID_LNG },
      { address: '大阪府岸和田市浜口町1-2-3' },
    ),
    `${VALID_LAT},${VALID_LNG}`,
  );

  assertEq(
    'pin_adjusted=false → 座標があっても住所を採用',
    buildFacilityMapQuery(
      { pinAdjusted: false, lat: VALID_LAT, lng: VALID_LNG },
      { address: '大阪府岸和田市浜口町1-2-3' },
    ),
    '大阪府岸和田市浜口町1-2-3',
  );

  assertEq(
    'pin_adjusted未指定（undefined）→ 住所を採用',
    buildFacilityMapQuery(
      { lat: VALID_LAT, lng: VALID_LNG },
      { address: '東京都渋谷区道玄坂1-2-3' },
    ),
    '東京都渋谷区道玄坂1-2-3',
  );

  assertEq(
    'pin_adjusted=true だが座標未設定(0,0) → 住所にフォールバック',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: 0, lng: 0 },
      { address: '東京都新宿区西新宿2-8-1' },
    ),
    '東京都新宿区西新宿2-8-1',
  );

  assertEq(
    '住所も座標も無い → 空文字（地図非表示）',
    buildFacilityMapQuery({ pinAdjusted: false, lat: 0, lng: 0 }, { address: null }),
    '',
  );
});

// =============================================================================
// 2. 境界値
// =============================================================================
group('[2] 境界値', () => {
  assertEq('緯度=90（上限）lng有効 → 採用', isValidCoord(90, 135), true);
  assertEq('緯度=-90（下限）lng有効 → 採用', isValidCoord(-90, 135), true);
  assertEq('経度=180（上限）lat有効 → 採用', isValidCoord(35, 180), true);
  assertEq('経度=-180（下限）lat有効 → 採用', isValidCoord(35, -180), true);
  assertEq('緯度=90.0001（範囲外）→ 不採用', isValidCoord(90.0001, 135), false);
  assertEq('経度=180.0001（範囲外）→ 不採用', isValidCoord(35, 180.0001), false);
  assertEq('緯度=0,経度=有効 → 0は未設定扱いで不採用', isValidCoord(0, 135), false);
  assertEq('緯度=有効,経度=0 → 0は未設定扱いで不採用', isValidCoord(35, 0), false);

  assertEq(
    'pin_adjusted=true, 緯度=0(片方のみ0) → 住所フォールバック',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: 0, lng: VALID_LNG },
      { address: '兵庫県神戸市中央区1-1' },
    ),
    '兵庫県神戸市中央区1-1',
  );
});

// =============================================================================
// 3. イレギュラー入力
// =============================================================================
group('[3] イレギュラー入力', () => {
  assertEq(
    'lat=NaN → 住所フォールバック',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: NaN, lng: VALID_LNG },
      { address: '京都府京都市下京区1' },
    ),
    '京都府京都市下京区1',
  );

  assertEq(
    'lng=Infinity → 住所フォールバック',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: VALID_LAT, lng: Infinity },
      { address: '京都府京都市下京区1' },
    ),
    '京都府京都市下京区1',
  );

  assertEq(
    'lat=文字列"34.1"（型不正）→ 住所フォールバック',
    buildFacilityMapQuery(
      // @ts-expect-error 型不正の混入を意図的にテスト
      { pinAdjusted: true, lat: '34.1', lng: VALID_LNG },
      { address: '奈良県奈良市1' },
    ),
    '奈良県奈良市1',
  );

  assertEq(
    'lat=null, lng=null → 住所フォールバック',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: null, lng: null },
      { address: '滋賀県大津市1' },
    ),
    '滋賀県大津市1',
  );

  assertEq(
    'facility=null → 住所フォールバック',
    buildFacilityMapQuery(null, { address: '和歌山県和歌山市1' }),
    '和歌山県和歌山市1',
  );

  assertEq(
    'facility=undefined, job=undefined → 空文字',
    buildFacilityMapQuery(undefined, undefined),
    '',
  );

  assertEq(
    '住所が空白のみ → トリムして空文字',
    buildFacilityMapQuery({ pinAdjusted: false }, { address: '   ' }),
    '',
  );

  assertEq(
    '住所に前後空白 → トリムされる',
    buildFacilityMapQuery({ pinAdjusted: false }, { address: '  三重県津市1  ' }),
    '三重県津市1',
  );

  assertEq(
    'pin_adjusted=true で範囲外座標(lat=200) → 住所フォールバック',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: 200, lng: VALID_LNG },
      { address: '岐阜県岐阜市1' },
    ),
    '岐阜県岐阜市1',
  );

  assertEq(
    'pin_adjusted="true"(文字列truthy) かつ有効座標 → 座標採用（truthy判定）',
    buildFacilityMapQuery(
      // @ts-expect-error 型不正の混入を意図的にテスト
      { pinAdjusted: 'true', lat: VALID_LAT, lng: VALID_LNG },
      { address: '愛知県名古屋市中区1' },
    ),
    `${VALID_LAT},${VALID_LNG}`,
  );

  assertEq(
    '住所が数値(型不正) → 文字列でないため空文字',
    buildFacilityMapQuery(
      { pinAdjusted: false },
      // @ts-expect-error 型不正の混入を意図的にテスト
      { address: 12345 },
    ),
    '',
  );

  assertEq(
    '負の有効座標（南半球/西半球）→ 採用',
    buildFacilityMapQuery(
      { pinAdjusted: true, lat: -33.8688, lng: -70.6693 },
      { address: 'fallback' },
    ),
    '-33.8688,-70.6693',
  );
});

// =============================================================================
// 4. isValidCoord() 単体
// =============================================================================
group('[4] isValidCoord() 単体', () => {
  assertEq('有効座標', isValidCoord(VALID_LAT, VALID_LNG), true);
  assertEq('両方0', isValidCoord(0, 0), false);
  assertEq('NaN', isValidCoord(NaN, 1), false);
  assertEq('Infinity', isValidCoord(1, Infinity), false);
  assertEq('undefined', isValidCoord(undefined, undefined), false);
  assertEq('null', isValidCoord(null, null), false);
  assertEq('文字列', isValidCoord('35', '135'), false);
  assertEq('boolean', isValidCoord(true, false), false);
});

// =============================================================================
// 結果サマリ
// =============================================================================
console.log('\n========================================');
console.log(`結果: ${passCount} passed, ${failCount} failed (計 ${passCount + failCount}件)`);
console.log('========================================');

if (failCount > 0) {
  console.log('\n失敗一覧:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
  }
  process.exit(1);
}
