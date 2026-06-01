import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { Prisma } from '@prisma/client'

process.env.NEXT_PUBLIC_FEATURE_HIBARAI = 'true'
process.env.GMO_AOZORA_WEBHOOK_SECRET = 'webhook-secret'

let prismaModule = null as unknown as typeof import('@/lib/prisma')
let POST = null as unknown as typeof import('../route').POST

test.before(async () => {
  prismaModule = await import('@/lib/prisma')
  const routeModule = await import('../route')
  POST = routeModule.POST
})

type WebhookEventRecord = {
  id: string
  message_id: string
  payload: unknown
}

type MockState = {
  events: WebhookEventRecord[]
  auditSequence: bigint
}

type MockTx = ReturnType<typeof createTx>

type MockablePrisma = {
  $transaction: <T>(callback: (tx: MockTx) => Promise<T>, options?: unknown) => Promise<T>
}

test('正しい署名は200を返しGmoWebhookEventを作成する', async () => {
  const state = installPrismaMock()
  const response = await POST(createRequest(createPayload('msg-1'), true))

  assert.equal(response.status, 200)
  assert.equal(state.events.length, 1)
  assert.equal(state.events[0].message_id, 'msg-1')
})

test('間違った署名は401を返す', async () => {
  const state = installPrismaMock()
  const response = await POST(createRequest(createPayload('msg-2'), false))

  assert.equal(response.status, 401)
  assert.equal(state.events.length, 0)
})

test('同じmessage_idの2回目はskipする', async () => {
  const state = installPrismaMock()
  const body = createPayload('msg-3')

  const first = await POST(createRequest(body, true))
  const second = await POST(createRequest(body, true))
  const json = await second.json() as { skipped: number }

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(json.skipped, 1)
  assert.equal(state.events.length, 1)
})

function installPrismaMock(): MockState {
  const state: MockState = { events: [], auditSequence: BigInt(0) }
  const prisma = prismaModule.default as unknown as MockablePrisma
  prisma.$transaction = async <T>(callback: (tx: MockTx) => Promise<T>): Promise<T> => callback(createTx(state))
  return state
}

function createTx(state: MockState) {
  return {
    $executeRaw: async () => undefined,
    gmoWebhookEvent: {
      create: async ({ data }: { data: { message_id: string; payload: unknown } }) => {
        const existing = state.events.find((event) => event.message_id === data.message_id)
        if (existing) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '5.22.0',
            meta: { target: ['message_id'] },
          })
        }
        const event = { id: `event-${state.events.length + 1}`, message_id: data.message_id, payload: data.payload }
        state.events.push(event)
        return event
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

function createRequest(body: string, validSignature: boolean): Request {
  const secret = validSignature ? process.env.GMO_AOZORA_WEBHOOK_SECRET ?? '' : 'wrong-secret'
  const signature = createHmac('sha256', secret).update(body).digest('base64')
  return new Request('http://localhost/api/gmo/webhooks/deposit', {
    method: 'POST',
    headers: { 'x-webhook-signature': `sha256=${signature}` },
    body,
  })
}

function createPayload(messageId: string): string {
  return JSON.stringify({
    messages: [
      {
        messageId,
        timestamp: '2026-05-28T10:00:00+09:00',
        account: { accountId: '101011234567' },
        vaTransaction: {
          transactionId: `tx-${messageId}`,
          virtualAccountId: 'va-1',
          depositAmount: '1000',
          remitterNameKana: 'タナカ タロウ',
        },
      },
    ],
  })
}
