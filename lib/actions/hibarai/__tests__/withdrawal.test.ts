import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NEXT_PUBLIC_FEATURE_HIBARAI = 'true'
process.env.HIBARAI_DEFAULT_FEE_JPY = '143'
process.env.HIBARAI_DAILY_WITHDRAWAL_COUNT_LIMIT = '5'
process.env.HIBARAI_DAILY_WITHDRAWAL_AMOUNT_LIMIT = '50000'
process.env.HIBARAI_MONTHLY_WITHDRAWAL_COUNT_LIMIT = '10'
process.env.HIBARAI_MONTHLY_WITHDRAWAL_AMOUNT_LIMIT = '150000'
process.env.GMO_AOZORA_MODE = 'real'
process.env.GMO_AOZORA_BASE_URL = 'https://api.example.test'
process.env.GMO_AOZORA_CLIENT_ID = 'client-id'
process.env.GMO_AOZORA_CLIENT_SECRET = 'client-secret'
process.env.GMO_AOZORA_REMITTER_ACCOUNT_ID = '101011234567'

let prismaModule = null as unknown as typeof import('@/lib/prisma')
let createWithdrawalRequest = null as unknown as typeof import('../withdrawal').createWithdrawalRequest
let submitWithdrawalToGmo = null as unknown as typeof import('../withdrawal').submitWithdrawalToGmo
let revertReservation = null as unknown as typeof import('../withdrawal').revertReservation
let EmergencyStoppedError = null as unknown as typeof import('../withdrawal-errors').EmergencyStoppedError
let InsufficientBalanceError = null as unknown as typeof import('../withdrawal-errors').InsufficientBalanceError
let OverLimitError = null as unknown as typeof import('../withdrawal-errors').OverLimitError
const originalFetch = globalThis.fetch

test.before(async () => {
  prismaModule = await import('@/lib/prisma')
  const withdrawalModule = await import('../withdrawal')
  const withdrawalErrors = await import('../withdrawal-errors')
  createWithdrawalRequest = withdrawalModule.createWithdrawalRequest
  submitWithdrawalToGmo = withdrawalModule.submitWithdrawalToGmo
  revertReservation = withdrawalModule.revertReservation
  EmergencyStoppedError = withdrawalErrors.EmergencyStoppedError
  InsufficientBalanceError = withdrawalErrors.InsufficientBalanceError
  OverLimitError = withdrawalErrors.OverLimitError
})

test.after(() => {
  globalThis.fetch = originalFetch
})

type WithdrawalRecord = {
  id: string
  worker_id: number
  bank_account_id: string
  requested_amount: number
  fee_amount: number
  transfer_amount: number
  status: string
  idempotency_key: string
  client_ip: string
  user_agent: string
  requested_at: Date
  gmo_apply_no: string | null
  gmo_account_id: string | null
  submitted_to_gmo_at: Date | null
  failed_at: Date | null
  last_polled_at: Date | null
  next_poll_at: Date | null
  error_message: string | null
}

type LedgerRecord = {
  worker_id: number
  kind: string
  delta: number
  balance_after: number
  idempotency_key: string
}

type MockState = {
  balance: number
  totalWithdrawn: number
  withdrawals: WithdrawalRecord[]
  ledger: LedgerRecord[]
  auditSequence: bigint
  stop: boolean
  perRequestLimit: number | null
  nextWithdrawalId: number
}

type MockTx = ReturnType<typeof createTx>

type MockablePrisma = {
  $transaction: <T>(callback: (tx: MockTx) => Promise<T>, options?: unknown) => Promise<T>
  withdrawalRequest: MockTx['withdrawalRequest']
  gmoOAuthToken: {
    findFirst: () => Promise<{ access_token: string; expires_at: Date } | null>
  }
}

test('並列で2つのcreateWithdrawalは1つだけ成功する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)

  const results = await Promise.allSettled([
    createWithdrawalRequest(createInput({ amount: 700, idempotencyKey: 'parallel-1' })),
    createWithdrawalRequest(createInput({ amount: 700, idempotencyKey: 'parallel-2' })),
  ])

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
  assert.equal(state.balance, 300)
  assert.equal(state.ledger.filter((entry) => entry.kind === 'WITHDRAWAL_RESERVED').length, 1)
})

