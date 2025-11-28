import { getApplicationForReview } from '@/src/lib/actions';
import ReviewFormClient from './ReviewFormClient';
import { redirect, notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

interface Props {
  params: { applicationId: string };
}

export default async function ReviewFormPage({ params }: Props) {
  const session = await getServerSession(authOptions);

  // 未ログイン時はログインページへリダイレクト
  if (!session) {
    redirect('/login?callbackUrl=/mypage/reviews');
  }

  const applicationId = parseInt(params.applicationId, 10);

  if (isNaN(applicationId)) {
    notFound();
  }

  const applicationData = await getApplicationForReview(applicationId);

  if (!applicationData) {
    notFound();
  }

  // すでに評価済みの場合はリストにリダイレクト
  if (applicationData.workerReviewStatus === 'COMPLETED') {
    redirect('/mypage/reviews');
  }

  return <ReviewFormClient applicationData={applicationData} />;
}
