import { notFound } from 'next/navigation';
import { AuditLogsClient } from '@/components/admin/hibarai/AuditLogsClient';
import { auditLogs } from '@/lib/dummy-data/hibarai';
import { isHibaraiEnabled } from '@/lib/features';

export default function HibaraiAuditLogsPage() {
  if (!isHibaraiEnabled()) notFound();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">監査ログ</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">送金・口座・設定・停止操作の履歴をイベント種別で確認します。</p>
      </div>
      <AuditLogsClient rows={auditLogs} />
    </main>
  );
}
