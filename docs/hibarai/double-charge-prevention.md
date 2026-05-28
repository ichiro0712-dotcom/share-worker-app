# 二重課金・二重引き出し 絶対防止設計

**作成日**: 2026-05-28
**重要度**: 🔴 CRITICAL
**適用対象**: 日払い機能 全コード（DB / Server Actions / GMO API / UI / Cron）

---

## 絶対要件

> **同じワーカーが同じ確定報酬に対して、複数回の振込を受けることが絶対にあってはならない。**
> **同じ申請に対して、GMOへ複数回の振込依頼が送られることが絶対にあってはならない。**

## 5層防御（Defense in Depth）

### Layer 1: DB 制約

| 制約 | 防ぐもの | 実装 |
|---|---|---|
| `WithdrawalRequest.idempotency_key` UNIQUE | 同じキーで2回の申請作成 | Prismaスキーマ済 |
| `WithdrawalRequest.gmo_apply_no` UNIQUE (nullable) | GMO受付番号の重複保存 | Prismaスキーマ済 |
| `PointLedgerEntry.idempotency_key` UNIQUE | 同じキーで2回の台帳エントリ | Prismaスキーマ済 |
| `PointLedgerEntry(attendance_id) WHERE kind='ATTENDANCE_CONFIRMED'` 部分UNIQUE | 同一勤怠の二重加算 | manual-sql 済 |
| `GmoWebhookEvent.message_id` UNIQUE | Webhook重複配信 | Prismaスキーマ済 |

### Layer 2: トランザクション + 行ロック

すべての金銭操作は **PostgreSQL のトランザクション内で `SELECT ... FOR UPDATE`** により直列化：

```ts
async function createWithdrawal(workerId: number, amount: number) {
  const idempotencyKey = generateIdempotencyKey();

  return await prisma.$transaction(async (tx) => {
    // 1. 冪等チェック: 既に同じキーで作成済みなら再利用
    const existing = await tx.withdrawalRequest.findUnique({
      where: { idempotency_key: idempotencyKey },
    });
    if (existing) return existing;

    // 2. 残高を FOR UPDATE で行ロック（並列申請の直列化）
    const balance = await tx.$queryRaw<{ balance: number }[]>`
      SELECT balance FROM point_balances WHERE worker_id = ${workerId} FOR UPDATE
    `;
    if (!balance[0] || balance[0].balance < amount) {
      throw new InsufficientBalanceError();
    }

    // 3. 緊急停止チェック
    const stop = await tx.emergencyStopState.findUnique({ where: { id: 'global' } });
    if (stop?.is_stopped) throw new EmergencyStoppedError();

    // 4. 個人別ポリシーチェック（上限・停止）
    const policy = await tx.advancePaymentPolicy.findFirst({
      where: { worker_id: workerId, effective_from: { lte: new Date() }, effective_to: null },
    });
    if (policy?.is_suspended) throw new WorkerSuspendedError();
    if (amount > (policy?.per_request_limit_amount ?? Infinity)) throw new OverLimitError();

    // 5. レート制限（日次・月次の出金回数・金額チェック）
    await checkRateLimits(tx, workerId, amount);

    // 6. 引当: ledger に WITHDRAWAL_RESERVED、balance を decrement
    const ledger = await tx.pointLedgerEntry.create({
      data: {
        worker_id: workerId,
        kind: 'WITHDRAWAL_RESERVED',
        delta: -amount,
        idempotency_key: `reserved-${idempotencyKey}`,
        // ...
      },
    });
    await tx.pointBalance.update({
      where: { worker_id: workerId },
      data: { balance: { decrement: amount }, updated_at: new Date() },
    });

    // 7. WithdrawalRequest 作成（PENDING）
    return await tx.withdrawalRequest.create({
      data: {
        worker_id: workerId,
        requested_amount: amount,
        idempotency_key: idempotencyKey,
        status: 'PENDING',
        // ...
      },
    });
  }, {
    isolationLevel: 'Serializable', // 最も厳格
  });
}
```

### Layer 3: GMO API レベル

| 仕組み | 詳細 |
|---|---|
| `Idempotency-Key` ヘッダ | 同じキーで2回叩いても GMO 側で重複検知、同じ `applyNo` が返る |
| 振込状況の事前確認 | GMO 呼び出し前に `getTransferRequestResult(applyNo)` で既存の状態確認 |
| エラーリトライポリシー | 4xx は冪等処理（既に同じキーで成功している判定）、5xx は backoff してリトライ（同じキーで安全） |

GMO 呼び出しは **DBトランザクションの外で**実行（外部呼び出しを抱えたまま長時間 lock しない）：

```ts
// 上記 createWithdrawal でPENDING 作成後、別タスクで GMO 呼び出し
async function submitToGmo(withdrawalRequestId: string) {
  const wr = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
  if (!wr || wr.status !== 'PENDING') return; // 冪等
  
  // 状態を PROCESSING に変更（DB ロック）
  const claimed = await prisma.withdrawalRequest.updateMany({
    where: { id: withdrawalRequestId, status: 'PENDING' },
    data: { status: 'PROCESSING', submitted_to_gmo_at: new Date() },
  });
  if (claimed.count === 0) return; // 既に他のプロセスが処理中
  
  try {
    const result = await gmoClient.requestTransfer(token, wr.idempotency_key, payload);
    await prisma.withdrawalRequest.update({
      where: { id: withdrawalRequestId },
      data: { gmo_apply_no: result.applyNo, /* ... */ },
    });
  } catch (e) {
    // 失敗時は PENDING に戻し、引当を返却（ledger に WITHDRAWAL_REVERTED）
    await revertReservation(withdrawalRequestId);
    throw e;
  }
}
```

