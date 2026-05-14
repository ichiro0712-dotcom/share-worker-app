import { prisma } from '../lib/prisma'

async function main() {
  const sessionId = process.argv[2]
  if (!sessionId) {
    const latest = await prisma.advisorAuditLog.findFirst({
      where: { event_type: 'chat_request' },
      orderBy: { created_at: 'desc' },
      select: { session_id: true },
    })
    if (!latest?.session_id) { console.log('no audit'); return }
    console.log('using session:', latest.session_id)
    process.argv[2] = latest.session_id
  }
  const sid = process.argv[2]
  const logs = await prisma.advisorAuditLog.findMany({
    where: { session_id: sid },
    orderBy: { created_at: 'asc' },
  })
  for (const log of logs) {
    console.log(`${log.created_at.toISOString()} ${log.event_type}`)
    console.log('  payload:', JSON.stringify(log.payload, null, 2).slice(0, 500))
  }
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
