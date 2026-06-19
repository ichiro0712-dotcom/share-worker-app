/**
 * 勤務実績なしワーカー応募上限ロジックのユニットテスト
 *
 * 実行: `npx tsx tests/unit/beginnerApplicationLimit.test.ts`
 *
 * テスト対象:
 * - src/lib/beginnerApplicationLimit.ts
 *   - canApplyByBeginnerLimit() — 純粋関数（DBアクセスなし）
 *   - isJobSubjectToBeginnerLimit() — job_type による例外判定
 *
 * カバー範囲:
 * 1. 通常ケース（初心者/非初心者・上限以下/到達/超過）
 * 2. weekly_frequency 求人ケース
 * 3. 境界値（ongoingCount=limit-1, =limit, =limit+5、limit=0/1/100）
 * 4. イレギュラー入力（負数、null、undefined、無効な job_type、不正な型）
 * 5. 例外対象 job_type の網羅 - OFFER / LIMITED_WORKED / LIMITED_FAVORITE / ORIENTATION / NORMAL / null / 未知の値
 */

import {
  canApplyByBeginnerLimit,
  isJobSubjectToBeginnerLimit,
  BEGINNER_LIMIT_EXEMPT_JOB_TYPES,
} from '../../src/lib/beginnerApplicationLimit';

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
// 1. canApplyByBeginnerLimit() の通常ケース
// =============================================================================
group('[1] 通常ケース', () => {
  assertEq(
    '非初心者は常に allowed=true',
    canApplyByBeginnerLimit({
      isBeginner: false,
      ongoingCount: 999,
      limit: 2,
      jobWeeklyFrequency: null,
    }),
    { allowed: true }
  );

  assertEq(
    '非初心者は weekly_frequency 求人でも allowed=true',
    canApplyByBeginnerLimit({
      isBeginner: false,
      ongoingCount: 0,
      limit: 2,
      jobWeeklyFrequency: 3,
    }),
    { allowed: true }
  );

  assertEq(
    '初心者・応募ゼロ・通常求人 → allowed=true',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 0,
      limit: 2,
      jobWeeklyFrequency: null,
    }),
    { allowed: true }
  );

  assertEq(
    '初心者・上限未満（ongoing=1, limit=2）・通常求人 → allowed=true',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 1,
      limit: 2,
      jobWeeklyFrequency: null,
    }),
    { allowed: true }
  );

  const limitReached = canApplyByBeginnerLimit({
    isBeginner: true,
    ongoingCount: 2,
    limit: 2,
    jobWeeklyFrequency: null,
  });
  assertEq('初心者・上限到達（ongoing=limit）→ allowed=false', limitReached.allowed, false);
  assertEq('上限到達 errorKind=LIMIT_REACHED', limitReached.errorKind, 'LIMIT_REACHED');
  assertEq(
    '上限到達 reason に「同時2件」を含む',
    typeof limitReached.reason === 'string' && limitReached.reason.includes('同時2件'),
    true
  );

  assertEq(
    '初心者・上限超過（ongoing > limit）→ allowed=false',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 5,
      limit: 2,
      jobWeeklyFrequency: null,
    }).allowed,
    false
  );
});

