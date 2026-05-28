import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NEXT_PUBLIC_FEATURE_HIBARAI = 'true'

let prismaModule = null as unknown as typeof import('@/lib/prisma')
let setAdvancePaymentPolicy = null as unknown as typeof import('../policy').setAdvancePaymentPolicy

test.before(async () => {
  prismaModule = await import('@/lib/prisma')
  setAdvancePaymentPolicy = (await import('../policy')).setAdvancePaymentPolicy
})

type PolicyRecord = {
  id: string
  worker_id: number
  rate_basis_points: number
  per_request_limit_amount: number | null
  daily_limit_amount: number | null
  monthly_limit_amount: number | null
  advance_program: string
  is_suspended: boolean
  reason: string
  effective_from: Date
  effective_to: Date | null
  created_by_admin_id: number
  replaced_by_id: string | null
  active_slot: string | null
}

type AuditRecord = { action: string; actor_type: string; result: string; payload: unknown }

type MockState = {
  policies: PolicyRecord[]
  audits: AuditRecord[]
  seq: number
}

const ADMIN_ID = 42

function createState(initial: PolicyRecord[] = []): MockState {
  return { policies: [...initial], audits: [], seq: initial.length }
}

function createTx(state: MockState) {
  return {
    $executeRaw: async () => undefined,
    advancePaymentPolicy: {
      findFirst: async ({ where }: { where: { worker_id: number; active_slot?: string } }) =>
        state.policies.find(
          (p) => p.worker_id === where.worker_id && (where.active_slot ? p.active_slot === where.active_slot : true)
        ) ?? null,
      create: async ({ data }: { data: Partial<PolicyRecord> }) => {
        // 同一 worker で active_slot='active' が既に在ればUNIQUE違反を模す
        if (
          data.active_slot === 'active' &&
          state.policies.some((p) => p.worker_id === data.worker_id && p.active_slot === 'active')
        ) {
          throw new Error('Unique constraint failed (worker_id, active_slot)')
        }
        const rec: PolicyRecord = {
          id: `pol_${++state.seq}`,
          worker_id: data.worker_id!,
          rate_basis_points: data.rate_basis_points!,
          per_request_limit_amount: data.per_request_limit_amount ?? null,
          daily_limit_amount: data.daily_limit_amount ?? null,
          monthly_limit_amount: data.monthly_limit_amount ?? null,
          advance_program: data.advance_program ?? 'HIBARAI',
          is_suspended: data.is_suspended ?? false,
          reason: data.reason ?? '',
          effective_from: data.effective_from ?? new Date(),
          effective_to: data.effective_to ?? null,
          created_by_admin_id: data.created_by_admin_id!,
          replaced_by_id: data.replaced_by_id ?? null,
          active_slot: data.active_slot ?? 'active',
        }
        state.policies.push(rec)
        return rec
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<PolicyRecord> }) => {
        const rec = state.policies.find((p) => p.id === where.id)
        if (!rec) throw new Error('policy not found')
        Object.assign(rec, data)
        return rec
      },
    },
    hibaraiAuditLog: {
      findFirst: async () => null,
      create: async ({ data }: { data: AuditRecord }) => {
        state.audits.push(data)
        return { id: `audit_${state.audits.length}` }
      },
    },
  }
}

function installMock(state: MockState): void {
  const prisma = prismaModule.default as unknown as {
    $transaction: <T>(cb: (tx: ReturnType<typeof createTx>) => Promise<T>, opts?: unknown) => Promise<T>
  }
  prisma.$transaction = async <T>(cb: (tx: ReturnType<typeof createTx>) => Promise<T>): Promise<T> => cb(createTx(state))
}

function baseInput(over: Partial<Parameters<typeof setAdvancePaymentPolicy>[0]> = {}) {
  return {
    workerId: 1,
    rateBasisPoints: 7000,
    perRequestLimitAmount: 50000,
    dailyLimitAmount: 50000,
    monthlyLimitAmount: 150000,
    isSuspended: false,
    advanceProgram: 'HIBARAI' as const,
    reason: '社保対象見込みのため7割に変更',
    ...over,
  }
}

