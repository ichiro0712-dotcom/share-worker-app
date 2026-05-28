import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NEXT_PUBLIC_FEATURE_HIBARAI = 'true'

let prismaModule = null as unknown as typeof import('@/lib/prisma')
let chargePointsOnReviewSubmitted = null as unknown as typeof import('../review-trigger').chargePointsOnReviewSubmitted

test.before(async () => {
  prismaModule = await import('@/lib/prisma')
  const reviewTriggerModule = await import('../review-trigger')
  chargePointsOnReviewSubmitted = reviewTriggerModule.chargePointsOnReviewSubmitted
})

type LedgerRecord = {
  attendance_id: number
  kind: string
  delta: number
  idempotency_key: string
}

type MockState = {
  balance: number
  ledger: LedgerRecord[]
  auditSequence: bigint
}

type MockTx = ReturnType<typeof createTx>

type MockablePrisma = {
  attendance: { findFirst: () => Promise<unknown> }
  $transaction: <T>(callback: (tx: MockTx) => Promise<T>, options?: unknown) => Promise<T>
}

test('同じattendance_idで2回呼んでも1回しか加算されない', async () => {
  const state: MockState = { balance: 0, ledger: [], auditSequence: BigInt(0) }
  installPrismaMock(state)

  await chargePointsOnReviewSubmitted(100, 1)
  await chargePointsOnReviewSubmitted(100, 1)

  assert.equal(state.balance, 9000)
  assert.equal(state.ledger.filter((entry) => entry.kind === 'ATTENDANCE_CONFIRMED').length, 1)
})

function installPrismaMock(state: MockState): void {
  let queue = Promise.resolve()
  const prisma = prismaModule.default as unknown as MockablePrisma
  prisma.attendance = {
    findFirst: async () => ({
      id: 10,
      application_id: 100,
      job_id: 20,
      calculated_wage: 10000,
      check_in_time: new Date('2026-05-28T00:00:00.000Z'),
      actual_start_time: null,
    }),
  }
  prisma.$transaction = async <T>(callback: (tx: MockTx) => Promise<T>): Promise<T> => {
    const run = queue.then(() => callback(createTx(state)))
    queue = run.then(() => undefined, () => undefined)
    return run
  }
}

function createTx(state: MockState) {
  return {
    $executeRaw: async () => undefined,
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      if (sql.includes('point_balances')) return [{ balance: state.balance }]
      if (sql.includes('attendances')) return [{ id: 10 }]
      return []
    },
    pointBalance: {
      upsert: async () => ({ worker_id: 1, balance: state.balance }),
      update: async ({ data }: { data: { balance?: { increment?: number }; total_charged?: { increment?: number } } }) => {
        state.balance += data.balance?.increment ?? 0
        return { worker_id: 1, balance: state.balance }
      },
    },
    pointLedgerEntry: {
      findFirst: async () => state.ledger.find((entry) => entry.attendance_id === 10 && entry.kind === 'ATTENDANCE_CONFIRMED') ?? null,
      create: async ({ data }: { data: LedgerRecord }) => {
        state.ledger.push(data)
        return data
      },
    },
    advancePaymentPolicy: {
      findFirst: async () => null,
    },
    hibaraiAuditLog: {
      findFirst: async () => state.auditSequence === BigInt(0)
        ? null
        : { chain_sequence: state.auditSequence, hash_self: `hash-${state.auditSequence}` },
      create: async () => {
        state.auditSequence += BigInt(1)
        return { id: `audit-${state.auditSequence}` }
      },
    },
  }
}
