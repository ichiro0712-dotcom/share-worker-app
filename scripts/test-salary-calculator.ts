/**
 * 給与計算ロジックのテストスクリプト
 * 実行: npx tsx scripts/test-salary-calculator.ts
 */

import { calculateSalary, formatCurrency, formatMinutesToHoursAndMinutes } from '../src/lib/salary-calculator';

// テストケース1: 17:00〜翌9:00、時給1,000円、休憩1時間 → 期待値18,250円
function testCase1() {
  console.log('='.repeat(60));
  console.log('テストケース1: 17:00〜翌9:00、休憩1時間、時給1,000円');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T17:00:00');
  const endTime = new Date('2026-01-16T09:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60, // 1時間
    hourlyRate: 1000
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)}`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)}`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)}`);
  console.log('');
  console.log(`① ベース給与: ${formatCurrency(result.basePay)}`);
  console.log(`② 残業手当:   ${formatCurrency(result.overtimePay)}`);
  console.log(`③ 深夜手当:   ${formatCurrency(result.nightPay)}`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)}`);
  console.log('');

  const expected = 18250;
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }
}

// テストケース2: 9:00〜18:00、休憩1時間、時給1,000円（通常勤務）
function testCase2() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース2: 9:00〜18:00、休憩1時間、時給1,000円（通常勤務）');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T09:00:00');
  const endTime = new Date('2026-01-15T18:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60,
    hourlyRate: 1000
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)}`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)}`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)}`);
  console.log('');
  console.log(`① ベース給与: ${formatCurrency(result.basePay)}`);
  console.log(`② 残業手当:   ${formatCurrency(result.overtimePay)}`);
  console.log(`③ 深夜手当:   ${formatCurrency(result.nightPay)}`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)}`);

  // 8時間×1000円 = 8000円（残業・深夜なし）
  const expected = 8000;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }
}

// テストケース3: 18:00〜23:00、休憩なし、時給1,000円（深夜あり、残業なし）
function testCase3() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース3: 18:00〜23:00、休憩なし、時給1,000円（深夜1時間）');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T18:00:00');
  const endTime = new Date('2026-01-15T23:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 0,
    hourlyRate: 1000
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)}`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)}`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)}`);
  console.log('');
  console.log(`① ベース給与: ${formatCurrency(result.basePay)}`);
  console.log(`② 残業手当:   ${formatCurrency(result.overtimePay)}`);
  console.log(`③ 深夜手当:   ${formatCurrency(result.nightPay)}`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)}`);

  // 5時間×1000 + 1時間×250（深夜） = 5000 + 250 = 5250円
  const expected = 5250;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }
}

// テストケース4: 9:00〜20:00、休憩1時間、時給1,000円（残業2時間）
function testCase4() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース4: 9:00〜20:00、休憩1時間、時給1,000円（残業2時間）');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T09:00:00');
  const endTime = new Date('2026-01-15T20:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60,
    hourlyRate: 1000
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)}`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)}`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)}`);
  console.log('');
  console.log(`① ベース給与: ${formatCurrency(result.basePay)}`);
  console.log(`② 残業手当:   ${formatCurrency(result.overtimePay)}`);
  console.log(`③ 深夜手当:   ${formatCurrency(result.nightPay)}`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)}`);

  // 10時間×1000 + 2時間×250 = 10000 + 500 = 10500円
  const expected = 10500;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }
}

// テストケース5: 22:00〜翌6:00、休憩1時間、時給1,000円（全深夜勤務）
function testCase5() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース5: 22:00〜翌6:00、休憩1時間、時給1,000円（深夜7時間）');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T22:00:00');
  const endTime = new Date('2026-01-16T06:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60,
    hourlyRate: 1000
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)}`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)}`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)}`);
  console.log('');
  console.log(`① ベース給与: ${formatCurrency(result.basePay)}`);
  console.log(`② 残業手当:   ${formatCurrency(result.overtimePay)}`);
  console.log(`③ 深夜手当:   ${formatCurrency(result.nightPay)}`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)}`);

  // 拘束8時間、深夜7時間（22:00-05:00）、通常1時間（05:00-06:00）
  // 休憩1時間を深夜から控除 → 深夜6時間、通常1時間
  // 実働7時間（残業なし）
  // ベース: 7×1000 = 7000
  // 深夜手当: 6×250 = 1500
  // 合計: 8500円
  const expected = 8500;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }
}

// すべてのテストを実行
console.log('\n給与計算ロジック テスト\n');
testCase1();
testCase2();
testCase3();
testCase4();
testCase5();
console.log('\n');
