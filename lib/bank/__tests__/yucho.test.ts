import assert from 'node:assert/strict'
import test from 'node:test'

import { YUCHO_BANK_CODE, convertYuchoToZengin, isYuchoBankCode, yuchoBranchName } from '../yucho'

// 出典(変換ルール):
// - ゆうちょ公式: 店番=記号の2〜3桁目+"8" / 口座番号=番号の最後の1桁を除く(7桁未満は左ゼロ埋め)
//   https://support.smarthr.jp/ja/help/articles/360026107394/
// - ゆうちょ公式（口座種別・桁数パターン。記号1始まり=通常貯金 / 0始まり=振替口座）
//   https://www.jp-bank.japanpost.jp/kojin/sokin/koza/kj_sk_kz_furikomi_ksk.html
// money が動く変換のため、確実な「通常貯金」のみ対応し、曖昧な振替口座は明示エラーで弾く（Phase1）。

test('isYuchoBankCode: 9900 のみ true', () => {
  assert.equal(isYuchoBankCode('9900'), true)
  assert.equal(isYuchoBankCode('0001'), false)
  assert.equal(isYuchoBankCode(''), false)
  assert.equal(isYuchoBankCode(null), false)
  assert.equal(YUCHO_BANK_CODE, '9900')
})

test('通常貯金: 記号12345 番号12345671 → 店番238 普通 口座1234567', () => {
  const r = convertYuchoToZengin('12345', '12345671')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.branchCode, '238')
  assert.equal(r.accountType, 'ORDINARY')
  assert.equal(r.accountNumber, '1234567')
})

test('通常貯金: ゆうちょ公式の例 記号11940 番号12345671 → 店番198 口座1234567', () => {
  // 出典: ゆうちょ公式図（番号8桁の例）
  const r = convertYuchoToZengin('11940', '12345671')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.branchCode, '198') // 2-3桁目"19" + "8"
  assert.equal(r.accountNumber, '1234567') // 最後の"1"を除く
})

test('通常貯金: 番号が7桁以下でも「最後の1桁を除く」→ゼロ埋め7桁', () => {
  // 公式: 桁数にかかわらず番号の最後の1桁を除く。
  // 番号 "123456" (6桁) → 最後を除く "12345" → ゼロ埋め "0012345"
  const r = convertYuchoToZengin('10010', '123456')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.branchCode, '008') // 2-3桁目="00" + "8"
  assert.equal(r.accountNumber, '0012345')
})

test('通常貯金: 番号1234561(7桁) → 最後を除き0123456', () => {
  const r = convertYuchoToZengin('11940', '1234561')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.accountNumber, '0123456')
})

test('通常貯金: 最小2桁の番号 12 → 最後を除き 0000001（境界）', () => {
  const r = convertYuchoToZengin('11940', '12')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.accountNumber, '0000001')
})

test('全角数字・空白・ハイフンを正規化して変換できる', () => {
  const r = convertYuchoToZengin('１２３４５', '1234-5671')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.branchCode, '238')
  assert.equal(r.accountNumber, '1234567')
})

test('記号が5桁でない場合はエラー', () => {
  assert.equal(convertYuchoToZengin('1234', '12345671').ok, false)
  assert.equal(convertYuchoToZengin('123456', '12345671').ok, false)
  assert.equal(convertYuchoToZengin('abcde', '12345671').ok, false)
})

test('番号が2〜8桁の数字でない場合はエラー', () => {
  assert.equal(convertYuchoToZengin('12345', '').ok, false)
  assert.equal(convertYuchoToZengin('12345', '1').ok, false) // 1桁(最後を除くと空)
  assert.equal(convertYuchoToZengin('12345', '123456789').ok, false) // 9桁
  assert.equal(convertYuchoToZengin('12345', '12ab5671').ok, false)
})

test('振替口座(記号が0始まり)はPhase1では明示エラーで弾く', () => {
  const r = convertYuchoToZengin('00010', '123456')
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.match(r.error, /振替/)
})

test('記号が1でも0でもない先頭はエラー(想定外)', () => {
  assert.equal(convertYuchoToZengin('23456', '12345671').ok, false)
})

test('yuchoBranchName: 店番(3桁)を漢数字読みの支店名に変換', () => {
  // ゆうちょの支店名は店番を漢数字読みにしたもの（公式表記）。
  assert.equal(yuchoBranchName('198'), '一九八')
  assert.equal(yuchoBranchName('008'), '〇〇八')
  assert.equal(yuchoBranchName('238'), '二三八')
})

test('yuchoBranchName: convertYuchoToZengin の店番と整合する', () => {
  const r = convertYuchoToZengin('11940', '12345671')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(yuchoBranchName(r.branchCode), '一九八')
})
