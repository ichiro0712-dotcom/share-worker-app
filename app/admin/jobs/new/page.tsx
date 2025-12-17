import { getJobDescriptionFormats, getDismissalReasonsFromLaborTemplate } from '@/src/lib/content-actions';
import JobFormWrapper from './JobFormWrapper';

// 動的レンダリングを強制（データベースアクセスを含むため）
export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  // Server Componentでadmin非依存のデータを事前取得
  const [formats, dismissalReasons] = await Promise.all([
    getJobDescriptionFormats(),
    getDismissalReasonsFromLaborTemplate(),
  ]);

  return (
    <JobFormWrapper
      mode="create"
      initialFormats={formats}
      initialDismissalReasons={dismissalReasons}
    />
  );
}