test('同じidempotencyKeyで2回作成すると同じidを返す', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)

  const first = await createWithdrawalRequest(createInput({ amount: 300, idempotencyKey: 'same-key' }))
  const second = await createWithdrawalRequest(createInput({ amount: 300, idempotencyKey: 'same-key' }))

  assert.equal(first.id, second.id)
  assert.equal(state.balance, 700)
  assert.equal(state.ledger.filter((entry) => entry.kind === 'WITHDRAWAL_RESERVED').length, 1)
})

test('緊急停止中の申請はエラーになる', async () => {
  installPrismaMock(createState({ balance: 1000, stop: true }))

  await assert.rejects(
    () => createWithdrawalRequest(createInput({ amount: 300, idempotencyKey: 'stopped' })),
    EmergencyStoppedError
  )
})

test('残高不足はエラーになる', async () => {
  installPrismaMock(createState({ balance: 100 }))

  await assert.rejects(
    () => createWithdrawalRequest(createInput({ amount: 300, idempotencyKey: 'insufficient' })),
    InsufficientBalanceError
  )
})

test('上限超えはエラーになる', async () => {
  installPrismaMock(createState({ balance: 1000, perRequestLimit: 200 }))

  await assert.rejects(
    () => createWithdrawalRequest(createInput({ amount: 300, idempotencyKey: 'over-limit' })),
    OverLimitError
  )
})

test('引当のreverseで残高が戻る', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'reverse' }))

  await revertReservation(request.id, 'bank rejected')

  assert.equal(state.balance, 1000)
  assert.equal(state.withdrawals[0].status, 'FAILED')
  assert.equal(state.ledger.some((entry) => entry.kind === 'WITHDRAWAL_REVERTED'), true)
})

test('GMO 5xxでは残高を戻さずPROCESSINGで保留する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'gmo-5xx' }))

  await assert.rejects(() => submitWithdrawalToGmo(request.id), /server error/)

  assert.equal(state.balance, 500)
  assert.equal(state.totalWithdrawn, 500)
  assert.equal(state.withdrawals[0].status, 'PROCESSING')
  assert.equal(state.withdrawals[0].gmo_apply_no, null)
  assert.equal(state.ledger.some((entry) => entry.kind === 'WITHDRAWAL_REVERTED'), false)
  assert.match(state.withdrawals[0].error_message ?? '', /server error/)
})

test('GMO timeoutでは残高を戻さずPROCESSINGで保留する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => {
    throw new Error('timeout')
  })
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'gmo-timeout' }))

  await assert.rejects(() => submitWithdrawalToGmo(request.id), /timeout/)

  assert.equal(state.balance, 500)
  assert.equal(state.totalWithdrawn, 500)
  assert.equal(state.withdrawals[0].status, 'PROCESSING')
  assert.equal(state.withdrawals[0].gmo_apply_no, null)
  assert.equal(state.ledger.some((entry) => entry.kind === 'WITHDRAWAL_REVERTED'), false)
})

test('GMO応答不明はnext_poll_at後に同じ冪等キーで再送しapplyNoを保存する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  let attempt = 0
  const calls = installGmoFetchMock(() => {
    attempt += 1
    if (attempt === 1) {
      return jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500)
    }
    return jsonResponse({
      applyNo: '1234567890123456',
      resultCode: '1',
      applyEndDatetime: '2026-05-28T10:00:00+09:00',
      accountId: '101011234567',
    })
  })
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'unknown-retry' }))

  await assert.rejects(() => submitWithdrawalToGmo(request.id), /server error/)
  await submitWithdrawalToGmo(request.id)
  state.withdrawals[0].next_poll_at = new Date(Date.now() - 1000)
  await submitWithdrawalToGmo(request.id)

  assert.equal(calls.length, 2)
  assert.equal(state.balance, 500)
  assert.equal(state.withdrawals[0].status, 'PROCESSING')
  assert.equal(state.withdrawals[0].gmo_apply_no, '1234567890123456')
  assert.equal(state.ledger.some((entry) => entry.kind === 'WITHDRAWAL_REVERTED'), false)
})