### Layer 4: Cron ポーリングの冪等性

```ts
// 5分おきに status をポーリング
async function pollTransferStatus() {
  const pending = await prisma.withdrawalRequest.findMany({
    where: {
      status: 'PROCESSING',
      gmo_apply_no: { not: null },
      next_poll_at: { lte: new Date() },
    },
    take: 100,
  });
  
  for (const wr of pending) {
    // FOR UPDATE で行ロック（同じレコードを別のCron実行が触らない）
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<WithdrawalRequest[]>`
        SELECT * FROM withdrawal_requests WHERE id = ${wr.id} FOR UPDATE SKIP LOCKED
      `;
      if (locked.length === 0) return; // 他プロセスが処理中
      
      const status = await gmoClient.getTransferStatus(token, { applyNo: wr.gmo_apply_no });
      // 完了系なら COMPLETED/FAILED/REFUNDED に遷移
      // 失敗系なら ledger に WITHDRAWAL_REVERTED で残高を戻す
      // ...
    });
  }
}
```

### Layer 5: UI レベル

| 仕組み | 詳細 |
|---|---|
| 送信中ボタンの disabled | クライアント側で多重クリック防止 |
| 確認シート（2段階） | ボトムシートで再確認後に送信 |
| 完了画面 | 完了したら新規申請までの導線 |
| エラー時の明示 | 失敗したら何度も同じ操作を促さない |
| サーバー側で再計算 | クライアント値は信用しない（必ずDBで再計算） |

## 例外・エッジケース

### E1. 勤怠取消・修正による残高マイナス
- 既に前払い済の勤怠が取り消された場合、PointBalance が負になる可能性
- 対応: **負残高は許容するが、新規申請は拒否**。次回確定報酬で相殺するか、管理者の手動調整で解消。
- `WithdrawalRequest` への新規申請時に **負残高チェック**を入れる

### E2. GMO API のネットワーク切断
- 振込依頼を送ったかどうか不明な状態
- 対応: 同じ Idempotency-Key で `getTransferRequestResult` を叩いて状態確認
- 結果コード `1`（完了）なら既に処理済み → PROCESSING のまま続行
- 結果が無ければ未送信 → リトライ可

### E3. Webhook の重複配信
- GMO は同じ messageId を重複配信する可能性あり
- 対応: `GmoWebhookEvent.message_id UNIQUE` で1回しか処理されない

### E4. 同時並列申請（同じワーカーが2タブで申請）
- 対応: SELECT FOR UPDATE で残高行をロック → 2つ目は1つ目のコミット後に新残高で再判定

### E5. 緊急停止の途中
- 対応: トランザクション開始時に `EmergencyStopState` を再チェック
- Cron ポーリングでも開始前に再チェック

### E6. 月末23:59直前の申請
- 5/31 23:59:59 申請 → 6/1 GMO処理 → 完了
- 対応: `settlement_month` フィールドで「どの月の精算か」を明示。`requested_at` 基準ではなく業務日基準。

## 実装チェックリスト（Server Actions 実装時）

- [ ] `prisma.$transaction({ isolationLevel: 'Serializable' })` を使う
- [ ] `SELECT ... FOR UPDATE` で残高をロック
- [ ] `idempotency_key` を必ず生成・保存
- [ ] GMO 呼び出しは DB トランザクション外
- [ ] GMO 呼び出し前に既存 `applyNo` の有無を確認
- [ ] GMO 呼び出し失敗時は `WITHDRAWAL_REVERTED` で残高を戻す
- [ ] Cron ポーリングは `FOR UPDATE SKIP LOCKED` で重複処理回避
- [ ] Webhook は `message_id` で冪等処理
- [ ] エラーログは全て `HibaraiAuditLog` に記録
- [ ] 緊急停止フラグを毎回確認

## テストケース（必須）

1. 同じ Idempotency-Key で2回 createWithdrawal → 同じレコードが返る、台帳は1件のみ
2. 並列で2つの createWithdrawal → 1つだけ成功、もう1つは残高不足エラー
3. GMO API 5xx → リトライで同じ applyNo
4. GMO Webhook 同じ message_id 2回受信 → 2回目はスキップ
5. 勤怠完了 → ledger 加算 → 同じ attendance_id でもう1回 confirm → 部分UNIQUE INDEX で失敗
6. 緊急停止中の申請 → 拒否される
7. 個人別上限超え → 拒否される
8. 残高マイナスからの申請 → 拒否される

これらを Server Actions 実装後の単体テストで必ず検証する。

## 監査ログの最小項目

各操作で `HibaraiAuditLog` に以下を記録：

- `actor_type`, `actor_id`
- `action`: WITHDRAWAL_REQUESTED, WITHDRAWAL_SUBMITTED_TO_GMO, WITHDRAWAL_COMPLETED, WITHDRAWAL_FAILED, BALANCE_ADJUSTED, EMERGENCY_STOP_TRIGGERED 等
- `target_type`, `target_id`
- `payload`: 重要な値（amount, applyNo, idempotencyKey）
- `result`: SUCCESS / ERROR
- `ip_address`, `user_agent`
- `hash_prev`, `hash_self`: 改竄検知用チェーン
