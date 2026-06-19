// ゆうちょ銀行(銀行コード 9900)の「記号・番号」→ 全銀フォーマット「店番・口座番号」変換。
//
// ■なぜ必要か
//   ゆうちょ口座は通帳に「記号(5桁)・番号(最大8桁)」で印字され、利用者はこれしか知らない。
//   一方、他行(GMOあおぞら経由の日払い送金=全銀)へ振り込むには「店番(3桁)・預金種目・口座番号(7桁)」が要る。
//   そのため入力された記号・番号を全銀形式へ変換する。記号・番号の"原本"は別途保持し、本関数は派生値を作る。
//
// ■変換ルールの出典（公式は計算式を伏せ変換ツールへ誘導するため、実務標準を採用）
//   - SmartHR ヘルプ（給与振込の実務標準）:
//       店番 = 記号の左から2〜3桁目 + "8" / 口座番号 = 番号の最後の1桁を除く(7桁未満は左ゼロ埋め)
//       https://support.smarthr.jp/ja/help/articles/360026107394/
//   - ゆうちょ公式（口座種別と桁数のパターン。記号"1"始まり=通常貯金 / "0"始まり=振替口座）:
//       https://www.jp-bank.japanpost.jp/kojin/sokin/koza/kj_sk_kz_furikomi_ksk.html
//
// ■方針（Phase1）
//   money が動くため、確実に対応できる「通常貯金(記号1始まり)」のみ変換する。
//   「振替口座(記号0始まり=当座)」は個人の給与/日払い受取口座ではまず使われず、変換ルールの確証も弱いので
//   明示エラーで弾く。呼び出し側は ok:false を UI バリデーションとして表示すること。
//   さらに上位UIで「計算結果(店番・口座番号)を通帳の"振込用のご案内"と照合する本人確認」を必須にし、
//   万一の変換ズレを人手で捕捉する(多層防御)。

export const YUCHO_BANK_CODE = '9900'

export function isYuchoBankCode(bankCode: string | null | undefined): boolean {
  return bankCode === YUCHO_BANK_CODE
}

export type YuchoConversionResult =
  | {
      ok: true
      /** 全銀の店番(3桁) */
      branchCode: string
      /** 預金種目。Phase1は通常貯金=普通のみ。 */
      accountType: 'ORDINARY'
      /** 全銀の口座番号(7桁・ゼロ埋め) */
      accountNumber: string
    }
  | { ok: false; error: string }

/** 全角数字→半角、空白・ハイフン除去。 */
function normalizeDigits(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-‐－―ー]/g, '')
    .trim()
}

/**
 * ゆうちょ 記号・番号 → 全銀 店番・口座番号。
 * 不正入力/未対応(振替口座)は ok:false（UIバリデーション用の日本語エラー）。
 */
export function convertYuchoToZengin(symbolRaw: string, numberRaw: string): YuchoConversionResult {
  const symbol = normalizeDigits(symbolRaw ?? '')
  const number = normalizeDigits(numberRaw ?? '')

  if (!/^\d{5}$/.test(symbol)) {
    return { ok: false, error: '記号は5桁の数字で入力してください' }
  }
  // 番号は最後の1桁を除いて口座番号にするため、最低2桁必要。
  if (!/^\d{2,8}$/.test(number)) {
    return { ok: false, error: '番号は2〜8桁の数字で入力してください' }
  }

  const kind = symbol[0]
  if (kind === '0') {
    // 振替口座(当座)。Phase1未対応。
    return { ok: false, error: '振替口座(記号が0で始まる口座)には現在対応していません。通常貯金の口座をご利用ください' }
  }
  if (kind !== '1') {
    return { ok: false, error: '記号の形式が不正です（通常貯金の記号は1で始まります）' }
  }

  // 通常貯金（ゆうちょ公式の変換ルール）
  // 店番(3桁) = 記号の2〜3桁目 + "8"   例: 記号11940 → "19"+"8" = "198"
  const branchCode = symbol.slice(1, 3) + '8'
  // 口座番号 = 番号の「桁数にかかわらず最後の1桁を除く」。7桁になるよう先頭ゼロ埋め。
  //   例: 番号12345671 → "1234567" / 番号1234561 → "0123456"
  const accountNumber = number.slice(0, -1).padStart(7, '0')

  return { ok: true, branchCode, accountType: 'ORDINARY', accountNumber }
}

/** 全銀店番(3桁数字)を漢数字に変換するための対応表。 */
const KANJI_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

/**
 * ゆうちょの店番(3桁)→支店名。
 * ゆうちょの「支店名」は店番を漢数字読みにしたもの（公式表記）。
 *   例: 店番 "198" → "一九八" / "008" → "〇〇八"
 * ゆうちょは画面で支店名を入力させない（記号から店番を導出する）ため、
 * プロフィール完了判定や帳票表示で使う支店名はこの関数で導出する。
 * 数字以外が混ざった想定外入力はその文字をそのまま残す（防御的）。
 */
export function yuchoBranchName(branchCode: string): string {
  return branchCode
    .split('')
    .map((d) => {
      const n = Number(d)
      return d >= '0' && d <= '9' ? KANJI_DIGITS[n] : d
    })
    .join('')
}
