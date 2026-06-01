import assert from 'node:assert/strict'
import test from 'node:test'
import { RealGmoClient } from '../client'
import { GmoApiError, GmoAuthError, GmoNetworkError } from '../errors'
import type { TransferRequest } from '../types'

type FetchCall = {
  input: URL | RequestInfo
  init?: RequestInit
}

test('requestTransfer sends Idempotency-Key header', async () => {
  const calls: FetchCall[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ input, init })
    return jsonResponse({
      applyNo: '1234567890123456',
      resultCode: '1',
      applyEndDatetime: '2026-05-28T10:00:00+09:00',
    })
  }
  const client = new RealGmoClient({ baseUrl: 'https://stg-api.gmo-aozora.com', fetchImpl })

  await client.requestTransfer('access-token', 'hibarai-worker-123', createTransferRequest())

  assert.equal(calls.length, 1)
  const headers = new Headers(calls[0].init?.headers)
  assert.equal(headers.get('Idempotency-Key'), 'hibarai-worker-123')
})

test('requestTransfer parses success response without accountId', async () => {
  const client = new RealGmoClient({
    baseUrl: 'https://stg-api.gmo-aozora.com',
    fetchImpl: async () => jsonResponse({
      applyNo: '1234567890123456',
      resultCode: '1',
      applyEndDatetime: '2026-05-28T10:00:00+09:00',
    }),
  })

  const result = await client.requestTransfer('access-token', 'hibarai-worker-123', createTransferRequest())

  assert.equal(result.applyNo, '1234567890123456')
  assert.equal(result.accountId, undefined)
})

test('client distinguishes 4xx, 5xx, and network errors', async () => {
  const badRequestClient = new RealGmoClient({
    baseUrl: 'https://stg-api.gmo-aozora.com',
    fetchImpl: async () => jsonResponse({ errorCode: 'BAD_REQUEST', errorMessage: 'bad request' }, 400),
  })
  await assert.rejects(
    () => badRequestClient.listAccounts('access-token'),
    (error) => {
      assert.equal(error instanceof GmoApiError, true)
      assert.equal(error instanceof GmoAuthError, false)
      assert.equal((error as GmoApiError).statusCode, 400)
      return true
    }
  )

  const authClient = new RealGmoClient({
    baseUrl: 'https://stg-api.gmo-aozora.com',
    fetchImpl: async () => jsonResponse({ errorCode: 'UNAUTHORIZED', errorMessage: 'unauthorized' }, 401),
  })
  await assert.rejects(
    () => authClient.listAccounts('access-token'),
    (error) => {
      assert.equal(error instanceof GmoAuthError, true)
      assert.equal((error as GmoApiError).statusCode, 401)
      return true
    }
  )

  const serverErrorClient = new RealGmoClient({
    baseUrl: 'https://stg-api.gmo-aozora.com',
    fetchImpl: async () => jsonResponse({ errorCode: 'SERVER_ERROR', errorMessage: 'server error' }, 500),
  })
  await assert.rejects(
    () => serverErrorClient.listAccounts('access-token'),
    (error) => {
      assert.equal(error instanceof GmoApiError, true)
      assert.equal(error instanceof GmoNetworkError, false)
      assert.equal((error as GmoApiError).statusCode, 500)
      return true
    }
  )

  const networkErrorClient = new RealGmoClient({
    baseUrl: 'https://stg-api.gmo-aozora.com',
    fetchImpl: async () => {
      throw new Error('connection refused')
    },
  })
  await assert.rejects(
    () => networkErrorClient.listAccounts('access-token'),
    (error) => {
      assert.equal(error instanceof GmoNetworkError, true)
      assert.equal((error as GmoApiError).statusCode, 0)
      return true
    }
  )
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createTransferRequest(): TransferRequest {
  return {
    accountId: '101011234567',
    remitterName: 'タスタス',
    transferDesignatedDate: '2026-05-29',
    transferDateHolidayCode: '1',
    totalCount: '1',
    totalAmount: '1000',
    transfers: [
      {
        itemId: '1',
        transferAmount: '1000',
        beneficiaryBankCode: '0001',
        beneficiaryBranchCode: '001',
        accountTypeCode: '1',
        accountNumber: '1234567',
        beneficiaryName: 'サトウ ミサキ',
      },
    ],
  }
}