// =============================================================================
// 2. weekly_frequency 求人ケース（案B：初心者は応募不可）
// =============================================================================
group('[2] weekly_frequency 求人ケース', () => {
  const wfBlock = canApplyByBeginnerLimit({
    isBeginner: true,
    ongoingCount: 0,
    limit: 2,
    jobWeeklyFrequency: 2,
  });
  assertEq('初心者・weekly_frequency=2 → allowed=false', wfBlock.allowed, false);
  assertEq('errorKind=WEEKLY_FREQUENCY', wfBlock.errorKind, 'WEEKLY_FREQUENCY');
  assertEq(
    'reason に「初回勤務後にご応募」を含む',
    typeof wfBlock.reason === 'string' && wfBlock.reason.includes('初回勤務後にご応募'),
    true
  );

  assertEq(
    '初心者・weekly_frequency=5 → 同じく allowed=false',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 0,
      limit: 2,
      jobWeeklyFrequency: 5,
    }).allowed,
    false
  );

  // weekly_frequency の判定が「上限到達」より優先されること（先にweekly_frequencyで弾く）
  const wfPriority = canApplyByBeginnerLimit({
    isBeginner: true,
    ongoingCount: 10, // 上限到達状態
    limit: 2,
    jobWeeklyFrequency: 3,
  });
  assertEq('上限到達 + weekly_frequency: weekly_frequency が優先される', wfPriority.errorKind, 'WEEKLY_FREQUENCY');

  // weekly_frequency=null は判定対象外
  assertEq(
    'weekly_frequency=null は通常求人扱い → 上限内なら allowed=true',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 1,
      limit: 2,
      jobWeeklyFrequency: null,
    }).allowed,
    true
  );

  // weekly_frequency=1 は仕様外（>=2 のみ対象）
  assertEq(
    'weekly_frequency=1 は判定対象外（>=2 のみ対象）',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 0,
      limit: 2,
      jobWeeklyFrequency: 1,
    }).allowed,
    true
  );

  assertEq(
    'weekly_frequency=0 も判定対象外',
    canApplyByBeginnerLimit({
      isBeginner: true,
      ongoingCount: 0,
      limit: 2,
      jobWeeklyFrequency: 0,
    }).allowed,
    true
  );
});

// =============================================================================
// 3. 境界値テスト
// =============================================================================
group('[3] 境界値テスト', () => {
  // limit=1 の境界
  assertEq(
    'limit=1, ongoing=0 → allowed=true',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: 1, jobWeeklyFrequency: null }).allowed,
    true
  );
  assertEq(
    'limit=1, ongoing=1 → allowed=false (境界)',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 1, limit: 1, jobWeeklyFrequency: null }).allowed,
    false
  );

  // limit=0 の境界（運用上禁止だが防御的テスト）
  assertEq(
    'limit=0 → 初心者の全応募がブロック',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: 0, jobWeeklyFrequency: null }).allowed,
    false
  );
  assertEq(
    'limit=0, 非初心者 → allowed=true（非初心者には影響なし）',
    canApplyByBeginnerLimit({ isBeginner: false, ongoingCount: 0, limit: 0, jobWeeklyFrequency: null }).allowed,
    true
  );

  // 大きな limit
  assertEq(
    'limit=100, ongoing=99 → allowed=true',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 99, limit: 100, jobWeeklyFrequency: null }).allowed,
    true
  );
});

// =============================================================================
// 4. イレギュラー入力（防御的テスト）
// =============================================================================
group('[4] イレギュラー入力', () => {
  // ongoingCount が負数（DB不整合等）
  assertEq(
    'ongoingCount=-1 (DB不整合) → 上限内扱いで allowed=true',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: -1, limit: 2, jobWeeklyFrequency: null }).allowed,
    true
  );

  // limit が負数（設定ミス）→ ongoingCount >= -1 になるので全てブロックされる
  assertEq(
    'limit=-1 (設定ミス) → 初心者は全ブロック',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: -1, jobWeeklyFrequency: null }).allowed,
    false
  );

  // weekly_frequency が極端な値
  assertEq(
    'weekly_frequency=999 (規格外大) でも判定する',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: 2, jobWeeklyFrequency: 999 }).allowed,
    false
  );

  assertEq(
    'weekly_frequency=-1 (負数) は判定対象外（>=2 のみ）',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: 2, jobWeeklyFrequency: -1 }).allowed,
    true
  );
});

// =============================================================================
// 5. isJobSubjectToBeginnerLimit() の網羅
// =============================================================================
group('[5] isJobSubjectToBeginnerLimit() — 例外 job_type 判定', () => {
  // 通常求人は対象
  assertEq("'NORMAL' は判定対象（true）", isJobSubjectToBeginnerLimit('NORMAL'), true);

  // 例外対象（OFFER/LIMITED_*/ORIENTATION）
  for (const exempt of BEGINNER_LIMIT_EXEMPT_JOB_TYPES) {
    assertEq(`'${exempt}' は例外（false）`, isJobSubjectToBeginnerLimit(exempt), false);
  }

  // null/undefined は判定対象（防御的）
  assertEq('null は判定対象（true）', isJobSubjectToBeginnerLimit(null), true);
  assertEq('undefined は判定対象（true）', isJobSubjectToBeginnerLimit(undefined), true);

  // 未知の値・大文字小文字違い
  assertEq('未知の値は判定対象（true）', isJobSubjectToBeginnerLimit('BANANA'), true);
  assertEq("小文字'offer' は判定対象（大文字のみ例外、true）", isJobSubjectToBeginnerLimit('offer'), true);
  assertEq("空文字は判定対象（true）", isJobSubjectToBeginnerLimit(''), true);
});

