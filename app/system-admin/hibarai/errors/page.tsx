import { notFound, redirect } from 'next/navigation';
import { ErrorQueueTable } from '@/components/admin/hibarai/ErrorQueueTable';
import { getHibaraiErrors } from '@/lib/actions/hibarai/admin-errors';
import { isHibaraiEnabled } from '@/lib/features';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export const dynamic = 'force-dynamic';

export default async function HibaraiErrorsPage() {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const rows = await getHibaraiErrors();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">出金エラー対応キュー</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">ワーカー名、エラー種別、金額、発生時刻、対応状態を確認します。</p>
      </div>
      <ErrorQueueTable rows={rows} filterable />
    </main>
  );
}
