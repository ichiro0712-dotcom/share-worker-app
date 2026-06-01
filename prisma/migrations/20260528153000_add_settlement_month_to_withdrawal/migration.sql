-- 出金申請に精算月(settlement_month)を追加する。
-- 申請時に開いている精算月(JST)を刻み、失敗・組戻しでも変えない。
-- 月末スイープ・給与控除の集計キーとして使う。
-- 参照: docs/hibarai/settlement-month-spec.md

-- AlterTable: まず nullable で追加（既存行があっても安全な定石）
ALTER TABLE "withdrawal_requests" ADD COLUMN "settlement_month" DATE;

-- Backfill: 万一の既存行は requested_at の JST 月初で埋める（現状どの環境も0件想定）
-- requested_at は UTC の timestamp without time zone なので、JST(=UTC+9)へは +9 hours で変換してから月初を取る。
-- ("requested_at" AT TIME ZONE 'Asia/Tokyo' は「JSTローカルとして解釈」する逆方向の式なので使わない)
UPDATE "withdrawal_requests"
SET "settlement_month" = date_trunc('month', "requested_at" + interval '9 hours')::date
WHERE "settlement_month" IS NULL;

-- NOT NULL 化
ALTER TABLE "withdrawal_requests" ALTER COLUMN "settlement_month" SET NOT NULL;

-- CreateIndex: 月末スイープ・給与控除の集計用
CREATE INDEX "withdrawal_requests_settlement_month_worker_id_idx"
  ON "withdrawal_requests"("settlement_month", "worker_id");
