import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NEXT_PUBLIC_FEATURE_HIBARAI = 'true'

let prismaModule = null as unknown as typeof import('@/lib/prisma')
let chargePointsOnReviewSubmitted = null as unknown as typeof import('../review-trigger').chargePointsOnReviewSubmitted
let reconcileHibaraiChargeInTx = null as unknown as typeof import('../review-trigger').reconcileHibaraiChargeInTx

test.before(async () => {
  prismaModule = await import('@/lib/prisma')
  const mod = await import('../review-trigger')
  chargePointsOnReviewSubmitted = mod.chargePointsOnReviewSubmitted
  reconcileHibaraiChargeInTx = mod.reconcileHibaraiChargeInTx
})

type LedgerRecord = {
  worker_id?: number
  attendance_id: number | null
  kind: string
  delta: number
  scheduled_payment_amount?: number | null
  gross_reward_amount?: number | null
  rate_basis_points?: number | null
  settlement_month?: Date | null
  idempotency_key: string
  source_type?: string | null
}

type AttendanceConfig = {
  id: number
  user_id: number
  application_id: number | null
  job_id: number | null
  status: string
  calculated_wage: number | null
  check_in_time: Date
  actual_start_time: Date | null
  worker_review_status: string | null
  modificationStatus: string | null
}

type MockState = {
  balance: number
  totalCharged: number
  ledger: LedgerRecord[]
  auditSequence: bigint
  attendance: AttendanceConfig
  policyRate: number | null
  policyProgram: string
}

const ACTOR = { type: 'WORKER' as const, id: '1', trigger: 'test' }

function createState(overrides: Partial<AttendanceConfig> = {}, base: Partial<MockState> = {}): MockState {
  return {
    balance: 0,
    totalCharged: 0,
    ledger: [],
    auditSequence: BigInt(0),
    policyRate: null,
    policyProgram: 'HIBARAI',
    attendance: {
      id: 10,
      user_id: 1,
      application_id: 100,
      job_id: 20,
      status: 'CHECKED_OUT',
      calculated_wage: 10000,
      check_in_time: new Date('2026-05-28T00:00:00.000Z'),
      actual_start_time: null,
      worker_review_status: 'COMPLETED',
      modificationStatus: null,
      ...overrides,
    },
    ...base,
  }
}

function sumDelta(state: MockState, kinds: string[]): number {
  return state.ledger
    .filter((e) => e.attendance_id === state.attendance.id && kinds.includes(e.kind))
    .reduce((t, e) => t + e.delta, 0)
}

function createTx(state: MockState) {
  return {
    $executeRaw: async () => undefined,
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      if (sql.includes('point_balances')) return [{ balance: state.balance }]
      if (sql.includes('attendances')) return [{ id: state.attendance.id }]
      return []
    },
    attendance: {
      findUnique: async () => ({
        id: state.attendance.id,
        user_id: state.attendance.user_id,
        application_id: state.attendance.application_id,
        job_id: state.attendance.job_id,
        status: state.attendance.status,
        calculated_wage: state.attendance.calculated_wage,
        check_in_time: state.attendance.check_in_time,
        actual_start_time: state.attendance.actual_start_time,
        application: state.attendance.application_id
          ? { worker_review_status: state.attendance.worker_review_status }
          : null,
        modificationRequest: state.attendance.modificationStatus
          ? { status: state.attendance.modificationStatus }
          : null,
      }),
    },
    pointBalance: {
      upsert: async () => ({ worker_id: 1, balance: state.balance }),
      update: async ({ data }: { data: { balance?: { increment?: number; decrement?: number }; total_charged?: { increment?: number } } }) => {
        state.balance += data.balance?.increment ?? 0
        state.balance -= data.balance?.decrement ?? 0
        state.totalCharged += data.total_charged?.increment ?? 0
        return { worker_id: 1, balance: state.balance }
      },
    },
    pointLedgerEntry: {
      findFirst: async () =>
        state.ledger.find((e) => e.attendance_id === state.attendance.id && e.kind === 'ATTENDANCE_CONFIRMED') ?? null,
      aggregate: async () => {
        // 実コードの where: attendance_id + OR[ATTENDANCE_CONFIRMED, MANUAL_ADJUSTMENT(source_type=AttendanceWageAdjustment)]
        const rows = state.ledger.filter(
          (e) =>
            e.attendance_id === state.attendance.id &&
            (e.kind === 'ATTENDANCE_CONFIRMED' ||
              (e.kind === 'MANUAL_ADJUSTMENT' && e.source_type === 'AttendanceWageAdjustment'))
        )
        return {
          _sum: {
            delta: rows.reduce((t, e) => t + e.delta, 0),
            scheduled_payment_amount: rows.reduce((t, e) => t + (e.scheduled_payment_amount ?? 0), 0),
            gross_reward_amount: rows.reduce((t, e) => t + (e.gross_reward_amount ?? 0), 0),
          },
        }
      },
      count: async () =>
        state.ledger.filter(
          (e) => e.attendance_id === state.attendance.id && e.kind === 'MANUAL_ADJUSTMENT' && e.source_type === 'AttendanceWageAdjustment'
        ).length,
      create: async ({ data }: { data: LedgerRecord }) => {
        if (state.ledger.some((e) => e.idempotency_key === data.idempotency_key)) {
          throw new Error('duplicate ledger idempotency_key')
        }
        state.ledger.push(data)
        return data
      },
    },
    advancePaymentPolicy: {
      findFirst: async () => {
        if (state.policyRate === null && state.policyProgram === 'HIBARAI') return null
        return { rate_basis_points: state.policyRate, advance_program: state.policyProgram }
      },
    },
    hibaraiAuditLog: {
      findFirst: async () =>
        state.auditSequence === BigInt(0) ? null : { chain_sequence: state.auditSequence, hash_self: `hash-${state.auditSequence}` },
      create: async () => {
        state.auditSequence += BigInt(1)
        return { id: `audit-${state.auditSequence}` }
      },
    },
  }
}

