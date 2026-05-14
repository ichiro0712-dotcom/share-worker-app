import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start updating primary accounts...')

    try {
        const count = await prisma.$executeRaw`
      UPDATE facility_admins fa
      SET is_primary = true
      WHERE id = (
        SELECT id FROM facility_admins 
        WHERE facility_id = fa.facility_id 
        ORDER BY created_at ASC 
        LIMIT 1
      )
    `
        console.log(`Updated ${count} accounts to primary.`)
    } catch (e) {
        console.error('Error updating accounts:', e)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
