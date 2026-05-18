/**
 * utils/salary.ts の JST/UTC 修正検証スクリプト
 *
 * 求人 #464 「夜勤テスト」の実データで:
 *   - クライアント想定(JST): 25,925円
 *   - サーバー実体(UTC, 修正前): 25,175円
 *   - 修正後: 両環境とも 25,925円 になるべき
 *
 * 実行方法:
 *   # JST環境
 *   npx tsx scripts/verify-salary-jst-fix.ts
 *   # UTC環境シミュレーション
 *   TZ=UTC npx tsx scripts/verify-salary-jst-fix.ts
 */

import { calculateDailyWage } from '../utils/salary';

const expectedWage = 25_925;
const result = calculateDailyWage('17:00', '09:00', 120, 1500, 800);

const tz = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`TZ: ${tz}`);
console.log(`calculateDailyWage('17:00', '09:00', 120, 1500, 800) = ${result.toLocaleString()}`);
console.log(`expected: ${expectedWage.toLocaleString()}`);

if (result === expectedWage) {
  console.log('✓ PASS');
  process.exit(0);
} else {
  console.log(`✗ FAIL (diff: ${result - expectedWage})`);
  process.exit(1);
}
