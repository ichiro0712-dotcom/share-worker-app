import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAdvisorAuth } from '@/src/lib/advisor/auth';
import { ChatLayout } from '@/src/components/advisor/chat/chat-layout';

export const dynamic = 'force-dynamic';

export default async function AdvisorPage() {
  const auth = await getAdvisorAuth();
  if (!auth) {
    redirect('/system-admin/login');
  }

  return (
    <Suspense fallback={null}>
      <ChatLayout
        adminName={auth.name || 'admin'}
        adminEmail={auth.email}
        adminRole={auth.role}
      />
    </Suspense>
  );
}