// =============================================================================
// 6. ユーザーのイレギュラー操作シナリオ（ロジックレベル）
// =============================================================================
group('[6] ユーザーのイレギュラー操作シナリオ', () => {
  // Scenario A: 初心者が UI を経由せず直接 API を叩いた場合
  // → サーバー側で canApplyByBeginnerLimit が呼ばれるため弾かれる
  assertEq(
    'シナリオA: 上限到達状態で API 直叩き → サーバー側で弾く',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 2, limit: 2, jobWeeklyFrequency: null }).allowed,
    false
  );

  // Scenario B: 初心者が応募→キャンセル→再応募を繰り返す
  // → CANCELLED は ongoingCount から除外される（呼び出し側 fetchBeginnerLimitStatus で除外）
  //    そのため再応募時は ongoing が回復しており allowed=true
  assertEq(
    'シナリオB: 2件応募→1件キャンセル → ongoing=1 で再応募可能',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 1, limit: 2, jobWeeklyFrequency: null }).allowed,
    true
  );

  // Scenario C: 並行応募 (race condition) を想定し、count 取得時点で上限ぎりぎりだった場合
  // 同じカウントから複数応募が同時に走ると、Application 作成は両方成功する可能性がある。
  // ただし新たな応募試行は次回 fetchBeginnerLimitStatus で 3 件カウントされて弾かれる。
  // → 純粋関数としては「与えられた ongoingCount を信じる」ので OK
  assertEq(
    'シナリオC: race で ongoing が limit+1 まで増えても、次回の判定で弾かれる',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 3, limit: 2, jobWeeklyFrequency: null }).allowed,
    false
  );

  // Scenario D: 初心者が weekly_frequency 求人を選んで応募ボタンを連打
  // → サーバー側 weekly_frequency 判定で弾かれる
  assertEq(
    'シナリオD: 初心者 + weekly_frequency 求人 → 連打しても弾かれる',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: 2, jobWeeklyFrequency: 3 }).errorKind,
    'WEEKLY_FREQUENCY'
  );

  // Scenario E: 上限値が SystemSetting で 0 に設定された（運用ミス）
  // → 初心者は全応募ブロック・非初心者には影響なし
  assertEq(
    'シナリオE: 設定 0 → 初心者の全応募ブロック',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 0, limit: 0, jobWeeklyFrequency: null }).allowed,
    false
  );
  assertEq(
    'シナリオE: 設定 0 → 非初心者は引き続き応募可能',
    canApplyByBeginnerLimit({ isBeginner: false, ongoingCount: 0, limit: 0, jobWeeklyFrequency: null }).allowed,
    true
  );

  // Scenario F: 初心者が直近に COMPLETED_PENDING（退勤後・レビュー前）の応募を持つ
  // → ongoingCount に COMPLETED_PENDING も含まれる（fetchBeginnerLimitStatus の where 句）
  //    そのため「実質完了直前」のワーカーでも上限内で動作する
  assertEq(
    'シナリオF: COMPLETED_PENDING 1件 + 新規応募 → ongoing=1 で allowed=true',
    canApplyByBeginnerLimit({ isBeginner: true, ongoingCount: 1, limit: 2, jobWeeklyFrequency: null }).allowed,
    true
  );

  // Scenario G: weekly_frequency 求人にオファー受諾経路（acceptOffer）でアクセス
  // → acceptOffer はガード追加していないが、acceptOffer は OFFER 種別のみ通過する
  //    OFFER は isJobSubjectToBeginnerLimit で例外扱いなので、対称的に問題なし
  assertEq(
    "シナリオG: OFFER 種別は例外（acceptOffer は判定対象外）",
    isJobSubjectToBeginnerLimit('OFFER'),
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
