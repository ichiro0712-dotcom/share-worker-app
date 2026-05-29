// GMO送金元の残高が不足しているとき、submit cron が空振りリクエストを投げないための資金ゲート（純粋）。
// 残高で送れる依頼だけを選び、送れないものは「未送金のまま据え置き」にして次回cronで再評価する。
// （失敗(FAILED)にはしない＝入金されれば自動で流れる運用を維持）

export type SubmitCandidate = { id: string; transferAmount: number }

/**
 * 送金元の引き出し可能残高(availableFunds)で送れる依頼を「申請順(FIFO)」に選ぶ（純粋関数）。
 * - availableFunds が null のときは資金ゲートしない（GMO未接続/dummy等）→ 全件送信対象。
 * - **厳格FIFO**: 先頭(最古)から積み、賄えない依頼に当たったら、それ以降は全てスキップする。
 *   後続の小額依頼が古い依頼を追い越さない＝古い依頼が永遠に後回しにされる飢餓(starvation)を防ぐ。
 *   入金されれば次回cronで先頭から順に流れる。
 *   （単一スナップショットでの best-effort。実残高超過分はGMO側でも弾かれPROCESSING維持されるため二重送金にはならない）
 */
export function planFundedSubmissions(
  candidates: SubmitCandidate[],
  availableFunds: number | null,
): { submit: string[]; skipped: string[] } {
  if (availableFunds == null) {
    return { submit: candidates.map((c) => c.id), skipped: [] }
  }
  const submit: string[] = []
  const skipped: string[] = []
  let remaining = availableFunds
  let blocked = false
  for (const c of candidates) {
    if (!blocked && c.transferAmount <= remaining) {
      submit.push(c.id)
      remaining -= c.transferAmount
    } else {
      // 先頭側で賄えない依頼が出たら、以降は追い越させず全てスキップ（FIFO・飢餓防止）。
      blocked = true
      skipped.push(c.id)
    }
  }
  return { submit, skipped }
}
