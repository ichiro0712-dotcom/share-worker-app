import { redirect } from 'next/navigation';
import { getAdvisorAuth } from '@/src/lib/advisor/auth';
import { HistoryClient } from '@/src/components/advisor/history/history-client';

export const dynamic = 'force-dynamic';

export default async function AdvisorHistoryPage() {
  const auth = await getAdvisorAuth();
  if (!auth) {
    redirect('/system-admin/login');
  }
  return <HistoryClient />;
}
