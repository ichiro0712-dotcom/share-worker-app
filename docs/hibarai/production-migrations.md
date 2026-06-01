# 日払い機能 本番(production)適用 SQL 一覧

> 作成日: 2026-05-28
> 対象: 本番DB(`ryvyuxomiqcgkspmpltk` / tastas.work)への日払い機能 migration 適用手順
> ⚠️ **適用はユーザーが手動で実施**（CLAUDE.md 規約。Claude Codeは本番DBを操作しない）

## 前提・注意

- 本番DBには日払い関連テーブルが**まだ一切無い想定**（feature/hibarai-mvp が main 未マージのため）。
  → 下記4件を**順番通り**に適用する必要がある。
- 適用前に本番の現状を確認すること（既に一部適用済みなら重複適用しない）:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('point_balances','point_ledger_entries','withdrawal_requests','transfer_attempts');
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'withdrawal_requests'
    AND column_name IN ('settlement_month','bank_snapshot');
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'point_ledger_entries' AND column_name = 'rate_basis_points';
  ```
- 適用タイミング: **develop→main マージ（本番デプロイ）の直前**に実施。
- feature flag `NEXT_PUBLIC_FEATURE_HIBARAI` は本番では OFF のまま（公開時に別途ON）。

## 適用順序

| # | migration | 内容 | 本SQL |
|---|---|---|---|
| 1 | `20260528101444_hibarai_gmo_models` | 日払い基盤（全テーブル・enum・部分unique・CHECK） | リポジトリのファイル参照（下記4-1） |
| 2 | `20260528153000_add_settlement_month_to_withdrawal` | 出金に精算月 | 下記4-2 |
| 3 | `20260528170000_add_rate_basis_points_to_ledger` | ledgerに前払い率 | 下記4-3 |
| 4 | `20260528180000_add_bank_snapshot_to_withdrawal` | 出金に口座snapshot | 下記4-4 |

---

## 4-1. 基盤（最初に必ず適用）

372行あり大きいため、リポジトリの以下ファイルの内容を**そのまま**実行する:

```
prisma/migrations/20260528101444_hibarai_gmo_models/migration.sql
```

作成物（概要）: enum 6種、テーブル 9種（point_balances, point_ledger_entries,
advance_payment_policies, withdrawal_requests, transfer_attempts, gmo_oauth_tokens,
gmo_webhook_events, hibarai_audit_logs, emergency_stop_states）、bank_accounts への列追加、
各種 index・FK、部分unique（1勤怠1チャージ）、CHECK（緊急停止シングルトン / rate 0〜10000）。

## 4-2. settlement_month

```sql
ALTER TABLE "withdrawal_requests" ADD COLUMN "settlement_month" DATE;

UPDATE "withdrawal_requests"
SET "settlement_month" = date_trunc('month', "requested_at" + interval '9 hours')::date
WHERE "settlement_month" IS NULL;

ALTER TABLE "withdrawal_requests" ALTER COLUMN "settlement_month" SET NOT NULL;

CREATE INDEX "withdrawal_requests_settlement_month_worker_id_idx"
  ON "withdrawal_requests"("settlement_month", "worker_id");
```

## 4-3. rate_basis_points

```sql
ALTER TABLE "point_ledger_entries" ADD COLUMN "rate_basis_points" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM point_ledger_entries
    WHERE kind = 'ATTENDANCE_CONFIRMED' AND rate_basis_points IS NULL
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_CONFIRMED rows without rate_basis_points exist; backfill required before applying this migration';
  END IF;
END $$;
```

## 4-4. bank_snapshot

```sql
ALTER TABLE "withdrawal_requests" ADD COLUMN "bank_snapshot" JSONB;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE bank_snapshot IS NULL) THEN
    RAISE EXCEPTION 'withdrawal_requests without bank_snapshot exist; backfill required before NOT NULL';
  END IF;
END $$;

ALTER TABLE "withdrawal_requests" ALTER COLUMN "bank_snapshot" SET NOT NULL;
```

---

## 適用後チェック

```sql
-- 列が追加されたか
SELECT column_name FROM information_schema.columns
WHERE table_name = 'withdrawal_requests' AND column_name IN ('settlement_month','bank_snapshot');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'point_ledger_entries' AND column_name = 'rate_basis_points';
```

- 本番デプロイ後、Prisma Client は再生成される（ビルド時 `prisma generate`）。
- 環境変数の追加は不要（今回の P0 では env 変更なし）。
