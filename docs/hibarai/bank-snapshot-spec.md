# 日払い 振込先口座スナップショット仕様 (P0-3)

> 作成日: 2026-05-28
> 対象: 出金申請時の振込先口座凍結と、GMO送信前の口座再検査
> ステータス: 実装済（P0-3、TDDで実装）
> 関連: [settlement-month-spec.md](./settlement-month-spec.md), [double-charge-prevention.md](./double-charge-prevention.md)

## 1. 背景・脅威

従来 `withdrawal_requests` は `bank_account_id` のみを持ち、GMO送信時に**現在の** `BankAccount` を読んでいた。
口座変更後の cooldown も申請時しか確認していなかった。

→ PENDING/PROCESSING 中に第三者（または本人）が口座を変更すると、**申請時と異なる口座へ送金**され得る。
攻撃者による送金先すり替えのリスク。

## 2. 対策: 申請時の口座凍結 + 送信時の再検査

### 申請時（createWithdrawalRequest）
振込先口座の情報を `withdrawal_requests.bank_snapshot`(JSONB, NOT NULL) に凍結保存する。

```
bank_snapshot = {
  bankCode, branchCode, accountType, accountNumber,
  accountHolderName, accountHolderNameKana,
  lastChangedAt  // 申請時点の口座更新時刻(epoch ms) — 変更検知に使う
}
```

### 送信時（submitWithdrawalToGmo）
1. **初回送信(PENDING)のみ再検査**する。現在の口座を読み、以下のいずれかなら **GMOへ送らず revert（引当を戻し FAILED）**:
   - 口座が存在しない
   - `isVerified === false`（未認証）
   - cooldown 中（`cooldownUntil > now`）
   - **口座が変更された** — `lastChangedAt` に依存せず、**口座フィールド(bankCode/branchCode/accountType/accountNumber/名義/名義カナ)の直接比較**で検知する（lastChangedAt も補助的に比較）
2. **送金は snapshot からのみ組む**（現口座の値は使わない）。
3. **再送(応答不明後のPROCESSING)では再検査しない**。初回送信がGMOに到達済みの可能性があるため、
   同じ idempotency key で再送/照会して解決する（再検査でrevertすると二重送金・残高不整合になる）。

→ 申請後に口座が変わった場合、初回送信時に **新旧どちらの口座にも送らず安全側で中止**する。
本人が正当に変更した場合も、再申請を促す（誤送金より中止が安全）。

### revertReservation の安全ガード
`revertReservation` は `gmo_apply_no != null`（GMO受理済み）の行は戻さない。
失敗確定は poll cron 経由でのみ行う（送金成立済みの取り違え返金を防ぐ）。

### 送信前ローカル失敗の扱い（初回 vs 再送）
snapshot parse 失敗・token取得失敗・payload検証失敗などGMO呼び出し前のローカル失敗時:
- **初回送信(isFirstSend)**: 返金(`revertReservation`)してよい（まだ何も送っていない）。
- **再送(PROCESSING)**: 返金せず `markWithdrawalSubmitUnknown` で PROCESSING 維持し後続 retry/照会に回す。
  初回送信がGMOへ到達済みの可能性があるため、再送のローカル失敗で返金すると二重支払いになる。

GMO の**明示拒否(resultCode≠1)** は確定失敗なので返金してよい（GMOが受理していない）。

### 変更検知を lastChangedAt に依存しない理由
口座編集フロー(W3/W4)が未実装で `bank_accounts.lastChangedAt` を更新する経路が現状存在しない。
そのため `lastChangedAt` 比較だけでは検知が効かない。**フィールド直接比較を主**とし、送金先の実変更を確実に捕捉する。

## 3. なぜ「変更されたら中止」か（両口座に送らない）

