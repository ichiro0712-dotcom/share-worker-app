import { notFound } from 'next/navigation';
import { WorkerSettingsPanel } from '@/components/admin/hibarai/WorkerSettingsPanel';
import { workerSettings } from '@/lib/dummy-data/hibarai';
import { isHibaraiEnabled } from '@/lib/features';

type WorkerSettingsPageProps = {
  params: {
    workerId: string;
  };
};

export default function WorkerHibaraiSettingsPage({ params }: WorkerSettingsPageProps) {
  if (!isHibaraiEnabled()) notFound();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">ワーカー別前払い設定</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          対象ワーカー: {params.workerId}。前払い率、上限金額、停止状態をダミーで編集できます。
        </p>
      </div>
      <WorkerSettingsPanel settings={{ ...workerSettings, workerId: params.workerId }} />
    </main>
  );
}