test('GMOの明示的拒否は引当を戻す', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => jsonResponse({
    applyNo: '1234567890123456',
    resultCode: '2',
    applyEndDatetime: '2026-05-28T10:00:00+09:00',
  }))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'gmo-rejected' }))

  await assert.rejects(() => submitWithdrawalToGmo(request.id), /GMO rejected/)

  assert.equal(state.balance, 1000)
  assert.equal(state.totalWithdrawn, 0)
  assert.equal(state.withdrawals[0].status, 'FAILED')
  assert.equal(state.ledger.some((entry) => entry.kind === 'WITHDRAWAL_REVERTED'), true)
})

test('同じWithdrawalRequestへの2並列submitは1回だけGMOへ送る', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return jsonResponse({
      applyNo: '1234567890123456',
      resultCode: '1',
      applyEndDatetime: '2026-05-28T10:00:00+09:00',
      accountId: '101011234567',
    })
  })
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'parallel-submit' }))

  await Promise.all([
    submitWithdrawalToGmo(request.id),
    submitWithdrawalToGmo(request.id),
  ])

  assert.equal(calls.length, 1)
  assert.equal(state.balance, 500)
  assert.equal(state.withdrawals[0].status, 'PROCESSING')
  assert.equal(state.withdrawals[0].gmo_apply_no, '1234567890123456')
  assert.equal(state.ledger.some((entry) => entry.kind === 'WITHDRAWAL_REVERTED'), false)
})

function createInput(overrides: { amount: number; idempotencyKey: string }) {
  return {
    workerId: 1,
    amount: overrides.amount,
    bankAccountId: 'bank_1',
    clientIp: '127.0.0.1',
    userAgent: 'node-test',
    idempotencyKey: overrides.idempotencyKey,
  }
}

function createState(overrides: Partial<MockState> = {}): MockState {
  return {
    balance: 1000,
    totalWithdrawn: 0,
    withdrawals: [],
    ledger: [],
    auditSequence: BigInt(0),
    stop: false,
    perRequestLimit: null,
    nextWithdrawalId: 1,
    ...overrides,
  }
}

