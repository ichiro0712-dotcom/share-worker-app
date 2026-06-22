/**
 * N回以上勤務求人「振替キャンセル」判定ロジックのユニットテスト
 *
 * 実行: `npx tsx tests/unit/weeklyFrequencyCancel.test.ts`
 *
 * テスト対象:
 * - src/lib/weeklyFrequencyCancel.ts
 *   - canCancelWeeklyFrequency() — 純粋関数（DBアクセスなし）
 *
 * カバー範囲:
 * 1. 条件なし求人（weeklyFrequency null / 0 / 1）
 * 2. 条件あり求人で条件を割る/割らないケース
 * 3. 振替（swapCount）込みの判定
 * 4. 超過応募分のキャンセル（振替不要）
 * 5. 境界値・イレギュラー入力
 * 6. ユーザーのイレギュラー操作シナリオ
 */

import { canCancelWeeklyFrequency } from '../../src/lib/weeklyFrequencyCancel';

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

// =============================================================================
// 1. 条件なし求人
// =============================================================================
group('[1] 条件なし求人（自由にキャンセル可）', () => {
  assertEq(
    'weeklyFrequency=null → allowed=true, requiresSwap=false',
    canCancelWeeklyFrequency({ weeklyFrequency: null, activeCount: 1, cancelCount: 1, swapCount: 0 }),
    { allowed: true, requiresSwap: false }
  );
  assertEq(
    'weeklyFrequency=1 → 条件扱いせず allowed=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 1, activeCount: 1, cancelCount: 1, swapCount: 0 }),
    { allowed: true, requiresSwap: false }
  );
  assertEq(
    'weeklyFrequency=0 → 条件扱いせず allowed=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 0, activeCount: 1, cancelCount: 1, swapCount: 0 }).allowed,
    true
  );
});

// =============================================================================
// 2. 条件あり求人：条件を割る/割らない
// =============================================================================
group('[2] 条件あり求人の単独キャンセル', () => {
  // 3回条件・3日応募 → 1日キャンセルで2日（<3）→ 振替必要
  assertEq(
    '3回条件・3日応募・1日キャンセル(振替なし) → allowed=false, requiresSwap=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 3, cancelCount: 1, swapCount: 0 }),
    {
      allowed: false,
      requiresSwap: true,
      reason: 'この求人は3回以上の勤務が条件です。単独でキャンセルする場合は、代わりに別の勤務日を選んで振り替えてください。',
    }
  );

  // 2回条件・2日応募 → 1日キャンセルで1日（<2）→ 振替必要
  assertEq(
    '2回条件・2日応募・1日キャンセル → requiresSwap=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 2, activeCount: 2, cancelCount: 1, swapCount: 0 }).requiresSwap,
    true
  );
});

// =============================================================================
// 3. 振替（swapCount）込みの判定
// =============================================================================
group('[3] 振替込みの判定', () => {
  // 3回条件・3日応募・1日キャンセル + 1日振替 → 3日維持 → allowed
  assertEq(
    '3回条件・1日キャンセル+1日振替 → allowed=true, requiresSwap=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 3, cancelCount: 1, swapCount: 1 }),
    { allowed: true, requiresSwap: true }
  );

  // 4回条件・4日応募・2日キャンセル + 2日振替 → 4日維持 → allowed
  assertEq(
    '4回条件・2日キャンセル+2日振替 → allowed=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 4, activeCount: 4, cancelCount: 2, swapCount: 2 }).allowed,
    true
  );

  // 3回条件・3日応募・2日キャンセル + 1日振替 → 2日（<3）→ 不可
  assertEq(
    '3回条件・2日キャンセル+1日振替 → 2日でNG, allowed=false',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 3, cancelCount: 2, swapCount: 1 }).allowed,
    false
  );
});

// =============================================================================
// 4. 超過応募分のキャンセル（振替不要）
// =============================================================================
group('[4] 超過分のキャンセル', () => {
  // 3回条件・4日応募 → 1日キャンセルで3日（>=3）→ 振替不要で単独キャンセル可
  assertEq(
    '3回条件・4日応募・1日キャンセル → allowed=true, requiresSwap=false',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 4, cancelCount: 1, swapCount: 0 }),
    { allowed: true, requiresSwap: false }
  );

  // 3回条件・5日応募 → 2日キャンセルで3日 → 振替不要
  assertEq(
    '3回条件・5日応募・2日キャンセル → requiresSwap=false',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 5, cancelCount: 2, swapCount: 0 }).requiresSwap,
    false
  );
});

// =============================================================================
// 5. 境界値・イレギュラー入力
// =============================================================================
group('[5] 境界値・イレギュラー入力', () => {
  // ちょうど条件ぴったり残る
  assertEq(
    '残り数がちょうど weeklyFrequency と等しい → allowed=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 4, cancelCount: 1, swapCount: 0 }).allowed,
    true
  );

  // 1未満に減る極端ケース
  assertEq(
    '全件キャンセル(振替なし) → allowed=false, requiresSwap=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 2, activeCount: 2, cancelCount: 2, swapCount: 0 }).allowed,
    false
  );

  // weekly_frequency が規格外大
  assertEq(
    'weeklyFrequency=999 でも判定する → 不足なら false',
    canCancelWeeklyFrequency({ weeklyFrequency: 999, activeCount: 3, cancelCount: 1, swapCount: 0 }).allowed,
    false
  );

  // weekly_frequency 負数は条件扱いしない
  assertEq(
    'weeklyFrequency=-1 → 条件扱いせず allowed=true',
    canCancelWeeklyFrequency({ weeklyFrequency: -1, activeCount: 1, cancelCount: 1, swapCount: 0 }).allowed,
    true
  );
});

// =============================================================================
// 6. ユーザーのイレギュラー操作シナリオ
// =============================================================================
group('[6] ユーザーのイレギュラー操作シナリオ', () => {
  // Scenario A: UI を経由せず直接キャンセル API を叩く（条件を割るケース）
  // → サーバー側ガード checkWeeklyFrequencyCancelGuard が canCancelWeeklyFrequency を呼んで弾く
  assertEq(
    'シナリオA: 3回条件・3日応募で単独キャンセルAPI直叩き → サーバーで弾く',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 3, cancelCount: 1, swapCount: 0 }).allowed,
    false
  );

  // Scenario B: 振替先を選んで振替キャンセル → 件数維持で成立
  assertEq(
    'シナリオB: 振替を選択 → allowed=true',
    canCancelWeeklyFrequency({ weeklyFrequency: 3, activeCount: 3, cancelCount: 1, swapCount: 1 }).allowed,
    true
  );

  // Scenario C: 超過応募していたワーカーが余剰分を1件キャンセル → 振替不要で通常キャンセル
  assertEq(
    'シナリオC: 超過分の単独キャンセルは振替不要',
    canCancelWeeklyFrequency({ weeklyFrequency: 2, activeCount: 3, cancelCount: 1, swapCount: 0 }).requiresSwap,
    false
  );
});

// =============================================================================
// テスト結果サマリー
// =============================================================================
console.log('\n=============================================');
console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
console.log('=============================================');

if (failCount > 0) {
  console.log('\n失敗したテスト:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
    console.log(`    expected: ${JSON.stringify(f.expected)}`);
    console.log(`    actual:   ${JSON.stringify(f.actual)}`);
  }
  process.exit(1);
} else {
  console.log('\n✓ 全テスト成功');
  process.exit(0);
}
