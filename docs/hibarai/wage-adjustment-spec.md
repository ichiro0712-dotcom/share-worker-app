# 日払い 勤怠修正後の過払い調整仕様 (P0-2)

> 作成日: 2026-05-28
> 対象: チャージ済み勤怠の wage 変更時の残高調整、および初回チャージ条件の統一
> ステータス: 実装済（P0-2）
> 関連: [settlement-month-spec.md](./settlement-month-spec.md), [double-charge-prevention.md](./double-charge-prevention.md)

## 1. 背景

従来のチャージは `chargePointsOnReviewSubmitted` がレビュー提出時に `calculated_wage` を一度読むだけで、
その後に施設の修正申請承認やシステム管理者編集で wage が変わっても日払い ledger に反映されなかった。
→ チャージ済みの勤怠が後から減額/増額されると **残高がズレる**（過払い・過少）。

また `MODIFICATION_REQUIRED` 退勤（wage=NULL）でレビューが承認より先だと、
チャージ条件を満たさず、承認後も再発火しないため **一生チャージされない** 既存ギャップもあった。

## 2. 採用設計: 冪等な統一 reconcile 関数

「チャージ」と「調整」を別物にせず、`reconcileHibaraiChargeInTx(tx, attendanceId, actor)` 1本にまとめた。

### 前提条件（すべて満たすとチャージ対象）
- `attendance.status === 'CHECKED_OUT'`
- `calculated_wage > 0`
- ワーカーレビュー提出済（`application.worker_review_status === 'COMPLETED'`）
- PENDING/RESUBMITTED な修正申請が**ない**

### 動作
| 状態 | 動作 |
|---|---|
| 前提未達 | 何もしない（未チャージは据え置き、チャージ済も据え置き。新規修正申請は承認時に再reconcile） |
| 前提達成 & 未チャージ | `ATTENDANCE_CONFIRMED` を作成（初回チャージ）。`rate_basis_points` を保存 |
| 前提達成 & チャージ済 | 差額を `MANUAL_ADJUSTMENT` で記録 |

### 差分(delta)ベースで冪等
調整は「目標 advanceable − この勤怠の現在実効 advanceable」を計算する。
- 目標 = `floor(現wage × rate / 10000)`（rate は**原チャージ時に保存した率**を使用）
- 現在実効 = `SUM(delta)` of この勤怠の `ATTENDANCE_CONFIRMED` + `MANUAL_ADJUSTMENT(source_type=AttendanceWageAdjustment)`
  （他用途の MANUAL_ADJUSTMENT を巻き込まないよう source_type で絞る）
- delta=0 なら何もしない → 何度呼んでも収束する（per-edit の冪等キー不要）

balance 行を `FOR UPDATE` でロックして同一ワーカーの並行 reconcile を直列化する。

### 精算月(settlement_month)は初回チャージで固定
調整は**原チャージの settlement_month を引き継ぐ**（現 work_date から再計算しない）。
勤務日が後から月跨ぎ修正されても、その勤怠の全 ledger は同一月に留まる。
これにより月バケットの分裂（旧月に元額・新月に差分が分かれる）を防ぐ。
勤怠の精算サイクルは初回チャージ時に確定する、という [settlement-month-spec](./settlement-month-spec.md) の哲学と一致。

### rate が無い既存チャージは失敗させる
`rate_basis_points` が null の `ATTENDANCE_CONFIRMED`（migration 前の異常データ）に対しては、
誤った率(9000)で残高を動かさず**明示的に例外を投げる**。
migration 側にも「null rate の confirmed があれば失敗」ガードを入れてある（未公開のため通常0件）。

### work_date は JST date-only
`work_date`(@db.Date) は `toJSTDateOnly()` で JST カレンダー日付として保存する
（生 timestamp をそのまま入れると JST 深夜帯で UTC 前日になる罠を回避）。

## 3. rate を保存する理由

`point_ledger_entries.rate_basis_points` を追加し、チャージ時の率を保存する。
調整時にこの率を使うことで、チャージ〜編集の間に policy 率が変わっても（例: 9割→社保対象7割）、
**同一勤怠は常に原チャージの率**で計算され一貫する。floor 除算のため率の逆算は不正確なので保存が必要。