test('active が無ければ新規ポリシーを active で作成し監査ログを残す', async () => {
  const state = createState()
  installMock(state)

  const res = await setAdvancePaymentPolicy(baseInput(), ADMIN_ID)

  const active = state.policies.filter((p) => p.active_slot === 'active')
  assert.equal(active.length, 1)
  assert.equal(active[0].rate_basis_points, 7000)
  assert.equal(active[0].created_by_admin_id, ADMIN_ID)
  assert.equal(res.id, active[0].id)
  // 監査ログ必須
  assert.equal(state.audits.length, 1)
  assert.equal(state.audits[0].action, 'POLICY_UPDATED')
  assert.equal(state.audits[0].actor_type, 'SYSTEM_ADMIN')
})

test('既存activeがあれば版管理する（旧を無効化+replaced_by_id、新をactive）', async () => {
  const state = createState([
    {
      id: 'pol_old', worker_id: 1, rate_basis_points: 9000,
      per_request_limit_amount: null, daily_limit_amount: null, monthly_limit_amount: null,
      advance_program: 'HIBARAI', is_suspended: false, reason: '初期', effective_from: new Date('2026-05-01'),
      effective_to: null, created_by_admin_id: 1, replaced_by_id: null, active_slot: 'active',
    },
  ])
  installMock(state)

  const res = await setAdvancePaymentPolicy(baseInput({ rateBasisPoints: 7000 }), ADMIN_ID)

  const old = state.policies.find((p) => p.id === 'pol_old')!
  assert.equal(old.active_slot, null) // 旧は無効化
  assert.equal(old.replaced_by_id, res.id) // 版リンク
  assert.ok(old.effective_to instanceof Date)
  const active = state.policies.filter((p) => p.active_slot === 'active')
  assert.equal(active.length, 1) // activeは常に1件
  assert.equal(active[0].rate_basis_points, 7000)
  // 監査ログに before/after が残る
  const payload = state.audits[0].payload as { before?: { rateBasisPoints?: number }; after?: { rateBasisPoints?: number } }
  assert.equal(payload.before?.rateBasisPoints, 9000)
  assert.equal(payload.after?.rateBasisPoints, 7000)
})

test('個別停止: advanceProgram=DISABLED を設定できる（日払い不可）', async () => {
  const state = createState()
  installMock(state)

  await setAdvancePaymentPolicy(baseInput({ advanceProgram: 'DISABLED', reason: '本人都合で日払い対象外' }), ADMIN_ID)

  const active = state.policies.find((p) => p.active_slot === 'active')!
  assert.equal(active.advance_program, 'DISABLED')
})

test('is_suspended=true（出金一時停止）を設定できる', async () => {
  const state = createState()
  installMock(state)
  await setAdvancePaymentPolicy(baseInput({ isSuspended: true, reason: '一時停止' }), ADMIN_ID)
  assert.equal(state.policies.find((p) => p.active_slot === 'active')!.is_suspended, true)
})

test('reason が空なら拒否（監査ログのため理由必須）', async () => {
  const state = createState()
  installMock(state)
  await assert.rejects(() => setAdvancePaymentPolicy(baseInput({ reason: '   ' }), ADMIN_ID), /reason/i)
  assert.equal(state.policies.length, 0)
})

test('rate が範囲外(0..10000)なら拒否', async () => {
  const state = createState()
  installMock(state)
  await assert.rejects(() => setAdvancePaymentPolicy(baseInput({ rateBasisPoints: 10001 }), ADMIN_ID), /rate/i)
  await assert.rejects(() => setAdvancePaymentPolicy(baseInput({ rateBasisPoints: -1 }), ADMIN_ID), /rate/i)
})

test('上限が負なら拒否', async () => {
  const state = createState()
  installMock(state)
  await assert.rejects(() => setAdvancePaymentPolicy(baseInput({ dailyLimitAmount: -100 }), ADMIN_ID), /limit/i)
})

test('未知の advanceProgram は拒否（allowlist）', async () => {
  const state = createState()
  installMock(state)
  await assert.rejects(
    () => setAdvancePaymentPolicy(baseInput({ advanceProgram: 'FOO' as never }), ADMIN_ID),
    /advanceProgram/i
  )
  assert.equal(state.policies.length, 0)
})

test('workerId が不正なら拒否', async () => {
  const state = createState()
  installMock(state)
  await assert.rejects(() => setAdvancePaymentPolicy(baseInput({ workerId: 0 }), ADMIN_ID), /workerId/i)
})
