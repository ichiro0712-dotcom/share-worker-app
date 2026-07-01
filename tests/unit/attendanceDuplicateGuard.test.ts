/**
 * 出勤打刻「二重生成ガード」判定ロジックのユニットテスト
 *
 * 実行: `npx tsx tests/unit/attendanceDuplicateGuard.test.ts`
 *
 * テスト対象:
 * - src/lib/attendanceDuplicateGuard.ts
 *   - decideCheckInDuplicate() — 純粋関数（DBアクセスなし）
 *
 * カバー範囲:
 * 1. 既存勤怠なし → 新規作成
 * 2. 未退勤(CHECKED_IN)の既存あり → 既存返却（冪等）
 * 3. 退勤済み(CHECKED_OUT) × 応募あり → ブロック
 * 4. 退勤済み(CHECKED_OUT) × 応募なし → 新規作成（別勤務の可能性・安全側）
 * 5. 境界・イレギュラー（status と check_out_time の不整合）
 */

import {
  decideCheckInDuplicate,
  type ExistingAttendanceLite,
} from '../../src/lib/attendanceDuplicateGuard';

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

const checkedIn = (id: number): ExistingAttendanceLite => ({
  id,
  status: 'CHECKED_IN',
  check_out_time: null,
});
const checkedOut = (id: number): ExistingAttendanceLite => ({
  id,
  status: 'CHECKED_OUT',
  check_out_time: new Date('2026-06-22T09:00:00Z'),
});

// =============================================================================
// 1. 既存勤怠なし
// =============================================================================
group('[1] 既存勤怠なし → 新規作成', () => {
  assertEq(
    '応募あり・既存なし → CREATE',
    decideCheckInDuplicate(null, true),
    { action: 'CREATE' }
  );
  assertEq(
    '応募なし・既存なし → CREATE',
    decideCheckInDuplicate(null, false),
    { action: 'CREATE' }
  );
});

// =============================================================================
// 2. 未退勤の既存あり → 冪等（既存返却）
// =============================================================================
group('[2] 未退勤(CHECKED_IN)の既存あり → RETURN_EXISTING', () => {
  assertEq(
    '応募あり・未退勤 → 既存を返す',
    decideCheckInDuplicate(checkedIn(101), true),
    { action: 'RETURN_EXISTING', attendanceId: 101 }
  );
  assertEq(
    '応募なし・未退勤 → 既存を返す',
    decideCheckInDuplicate(checkedIn(102), false),
    { action: 'RETURN_EXISTING', attendanceId: 102 }
  );
});

// =============================================================================
// 3. 退勤済み × 応募あり → ブロック
// =============================================================================
group('[3] 退勤済み(CHECKED_OUT) × 応募あり → BLOCK', () => {
  assertEq(
    '同一応募で退勤済み → 二重出勤ブロック',
    decideCheckInDuplicate(checkedOut(201), true),
    { action: 'BLOCK' }
  );
});

// =============================================================================
// 4. 退勤済み × 応募なし → 新規作成（安全側）
// =============================================================================
group('[4] 退勤済み(CHECKED_OUT) × 応募なし → CREATE', () => {
  assertEq(
    '応募なしで退勤済みのみ → 別勤務の可能性で作成許可',
    decideCheckInDuplicate(checkedOut(301), false),
    { action: 'CREATE' }
  );
});

// =============================================================================
// 5. 境界・イレギュラー（status と check_out_time の不整合）
// =============================================================================
group('[5] イレギュラー入力', () => {
  // status=CHECKED_IN だが check_out_time が入っている（不整合）→ 未退勤扱いにしない
  assertEq(
    'CHECKED_IN + check_out_time あり・応募あり → BLOCK（開いていない扱い）',
    decideCheckInDuplicate(
      { id: 401, status: 'CHECKED_IN', check_out_time: new Date('2026-06-22T09:00:00Z') },
      true
    ),
    { action: 'BLOCK' }
  );
  assertEq(
    'CHECKED_IN + check_out_time あり・応募なし → CREATE',
    decideCheckInDuplicate(
      { id: 402, status: 'CHECKED_IN', check_out_time: new Date('2026-06-22T09:00:00Z') },
      false
    ),
    { action: 'CREATE' }
  );
  // status=CHECKED_OUT だが check_out_time が null（不整合）→ 開いていない扱いでブロック（応募あり）
  assertEq(
    'CHECKED_OUT + check_out_time null・応募あり → BLOCK',
    decideCheckInDuplicate({ id: 403, status: 'CHECKED_OUT', check_out_time: null }, true),
    { action: 'BLOCK' }
  );
});