## 4. 金額フィールドの意味（kind別）

| kind | delta | advanceable_amount | scheduled_payment_amount |
|---|---|---|---|
| ATTENDANCE_CONFIRMED | 絶対値（=advanceable） | 絶対値 | 絶対値 |
| MANUAL_ADJUSTMENT (wage調整, source_type=AttendanceWageAdjustment) | **差分** | **差分** | **差分** |

gross_reward_amount も調整entryでは差分（`現gross − この勤怠の現在実効gross`）。SUMで現在の絶対gross値に一致する。

`SUM` すると現在値に一致する（絶対 + 差分群 = 現在の絶対）。
`balance.ts` の「給与日に入る金額」は `ATTENDANCE_CONFIRMED + MANUAL_ADJUSTMENT` の
`scheduled_payment_amount` を当月分で合算する（非勤怠の調整は null なので影響なし）。

## 5. total_charged / total_withdrawn の扱い

調整は `balance` のみ更新し、`total_charged`/`total_withdrawn` は触らない。
これは `recomputeBalance`（balance.ts）が `total_charged = SUM(delta WHERE kind=ATTENDANCE_CONFIRMED)` と
定義しているため。両者を一致させ、recompute してもズレないようにする。
（`balance` は `SUM(全delta)` なので調整を含み、常に正しい。）

## 6. 負残高

wage が既出金額を下回ると balance が負になり得るが**許容**。
新規出金は `withdrawal.ts` の `NegativeBalanceError` で停止済み。
次回確定報酬での相殺、または管理者の手動調整で解消する（double-charge-prevention.md E1）。

## 7. 呼び出し箇所

| トリガー | 場所 | actor |
|---|---|---|
| レビュー提出 | `review-worker.ts:143` → `chargePointsOnReviewSubmitted`（独自tx） | WORKER |
| 施設の修正申請承認 | `attendance-admin.ts` 承認tx内 → `reconcileHibaraiChargeInTx` | WORKER (worker起因の変更) |
| システム管理者編集 | `attendance-system-admin.ts` 編集tx内 → `reconcileHibaraiChargeInTx` | SYSTEM_ADMIN |

admin 経路は**同一トランザクション内**で呼ぶ（原子性: wage更新と日払い調整が同時にコミット/ロールバック）。
feature flag OFF 時は `isHibaraiEnabled()` で即 return するため、本番未公開中は完全な no-op。

## 8. 既知の限界 / フォローアップ

- SA 編集で status を `CHECKED_IN` に戻した場合（チャージ済）、前提未達となり調整されず**チャージは据え置き**。
  退勤取消後のクローバックは未対応（稀なケース。必要なら別途）。
- 勤怠の「取消」は Application レベルで起き、Attendance は CHECKED_IN/CHECKED_OUT のみ。
  Application 取消時の日払いクローバックは本 PR のスコープ外。

## 9. 実装ファイル（P0-2）

| ファイル | 変更 |
|---|---|
| `prisma/schema.prisma` | `PointLedgerEntry.rate_basis_points` 追加 |
| `prisma/migrations/20260528170000_add_rate_basis_points_to_ledger/migration.sql` | nullable列追加 |
| `lib/actions/hibarai/review-trigger.ts` | `reconcileHibaraiChargeInTx` / `reconcileHibaraiCharge` に再構成、`chargePointsOnReviewSubmitted` は互換ラッパー |
| `src/lib/actions/attendance-admin.ts` | 修正申請承認tx内で reconcile 呼び出し |
| `src/lib/actions/attendance-system-admin.ts` | SA編集tx内で reconcile 呼び出し |
| `lib/actions/hibarai/balance.ts` | scheduled_payment 集計に MANUAL_ADJUSTMENT を含める |
| `lib/actions/hibarai/__tests__/review-trigger.test.ts` | 初回チャージ/冪等/前提未達/増額/減額/rate固定の8テスト |
