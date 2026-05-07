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

// テストケース6: 残業から休憩控除を確認（01:00〜10:00、休憩1時間、時給1,000円）
function testCase6() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース6: 01:00〜10:00、休憩1時間、時給1,000円');
  console.log('（残業から休憩控除を確認）');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-16T01:00:00');
  const endTime = new Date('2026-01-16T10:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60,
    hourlyRate: 1000
  });

  console.log('\n【時間帯分析】');
  console.log('拘束: 9時間（01:00-10:00）');
  console.log('深夜: 4時間（01:00-05:00）');
  console.log('通常: 4時間（05:00-09:00）← ここまでで8時間');
  console.log('通常残業: 1時間（09:00-10:00）← 8時間超過分');
  console.log('→ 休憩は残業（1.25倍）から控除 → 残業: 0時間');

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

  // 拘束9時間、休憩1時間、実働8時間
  // 深夜: 4時間（01:00-05:00）
  // 通常: 4時間（05:00-09:00）
  // 残業: 1時間（09:00-10:00）→ 休憩控除で0時間
  // ベース: 8 × 1000 = 8000
  // 残業: 0
  // 深夜: 4 × 250 = 1000
  // 合計: 9000円
  const expected = 9000;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }
}

// テストケース7: 要件の例と同じ（17:00〜翌9:00、休憩1時間、時給1,000円）詳細確認
function testCase7() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース7: 要件通りの計算確認（17:00〜翌9:00）');
  console.log('休憩は深夜残業時間（01:00-05:00）から控除');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T17:00:00');
  const endTime = new Date('2026-01-16T09:00:00');

  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60,
    hourlyRate: 1000
  });

  console.log('\n【時間帯分析（休憩控除前）】');
  console.log('17:00-22:00（通常）: 5時間');
  console.log('22:00-01:00（深夜）: 3時間 ← ここまでで8時間');
  console.log('01:00-05:00（深夜残業）: 4時間');
  console.log('05:00-09:00（通常残業）: 4時間');

  console.log('\n【休憩控除（深夜残業から1時間）】');
  console.log('通常: 5時間');
  console.log('深夜: 3時間');
  console.log('深夜残業: 4時間 - 1時間 = 3時間');
  console.log('通常残業: 4時間');

  console.log('\n【計算結果（新方式・2段階切り上げ）】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)} (期待: 15時間)`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)} (期待: 7時間 = 深夜残業3h + 通常残業4h)`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)} (期待: 6時間 = 深夜3h + 深夜残業3h)`);
  console.log('');
  console.log(`① 通常給(1.0倍):   ${formatCurrency(result.basePay)} (期待: ¥5,000 = 5h × 1000)`);
  console.log(`② 深夜給(1.25倍):  ${formatCurrency(result.nightPay)} (期待: ¥3,750 = 3h × 1250)`);
  console.log(`③ 残業給(1.25倍):  ${formatCurrency(result.overtimePay)} (期待: ¥5,000 = 4h × 1250)`);
  console.log(`④ 深夜残業(1.5倍): ${formatCurrency(result.nightOvertimePay)} (期待: ¥4,500 = 3h × 1500)`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)}`);

  const expected = 18250;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }

  // 詳細検証（新方式の区分別金額）
  const checksPass =
    result.workedMinutes === 15 * 60 &&
    result.overtimeMinutes === 7 * 60 &&
    result.nightMinutes === 6 * 60 &&
    result.basePay === 5000 &&
    result.nightPay === 3750 &&
    result.overtimePay === 5000 &&
    result.nightOvertimePay === 4500;

  if (checksPass) {
    console.log('✅ 全詳細項目が期待値と一致');
  } else {
    console.log('❌ 詳細項目に不一致あり');
  }
}

// テストケース8: 新方式の検証（時給1010円・残業3時間）
// 旧方式と新方式で結果が異なるケース
function testCase8() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース8: 新方式の効果確認（時給1,010円・残業3時間）');
  console.log('旧方式: ceil(180×1010×1.25/60)=ceil(3787.5)=3788');
  console.log('新方式: ceil(1010×1.25)=1263 → ceil(1263×180/60)=3789');
  console.log('='.repeat(60));

  const startTime = new Date('2026-01-15T09:00:00');
  const endTime = new Date('2026-01-15T21:00:00'); // 12時間
  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 60, // 休憩は残業から控除 → 残業3時間、通常8時間
    hourlyRate: 1010
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)} (期待: 11時間)`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)} (期待: 3時間)`);
  console.log('');
  console.log(`① 通常給(1.0倍):   ${formatCurrency(result.basePay)} (期待: ¥8,080 = 8h × 1010)`);
  console.log(`③ 残業給(1.25倍):  ${formatCurrency(result.overtimePay)} (期待: ¥3,789 = 3h × 1263)`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)} (期待: ¥11,869)`);

  // 旧方式なら 11868（割増時給を切り上げない分1円少ない）
  const expected = 11869;
  const oldMethodValue = 11868;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 新方式の期待値 ${formatCurrency(expected)} と一致`);
    console.log(`  （旧方式なら ${formatCurrency(oldMethodValue)} となるはずなので、新方式が正しく適用されている）`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }

  const checksPass =
    result.basePay === 8080 &&
    result.overtimePay === 3789 &&
    result.totalPay === 11869;
  if (checksPass) {
    console.log('✅ 全詳細項目が期待値と一致（新方式での割増時給切り上げが効いている）');
  } else {
    console.log('❌ 詳細項目に不一致あり');
  }
}

// テストケース9: 深夜残業の1.5倍直接適用を確認（時給1,010円）
// 旧方式の合計式（積み上げ）と内訳式（1.5直接）で1円ずれていた既存バグの解消確認
function testCase9() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('テストケース9: 深夜残業の1.5倍直接適用（時給1,010円・深夜残業30分）');
  console.log('旧合計: ceil(30×1010/60)+ceil(30×1010×0.25/60)×2 = 505+127+127 = 759');
  console.log('旧内訳: ceil(30×1010×1.5/60) = ceil(757.5) = 758（合計と1円ずれ）');
  console.log('新方式: ceil(1010×1.5)=1515 → ceil(1515×30/60)=758（合計と内訳が一致）');
  console.log('='.repeat(60));

  // 22:30〜翌7:30、休憩なし、8.5時間勤務
  // 22:30-23:00: 30分 深夜
  // 23:00-翌5:00: 6時間 深夜（合計8時間で残業突入は深夜中）
  // 22:30-翌6:30 = 8時間ちょうどで残業突入
  // → 計算しやすいよう 深夜残業30分のみのケース構築:
  //   22:00〜翌6:30、休憩0時間、8.5時間勤務
  //   通常0、深夜8時間（22:00-翌5:00超過分は深夜残業）...
  // シンプルに: 13:00〜22:30 = 9.5時間勤務、休憩0
  //   通常: 13-22 = 9時間、深夜: 22-22:30 = 30分
  //   8時間時点で残業突入 → 通常8時間、残業1時間（21-22）、深夜残業30分（22-22:30）
  const startTime = new Date('2026-01-15T13:00:00');
  const endTime = new Date('2026-01-15T22:30:00');
  const result = calculateSalary({
    startTime,
    endTime,
    breakMinutes: 0,
    hourlyRate: 1010
  });

  console.log('\n【計算結果】');
  console.log(`実働時間: ${formatMinutesToHoursAndMinutes(result.workedMinutes)} (期待: 9時間30分)`);
  console.log(`残業時間: ${formatMinutesToHoursAndMinutes(result.overtimeMinutes)} (期待: 1時間30分 = 通常残業1h+深夜残業30分)`);
  console.log(`深夜時間: ${formatMinutesToHoursAndMinutes(result.nightMinutes)} (期待: 30分 = 深夜残業30分)`);
  console.log('');
  console.log(`① 通常給(1.0倍):   ${formatCurrency(result.basePay)} (期待: ¥8,080 = 8h × 1010)`);
  console.log(`③ 残業給(1.25倍):  ${formatCurrency(result.overtimePay)} (期待: ¥1,263 = 1h × 1263)`);
  console.log(`④ 深夜残業(1.5倍): ${formatCurrency(result.nightOvertimePay)} (期待: ¥758 = ceil(1515×30/60))`);
  console.log(`─────────────────`);
  console.log(`   合計:       ${formatCurrency(result.totalPay)} (期待: ¥10,101)`);

  const expected = 10101;
  console.log('');
  if (result.totalPay === expected) {
    console.log(`✅ テスト成功: 期待値 ${formatCurrency(expected)} と一致`);
  } else {
    console.log(`❌ テスト失敗: 期待値 ${formatCurrency(expected)} != 実際 ${formatCurrency(result.totalPay)}`);
  }

  // 内訳と合計の整合性チェック（旧方式では1円ずれていたバグの解消確認）
  const breakdownSum = result.breakdown.reduce((sum, b) => sum + b.amount, 0);
  if (breakdownSum === result.totalPay) {
    console.log(`✅ 内訳合計 ${formatCurrency(breakdownSum)} = 合計 ${formatCurrency(result.totalPay)} （内訳と合計の整合性OK）`);
  } else {
    console.log(`❌ 内訳合計 ${formatCurrency(breakdownSum)} ≠ 合計 ${formatCurrency(result.totalPay)} （内訳と合計が不整合）`);
  }
}

// すべてのテストを実行
console.log('\n給与計算ロジック テスト（新方式: 2段階切り上げ）\n');
testCase1();
testCase2();
testCase3();
testCase4();
testCase5();
testCase6();
testCase7();
testCase8();
testCase9();
console.log('\n');
