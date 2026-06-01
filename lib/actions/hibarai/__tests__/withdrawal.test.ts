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
let ProgramNotAllowedError = null as unknown as typeof import('../withdrawal-errors').ProgramNotAllowedError
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
  ProgramNotAllowedError = withdrawalErrors.ProgramNotAllowedError
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
  settlement_month: Date
  bank_snapshot?: unknown
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
  settlement_month?: Date
}

type BankAccountState = {
  id: string
  bankCode: string
  branchCode: string
  accountNumber: string
  accountType: 'ORDINARY' | 'CURRENT'
  accountHolderName: string
  accountHolderNameKana: string | null
  isVerified: boolean
  cooldownUntil: Date | null
  lastChangedAt: Date | null
}

type TransferAttemptRecord = {
  withdrawal_request_id: string
  attempt_no: number
  idempotency_key?: string | null
  gmo_apply_no?: string | null
  error_code?: string | null
  response_status_code?: number | null
  [key: string]: unknown
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
  bankAccount: BankAccountState
  transferAttempts: TransferAttemptRecord[]
  advanceProgram: string
}

type MockTx = ReturnType<typeof createTx>

type MockablePrisma = {
  $transaction: <T>(callback: (tx: MockTx) => Promise<T>, options?: unknown) => Promise<T>
  withdrawalRequest: MockTx['withdrawalRequest']
  gmoOAuthToken: {
    findFirst: () => Promise<{ access_token: string; expires_at: Date } | null>
  }
  transferAttempt: {
    create: (args: { data: TransferAttemptRecord }) => Promise<TransferAttemptRecord>
    findFirst: (args: { where: { withdrawal_request_id: string; gmo_apply_no?: { not: null } } }) => Promise<TransferAttemptRecord | null>
    aggregate: (args: { where: { withdrawal_request_id: string } }) => Promise<{ _max: { attempt_no: number | null } }>
  }
  systemSetting: {
    findUnique: (args: { where: { key: string } }) => Promise<{ value: string } | null>
  }
  emergencyStopState: {
    findUnique: (args: { where: { id: string } }) => Promise<{ is_stopped: boolean } | null>
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

  // settlement_month が申請→引当→組戻しまで一貫して刻まれる
  const expectedMonth = state.withdrawals[0].settlement_month
  assert.ok(expectedMonth instanceof Date)
  const reserved = state.ledger.find((entry) => entry.kind === 'WITHDRAWAL_RESERVED')
  const reverted = state.ledger.find((entry) => entry.kind === 'WITHDRAWAL_REVERTED')
  assert.equal(reserved?.settlement_month?.getTime(), expectedMonth.getTime())
  assert.equal(reverted?.settlement_month?.getTime(), expectedMonth.getTime())
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

const SUCCESS_TRANSFER = {
  applyNo: '1234567890123456',
  resultCode: '1',
  applyEndDatetime: '2026-05-28T10:00:00+09:00',
  accountId: '101011234567',
}

test('P0-3: createWithdrawalRequestは申請時の口座をsnapshotに保存する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)

  await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-store' }))

  const snap = state.withdrawals[0].bank_snapshot as Record<string, unknown> | undefined
  assert.ok(snap, 'bank_snapshot should be saved at request time')
  assert.equal(snap?.bankCode, '0001')
  assert.equal(snap?.branchCode, '001')
  assert.equal(snap?.accountNumber, '1234567')
  assert.equal(snap?.accountType, 'ORDINARY')
})

test('P0-3: GMOペイロードはsnapshotの値で組む', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse(SUCCESS_TRANSFER))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-payload' }))

  await submitWithdrawalToGmo(request.id)

  assert.equal(calls.length, 1)
  const body = JSON.parse(String(calls[0].init?.body))
  const snap = state.withdrawals[0].bank_snapshot as Record<string, unknown>
  assert.equal(body.transfers[0].accountNumber, snap.accountNumber)
  assert.equal(body.transfers[0].beneficiaryBankCode, snap.bankCode)
  assert.equal(body.transfers[0].beneficiaryBranchCode, snap.branchCode)
})

test('P0-3: 申請後に口座フィールド(口座番号)が変わったら送金せずrevertする', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse(SUCCESS_TRANSFER))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-changed' }))

  // lastChangedAt を更新する口座編集パスは未実装でも、フィールド直接比較で検知する
  state.bankAccount.accountNumber = '7654321'

  await assert.rejects(() => submitWithdrawalToGmo(request.id))

  assert.equal(calls.length, 0) // GMOへ一度も送らない
  assert.equal(state.withdrawals[0].status, 'FAILED')
  assert.equal(state.balance, 1000) // 引当が戻る
  assert.equal(state.ledger.some((e) => e.kind === 'WITHDRAWAL_REVERTED'), true)
})

