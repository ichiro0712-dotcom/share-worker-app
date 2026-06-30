/**
 * 通知変数の不一致 一括修正のユニットテスト
 *
 * 実行: `npx tsx tests/unit/notificationVariableMismatch.test.ts`
 *
 * テスト対象（いずれも純粋関数・DB/Resend非依存）:
 * - lib/notification-template.ts
 *   - withWorkerNameDefault() — ワーカー宛 {{worker_name}} 自動補完（群A）
 *   - buildMessagePreview()   — メッセージ本文プレビュー100字（群D）
 *   - replaceVariables()      — 単一パス置換（注入安全性）
 *
 * カバー範囲:
 * 1. withWorkerNameDefault: WORKER/FACILITY/ADMIN・明示優先・空名・マージ
 * 2. buildMessagePreview: 通常/空/空白/境界100/超過/多バイト/絵文字(サロゲート)/注入
 * 3. 修正対象通知の本文レンダリング（未置換 {{..}} が残らないこと）
 *    - 当日/前日リマインド・勤怠変更申請・新着メッセージ・お気に入り締切・管理者アラート
 * 4. ユーザー/管理者のイレギュラー操作シナリオ（変数注入・$&・改行・空）
 */

import {
  replaceVariables,
  withWorkerNameDefault,
  buildMessagePreview,
} from '../../lib/notification-template';

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
    console.log(`      expected: ${JSON.stringify(expected)}`);
    console.log(`      actual:   ${JSON.stringify(actual)}`);
  }
}

function assertTrue(name: string, cond: boolean) {
  assertEq(name, cond, true);
}

/** テンプレに未解決の {{..}} が残っていないか */
function hasUnresolved(s: string): boolean {
  return /\{\{[^}]*\}\}/.test(s);
}

// ============================================================
console.log('\n[1] withWorkerNameDefault（群A: worker_name 自動補完）');
// ============================================================
{
  // WORKER + 名前あり・worker_name未指定 → 注入される
  const r1 = withWorkerNameDefault('WORKER', '山田 太郎', { facility_name: 'みやけ' });
  assertEq('WORKER: worker_nameが注入される', r1.worker_name, '山田 太郎');
  assertEq('WORKER: 既存キーは保持', r1.facility_name, 'みやけ');

  // 明示 worker_name は優先（spread順）
  const r2 = withWorkerNameDefault('WORKER', '受信者名', { worker_name: '明示名' });
  assertEq('WORKER: 明示worker_nameが優先', r2.worker_name, '明示名');

  // FACILITY → 注入しない（recipientNameは施設名のため）
  const r3 = withWorkerNameDefault('FACILITY', 'みやけサポートハウス', { worker_name: '本物のワーカー' });
  assertEq('FACILITY: worker_nameは注入されず明示値のまま', r3.worker_name, '本物のワーカー');
  const r3b = withWorkerNameDefault('FACILITY', 'みやけ', { facility_name: 'みやけ' });
  assertEq('FACILITY: worker_nameキーは生えない', 'worker_name' in r3b, false);

  // SYSTEM_ADMIN → 注入しない
  const r4 = withWorkerNameDefault('SYSTEM_ADMIN', '管理者', { user_name: '対象者' });
  assertEq('ADMIN: worker_nameキーは生えない', 'worker_name' in r4, false);

  // 空名/未指定 → 注入しない（既存variablesをそのまま返す）
  assertEq('WORKER: 空名は注入しない', 'worker_name' in withWorkerNameDefault('WORKER', '', { a: 'b' }), false);
  assertEq('WORKER: null名は注入しない', 'worker_name' in withWorkerNameDefault('WORKER', null, { a: 'b' }), false);

  // 元のvariablesを破壊的変更しない（新オブジェクトを返す）
  const orig = { facility_name: 'X' };
  withWorkerNameDefault('WORKER', '太郎', orig);
  assertEq('元のvariablesを変更しない', 'worker_name' in orig, false);
}

// ============================================================
console.log('\n[2] buildMessagePreview（群D: 100字プレビュー）');
// ============================================================
{
  assertEq('通常の短文はそのまま', buildMessagePreview('よろしくお願いします'), 'よろしくお願いします');
  assertEq('前後空白はtrim', buildMessagePreview('  こんにちは  '), 'こんにちは');
  assertEq('空文字 → 添付代替文言', buildMessagePreview(''), '（添付ファイルが送信されました）');
  assertEq('空白のみ → 添付代替文言', buildMessagePreview('   \n\t '), '（添付ファイルが送信されました）');
  assertEq('null → 添付代替文言', buildMessagePreview(null), '（添付ファイルが送信されました）');
  assertEq('undefined → 添付代替文言', buildMessagePreview(undefined), '（添付ファイルが送信されました）');

  // 境界: ちょうど100文字は切り詰めない
  const exactly100 = 'あ'.repeat(100);
  assertEq('ちょうど100字は…付かない', buildMessagePreview(exactly100), exactly100);
  // 101文字は 100字 + …
  const over = 'あ'.repeat(101);
  assertEq('101字は100字+…に切り詰め', buildMessagePreview(over), 'あ'.repeat(100) + '…');
  // 多バイト150字
  assertEq('多バイト150字 → 100字+…', buildMessagePreview('漢'.repeat(150)), '漢'.repeat(100) + '…');

  // 絵文字（サロゲートペア）を途中で割らない
  assertEq('絵文字を割らない(maxLength=2)', buildMessagePreview('😀😀😀', 2), '😀😀…');
  assertEq('絵文字ちょうど境界', buildMessagePreview('😀😀', 2), '😀😀');
  // 改行を含む本文
  assertEq('改行を含む本文を保持', buildMessagePreview('1行目\n2行目'), '1行目\n2行目');
}

