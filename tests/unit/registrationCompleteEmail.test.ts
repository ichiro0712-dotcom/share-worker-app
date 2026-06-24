/**
 * 会員登録完了メール（管理画面編集対応）のユニットテスト
 *
 * 実行: `npx tsx tests/unit/registrationCompleteEmail.test.ts`
 *
 * テスト対象（いずれも純粋関数・DB/Resend非依存）:
 * - src/lib/auth/registration-email-content.ts
 *   - isRegistrationTemplateUsable() — テンプレ採用/フォールバック判定
 *   - buildRegistrationEmailContent() — 本文構築（テンプレ or フォールバック）
 *   - formatTemplateEmailHtml() — テキスト→HTML整形
 *   - DEFAULT_REGISTRATION_NOTIFICATION_SETTING — 初期テンプレ（真実源）
 * - lib/notification-template.ts
 *   - replaceVariables() / findInvalidPlaceholders() / NOTIFICATION_VARIABLES
 *
 * カバー範囲:
 * 1. 新変数の登録（{{verification_url}} {{login_url}}）
 * 2. 初期テンプレの健全性（未知変数なし・全プレースホルダ解決）
 * 3. buildRegistrationEmailContent 正常系
 * 4. フォールバック（テンプレ未投入/email無効/件名空/本文空/空白）
 * 5. 管理者のイレギュラー編集（変数削除/タイポ/空白入り/角括弧）
 * 6. ワーカー名などのイレギュラー入力（特殊文字 $&・{{..}}注入・改行・空）
 * 7. formatTemplateEmailHtml の整形
 */

import {
  NOTIFICATION_VARIABLES,
  replaceVariables,
  findInvalidPlaceholders,
  getSampleVariableValues,
} from '../../lib/notification-template';
import {
  REGISTRATION_COMPLETE_KEY,
  DEFAULT_REGISTRATION_EMAIL_SUBJECT,
  DEFAULT_REGISTRATION_EMAIL_BODY,
  DEFAULT_REGISTRATION_NOTIFICATION_SETTING,
  isRegistrationTemplateUsable,
  buildRegistrationEmailContent,
  formatTemplateEmailHtml,
} from '../../src/lib/auth/registration-email-content';

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

// 標準のフォールバック本文（呼び出し側 email-verification.ts が渡すものを模す）
const FALLBACK = {
  subject: '【+タスタス】メールアドレスの確認',
  html: '<html>FALLBACK_HTML</html>',
  text: 'FALLBACK_TEXT',
};

const VARS = {
  name: '山田 太郎',
  verificationUrl: 'https://tastas.work/api/auth/verify?token=abc123',
  loginUrl: 'https://tastas.work/login',
};

// 有効な初期設定（DBから取得した想定）
const VALID_SETTING = {
  email_enabled: true,
  email_subject: DEFAULT_REGISTRATION_EMAIL_SUBJECT,
  email_body: DEFAULT_REGISTRATION_EMAIL_BODY,
};

// =============================================================================
// 1. 新変数の登録
// =============================================================================
group('[1] NOTIFICATION_VARIABLES への新変数登録', () => {
  const keys = NOTIFICATION_VARIABLES.map((v) => v.key);
  assertEq('{{verification_url}} が登録されている', keys.includes('{{verification_url}}'), true);
  assertEq('{{login_url}} が登録されている', keys.includes('{{login_url}}'), true);
  assertEq('{{worker_name}} は既存で登録済み', keys.includes('{{worker_name}}'), true);

  const samples = getSampleVariableValues();
  assertEq('verification_url のサンプル値が存在', typeof samples['verification_url'] === 'string' && samples['verification_url'].length > 0, true);
  assertEq('login_url のサンプル値が存在', typeof samples['login_url'] === 'string' && samples['login_url'].length > 0, true);
});

