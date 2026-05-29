import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'

process.env.NEXT_PUBLIC_FEATURE_HIBARAI = 'true'

let prismaModule = null as unknown as typeof import('@/lib/prisma')
let applyManualAdjustment = null as unknown as typeof import('../manual-adjustment').applyManualAdjustment
let IdempotencyConflictError = null as unknown as typeof import('../manual-adjustment').IdempotencyConflictError

test.before(async () => {
  prismaModule = await import('@/lib/prisma')
  const mod = await import('../manual-adjustment')
  applyManualAdjustment = mod.applyManualAdjustment
  IdempotencyConflictError = mod.IdempotencyConflictError
})

type LedgerRow = {
  id: string
  worker_id: number
  kind: string
  delta: number
  balance_after: number
  idempotency_key: string
  source_type: string | null
  note: string | null
  created_by_admin_id: number | null
}

type State = {
  balance: number
  ledger: LedgerRow[]
  audit: Array<{ action: string; payload: unknown }>
  nextLedger: number
  auditSeq: bigint
  // 競合シミュレーション用: このキーは最初のfindUniqueだけnullを返す（古いスナップショットを再現）。
  raceMissKeys: Set<string>
  // create が必ず投げる競合コード（P2034=シリアライズ失敗を再現）。
  forceCreateError: 'P2002' | 'P2034' | null
}

function createState(over: Partial<State> = {}): State {
  return {
    balance: 0,
    ledger: [],
    audit: [],
    nextLedger: 1,
    auditSeq: BigInt(0),
    raceMissKeys: new Set(),
    forceCreateError: null,
    ...over,
  }
}

// サマリ残高 == 台帳SUM の整合状態を作る（現実の正常状態を再現）。
function seeded(balance: number): State {
  const s = createState({ balance })
  if (balance !== 0) {
    s.ledger.push({
      id: 'opening', worker_id: 7, kind: 'ATTENDANCE_CONFIRMED', delta: balance, balance_after: balance,
      idempotency_key: 'opening', source_type: null, note: null, created_by_admin_id: null,
    })
  }
  return s
}

function createTx(state: State) {
  return {
    pointLedgerEntry: {
      findUnique: async ({ where }: { where: { idempotency_key: string } }) => {
        // 競合再現: 対象キーは最初の参照だけ null（古いスナップショットを抜けたfast-path miss）。
        if (state.raceMissKeys.has(where.idempotency_key)) {
          state.raceMissKeys.delete(where.idempotency_key)
          return null
        }
        return state.ledger.find((l) => l.idempotency_key === where.idempotency_key) ?? null
      },
      aggregate: async ({ where }: { where: { worker_id: number } }) => {
        const sum = state.ledger
          .filter((l) => l.worker_id === where.worker_id)
          .reduce((acc, l) => acc + l.delta, 0)
        return { _sum: { delta: sum } }
      },
      create: async ({ data }: { data: Omit<LedgerRow, 'id'> }) => {
        if (state.forceCreateError) {
          throw new Prisma.PrismaClientKnownRequestError('forced conflict', {
            code: state.forceCreateError,
            clientVersion: 'test',
          })
        }
        if (state.ledger.some((l) => l.idempotency_key === data.idempotency_key)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['idempotency_key'] },
          })
        }
        const row: LedgerRow = { id: `led_${state.nextLedger++}`, ...data }
        state.ledger.push(row)
        return { id: row.id }
      },
    },
    pointBalance: {
      upsert: async () => ({}),
      update: async ({ data }: { data: { balance: number } }) => {
        state.balance = data.balance
        return {}
      },
    },
    hibaraiAuditLog: {
      findFirst: async () => (state.auditSeq > BigInt(0) ? { chain_sequence: state.auditSeq, hash_self: 'x' } : null),
      create: async ({ data }: { data: { action: string; payload: unknown } }) => {
        state.auditSeq += BigInt(1)
        state.audit.push({ action: data.action, payload: data.payload })
        return {}
      },
    },
    $queryRaw: async () => [{ balance: state.balance }],
    $executeRaw: async () => 1,
  }
}

function installMock(state: State) {
  const tx = createTx(state)
  const p = prismaModule.default as unknown as Record<string, unknown>
  p.$transaction = (async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) as unknown
  p.pointLedgerEntry = tx.pointLedgerEntry as unknown
}

const base = { workerId: 7, reason: '組戻不成立の調査に基づく補正', adminId: 1 }

test('成功: 残高に加算し台帳・監査を記録、applied=true', async () => {
  const state = seeded(5000)
  installMock(state)
  const res = await applyManualAdjustment({ ...base, amount: 3000, idempotencyKey: 'k1' })
  assert.equal(res.applied, true)
  assert.equal(res.balanceBefore, 5000)
  assert.equal(res.balanceAfter, 8000)
  assert.equal(state.balance, 8000)
  const adj = state.ledger.find((l) => l.kind === 'MANUAL_ADJUSTMENT')
  assert.ok(adj)
  assert.equal(adj.delta, 3000)
  assert.equal(adj.source_type, 'AdminManualAdjustment')
  assert.equal(adj.created_by_admin_id, 1)
  assert.equal(state.audit.length, 1)
  assert.equal(state.audit[0].action, 'MANUAL_BALANCE_ADJUSTED')
})

