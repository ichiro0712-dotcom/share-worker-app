import { redirect, notFound } from 'next/navigation'
import { getAdvisorAuth } from '@/src/lib/advisor/auth'
import { getVersionDetail } from '@/src/lib/advisor/actions/report-versions'
import { ReportDetailClient } from '@/src/components/advisor/reports/report-detail'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ versionId: string }>
}

export default async function AdvisorReportDetailPage({ params }: Props) {
  const auth = await getAdvisorAuth()
  if (!auth) {
    redirect('/system-admin/login')
  }
  const { versionId } = await params
  const version = await getVersionDetail(versionId)
  if (!version) notFound()
  return <ReportDetailClient initial={version} />
}