function installPrismaMock(state: MockState): void {
  let queue = Promise.resolve()
  const prisma = prismaModule.default as unknown as {
    attendance: { findFirst: () => Promise<unknown> }
    $transaction: <T>(cb: (tx: ReturnType<typeof createTx>) => Promise<T>) => Promise<T>
  }
  prisma.attendance = { findFirst: async () => ({ id: state.attendance.id }) }
  prisma.$transaction = async <T>(cb: (tx: ReturnType<typeof createTx>) => Promise<T>): Promise<T> => {
    const run = queue.then(() => cb(createTx(state)))
    queue = run.then(() => undefined, () => undefined)
    return run
  }
}

test('初回チャージ: 9割をチャージしrateを保存する', async () => {
  const state = createState()
  installPrismaMock(state)

  await chargePointsOnReviewSubmitted(100, 1)

  assert.equal(state.balance, 9000)
  assert.equal(state.totalCharged, 9000)
  const charged = state.ledger.filter((e) => e.kind === 'ATTENDANCE_CONFIRMED')
  assert.equal(charged.length, 1)
  assert.equal(charged[0].rate_basis_points, 9000)
  assert.equal(charged[0].scheduled_payment_amount, 1000)
})

test('冪等: 同じ勤怠で2回呼んでも1回しか加算されない', async () => {
  const state = createState()
  installPrismaMock(state)

  await chargePointsOnReviewSubmitted(100, 1)
  await chargePointsOnReviewSubmitted(100, 1)

  assert.equal(state.balance, 9000)
  assert.equal(state.ledger.filter((e) => e.kind === 'ATTENDANCE_CONFIRMED').length, 1)
})

test('前提未達: 修正申請がPENDINGならチャージしない', async () => {
  const state = createState({ modificationStatus: 'PENDING' })
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  assert.equal(state.balance, 0)
  assert.equal(state.ledger.length, 0)
})

test('前提未達: レビュー未提出ならチャージしない', async () => {
  const state = createState({ worker_review_status: 'PENDING' })
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  assert.equal(state.balance, 0)
  assert.equal(state.ledger.length, 0)
})

test('増額調整: チャージ後にwageが上がると差額をMANUAL_ADJUSTMENTで加算', async () => {
  const state = createState()
  // 初回チャージ (10000 -> advanceable 9000)
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)
  assert.equal(state.balance, 9000)

  // wage が 12000 に増額
  state.attendance.calculated_wage = 12000
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  // target advanceable = floor(12000*9000/10000)=10800, delta=+1800
  assert.equal(state.balance, 10800)
  const adj = state.ledger.filter((e) => e.kind === 'MANUAL_ADJUSTMENT')
  assert.equal(adj.length, 1)
  assert.equal(adj[0].delta, 1800)
  assert.equal(adj[0].source_type, 'AttendanceWageAdjustment')
  // scheduled delta: target scheduled 1200 - 元 1000 = 200
  assert.equal(adj[0].scheduled_payment_amount, 200)
})

