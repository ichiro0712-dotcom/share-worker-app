import { notFound, redirect } from 'next/navigation';
import { WorkerSettingsPanel } from '@/components/admin/hibarai/WorkerSettingsPanel';
import { isHibaraiEnabled } from '@/lib/features';
import { getWorkerPolicyForAdmin } from '@/lib/actions/hibarai/policy';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';
import prisma from '@/lib/prisma';

type WorkerSettingsPageProps = {
  params: {
    workerId: string;
  };
};

export default async function WorkerHibaraiSettingsPage({ params }: WorkerSettingsPageProps) {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const workerId = Number(params.workerId);
  if (!Number.isInteger(workerId) || workerId <= 0) notFound();

  const [worker, policy] = await Promise.all([
    prisma.user.findUnique({ where: { id: workerId }, select: { id: true, name: true } }),
    getWorkerPolicyForAdmin(workerId),
  ]);
  if (!worker) notFound();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">ワーカー別前払い設定</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          対象: {worker.name}（ID: {worker.id}）。前払い率・上限・停止・日払い対象可否を設定します。変更は監査ログに記録されます。
        </p>
      </div>
      <WorkerSettingsPanel workerId={worker.id} workerName={worker.name} policy={policy} />
    </main>
  );
}