test('P0-3: GMO応答不明後の再送は口座変更でもrevertしない（二重送金防止）', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  let attempt = 0
  const calls = installGmoFetchMock(() => {
    attempt += 1
    if (attempt === 1) return jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500)
    return jsonResponse(SUCCESS_TRANSFER)
  })
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-resend' }))

  // 初回送信 → 500 で応答不明(PROCESSING)
  await assert.rejects(() => submitWithdrawalToGmo(request.id), /server error/)
  assert.equal(state.withdrawals[0].status, 'PROCESSING')

  // この後に口座が変わっても、再送では revert しない（初回送金がGMOに届いている可能性があるため）
  state.bankAccount.accountNumber = '7654321'
  state.withdrawals[0].next_poll_at = new Date(Date.now() - 1000)
  await submitWithdrawalToGmo(request.id)

  assert.equal(calls.length, 2) // 同じ冪等キーで再送した
  assert.notEqual(state.withdrawals[0].status, 'FAILED')
  assert.equal(state.balance, 500) // 返金していない
})

test('P0-3: 再送時のローカル失敗(snapshot不正)でも返金せずPROCESSING維持', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-resend-localfail' }))

  // 初回送信 → 500 で応答不明(PROCESSING)
  await assert.rejects(() => submitWithdrawalToGmo(request.id), /server error/)
  assert.equal(state.withdrawals[0].status, 'PROCESSING')

  // 再送時に snapshot が壊れていても、返金せず PROCESSING を維持する（二重支払い防止）
  state.withdrawals[0].bank_snapshot = { broken: true }
  state.withdrawals[0].next_poll_at = new Date(Date.now() - 1000)
  await assert.rejects(() => submitWithdrawalToGmo(request.id))

  assert.equal(state.withdrawals[0].status, 'PROCESSING')
  assert.equal(state.balance, 500)
  assert.equal(state.ledger.some((e) => e.kind === 'WITHDRAWAL_REVERTED'), false)
})

test('P0-3: 送信時に口座がcooldown中ならrevertする', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse(SUCCESS_TRANSFER))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-cooldown' }))

  state.bankAccount.cooldownUntil = new Date(Date.now() + 60 * 60 * 1000)

  await assert.rejects(() => submitWithdrawalToGmo(request.id))

  assert.equal(calls.length, 0)
  assert.equal(state.withdrawals[0].status, 'FAILED')
  assert.equal(state.balance, 1000)
})

test('P0-3: 送信時に口座がunverifiedならrevertする', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse(SUCCESS_TRANSFER))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'snap-unverified' }))

  state.bankAccount.isVerified = false

  await assert.rejects(() => submitWithdrawalToGmo(request.id))

  assert.equal(calls.length, 0)
  assert.equal(state.withdrawals[0].status, 'FAILED')
  assert.equal(state.balance, 1000)
})

test('P0-4: resultCode=2(未完了)はapplyNoを保存しPROCESSING維持（返金しない）', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => jsonResponse({
    applyNo: '1234567890123456',
    resultCode: '2',
    applyEndDatetime: '2026-05-28T10:00:00+09:00',
    accountId: '101011234567',
  }))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'rc2' }))

  await submitWithdrawalToGmo(request.id)

  assert.equal(state.withdrawals[0].status, 'PROCESSING')
  assert.equal(state.withdrawals[0].gmo_apply_no, '1234567890123456')
  assert.equal(state.balance, 500) // 返金していない
  assert.equal(state.ledger.some((e) => e.kind === 'WITHDRAWAL_REVERTED'), false)
})

test('P0-4: 送信成功時にtransfer_attemptsへ記録する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => jsonResponse({
    applyNo: '1234567890123456',
    resultCode: '1',
    applyEndDatetime: '2026-05-28T10:00:00+09:00',
    accountId: '101011234567',
  }))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'attempt-ok' }))

  await submitWithdrawalToGmo(request.id)

  assert.equal(state.transferAttempts.length, 1)
  assert.equal(state.transferAttempts[0].attempt_no, 1)
  assert.equal(state.transferAttempts[0].gmo_apply_no, '1234567890123456')
})

test('P0-4: 送信失敗(500)時もtransfer_attemptsへ記録する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'attempt-fail' }))

  await assert.rejects(() => submitWithdrawalToGmo(request.id), /server error/)

  assert.equal(state.transferAttempts.length, 1)
  assert.equal(state.transferAttempts[0].gmo_apply_no ?? null, null)
  assert.ok(state.transferAttempts[0].error_code)
})

