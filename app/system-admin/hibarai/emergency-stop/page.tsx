import { notFound } from 'next/navigation';
import { EmergencyStopControlPanel } from '@/components/admin/hibarai/EmergencyStopControlPanel';
import { stopHistory } from '@/lib/dummy-data/hibarai';
import { isHibaraiEnabled } from '@/lib/features';

export default function EmergencyStopPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">緊急一括停止</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          停止は単独可、解除は二者承認の想定です。UIプロトタイプではダミーで状態を切り替えます。
        </p>
      </div>
      <EmergencyStopControlPanel history={stopHistory} />
    </main>
  );
}