function installPrismaMock(state: MockState): void {
  let queue = Promise.resolve()
  const prisma = prismaModule.default as unknown as MockablePrisma
  prisma.$transaction = async <T>(callback: (tx: MockTx) => Promise<T>): Promise<T> => {
    const run = queue.then(() => callback(createTx(state)))
    queue = run.then(() => undefined, () => undefined)
    return run
  }
  prisma.withdrawalRequest = createTx(state).withdrawalRequest
  prisma.gmoOAuthToken = {
    findFirst: async () => ({
      access_token: 'access-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    }),
  }
}

function createTx(state: MockState) {
  const bankAccount = {
    bankCode: '0001',
    branchCode: '001',
    accountNumber: '1234567',
    accountType: 'ORDINARY' as const,
    accountHolderName: 'サトウ ミサキ',
    accountHolderNameKana: 'サトウ ミサキ',
  }

  return {
    $executeRaw: async () => undefined,
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?')
      if (sql.includes('point_balances')) {
        return [{ balance: state.balance, total_charged: 0, total_withdrawn: state.totalWithdrawn }]
      }
      if (sql.includes('withdrawal_requests')) {
        return state.withdrawals.filter((withdrawal) => withdrawal.id === values[0])
      }
      return []
    },
    withdrawalRequest: {
      findUnique: async ({ where }: { where: { idempotency_key?: string; id?: string } }) => {
        const withdrawal = state.withdrawals.find((item) =>
          where.idempotency_key ? item.idempotency_key === where.idempotency_key : item.id === where.id
        ) ?? null
        return withdrawal ? { ...withdrawal, bank_account: bankAccount } : null
      },
      create: async ({ data }: { data: Omit<WithdrawalRecord, 'id' | 'requested_at' | 'gmo_apply_no' | 'gmo_account_id' | 'submitted_to_gmo_at' | 'failed_at' | 'last_polled_at' | 'error_message'> }) => {
        const withdrawal: WithdrawalRecord = {
          ...data,
          id: `wr_${state.nextWithdrawalId++}`,
          requested_at: new Date(),
          gmo_apply_no: null,
          gmo_account_id: null,
          submitted_to_gmo_at: null,
          failed_at: null,
          last_polled_at: null,
          error_message: null,
        }
        state.withdrawals.push(withdrawal)
        return withdrawal
      },
      count: async () => state.withdrawals.filter((withdrawal) => withdrawal.status !== 'FAILED').length,
      aggregate: async () => ({
        _sum: {
          requested_amount: state.withdrawals
            .filter((withdrawal) => withdrawal.status !== 'FAILED')
            .reduce((total, withdrawal) => total + withdrawal.requested_amount, 0),
        },
      }),
      update: async ({ where, data }: { where: { id: string }; data: Partial<WithdrawalRecord> }) => {
        const withdrawal = state.withdrawals.find((item) => item.id === where.id)
        if (!withdrawal) throw new Error('withdrawal not found')
        Object.assign(withdrawal, data)
        return withdrawal
      },
      updateMany: async ({ where, data }: {
        where: {
          id?: string
          status?: string
          gmo_apply_no?: string | null
          OR?: Array<{ status?: string; next_poll_at?: { lte: Date } }>
        }
        data: Partial<WithdrawalRecord>
      }) => {
        const matched = state.withdrawals.filter((withdrawal) => {
          if (where.id !== undefined && withdrawal.id !== where.id) return false
          if (where.status !== undefined && withdrawal.status !== where.status) return false
          if (where.gmo_apply_no !== undefined && withdrawal.gmo_apply_no !== where.gmo_apply_no) return false
          if (where.OR && !where.OR.some((condition) => {
            if (condition.status !== undefined && withdrawal.status !== condition.status) return false
            if (condition.next_poll_at?.lte && (!withdrawal.next_poll_at || withdrawal.next_poll_at > condition.next_poll_at.lte)) {
              return false
            }
            return true
          })) return false
          return true
        })
        for (const withdrawal of matched) Object.assign(withdrawal, data)
        return { count: matched.length }
      },
    },
    emergencyStopState: {
      findUnique: async () => state.stop ? { id: 'global', is_stopped: true } : null,
    },
    advancePaymentPolicy: {
      findFirst: async () => state.perRequestLimit
        ? { is_suspended: false, per_request_limit_amount: state.perRequestLimit, daily_limit_amount: null, monthly_limit_amount: null }
        : null,
    },
    bankAccount: {
      findFirst: async () => ({ id: 'bank_1' }),
    },
    pointLedgerEntry: {
      create: async ({ data }: { data: LedgerRecord }) => {
        if (state.ledger.some((entry) => entry.idempotency_key === data.idempotency_key)) {
          throw new Error('duplicate ledger')
        }
        state.ledger.push(data)
        return data
      },
      findUnique: async ({ where }: { where: { idempotency_key: string } }) =>
        state.ledger.find((entry) => entry.idempotency_key === where.idempotency_key) ?? null,
    },
    pointBalance: {
      update: async ({ data }: { data: { balance?: { decrement?: number; increment?: number }; total_withdrawn?: { decrement?: number; increment?: number } } }) => {
        state.balance += data.balance?.increment ?? 0
        state.balance -= data.balance?.decrement ?? 0
        state.totalWithdrawn += data.total_withdrawn?.increment ?? 0
        state.totalWithdrawn -= data.total_withdrawn?.decrement ?? 0
        return { worker_id: 1, balance: state.balance, total_withdrawn: state.totalWithdrawn }
      },
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

type FetchCall = {
  input: URL | RequestInfo
  init?: RequestInit
}

function installGmoFetchMock(handler: (input: URL | RequestInfo, init?: RequestInit) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init })
    return handler(input, init)
  }
  return calls
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