- 攻撃者が口座をすり替えた場合 → 旧口座(snapshot)に送ると本人の旧口座、新口座に送ると攻撃者口座。**どちらも危険**。
- 口座変更は P0設計で cooldown を伴う想定なので、cooldown 検査でも捕捉される（多層防御）。
- 中止して再申請させるのが最も安全。

## 4. テスト（TDDで先行作成）

`lib/actions/hibarai/__tests__/withdrawal.test.ts`:
1. createWithdrawalRequest が snapshot を保存する
2. GMOペイロードは snapshot から組む（現口座が書き換わっても snapshot 優先）
3. 申請後に口座変更(lastChangedAt更新) → 送金せず revert
4. 送信時 cooldown → revert
5. 送信時 unverified → revert

## 5. 実装ファイル（P0-3）

| ファイル | 変更 |
|---|---|
| `prisma/schema.prisma` | `WithdrawalRequest.bank_snapshot Json` 追加 |
| `prisma/migrations/20260528180000_add_bank_snapshot_to_withdrawal/migration.sql` | JSONB列追加→NOT NULL化 |
| `lib/actions/hibarai/withdrawal.ts` | createWithdrawalRequest で snapshot 保存、submitWithdrawalToGmo で再検査＋snapshotから送金、buildTransferRequestPayload は snapshot 受け取り、parseBankSnapshot 追加 |
| `lib/actions/hibarai/__tests__/withdrawal.test.ts` | snapshot 5テスト + モックに口座状態追加 |

## 6. 既知の限界 / フォローアップ（重要）

### 口座編集フロー(W3/W4)実装時の必須要件
現状 `bank_accounts` に書き込む口座登録/編集の Server Action が存在しない（レガシーは `User.bank_code/account_number`）。
口座編集フローを実装する際は、本機能の安全性のため**以下を必須**とする:

1. 振込先フィールド変更時に `lastChangedAt = now()` を設定（補助的な変更検知キー）。
2. 変更時に `isVerified = false` にし、再認証(SMS/メールOTP)を要求。必要なら `cooldownUntil` を設定。
3. **active な PENDING/PROCESSING の出金がある間は口座変更を拒否/保留する**。
   これにより「再検査〜GMO送信」間の TOCTOU（送信直前の変更）を源流で塞ぐ。

→ これらが未実装の間、フィールド直接比較で大半の変更は捕捉できるが、
   送信処理中のごく短い TOCTOU 窓は残る。口座編集フロー側のブロックで完全に塞ぐこと。

### 口座番号の暗号化
snapshot は現状 `accountNumber` を平文で保持する（bank_accounts と同様）。
口座番号の暗号化（`encrypted_account_number`）はGMO接続層の別タスク。暗号化導入時は snapshot も暗号化版に切替える。

### 【P0-4で修正済】resultCode=2 を返金扱いにしている（二重支払いリスク）
→ 解消済み。詳細は [gmo-submit-recovery-spec.md](./gmo-submit-recovery-spec.md) を参照。以下は経緯。

`submitWithdrawalToGmo` の `if (result.resultCode !== '1') revertReservation(...)` は誤り。
`gmo-api-research.md:116` の通り振込依頼レスポンスの `resultCode` は **1:完了 / 2:未完了** で、
`2` は applyNo が採番された「未完了」状態（`/transfer/status` で 20:手続済 等に遷移し得る）。
現状は GMO に生きた振込依頼を残したままローカルだけ返金するため、後で処理されると二重支払いになる。
- 正しい扱い: resultCode=2 は applyNo を保存し PROCESSING 維持 → poll cron が transferStatus で確定。
- 返金は poll で 22:資金返却 / 25:組戻済 / 40:手続不成立 等の**確定失敗**を検知してから行う。
- 既存テスト「GMOの明示的拒否は引当を戻す」(resultCode=2→revert) は現挙動を固定しているため、P0-4で修正する。
- 現状 feature flag OFF + GMO dummy のため実害なし。P0-4（GMO送信/不明復旧/transfer_attempts/request-result照会）でまとめて対応。
