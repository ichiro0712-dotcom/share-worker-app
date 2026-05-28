# 日払い 精算月(settlement_month) 仕様

> 作成日: 2026-05-28
> 対象: 日払い機能の出金・チャージの精算月帰属ロジック
> ステータス: 実装済（P0-1）。月末スイープ本体は未実装（Step 2）。
> 関連: [double-charge-prevention.md](./double-charge-prevention.md), [screen-spec-draft.md](./screen-spec-draft.md)

## 1. 背景

日払いは「月末23:59締め → 1日に当月残額＋1割プールを給与口座へ振替 → 15日支払」という月次サイクルで動く。
そのため、各チャージ・各出金が**どの精算月に属するか**を明示しないと、月末スイープと給与控除の相殺ができない。

当初の実装では出金側に精算月の記録がなく、`point_balances.balance` の単一合算値だけで管理していた。
これだと「5月分の残り（チャージ−出金）」を復元できないため、settlement_month を出金にも刻む方式へ修正した。

## 2. 採用方針: 精算月バケット方式

per-attendance の配賦テーブルは作らない。理由:
- 月末スイープも給与控除も**月単位**である
- 月境界で前月分は一掃されるため、出金が複数月をまたがない（当月プールからのみ引く）
- 出金は「特定勤怠」ではなく「その月のプール」から引く実態に合う

→ **精算月の粒度**で十分。per-attendance 配賦は実態に合わない人工的な紐付けになるため不採用。

## 3. settlement_month の定義（確定ルール）

| 対象 | settlement_month の決め方 |
|---|---|
| チャージ (`ATTENDANCE_CONFIRMED`) | 勤務日(`actual_start_time ?? check_in_time`)が属する **JST月の月初** |
| 出金 (`WITHDRAWAL_RESERVED` / `_COMPLETED` / `_REVERTED`) | **申請時刻(JST)** に開いている精算月の月初 |

### 確定事項: 失敗・組戻しでも精算月は変えない

- 5/31 23:59 申請 → 6/1 GMO処理 → 失敗/組戻し の場合でも **settlement_month は5月のまま**。
- `requested_at` の JST 月 = settlement_month（常に固定）。`completed_at` / `failed_at` では決めない。

> ⚠️ この帰属ルールは経理・報酬チームの最終確認が必要（screen-spec-draft.md:1476 の P0 未確定事項）。
> 暫定的に上記で実装している。

## 4. JST と `@db.Date` の扱い（重要な落とし穴）

`@db.Date` は UTC のカレンダー日付として保存される。
`getJSTMonthStart()` は「JST深夜0時の瞬間」を表す Date を返すため、その UTC 日付は**前月末日**になり @db.Date には使えない。

→ 精算月は `getJSTSettlementMonthStart()` / `toJSTSettlementMonthStart(date)`（`lib/actions/hibarai/utils.ts`）で
`Date.UTC(jstYear, jstMonth, 1)`（時差補正なし）として組み立てる。

**チャージ側と出金側で必ず同じヘルパーを使い、精算月の定義を統一する**こと。
（旧 `review-trigger.ts` は `new Date(workDate.getFullYear(), workDate.getMonth(), 1)` を使っており、
Vercel(UTC)稼働下で JST深夜帯の勤務が前月扱いになる月跨ぎバグがあった。本対応で修正済み。）

## 5. データモデル

| 場所 | 列 | 備考 |
|---|---|---|
| `withdrawal_requests.settlement_month` (`DATE NOT NULL`) | 管理画面の履歴/CSV(A5)・月末スイープの集計キー。インデックス `(settlement_month, worker_id)` | 本対応で追加 |
| `point_ledger_entries.settlement_month` (`DATE`) | 残高計算・スイープの相殺に使う。全 ledger 種別で同月を伝播 | 既存列を活用 |

`withdrawal_requests` と `point_ledger_entries` の両方に持たせる（同一トランザクションで書くため乖離しない）。
- 出金エンティティを直接クエリする管理画面のために `withdrawal_requests` に
- 残高計算のために ledger に

### 非正規化の判断

「失敗しても5月扱い = requested_at の JST 月」なので settlement_month は requested_at から導出も可能だが、
金融・監査データは明示保存が安全であること、インデックス付き集計が必要なこと、将来ルール変更時に
歴史を固定できることから、**明示保存**を採用した。

## 6. 残高表示

`balance.ts` の「給与日に入る金額(scheduledPaymentAmount)」は**当月精算分のみ**を集計する
（`settlement_month = getJSTSettlementMonthStart(now)`）。
前月以前は月末スイープで給与口座へ振替済みの想定。
（修正前は全月合算で、前月以降の 1割プールが累積し続けるバグがあった。）

## 7. スコープ外（Step 2 で実装）

- **月末スイープ job 本体**: 月末に settlement_month ごとに「残り(チャージ−出金)＋1割プール」を集計し、
  `PAYMENT_DEDUCTION` を生成して給与システムへ控除データを渡す。
- スイープ実行タイミングの注意: 5/31 23:59 申請が 6/1 に失敗して返却されると ¥X が **5月タグのまま** balance に戻るため、
  スイープは「当月の処理中(reserved/processing)出金が全部決着してから」実行する必要がある。

## 8. 実装ファイル（P0-1）

| ファイル | 変更 |
|---|---|
| `prisma/schema.prisma` | `WithdrawalRequest.settlement_month` 追加 + `@@index([settlement_month, worker_id])` |
| `prisma/migrations/20260528153000_add_settlement_month_to_withdrawal/migration.sql` | nullable追加→backfill→NOT NULL化→index |
| `lib/actions/hibarai/utils.ts` | `getJSTSettlementMonthStart()` / `toJSTSettlementMonthStart()` 追加 |
| `lib/actions/hibarai/withdrawal.ts` | 申請時に精算月算出、RESERVED/COMPLETED/REVERTED ledger と withdrawal_requests に伝播 |
| `lib/actions/hibarai/review-trigger.ts` | settlement_month を新ヘルパーに切替（月跨ぎバグ修正＋出金側と統一） |
| `lib/actions/hibarai/balance.ts` | scheduledPaymentAmount を当月精算分に限定 |
| `app/api/cron/hibarai-poll-transfer-status/route.ts` | poll cron の COMPLETED/REVERTED ledger にも settlement_month を伝播（SELECT + PollWithdrawalRow + ledger create） |
| `lib/actions/hibarai/__tests__/utils.test.ts` | getJSTSettlementMonthStart の月境界テスト追加 |
| `lib/actions/hibarai/__tests__/withdrawal.test.ts` | モックの $queryRaw を「SELECTした列だけ返す」方式にして列漏れを検出可能に + RESERVED/REVERTED の精算月一致を検証 |

### 既知の技術的負債（フォローアップ）

- **出金完了/失敗処理が2箇所に重複**: `lib/actions/hibarai/withdrawal.ts`（markWithdrawalCompleted / revertReservation）と
  `app/api/cron/hibarai-poll-transfer-status/route.ts`（completeWithdrawalInTransaction / revertWithdrawalInTransaction）が
  ほぼ同一ロジックを持つ。本番の主経路は poll cron。今回 settlement_month は両方に入れたが、
  将来は共通関数へ一本化すべき（列追加のたびに2箇所直す必要があり、今回の Critical 見落としの温床）。
- **poll cron にユニットテストが無い**: 本番の完了/失敗確定の主経路だが現状テスト未整備。settlement_month 含め回帰検出ができない。
