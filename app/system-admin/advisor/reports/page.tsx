import { redirect } from 'next/navigation'
import { getAdvisorAuth } from '@/src/lib/advisor/auth'
import { ReportsListClient } from '@/src/components/advisor/reports/reports-list'

export const dynamic = 'force-dynamic'

export default async function AdvisorReportsPage() {
  const auth = await getAdvisorAuth()
  if (!auth) {
    redirect('/system-admin/login')
  }
  return <ReportsListClient />
}
