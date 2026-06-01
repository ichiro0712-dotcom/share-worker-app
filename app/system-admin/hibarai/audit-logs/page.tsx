import { notFound, redirect } from 'next/navigation';
import { AuditLogsClient } from '@/components/admin/hibarai/AuditLogsClient';
import { isHibaraiEnabled } from '@/lib/features';
import { getHibaraiAuditLogsForAdmin } from '@/lib/actions/hibarai/admin-dashboard';
import { getSystemAdminSessionData } from '@/lib/system-admin-session-server';

export default async function HibaraiAuditLogsPage() {
  if (!isHibaraiEnabled()) notFound();

  const session = await getSystemAdminSessionData();
  if (!session) redirect('/system-admin/login');

  const rows = await getHibaraiAuditLogsForAdmin();

  return (
    <main className="mx-auto max-w-[1600px] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">監査ログ</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">送金・口座・設定・停止操作の履歴をイベント種別で確認します（append-only ハッシュチェーン）。</p>
      </div>
      <AuditLogsClient rows={rows} />
    </main>
  );
}
