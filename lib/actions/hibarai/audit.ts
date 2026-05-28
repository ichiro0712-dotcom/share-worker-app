import { createHash, randomUUID } from 'crypto'
import { HibaraiAuditActorType, HibaraiAuditResult, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

export type HibaraiAuditInput = {
  actorType: HibaraiAuditActorType
  actorId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  requestId?: string | null
  idempotencyKey?: string | null
  payload?: Prisma.InputJsonValue
  result: HibaraiAuditResult
  errorCode?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  chainScope?: string
}

export async function createHibaraiAuditLog(
  tx: Prisma.TransactionClient,
  input: HibaraiAuditInput
): Promise<void> {
  const chainScope = input.chainScope ?? 'global'

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hibarai_audit_${chainScope}`}))`

  const previous = await tx.hibaraiAuditLog.findFirst({
    where: { chain_scope: chainScope },
    orderBy: { chain_sequence: 'desc' },
    select: { chain_sequence: true, hash_self: true },
  })
  const chainSequence = (previous?.chain_sequence ?? BigInt(0)) + BigInt(1)
  const payload = input.payload ?? {}
  const hashSelf = createHash('sha256')
    .update(JSON.stringify({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      payload,
      result: input.result,
      chainScope,
      chainSequence: chainSequence.toString(),
      hashPrev: previous?.hash_self ?? null,
      nonce: randomUUID(),
    }))
    .digest('hex')

  await tx.hibaraiAuditLog.create({
    data: {
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      request_id: input.requestId ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      payload,
      result: input.result,
      error_code: input.errorCode ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      chain_scope: chainScope,
      chain_sequence: chainSequence,
      hash_prev: previous?.hash_self ?? null,
      hash_self: hashSelf,
    },
  })
}

export async function recordHibaraiAudit(input: HibaraiAuditInput): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await createHibaraiAuditLog(tx, input)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
  )
}