// =============================================================================
// 6. ユーザーのイレギュラー操作シナリオ
//    各操作で「その時点の既存勤怠状態」を processCheckIn のクエリが返すものとして、
//    decideCheckInDuplicate に渡した場合の期待挙動を検証する。
//    RETURN_EXISTING/BLOCK なら勤怠は増えない（＝重複が発生しない）ことを意味する。
// =============================================================================
group('[6] ユーザーのイレギュラー操作シナリオ（重複が発生しないこと）', () => {
  // (a) 出勤ボタンを二度押し: 1回目でCHECKED_IN作成 → 2回目は既存を検出
  assertEq(
    '(a) 出勤の二度押し → 既存返却（新規作成しない）',
    decideCheckInDuplicate(checkedIn(1001), true),
    { action: 'RETURN_EXISTING', attendanceId: 1001 }
  );

  // (b) QRを短時間に2回連続スキャン（stop完了前の再発火相当）
  assertEq(
    '(b) QR連続スキャン → 既存返却',
    decideCheckInDuplicate(checkedIn(1002), true),
    { action: 'RETURN_EXISTING', attendanceId: 1002 }
  );

  // (c) 通信エラーと思い出勤を再送信
  assertEq(
    '(c) 出勤の再送信 → 既存返却',
    decideCheckInDuplicate(checkedIn(1003), true),
    { action: 'RETURN_EXISTING', attendanceId: 1003 }
  );

  // (d) 退勤済みなのにもう一度出勤QRをスキャン（本件の主因）
  assertEq(
    '(d) 退勤後の再出勤 → ブロック',
    decideCheckInDuplicate(checkedOut(1004), true),
    { action: 'BLOCK' }
  );

  // (e) 変更申請中（勤怠はCHECKED_OUT）にまた出勤しようとする
  assertEq(
    '(e) 変更申請中に再出勤 → ブロック（勤怠は退勤済み）',
    decideCheckInDuplicate(checkedOut(1005), true),
    { action: 'BLOCK' }
  );

  // (f) 緊急番号で出勤・応募なし → 二度押し（当日・同一施設の未退勤が既存）
  assertEq(
    '(f) 緊急番号・応募なしの二度押し → 既存返却',
    decideCheckInDuplicate(checkedIn(1006), false),
    { action: 'RETURN_EXISTING', attendanceId: 1006 }
  );

  // (g) 緊急番号・応募なし・退勤後に別勤務のつもりで再出勤
  //     processCheckIn 側は「未退勤のみ」を検索するため既存は渡らない(null) → 作成許可
  assertEq(
    '(g) 緊急番号・応募なし・退勤後の再出勤 → 作成許可（別勤務の可能性）',
    decideCheckInDuplicate(null, false),
    { action: 'CREATE' }
  );

  // (h) 前日の未退勤が残ったまま当日の別応募で出勤
  //     応募ありは application_id で判定するため、別応募＝既存なし扱い → 作成許可
  assertEq(
    '(h) 前日の閉じ忘れが残存・当日は別応募で出勤 → 作成許可',
    decideCheckInDuplicate(null, true),
    { action: 'CREATE' }
  );

  // (i) 正常な初回出勤（既存なし・応募あり）
  assertEq(
    '(i) 正常な初回出勤 → 作成',
    decideCheckInDuplicate(null, true),
    { action: 'CREATE' }
  );

  // (j) 承認済み後にさらに出勤しようとする（給与確定済みの二重勤務防止）
  assertEq(
    '(j) 承認済み(退勤済み)後の再出勤 → ブロック',
    decideCheckInDuplicate(
      { id: 1010, status: 'CHECKED_OUT', check_out_time: new Date('2026-06-22T18:00:00Z') },
      true
    ),
    { action: 'BLOCK' }
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
