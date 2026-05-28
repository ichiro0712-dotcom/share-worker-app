# 日払い GMO送信・不明復旧・試行記録 仕様 (P0-4)

> 作成日: 2026-05-28
> 対象: GMO振込依頼の送信、resultCode処理、応答不明時の復旧、試行記録(transfer_attempts)
> ステータス: 実装済（P0-4、TDD）
> 関連: [bank-snapshot-spec.md](./bank-snapshot-spec.md), [gmo-api-research.md](./gmo-api-research.md), [double-charge-prevention.md](./double-charge-prevention.md)

## 1. resultCode=2 を返金扱いにしない（二重支払い修正）

`gmo-api-research.md:116` の通り、振込依頼レスポンスの `resultCode` は **1:完了 / 2:未完了**。
`applyNo` は 16桁必須で、1/2 いずれも **GMOに受理され applyNo が採番された状態**。

- 旧実装は `resultCode !== '1'` で `revertReservation`（返金）していた。
  → GMOに生きた振込依頼を残したままローカルだけ返金 → 後で処理されると**二重支払い**。
- 新実装: **resultCode 1 も 2 も accept**。applyNo を保存し `PROCESSING` 維持。
  最終確定は poll cron の `transferStatus`（20:手続済 / 22:資金返却 / 25:組戻済 / 40:手続不成立 …）に委ねる。
- スキーマ上 `resultCode` は `['1','2']`、`applyNo` は `/^\d{16}$/` 必須なので、
  「拒否を表す resultCode」は存在しない。真の拒否は HTTP エラーとして現れ、それは下記「不明扱い(hold)」になる。

## 2. 送信失敗時は返金せず hold（unknown）

GMO呼び出しが throw（timeout/5xx/4xx等）した場合、GMOへ到達したか不明なため
**返金せず `markWithdrawalSubmitUnknown` で PROCESSING 維持**し、再送/照会で解決する。
（4xxの確定拒否でも、安全側で hold。ops/poll で解決する。）

## 3. 試行記録（transfer_attempts）

GMO `requestTransfer` の各試行を `transfer_attempts` に append-only 記録する（成功・失敗とも）。
- `attempt_no` = 既存最大 + 1。`@@unique(withdrawal_request_id, attempt_no)`。
- 記録内容: method/url/headers/body, response_status_code, response_body, gmo_apply_no, error_code, duration_ms。
- **⚠ Bearerトークンは記録しない**（headersは Idempotency-Key のみ）。request_body は送信内容（口座番号含む）で**内部フォレンジック専用**。
- 記録失敗は本処理を止めない（idempotency-key 再送がGMO側重複防止の最終的な砦）。

## 4. 不明復旧（二重送金防止）

再送(submit)前に `transfer_attempts` を確認し、**過去試行に applyNo があれば再送せずそれを回収**する
（`saveGmoApplyNo` で applyNo 保存 + PROCESSING、poll に委ねる）。

これは「初回送信がGMOへ到達し applyNo を得たが、DB保存に失敗して applyNo を取りこぼした」ケースの救済。
過去試行に applyNo が無ければ、同じ idempotency-key で再送する（GMO側が重複排除）。

## 5. 送信前/送信後の失敗ハンドリング整理

| 段階 | 失敗 | 初回(isFirstSend) | 再送 |
|---|---|---|---|
| snapshot parse / token / payload | ローカル失敗 | 返金(revert) | hold(markUnknown) |
| GMO呼び出し throw | 到達不明 | hold(markUnknown) | hold(markUnknown) |
| GMO応答(1/2) | 受理 | applyNo保存・PROCESSING | applyNo保存・PROCESSING |
| applyNo保存tx失敗 | DB失敗 | hold(markUnknown)・試行記録にapplyNo残る→次回復旧 | 同左 |

## 6. 実装ファイル（P0-4）

| ファイル | 変更 |
|---|---|
| `lib/actions/hibarai/withdrawal.ts` | resultCode 1/2 accept、`saveGmoApplyNo`/`recordTransferAttempt` 追加、不明復旧(過去applyNo回収)、GmoApiError import |
| `lib/actions/hibarai/__tests__/withdrawal.test.ts` | resultCode=2 / 試行記録(成功・失敗) / 不明復旧 の4テスト追加、誤前提の旧「明示的拒否」テスト削除、モックに transferAttempt 追加 |

## 6.1 堅牢化（Codexレビュー反映）

- `markWithdrawalSubmitUnknown` は終端状態(COMPLETED/FAILED/CANCELLED/REFUNDED)を `PROCESSING` へ巻き戻さない
  （長時間/手動実行で後続が確定させた後の古いsubmitによる状態退行を防ぐ）。
- `saveGmoApplyNo` は既存applyNoと同一なら冪等no-op、**別applyNoは異常**として
  `WITHDRAWAL_APPLY_NO_CONFLICT` 監査(WARNING)を残し上書きしない。

## 7. スコープ外 / フォローアップ

- `getTransferRequestResult`(applyNo指定の結果照会) はクライアントに実装済みだが、
  applyNo 未取得の不明状態では使えないため、本対応では未使用。applyNo がある状態の照会は poll cron の `getTransferStatus` が担う。
- transfer_attempts の記録は submit レベルの代表値（endpoint/payload/結果）。
  クライアントが送る生のHTTPヘッダ完全再現はしていない（トークン秘匿のためむしろ望ましい）。
- migration 不要（transfer_attempts は既存テーブル、20260528101444 で作成済み）。