test('P0-4: 過去試行にapplyNoがあれば再送せずapplyNoを回収する（二重送金防止）', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse({
    applyNo: '9999999999999999',
    resultCode: '1',
    applyEndDatetime: '2026-05-28T10:00:00+09:00',
    accountId: '101011234567',
  }))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'recover' }))

  // 初回送信はGMOに到達しapplyNoを得たが、DB保存に失敗してPROCESSING(applyNo未保存)で残った状況を再現:
  // transfer_attempts にだけ applyNo が記録されている
  state.transferAttempts.push({
    withdrawal_request_id: request.id,
    attempt_no: 1,
    idempotency_key: state.withdrawals[0].idempotency_key,
    gmo_apply_no: '1111111111111111',
  })
  state.withdrawals[0].status = 'PROCESSING'
  state.withdrawals[0].gmo_apply_no = null
  state.withdrawals[0].next_poll_at = new Date(Date.now() - 1000)

  await submitWithdrawalToGmo(request.id)

  assert.equal(calls.length, 0) // 再送しない
  assert.equal(state.withdrawals[0].gmo_apply_no, '1111111111111111') // 過去試行のapplyNoを回収
  assert.equal(state.withdrawals[0].status, 'PROCESSING')
})

test('P0-4: transfer_attemptsはトークンを記録せず、再送でattempt_noが増える', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  let attempt = 0
  installGmoFetchMock(() => {
    attempt += 1
    if (attempt === 1) return jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500)
    return jsonResponse({
      applyNo: '1234567890123456',
      resultCode: '1',
      applyEndDatetime: '2026-05-28T10:00:00+09:00',
      accountId: '101011234567',
    })
  })
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'attempt-seq' }))

  await assert.rejects(() => submitWithdrawalToGmo(request.id), /server error/)
  state.withdrawals[0].next_poll_at = new Date(Date.now() - 1000)
  await submitWithdrawalToGmo(request.id)

  assert.deepEqual(state.transferAttempts.map((a) => a.attempt_no).sort(), [1, 2])
  for (const a of state.transferAttempts) {
    const headers = JSON.stringify((a as Record<string, unknown>).request_headers ?? {}).toLowerCase()
    assert.ok(!headers.includes('authorization'), 'headers must not contain authorization')
    assert.ok(!headers.includes('access-token'), 'headers must not contain token')
  }
})

test('P0-4: transfer_attempts記録が失敗してもsubmit本体は完了する', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  installGmoFetchMock(() => jsonResponse({
    applyNo: '1234567890123456',
    resultCode: '1',
    applyEndDatetime: '2026-05-28T10:00:00+09:00',
    accountId: '101011234567',
  }))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'attempt-recfail' }))

  // 記録(create)だけ失敗させる（findFirst/aggregateは生かす）
  const prisma = prismaModule.default as unknown as MockablePrisma
  prisma.transferAttempt.create = async () => { throw new Error('record failed') }

  await submitWithdrawalToGmo(request.id)

  assert.equal(state.withdrawals[0].gmo_apply_no, '1234567890123456') // 本体は成功
  assert.equal(state.withdrawals[0].status, 'PROCESSING')
})

test('緊急停止中は送信(submit)もGMOへ送らない', async () => {
  const state = createState({ balance: 1000 })
  installPrismaMock(state)
  const calls = installGmoFetchMock(() => jsonResponse({
    applyNo: '1234567890123456', resultCode: '1', applyEndDatetime: '2026-05-28T10:00:00+09:00', accountId: '101011234567',
  }))
  const request = await createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'stop-submit' }))

  // 申請後に緊急停止
  state.stop = true
  await submitWithdrawalToGmo(request.id)

  assert.equal(calls.length, 0) // GMOへ送らない
  assert.equal(state.withdrawals[0].status, 'PENDING') // claimもせずPENDINGのまま
})

test('per_request_limit=0 は「制限なし」ではなく全出金を止める', async () => {
  const state = createState({ balance: 1000, perRequestLimit: 0 })
  installPrismaMock(state)
  await assert.rejects(
    () => createWithdrawalRequest(createInput({ amount: 1, idempotencyKey: 'limit-zero' })),
    OverLimitError
  )
  assert.equal(state.balance, 1000)
})

test('P0-5: advance_program=DISABLED のワーカーは出金できない', async () => {
  const state = createState({ balance: 1000, advanceProgram: 'DISABLED' })
  installPrismaMock(state)

  await assert.rejects(
    () => createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'prog-disabled' })),
    ProgramNotAllowedError
  )

  assert.equal(state.balance, 1000) // 引当しない
  assert.equal(state.ledger.length, 0)
  assert.equal(state.withdrawals.length, 0)
})

