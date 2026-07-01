/**
 * 施設側「緊急連絡先」モーダル表示ロジックのユニットテスト
 *
 * 実行: `npx tsx tests/unit/emergencyContactView.test.ts`
 *
 * テスト対象: src/lib/emergencyContactView.ts
 *   - buildPhoneView() — 電話番号1件の表示ビュー（純粋関数）
 *   - fieldOrEmpty() — フィールド文字列の未登録フォールバック
 *   - buildEmergencyContactView() — モーダル全体のビュー組み立て
 *
 * カバー範囲:
 * 1. 本人電話の通常/未登録
 * 2. 関係者連絡先の有無判定・出し分け
 * 3. 境界値・イレギュラー入力（null / undefined / 空文字 / 空白のみ /
 *    前後空白 / 記号・ハイフン・全角・長大文字列 / tel:リンク生成）
 * 4. XSS的な文字列を渡しても tel: スキームが固定されること
 */

import {
  buildPhoneView,
  fieldOrEmpty,
  buildEmergencyContactView,
  LABEL_FIELD_EMPTY,
} from '../../src/lib/emergencyContactView';

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
// 1. buildPhoneView() 通常ケース
// =============================================================================
group('[1] buildPhoneView 通常', () => {
  assertEq('通常の携帯番号', buildPhoneView('09012345678'), {
    hasValue: true,
    display: '09012345678',
    telHref: 'tel:09012345678',
  });
  assertEq('ハイフン付きは視覚区切りを維持', buildPhoneView('090-1234-5678'), {
    hasValue: true,
    display: '090-1234-5678',
    telHref: 'tel:090-1234-5678',
  });
  assertEq('固定電話（市外局番）', buildPhoneView('03-1234-5678'), {
    hasValue: true,
    display: '03-1234-5678',
    telHref: 'tel:03-1234-5678',
  });
});

// =============================================================================
// 2. buildPhoneView() イレギュラー・境界値
// =============================================================================
group('[2] buildPhoneView イレギュラー', () => {
  assertEq('null → 未表示', buildPhoneView(null), {
    hasValue: false,
    display: '',
    telHref: null,
  });
  assertEq('undefined → 未表示', buildPhoneView(undefined), {
    hasValue: false,
    display: '',
    telHref: null,
  });
  assertEq('空文字 → 未表示', buildPhoneView(''), {
    hasValue: false,
    display: '',
    telHref: null,
  });
  assertEq('空白のみ → 未表示（登録なし扱い）', buildPhoneView('   '), {
    hasValue: false,
    display: '',
    telHref: null,
  });
  assertEq('全角スペースのみ → 未表示', buildPhoneView('　　'), {
    hasValue: false,
    display: '',
    telHref: null,
  });
  assertEq('前後空白はtrimされる', buildPhoneView('  09012345678  '), {
    hasValue: true,
    display: '09012345678',
    telHref: 'tel:09012345678',
  });
  assertEq('番号内の空白はtelから除去', buildPhoneView('090 1234 5678'), {
    hasValue: true,
    display: '090 1234 5678',
    telHref: 'tel:09012345678',
  });
  assertEq('タブ・改行混じり', buildPhoneView('090\t1234\n5678'), {
    hasValue: true,
    display: '090\t1234\n5678',
    telHref: 'tel:09012345678',
  });
});

// =============================================================================
// 3. XSS的入力でも tel: スキーム固定
// =============================================================================
group('[3] スキーム固定（安全性）', () => {
  const v = buildPhoneView('javascript:alert(1)');
  assertEq('javascript: は tel: 配下に埋め込まれ実行不可', v.telHref, 'tel:javascript:alert(1)');
  const q = buildPhoneView('123"onmouseover="x');
  assertEq('引用符入りでも tel: 接頭辞は保持', q.telHref?.startsWith('tel:'), true);
});

// =============================================================================
// 4. fieldOrEmpty()
// =============================================================================
group('[4] fieldOrEmpty', () => {
  assertEq('値あり', fieldOrEmpty('母'), '母');
  assertEq('null → 未登録', fieldOrEmpty(null), LABEL_FIELD_EMPTY);
  assertEq('空白のみ → 未登録', fieldOrEmpty('  '), LABEL_FIELD_EMPTY);
  assertEq('前後空白trim', fieldOrEmpty(' 東京都〇〇区 '), '東京都〇〇区');
});

// =============================================================================
// 5. buildEmergencyContactView() 本人＋関係者
// =============================================================================
group('[5] buildEmergencyContactView 全体', () => {
  // 本人あり・関係者フル
  const full = buildEmergencyContactView({
    phone: '09011112222',
    emergencyName: '山田花子',
    emergencyRelation: '母',
    emergencyPhone: '08033334444',
    emergencyAddress: '東京都〇〇区1-2-3',
  });
  assertEq('本人電話が表示される', full.self, {
    hasValue: true,
    display: '09011112222',
    telHref: 'tel:09011112222',
  });
  assertEq('関係者ありと判定', full.related.hasAny, true);
  assertEq('関係者氏名', full.related.name, '山田花子');
  assertEq('関係者電話ビュー', full.related.phone, {
    hasValue: true,
    display: '08033334444',
    telHref: 'tel:08033334444',
  });

  // 本人あり・関係者すべて空 → 本人は出るが関係者は「登録なし」
  const noRelated = buildEmergencyContactView({
    phone: '09011112222',
    emergencyName: null,
    emergencyRelation: null,
    emergencyPhone: null,
    emergencyAddress: null,
  });
  assertEq('本人は表示され続ける', noRelated.self.hasValue, true);
  assertEq('関係者なし判定', noRelated.related.hasAny, false);
  assertEq('関係者フィールドは未登録', noRelated.related.name, LABEL_FIELD_EMPTY);

  // 関係者は住所のみ → hasAny=true（部分入力でもセクション表示）
  const addrOnly = buildEmergencyContactView({
    phone: '09011112222',
    emergencyName: '  ',
    emergencyRelation: null,
    emergencyPhone: '   ',
    emergencyAddress: '大阪府〇〇市',
  });
  assertEq('住所のみでも関係者あり判定', addrOnly.related.hasAny, true);
  assertEq('空白電話は関係者側でも未表示', addrOnly.related.phone.hasValue, false);

  // 本人電話が空・関係者もなし（想定外だが安全に）
  const empty = buildEmergencyContactView({
    phone: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    emergencyAddress: '',
  });
  assertEq('本人電話なし', empty.self.hasValue, false);
  assertEq('関係者なし', empty.related.hasAny, false);

  // 全プロパティ未指定（undefined）
  const undef = buildEmergencyContactView({});
  assertEq('空オブジェクトでも落ちない・本人なし', undef.self.hasValue, false);
  assertEq('空オブジェクトでも関係者なし', undef.related.hasAny, false);
});

// =============================================================================
// 結果サマリ
// =============================================================================
console.log('\n=============================================');
console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
console.log('=============================================');
if (failCount > 0) {
  console.log('\n✗ 失敗あり');
  process.exit(1);
} else {
  console.log('\n✓ 全テスト成功');
}