test('減額: 残高を減らす', async () => {
  const state = seeded(5000)
  installMock(state)
  const res = await applyManualAdjustment({ ...base, amount: -2000, idempotencyKey: 'k2' })
  assert.equal(res.balanceAfter, 3000)
  assert.equal(state.balance, 3000)
})

test('マイナス残高になる調整は拒否し、何も変更しない', async () => {
  const state = seeded(1000)
  installMock(state)
  await assert.rejects(() => applyManualAdjustment({ ...base, amount: -2000, idempotencyKey: 'k3' }), /マイナス/)
  assert.equal(state.balance, 1000)
  assert.equal(state.ledger.filter((l) => l.kind === 'MANUAL_ADJUSTMENT').length, 0)
  assert.equal(state.audit.length, 0)
})

test('整合性: サマリ残高と台帳合計が不一致なら拒否', async () => {
  // 台帳合計(1000) != サマリ残高(5000) のドリフト状態
  const state = createState({ balance: 5000 })
  state.ledger.push({
    id: 'pre', worker_id: 7, kind: 'ATTENDANCE_CONFIRMED', delta: 1000, balance_after: 1000,
    idempotency_key: 'pre', source_type: null, note: null, created_by_admin_id: null,
  })
  installMock(state)
  await assert.rejects(() => applyManualAdjustment({ ...base, amount: 100, idempotencyKey: 'k4' }), /不一致/)
  assert.equal(state.balance, 5000) // 変更なし
})

test('冪等: 同じキーの再実行は no-op(applied=false)で二重適用しない', async () => {
  const state = seeded(5000)
  installMock(state)
  const first = await applyManualAdjustment({ ...base, amount: 1000, idempotencyKey: 'dup' })
  const second = await applyManualAdjustment({ ...base, amount: 1000, idempotencyKey: 'dup' })
  assert.equal(first.applied, true)
  assert.equal(second.applied, false)
  assert.equal(second.balanceAfter, 6000)
  assert.equal(state.balance, 6000) // 1回だけ適用
  assert.equal(state.ledger.filter((l) => l.kind === 'MANUAL_ADJUSTMENT').length, 1)
})

// 競合の loser を再現: fast-path findUnique は miss させ、create で競合エラーを投げ、
// catch が同キーを読み直して no-op 解決する（適用済みなのに失敗表示にしない）。
function raceState(conflict: 'P2002' | 'P2034'): State {
  // winner適用後の整合状態: opening5000 + winnerの調整1000 = 残高6000（SUM==balance）。
  const state = createState({ balance: 6000 })
  state.ledger.push({
    id: 'opening', worker_id: 7, kind: 'ATTENDANCE_CONFIRMED', delta: 5000, balance_after: 5000,
    idempotency_key: 'opening', source_type: null, note: null, created_by_admin_id: null,
  })
  state.ledger.push({
    id: 'led_winner', worker_id: 7, kind: 'MANUAL_ADJUSTMENT', delta: 1000, balance_after: 6000,
    idempotency_key: 'racekey', source_type: 'AdminManualAdjustment', note: 'winner', created_by_admin_id: 1,
  })
  state.raceMissKeys.add('racekey') // loserのfast-path参照だけnull
  if (conflict === 'P2034') state.forceCreateError = 'P2034'
  return state
}

test('冪等競合(P2002): createのunique違反でも既存を読み直して no-op 解決', async () => {
  const state = raceState('P2002')
  installMock(state)
  const res = await applyManualAdjustment({ ...base, amount: 1000, idempotencyKey: 'racekey' })
  assert.equal(res.applied, false)
  assert.equal(res.balanceAfter, 6000)
})

test('冪等競合(P2034): シリアライズ失敗でも既存を読み直して no-op 解決', async () => {
  const state = raceState('P2034')
  installMock(state)
  const res = await applyManualAdjustment({ ...base, amount: 1000, idempotencyKey: 'racekey' })
  assert.equal(res.applied, false)
  assert.equal(res.balanceAfter, 6000)
})

test('競合だが同キー台帳なし(別オペの競合)はそのまま再送可能エラーとして投げる', async () => {
  const state = seeded(5000)
  state.forceCreateError = 'P2034'
  installMock(state)
  await assert.rejects(() => applyManualAdjustment({ ...base, amount: 1000, idempotencyKey: 'lonely' }))
})

test('冪等衝突: 同じキーで異なる金額は IdempotencyConflictError', async () => {
  const state = createState({ balance: 5000 })
  state.ledger.push({
    id: 'led_x', worker_id: 7, kind: 'MANUAL_ADJUSTMENT', delta: 1000, balance_after: 6000,
    idempotency_key: 'conflict', source_type: 'AdminManualAdjustment', note: 'r', created_by_admin_id: 1,
  })
  installMock(state)
  await assert.rejects(
    () => applyManualAdjustment({ ...base, amount: 2000, idempotencyKey: 'conflict' }),
    IdempotencyConflictError,
  )
})