// =============================================================================
// 2. 初期テンプレの健全性（管理画面プレビューで警告が出ないこと）
// =============================================================================
group('[2] 初期テンプレの健全性', () => {
  assertEq(
    '件名に誤記法プレースホルダなし',
    findInvalidPlaceholders(DEFAULT_REGISTRATION_EMAIL_SUBJECT),
    []
  );
  assertEq(
    '本文に誤記法プレースホルダなし（未知変数/空白/角括弧）',
    findInvalidPlaceholders(DEFAULT_REGISTRATION_EMAIL_BODY),
    []
  );

  // 本文中の全 {{..}} が登録済み変数であること
  const used = (DEFAULT_REGISTRATION_EMAIL_BODY.match(/\{\{([^{}]+)\}\}/g) || []);
  assertEq('本文に少なくとも worker_name/verification_url/login_url を含む', used.length >= 3, true);

  // 実値置換後、未解決の {{..}} が残らないこと
  const replaced = replaceVariables(DEFAULT_REGISTRATION_EMAIL_BODY, {
    worker_name: VARS.name,
    verification_url: VARS.verificationUrl,
    login_url: VARS.loginUrl,
  });
  assertEq('置換後に未解決の {{..}} が残らない', /\{\{[^{}]+\}\}/.test(replaced), false);
  assertEq('置換後に verificationUrl を含む', replaced.includes(VARS.verificationUrl), true);
  assertEq('置換後に loginUrl を含む', replaced.includes(VARS.loginUrl), true);
  assertEq('置換後に worker_name を含む', replaced.includes(VARS.name), true);

  // 真実源の一致（seed/upsert と送信コードが同一文面を使う）
  assertEq('初期設定の key が一致', DEFAULT_REGISTRATION_NOTIFICATION_SETTING.notification_key, REGISTRATION_COMPLETE_KEY);
  assertEq('初期設定は email のみ有効', [
    DEFAULT_REGISTRATION_NOTIFICATION_SETTING.email_enabled,
    DEFAULT_REGISTRATION_NOTIFICATION_SETTING.chat_enabled,
    DEFAULT_REGISTRATION_NOTIFICATION_SETTING.push_enabled,
  ], [true, false, false]);
  assertEq('初期設定の target_type は WORKER', DEFAULT_REGISTRATION_NOTIFICATION_SETTING.target_type, 'WORKER');
});

// =============================================================================
// 3. buildRegistrationEmailContent 正常系
// =============================================================================
group('[3] buildRegistrationEmailContent 正常系', () => {
  const content = buildRegistrationEmailContent(VALID_SETTING, VARS, FALLBACK);

  assertEq('件名が初期テンプレ件名と一致', content.subject, DEFAULT_REGISTRATION_EMAIL_SUBJECT);
  assertEq('テキスト本文に worker_name', content.text.includes('山田 太郎'), true);
  assertEq('テキスト本文に verificationUrl', content.text.includes(VARS.verificationUrl), true);
  assertEq('テキスト本文に loginUrl', content.text.includes(VARS.loginUrl), true);
  assertEq('テキスト本文に未解決 {{..}} なし', /\{\{[^{}]+\}\}/.test(content.text), false);

  assertEq('HTMLに verificationUrl', content.html.includes(VARS.verificationUrl), true);
  assertEq('HTMLに自動送信フッター', content.html.includes('自動送信'), true);
  assertEq('HTMLは改行を<br>化（テキストの改行数と概ね対応）', content.html.includes('<br>'), true);

  assertEq('フォールバックは返さない（テンプレ採用）', content.text === FALLBACK.text, false);
});

// =============================================================================
// 4. フォールバック（テンプレが使えないケース）
// =============================================================================
group('[4] フォールバック判定', () => {
  assertEq('setting=null → フォールバック', buildRegistrationEmailContent(null, VARS, FALLBACK), FALLBACK);
  assertEq('setting=undefined → フォールバック', buildRegistrationEmailContent(undefined, VARS, FALLBACK), FALLBACK);
  assertEq(
    'email_enabled=false → フォールバック',
    buildRegistrationEmailContent({ ...VALID_SETTING, email_enabled: false }, VARS, FALLBACK),
    FALLBACK
  );
  assertEq(
    'email_subject=null → フォールバック',
    buildRegistrationEmailContent({ ...VALID_SETTING, email_subject: null }, VARS, FALLBACK),
    FALLBACK
  );
  assertEq(
    'email_body=null → フォールバック',
    buildRegistrationEmailContent({ ...VALID_SETTING, email_body: null }, VARS, FALLBACK),
    FALLBACK
  );
  assertEq(
    'email_subject="" → フォールバック',
    buildRegistrationEmailContent({ ...VALID_SETTING, email_subject: '' }, VARS, FALLBACK),
    FALLBACK
  );
  assertEq(
    'email_body="   "（空白のみ）→ フォールバック',
    buildRegistrationEmailContent({ ...VALID_SETTING, email_body: '   ' }, VARS, FALLBACK),
    FALLBACK
  );

  // isRegistrationTemplateUsable 単体
  assertEq('usable: 有効設定 → true', isRegistrationTemplateUsable(VALID_SETTING), true);
  assertEq('usable: null → false', isRegistrationTemplateUsable(null), false);
  assertEq('usable: 件名空白のみ → false', isRegistrationTemplateUsable({ ...VALID_SETTING, email_subject: '  ' }), false);
});