// ============================================================
console.log('\n[3] 修正対象通知の本文レンダリング（未置換が残らない）');
// ============================================================
{
  // --- 当日リマインド（群A自動補完で worker_name 解決）= 報告された本件 ---
  const SAME_DAY = `{{worker_name}}様\n\n本日の勤務リマインドです。\n\n勤務先: {{facility_name}}\n開始時間: {{start_time}}\n\nお気をつけてお越しください。`;
  const sameDayVars = withWorkerNameDefault('WORKER', '山田 太郎', {
    facility_name: 'みやけサポートハウス竹の塚',
    start_time: '11:00',
    address: '東京都足立区',
    job_title: '介護スタッフ',
  });
  const sameDayOut = replaceVariables(SAME_DAY, sameDayVars);
  assertTrue('当日リマインド: 未置換なし', !hasUnresolved(sameDayOut));
  assertTrue('当日リマインド: 氏名が反映', sameDayOut.startsWith('山田 太郎様'));

  // --- 前日リマインド（worker_name自動補完 + end_time追加） ---
  const DAY_BEFORE = `{{worker_name}}様\n\n勤務先: {{facility_name}}\n日時: {{work_date}} {{start_time}}〜{{end_time}}`;
  const dayBeforeVars = withWorkerNameDefault('WORKER', '佐藤 花子', {
    facility_name: 'みやけ',
    work_date: '2026-07-01',
    start_time: '09:00',
    end_time: '18:00',
    job_title: '介護',
  });
  assertTrue('前日リマインド: 未置換なし', !hasUnresolved(replaceVariables(DAY_BEFORE, dayBeforeVars)));

  // --- 勤怠変更申請（群B: snake_case化 + facility_name追加, FACILITY宛） ---
  const ATTENDANCE = `{{facility_name}}様\n\n{{worker_name}}様から勤怠変更申請がありました。\n\n勤務日: {{work_date}}\nワーカー: {{worker_name}}\n出勤時間: {{requested_start_time}}\n退勤時間: {{requested_end_time}}\n休憩時間: {{requested_break_time}}分\n\nワーカーコメント:\n{{worker_comment}}\n\n{{approval_url}}`;
  // 実コードと同じ変数セット（snake_case）
  let attVars: Record<string, string> = {
    facility_name: 'みやけ',
    worker_name: '山田 太郎',
    work_date: '2026-07-01',
    requested_start_time: '09:15',
    requested_end_time: '18:30',
    requested_break_time: '60',
    worker_comment: '残業しました',
    approval_url: 'https://tastas.work/admin/tasks/attendance/123',
  };
  // FACILITY宛なので worker_name は自動補完されない（明示が必須）→ 通しても変化しないこと
  attVars = withWorkerNameDefault('FACILITY', 'みやけ', attVars);
  const attOut = replaceVariables(ATTENDANCE, attVars);
  assertTrue('勤怠変更申請: 未置換なし', !hasUnresolved(attOut));
  assertTrue('勤怠変更申請: 承認URLが反映', attOut.includes('https://tastas.work/admin/tasks/attendance/123'));
  // 旧バグ（camelCase）だと未置換になることを対照確認
  const buggy = replaceVariables(ATTENDANCE, {
    workerName: '山田', workDate: 'x', requestedStartTime: 'x', requestedEndTime: 'x',
    requestedBreakTime: 'x', workerComment: 'x', approvalUrl: 'x',
  } as Record<string, string>);
  assertTrue('対照: camelCaseだと未置換が残る（旧バグ再現）', hasUnresolved(buggy));

  // --- 新着メッセージ（群D: message_content プレビュー） ---
  const NEW_MESSAGE = `{{worker_name}}様\n\n{{facility_name}}から新しいメッセージが届きました。\n\n■ メッセージ\n{{message_content}}\n\nメッセージ画面でご確認ください。`;
  const msgVars = withWorkerNameDefault('WORKER', '山田 太郎', {
    facility_name: 'みやけ',
    worker_name: '山田 太郎',
    message_content: buildMessagePreview('明日の勤務よろしくお願いします。'),
  });
  const msgOut = replaceVariables(NEW_MESSAGE, msgVars);
  assertTrue('新着メッセージ: 未置換なし', !hasUnresolved(msgOut));
  assertTrue('新着メッセージ: 本文プレビューが反映', msgOut.includes('明日の勤務よろしくお願いします。'));

  // --- お気に入り締切（群E: remaining_hours） ---
  const FAVORITE = `{{facility_name}}の求人があと{{remaining_hours}}時間で締切です。\n\nマイページをご確認ください。`;
  const favVars = withWorkerNameDefault('WORKER', '山田', {
    job_title: '介護',
    facility_name: 'みやけ',
    remaining_hours: '48',
    deadline: '2026-07-01',
    job_url: 'https://tastas.work/jobs/1',
  });
  const favOut = replaceVariables(FAVORITE, favVars);
  assertTrue('お気に入り締切: 未置換なし', !hasUnresolved(favOut));
  assertTrue('お気に入り締切: 残り時間が反映', favOut.includes('あと48時間'));

  // --- 管理者: キャンセル率（群F: user_name/recent_cancels + 二重%修正） ---
  const HIGH_CANCEL = `キャンセル率が高いユーザーを検知しました。\n\nユーザー: {{user_name}}\nキャンセル率: {{cancel_rate}}%\n直近キャンセル数: {{recent_cancels}}件`;
  const cancelVars = withWorkerNameDefault('SYSTEM_ADMIN', '管理者', {
    user_name: '山田 太郎',
    cancel_rate: '20', // % はテンプレ側が付与
    recent_cancels: '3',
    target_type: 'ワーカー',
    target_name: '山田 太郎',
    target_url: 'https://tastas.work/system-admin/workers/1',
  });
  const cancelOut = replaceVariables(HIGH_CANCEL, cancelVars);
  assertTrue('キャンセル率: 未置換なし', !hasUnresolved(cancelOut));
  assertTrue('キャンセル率: 二重%にならない(20%)', cancelOut.includes('キャンセル率: 20%') && !cancelOut.includes('%%'));

  // --- 管理者: 低評価連続（群F: average_rating/low_rating_count） ---
  const LOW_RATING = `ユーザー: {{user_name}}\n平均評価: {{average_rating}}\n直近の低評価数: {{low_rating_count}}件`;
  const lowVars = {
    user_name: '施設A', average_rating: '2.3', low_rating_count: '3',
    target_type: '施設', target_name: '施設A', streak_count: '3', avg_rating: '2.3',
    target_url: 'x',
  };
  assertTrue('低評価連続: 未置換なし', !hasUnresolved(replaceVariables(LOW_RATING, lowVars)));
}

