import { notFound, redirect } from 'next/navigation';
import { EmergencyStopControlPanel } from '@/components/admin/hibarai/EmergencyStopControlPanel';
import { isHibaraiEnabled } from '@/lib/features';
import { getEmergencyStopState, getEmergencyStopHistory } from '@/lib/actions/hibarai/emergency-stop';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export default async function EmergencyStopPage() {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const [state, history] = await Promise.all([getEmergencyStopState(), getEmergencyStopHistory()]);

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">緊急一括停止</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          異常時に全ワーカーの日払いを一括停止します。停止・解除とも単独で実行できますが、理由は必ず監査ログに記録されます。
        </p>
      </div>
      <EmergencyStopControlPanel initialStopped={state.isStopped} history={history} />
    </main>
  );
}