// =============================================================================
// 5. 管理者のイレギュラー編集（通知管理画面での編集ミス）
// =============================================================================
group('[5] 管理者のイレギュラー編集', () => {
  // A: {{verification_url}} を削除して保存 → リンクは消えるが送信は継続（クラッシュしない）
  const noUrlBody = `{{worker_name}} 様\n登録が完了しました。ログイン: {{login_url}}`;
  const aContent = buildRegistrationEmailContent(
    { ...VALID_SETTING, email_body: noUrlBody },
    VARS,
    FALLBACK
  );
  assertEq('A: 認証URL削除でもフォールバックせず送信（テンプレ採用）', aContent.text.includes('登録が完了しました'), true);
  assertEq('A: 認証URLは本文に含まれない（消えている）', aContent.text.includes(VARS.verificationUrl), false);
  assertEq('A: login_url は残る', aContent.text.includes(VARS.loginUrl), true);
  assertEq('A: 削除そのものは「誤記法」ではない（警告なし）', findInvalidPlaceholders(noUrlBody), []);

  // B: 変数名タイポ {{verificaton_url}} → 置換されず、警告対象
  const typoBody = `ログイン: {{verificaton_url}}`;
  assertEq('B: タイポは置換されず原文のまま残る', replaceVariables(typoBody, { verification_url: VARS.verificationUrl }), 'ログイン: {{verificaton_url}}');
  const typoWarn = findInvalidPlaceholders(typoBody);
  assertEq('B: タイポは未知変数として警告される', typoWarn.length >= 1 && typoWarn[0].reason.includes('未知'), true);

  // C: 余分な空白 {{ verification_url }} → 置換されず、警告対象
  const spaceBody = `ログイン: {{ verification_url }}`;
  assertEq('C: 空白入りは置換されない', replaceVariables(spaceBody, { verification_url: VARS.verificationUrl }).includes('{{ verification_url }}'), true);
  const spaceWarn = findInvalidPlaceholders(spaceBody);
  assertEq('C: 空白入りは警告される', spaceWarn.some((w) => w.reason.includes('空白')), true);

  // D: 角括弧記法 [施設名] → 警告対象（置換されない旧記法）
  const bracketWarn = findInvalidPlaceholders('施設: [施設名]');
  assertEq('D: 角括弧の既知語は警告される', bracketWarn.some((w) => w.reason.includes('角括弧')), true);

  // E: email_enabled を false に切替（管理者が無効化）→ 安全にフォールバック
  assertEq(
    'E: 管理者が無効化 → 旧確認メールにフォールバック',
    buildRegistrationEmailContent({ ...VALID_SETTING, email_enabled: false }, VARS, FALLBACK),
    FALLBACK
  );
});

// =============================================================================
// 6. ワーカー名などイレギュラー入力（インジェクション・特殊文字）
// =============================================================================
group('[6] イレギュラーな入力値', () => {
  // $& や $1 は正規表現置換の特殊パターン。関数置換のため誤展開されないこと
  const dollar = replaceVariables('Hi {{worker_name}}!', { worker_name: '$& $1 $`' });
  assertEq('特殊パターン $& $1 がそのまま入る（誤展開なし）', dollar, 'Hi $& $1 $`!');

  // 値に {{login_url}} を含めても再展開されない（単一パス）
  const inject = replaceVariables('Name: {{worker_name}} / URL: {{login_url}}', {
    worker_name: '{{login_url}}',
    login_url: 'https://evil.example/login',
  });
  assertEq('名前に{{login_url}}を仕込んでも再展開されない', inject, 'Name: {{login_url}} / URL: https://evil.example/login');

  // 空のワーカー名 → スロットは空文字
  const empty = replaceVariables('[{{worker_name}}]', { worker_name: '' });
  assertEq('空のworker_name → 空文字に置換', empty, '[]');

  // 同一変数が複数回出現 → すべて置換
  const multi = replaceVariables('{{login_url}} a {{login_url}} b {{login_url}}', { login_url: 'X' });
  assertEq('同一変数の複数出現はすべて置換', multi, 'X a X b X');

  // verificationUrl に returnUrl クエリ（& と %エンコード）が付いても素通し
  const urlWithQuery = 'https://tastas.work/api/auth/verify?token=abc&returnUrl=%2Fjobs%2F1';
  const content = buildRegistrationEmailContent(
    VALID_SETTING,
    { ...VARS, verificationUrl: urlWithQuery },
    FALLBACK
  );
  assertEq('クエリ付きverificationUrlが本文に素通しで入る', content.text.includes(urlWithQuery), true);

  // 改行を含むワーカー名 → テキストにそのまま反映（クラッシュしない）
  const nl = buildRegistrationEmailContent(VALID_SETTING, { ...VARS, name: '山田\n太郎' }, FALLBACK);
  assertEq('改行入りの名前でもcrashせず本文生成', typeof nl.text === 'string' && nl.text.length > 0, true);
});

// =============================================================================
// 7. formatTemplateEmailHtml の整形
// =============================================================================
group('[7] formatTemplateEmailHtml', () => {
  const html = formatTemplateEmailHtml('1行目\n2行目\n3行目');
  assertEq('改行が<br>に変換される（2箇所）', (html.match(/<br>/g) || []).length, 2);
  assertEq('共通枠（DOCTYPE）を含む', html.includes('<!DOCTYPE html>'), true);
  assertEq('自動送信フッターを含む', html.includes('このメールは +タスタス より自動送信されています'), true);
  assertEq('本文テキストを含む', html.includes('2行目'), true);
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
