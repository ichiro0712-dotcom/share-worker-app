-- CreateEnum
CREATE TYPE "point_ledger_kind" AS ENUM ('ATTENDANCE_CONFIRMED', 'WITHDRAWAL_RESERVED', 'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_REVERTED', 'MANUAL_ADJUSTMENT', 'PAYMENT_DEDUCTION');

-- CreateEnum
CREATE TYPE "withdrawal_status" AS ENUM ('DRAFT', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "advance_program" AS ENUM ('HIBARAI', 'LEGACY_CARRYBARAI', 'DISABLED');

-- CreateEnum
CREATE TYPE "gmo_token_account_type" AS ENUM ('CORPORATE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "hibarai_audit_actor_type" AS ENUM ('WORKER', 'SYSTEM_ADMIN', 'SYSTEM_CRON', 'GMO_WEBHOOK');

-- CreateEnum
CREATE TYPE "hibarai_audit_result" AS ENUM ('SUCCESS', 'ERROR', 'WARNING');

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "account_holder_name_kana" VARCHAR(48),
ADD COLUMN     "cooldown_until" TIMESTAMP(3),
ADD COLUMN     "encrypted_account_number" TEXT,
ADD COLUMN     "encryption_version" INTEGER,
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_changed_at" TIMESTAMP(3),
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "point_balances" (
    "id" TEXT NOT NULL,
    "worker_id" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "total_charged" INTEGER NOT NULL DEFAULT 0,
    "total_withdrawn" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger_entries" (
    "id" TEXT NOT NULL,
    "worker_id" INTEGER NOT NULL,
    "kind" "point_ledger_kind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "source_id" VARCHAR(100),
    "source_type" VARCHAR(50),
    "attendance_id" INTEGER,
    "application_id" INTEGER,
    "job_id" INTEGER,
    "work_date" DATE,
    "gross_reward_amount" INTEGER,
    "transportation_fee_amount" INTEGER,
    "advanceable_amount" INTEGER,
    "scheduled_payment_amount" INTEGER,
    "settlement_month" DATE,
    "scheduled_payment_date" DATE,
    "review_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_admin_id" INTEGER,

    CONSTRAINT "point_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payment_policies" (
    "id" TEXT NOT NULL,
    "worker_id" INTEGER NOT NULL,
    "rate_basis_points" INTEGER NOT NULL,
    "monthly_limit_amount" INTEGER,
    "daily_limit_amount" INTEGER,
    "per_request_limit_amount" INTEGER,
    "advance_program" "advance_program" NOT NULL DEFAULT 'HIBARAI',
    "carrybarai_reference_id" VARCHAR(100),
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_by_admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_by_id" TEXT,
    "active_slot" VARCHAR(16) DEFAULT 'active',

    CONSTRAINT "advance_payment_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "worker_id" INTEGER NOT NULL,
    "requested_amount" INTEGER NOT NULL,
    "fee_amount" INTEGER NOT NULL,
    "transfer_amount" INTEGER NOT NULL,
    "status" "withdrawal_status" NOT NULL DEFAULT 'DRAFT',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "gmo_apply_no" VARCHAR(16),
    "gmo_account_id" VARCHAR(64),
    "gmo_transfer_status_code" INTEGER,
    "gmo_transfer_status_name" VARCHAR(100),
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "client_ip" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_to_gmo_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "last_polled_at" TIMESTAMP(3),
    "next_poll_at" TIMESTAMP(3),
    "poll_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "gmo_refund_status" INTEGER,
    "gmo_is_repayment" BOOLEAN,
    "gmo_repayment_date" DATE,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_attempts" (
    "id" TEXT NOT NULL,
    "withdrawal_request_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(128),
    "request_method" VARCHAR(10) NOT NULL,
    "request_url" TEXT NOT NULL,
    "request_headers" JSONB NOT NULL,
    "request_body" JSONB NOT NULL,
    "response_status_code" INTEGER,
    "response_body" JSONB,
    "gmo_apply_no" VARCHAR(16),
    "gmo_status_code" INTEGER,
    "gmo_status_name" VARCHAR(100),
    "error_code" VARCHAR(100),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,

    CONSTRAINT "transfer_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmo_oauth_tokens" (
    "id" TEXT NOT NULL,
    "scope" VARCHAR(256) NOT NULL,
    "account_type" "gmo_token_account_type" NOT NULL DEFAULT 'CORPORATE',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_type" VARCHAR(20) NOT NULL DEFAULT 'Bearer',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "id_token" TEXT,
    "gmo_user_sub" VARCHAR(255),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmo_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmo_webhook_events" (
    "id" TEXT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "message_id" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_header" TEXT,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "virtual_account_id" VARCHAR(64),
    "deposit_amount" INTEGER,
    "remitter_name_kana" VARCHAR(100),

    CONSTRAINT "gmo_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hibarai_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" "hibarai_audit_actor_type" NOT NULL,
    "actor_id" VARCHAR(100),
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100),
    "target_id" VARCHAR(100),
    "tenant_scope" VARCHAR(100),
    "request_id" VARCHAR(100),
    "idempotency_key" VARCHAR(128),
    "payload" JSONB NOT NULL,
    "result" "hibarai_audit_result" NOT NULL,
    "error_code" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "chain_scope" VARCHAR(50) NOT NULL DEFAULT 'global',
    "chain_sequence" BIGINT NOT NULL,
    "hash_prev" VARCHAR(128),
    "hash_self" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hibarai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_stop_states" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "is_stopped" BOOLEAN NOT NULL DEFAULT false,
    "stopped_at" TIMESTAMP(3),
    "stopped_by_admin_id" INTEGER,
    "stopped_reason" TEXT,
    "released_at" TIMESTAMP(3),
    "released_by_admin_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_stop_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "point_balances_worker_id_key" ON "point_balances"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_ledger_entries_idempotency_key_key" ON "point_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "point_ledger_entries_worker_id_created_at_idx" ON "point_ledger_entries"("worker_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "point_ledger_entries_attendance_id_idx" ON "point_ledger_entries"("attendance_id");

-- CreateIndex
CREATE INDEX "point_ledger_entries_settlement_month_worker_id_idx" ON "point_ledger_entries"("settlement_month", "worker_id");

-- CreateIndex
CREATE INDEX "point_ledger_entries_scheduled_payment_date_idx" ON "point_ledger_entries"("scheduled_payment_date");

-- CreateIndex
CREATE INDEX "point_ledger_entries_review_id_idx" ON "point_ledger_entries"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "advance_payment_policies_replaced_by_id_key" ON "advance_payment_policies"("replaced_by_id");

-- CreateIndex
CREATE INDEX "advance_payment_policies_advance_program_idx" ON "advance_payment_policies"("advance_program");

-- CreateIndex
CREATE INDEX "advance_payment_policies_worker_id_effective_from_idx" ON "advance_payment_policies"("worker_id", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "advance_payment_policies_effective_to_idx" ON "advance_payment_policies"("effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "advance_payment_policies_worker_id_active_slot_key" ON "advance_payment_policies"("worker_id", "active_slot");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_idempotency_key_key" ON "withdrawal_requests"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_gmo_apply_no_key" ON "withdrawal_requests"("gmo_apply_no");

-- CreateIndex
CREATE INDEX "withdrawal_requests_worker_id_requested_at_idx" ON "withdrawal_requests"("worker_id", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_requested_at_idx" ON "withdrawal_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_next_poll_at_idx" ON "withdrawal_requests"("status", "next_poll_at");

-- CreateIndex
CREATE INDEX "transfer_attempts_withdrawal_request_id_occurred_at_idx" ON "transfer_attempts"("withdrawal_request_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "transfer_attempts_idempotency_key_idx" ON "transfer_attempts"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_attempts_withdrawal_request_id_attempt_no_key" ON "transfer_attempts"("withdrawal_request_id", "attempt_no");

-- CreateIndex
CREATE INDEX "gmo_oauth_tokens_account_type_revoked_at_idx" ON "gmo_oauth_tokens"("account_type", "revoked_at");

-- CreateIndex
CREATE INDEX "gmo_oauth_tokens_expires_at_idx" ON "gmo_oauth_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "gmo_webhook_events_message_id_key" ON "gmo_webhook_events"("message_id");

-- CreateIndex
CREATE INDEX "gmo_webhook_events_event_type_received_at_idx" ON "gmo_webhook_events"("event_type", "received_at" DESC);

-- CreateIndex
CREATE INDEX "hibarai_audit_logs_created_at_idx" ON "hibarai_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "hibarai_audit_logs_actor_type_action_created_at_idx" ON "hibarai_audit_logs"("actor_type", "action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "hibarai_audit_logs_target_type_target_id_idx" ON "hibarai_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "hibarai_audit_logs_idempotency_key_idx" ON "hibarai_audit_logs"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "hibarai_audit_logs_chain_scope_chain_sequence_key" ON "hibarai_audit_logs"("chain_scope", "chain_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "hibarai_audit_logs_hash_self_key" ON "hibarai_audit_logs"("hash_self");

-- AddForeignKey
ALTER TABLE "point_balances" ADD CONSTRAINT "point_balances_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_worker_user_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_worker_balance_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "point_balances"("worker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger_entries" ADD CONSTRAINT "point_ledger_entries_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_policies" ADD CONSTRAINT "advance_payment_policies_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_policies" ADD CONSTRAINT "advance_payment_policies_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "advance_payment_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_worker_user_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_worker_balance_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "point_balances"("worker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_attempts" ADD CONSTRAINT "transfer_attempts_withdrawal_request_id_fkey" FOREIGN KEY ("withdrawal_request_id") REFERENCES "withdrawal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma schema では表現できない日払い系制約。
-- Prisma migration 作成後、同一 migration.sql の末尾にこの内容を反映する。

CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_entries_attendance_confirmed_once
  ON point_ledger_entries(attendance_id)
  WHERE kind = 'ATTENDANCE_CONFIRMED' AND attendance_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'emergency_stop_states_singleton_id'
  ) THEN
    ALTER TABLE emergency_stop_states
      ADD CONSTRAINT emergency_stop_states_singleton_id
      CHECK (id = 'global');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'advance_payment_policies_rate_basis_points_range'
  ) THEN
    ALTER TABLE advance_payment_policies
      ADD CONSTRAINT advance_payment_policies_rate_basis_points_range
      CHECK (rate_basis_points BETWEEN 0 AND 10000);
  END IF;
END $$;