test('減額調整: wageが下がると差額をマイナス計上（balance負許容）', async () => {
  const state = createState()
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)
  assert.equal(state.balance, 9000)

  // wage が 5000 に減額
  state.attendance.calculated_wage = 5000
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  // target advanceable = floor(5000*9000/10000)=4500, delta=-4500
  assert.equal(state.balance, 4500)
  const adj = state.ledger.filter((e) => e.kind === 'MANUAL_ADJUSTMENT')
  assert.equal(adj.length, 1)
  assert.equal(adj[0].delta, -4500)
})

test('調整の冪等: wage不変で再reconcileしても追加調整しない', async () => {
  const state = createState()
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)
  state.attendance.calculated_wage = 12000
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  assert.equal(state.balance, 10800)
  assert.equal(state.ledger.filter((e) => e.kind === 'MANUAL_ADJUSTMENT').length, 1)
})

test('P0-5: advance_program=DISABLED のワーカーはチャージされない', async () => {
  const state = createState({}, { policyProgram: 'DISABLED' })
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  assert.equal(state.balance, 0)
  assert.equal(state.ledger.filter((e) => e.kind === 'ATTENDANCE_CONFIRMED').length, 0)
})

test('P0-5: advance_program=LEGACY_CARRYBARAI のワーカーはチャージされない', async () => {
  const state = createState({}, { policyProgram: 'LEGACY_CARRYBARAI' })
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  assert.equal(state.balance, 0)
  assert.equal(state.ledger.filter((e) => e.kind === 'ATTENDANCE_CONFIRMED').length, 0)
})

test('P0-5: 既にチャージ済みなら非HIBARAIに変わっても差額調整は継続する', async () => {
  const state = createState()
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR) // HIBARAIで初回チャージ
  assert.equal(state.balance, 9000)

  // 後でプログラムがDISABLEDに変わっても、既存チャージの差額調整は継続（残高補正）
  state.policyProgram = 'DISABLED'
  state.attendance.calculated_wage = 12000
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  assert.equal(state.balance, 10800)
  assert.equal(state.ledger.filter((e) => e.kind === 'MANUAL_ADJUSTMENT').length, 1)
})

test('調整は原チャージのrateを使う（policy変更の影響を受けない）', async () => {
  const state = createState()
  // 初回 9000 でチャージ
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)
  // policy が 7000 に変わっても、調整は原チャージrate(9000)で計算
  state.policyRate = 7000
  state.attendance.calculated_wage = 20000
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  // target = floor(20000*9000/10000)=18000
  assert.equal(state.balance, 18000)
})

test('月跨ぎ修正: 勤務日が翌月に変わっても精算月は原チャージ月に固定', async () => {
  const state = createState({ actual_start_time: new Date('2026-05-10T01:00:00.000Z') })
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)
  const chargedMonth = state.ledger.find((e) => e.kind === 'ATTENDANCE_CONFIRMED')?.settlement_month
  assert.ok(chargedMonth instanceof Date)

  // 勤務日を6月に修正 + 増額
  state.attendance.actual_start_time = new Date('2026-06-10T01:00:00.000Z')
  state.attendance.calculated_wage = 12000
  await reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR)

  const adj = state.ledger.find((e) => e.kind === 'MANUAL_ADJUSTMENT')
  assert.ok(adj)
  // 調整は原チャージ月(5月)に載る。6月には載せ替えない
  assert.equal(adj?.settlement_month?.getTime(), chargedMonth?.getTime())
})

test('null rate の既存チャージは調整で誤動作せず例外を投げる', async () => {
  const state = createState()
  // rate_basis_points を持たない既存チャージを直接仕込む（migration前の異常データ想定）
  state.ledger.push({
    attendance_id: 10,
    kind: 'ATTENDANCE_CONFIRMED',
    delta: 7000,
    scheduled_payment_amount: 3000,
    gross_reward_amount: 10000,
    rate_basis_points: null,
    settlement_month: new Date('2026-05-01T00:00:00.000Z'),
    idempotency_key: 'attendance-10-confirmed',
  })
  state.balance = 7000
  state.attendance.calculated_wage = 12000

  await assert.rejects(() => reconcileHibaraiChargeInTx(createTx(state) as never, 10, ACTOR), /rate_basis_points/)
  // 残高は動かさない
  assert.equal(state.balance, 7000)
})
