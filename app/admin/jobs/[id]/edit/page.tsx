import { getJobDescriptionFormats, getDismissalReasonsFromLaborTemplate } from '@/src/lib/content-actions';
import EditJobFormWrapper from './EditJobFormWrapper';

// 動的レンダリングを強制（データベースアクセスを含むため）
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditJobPage({ params }: PageProps) {
  const { id } = await params;

  // Server Componentでadmin非依存のデータを事前取得
  const [formats, dismissalReasons] = await Promise.all([
    getJobDescriptionFormats(),
    getDismissalReasonsFromLaborTemplate(),
  ]);

  return (
    <EditJobFormWrapper
      jobId={id}
      initialFormats={formats}
      initialDismissalReasons={dismissalReasons}
    />
  );
}