// ============================================================
console.log('\n[4] イレギュラー操作シナリオ');
// ============================================================
{
  const TPL = `{{worker_name}}様 勤務先:{{facility_name}}`;

  // ワーカー名に変数記法が混入 → 単一パスのため再展開されない（注入防止）
  const injVars = withWorkerNameDefault('WORKER', '{{facility_name}}を注入 太郎', { facility_name: 'みやけ' });
  const injOut = replaceVariables(TPL, injVars);
  assertEq('注入: 氏名中の{{facility_name}}は展開されない', injOut, '{{facility_name}}を注入 太郎様 勤務先:みやけ');

  // ワーカー名に $& （正規表現置換の特殊パターン）→ そのまま出力
  const dollarOut = replaceVariables(TPL, withWorkerNameDefault('WORKER', '山田$&太郎', { facility_name: 'みやけ' }));
  assertEq('特殊文字 $& がそのまま', dollarOut, '山田$&太郎様 勤務先:みやけ');

  // メッセージ本文に変数記法が混入 → プレビュー化後も展開されない
  const evilContent = '電話して{{worker_name}}さん';
  const evilVars = withWorkerNameDefault('WORKER', '山田', {
    facility_name: 'みやけ', worker_name: '山田',
    message_content: buildMessagePreview(evilContent),
  });
  const evilOut = replaceVariables(`本文: {{message_content}}`, evilVars);
  assertEq('注入: メッセージ本文中の{{worker_name}}は展開されない', evilOut, '本文: 電話して{{worker_name}}さん');

  // 未知変数はそのまま残す（既存仕様の確認）
  assertEq('未知変数は保持', replaceVariables('{{unknown_var}}', { a: 'b' }), '{{unknown_var}}');

  // 値が空文字でもキーがあれば空に置換（{{..}}は残さない）
  assertEq('空値はキーがあれば空置換', replaceVariables('[{{x}}]', { x: '' }), '[]');
}

// ============================================================
// 結果サマリ
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`結果: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  console.log('\n失敗:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
  }
  process.exit(1);
}
console.log('全テスト成功 ✅');
