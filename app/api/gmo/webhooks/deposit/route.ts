import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { isHibaraiEnabled } from '@/lib/features'
import prisma from '@/lib/prisma'
import { verifyWebhookSignature, WebhookDepositPayloadSchema } from '@/lib/gmo-aozora'
import type { WebhookDepositMessage } from '@/lib/gmo-aozora'
import { createHibaraiAuditLog } from '@/lib/actions/hibarai/audit'
import { createSupportCode, getErrorMessage, isUniqueConstraintError } from '@/lib/actions/hibarai/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  if (!isHibaraiEnabled()) return new Response('Not found', { status: 404 })

  const rawBody = await request.text()
  const signature = request.headers.get('x-webhook-signature')
  const secret = process.env.GMO_AOZORA_WEBHOOK_SECRET ?? ''

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = WebhookDepositPayloadSchema.safeParse(parsedBody)
  if (!payload.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = { received: payload.data.messages.length, created: 0, skipped: 0 }
    for (const message of payload.data.messages) {
      const status = await persistWebhookMessage(message, signature)
      if (status === 'created') results.created += 1
      if (status === 'skipped') results.skipped += 1
    }

    return NextResponse.json({ ok: true, ...results }, { status: 200 })
  } catch (error) {
    const supportCode = createSupportCode('HBW')
    console.error('[GMO_DEPOSIT_WEBHOOK_ERROR]', supportCode, getErrorMessage(error))
    return NextResponse.json({ supportCode }, { status: 500 })
  }
}

async function persistWebhookMessage(
  message: WebhookDepositMessage,
  signatureHeader: string | null
): Promise<'created' | 'skipped'> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const event = await tx.gmoWebhookEvent.create({
          data: {
            event_type: 'DEPOSIT',
            message_id: message.messageId,
            payload: message as Prisma.InputJsonValue,
            signature_header: signatureHeader,
            signature_valid: true,
            processed_at: new Date(),
            virtual_account_id: message.vaTransaction.virtualAccountId ?? null,
            deposit_amount: Number(message.vaTransaction.depositAmount),
            remitter_name_kana: message.vaTransaction.remitterNameKana ?? null,
          },
        })

        await createHibaraiAuditLog(tx, {
          actorType: 'GMO_WEBHOOK',
          action: 'GMO_DEPOSIT_WEBHOOK_RECEIVED',
          targetType: 'GmoWebhookEvent',
          targetId: event.id,
          idempotencyKey: message.messageId,
          payload: {
            messageId: message.messageId,
            depositAmount: message.vaTransaction.depositAmount,
            virtualAccountId: message.vaTransaction.virtualAccountId ?? null,
          } as Prisma.InputJsonValue,
          result: 'SUCCESS',
        })
        return 'created' as const
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 }
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) return 'skipped'
    throw error
  }
}