test('P0-5: advance_program=LEGACY_CARRYBARAI のワーカーは出金できない', async () => {
  const state = createState({ balance: 1000, advanceProgram: 'LEGACY_CARRYBARAI' })
  installPrismaMock(state)

  await assert.rejects(
    () => createWithdrawalRequest(createInput({ amount: 500, idempotencyKey: 'prog-legacy' })),
    ProgramNotAllowedError
  )

  assert.equal(state.balance, 1000)
  assert.equal(state.withdrawals.length, 0)
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
    bankAccount: {
      id: 'bank_1',
      bankCode: '0001',
      branchCode: '001',
      accountNumber: '1234567',
      accountType: 'ORDINARY',
      accountHolderName: 'サトウ ミサキ',
      accountHolderNameKana: 'サトウ ミサキ',
      isVerified: true,
      cooldownUntil: null,
      lastChangedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    transferAttempts: [],
    advanceProgram: 'HIBARAI',
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
  // getEffectiveWithdrawalFee は systemSetting を読む。null → env(HIBARAI_DEFAULT_FEE_JPY=143)にフォールバック
  prisma.systemSetting = { findUnique: async () => null }
  // submitWithdrawalToGmo は送信前に緊急停止を再確認する。state.stop を反映
  prisma.emergencyStopState = { findUnique: async () => (state.stop ? { is_stopped: true } : null) }
  prisma.transferAttempt = {
    create: async ({ data }: { data: TransferAttemptRecord }) => {
      if (state.transferAttempts.some((a) => a.withdrawal_request_id === data.withdrawal_request_id && a.attempt_no === data.attempt_no)) {
        throw new Error('duplicate transfer_attempt (withdrawal_request_id, attempt_no)')
      }
      state.transferAttempts.push(data)
      return data
    },
    findFirst: async ({ where }: { where: { withdrawal_request_id: string; gmo_apply_no?: { not: null } } }) => {
      const rows = state.transferAttempts
        .filter((a) => a.withdrawal_request_id === where.withdrawal_request_id)
        .filter((a) => (where.gmo_apply_no ? a.gmo_apply_no != null : true))
        .sort((a, b) => b.attempt_no - a.attempt_no)
      return rows[0] ?? null
    },
    aggregate: async ({ where }: { where: { withdrawal_request_id: string } }) => {
      const nos = state.transferAttempts
        .filter((a) => a.withdrawal_request_id === where.withdrawal_request_id)
        .map((a) => a.attempt_no)
      return { _max: { attempt_no: nos.length > 0 ? Math.max(...nos) : null } }
    },
  }
}

function createTx(state: MockState) {
  const bankAccount = state.bankAccount

  return {
    $executeRaw: async () => undefined,
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?')
      if (sql.includes('point_balances')) {
        return [{ balance: state.balance, total_charged: 0, total_withdrawn: state.totalWithdrawn }]
      }
      if (sql.includes('withdrawal_requests')) {
        // 実 DB と同様に「SELECT した列だけ」を返す。列漏れ(例: settlement_month未取得)を検出するため。
        const columns = parseSelectColumns(sql)
        return state.withdrawals
          .filter((withdrawal) => withdrawal.id === values[0])
          .map((withdrawal) => projectColumns(withdrawal, columns))
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
      findFirst: async () => {
        if (state.perRequestLimit === null && state.advanceProgram === 'HIBARAI') return null
        return {
          is_suspended: false,
          per_request_limit_amount: state.perRequestLimit,
          daily_limit_amount: null,
          monthly_limit_amount: null,
          advance_program: state.advanceProgram,
        }
      },
    },
    bankAccount: {
      findFirst: async () => {
        const ba = state.bankAccount
        const now = new Date()
        if (!ba.isVerified) return null
        if (ba.cooldownUntil && ba.cooldownUntil > now) return null
        return {
          id: ba.id,
          bankCode: ba.bankCode,
          branchCode: ba.branchCode,
          accountNumber: ba.accountNumber,
          accountType: ba.accountType,
          accountHolderName: ba.accountHolderName,
          accountHolderNameKana: ba.accountHolderNameKana,
          isVerified: ba.isVerified,
          cooldownUntil: ba.cooldownUntil,
          lastChangedAt: ba.lastChangedAt,
        }
      },
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

function parseSelectColumns(sql: string): string[] {
  const match = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i)
  if (!match) return []
  return match[1].split(',').map((column) => column.trim())
}

function projectColumns<T extends Record<string, unknown>>(row: T, columns: string[]): Partial<T> {
  if (columns.length === 0) return row
  const projected: Record<string, unknown> = {}
  for (const column of columns) projected[column] = row[column]
  return projected as Partial<T>
}
