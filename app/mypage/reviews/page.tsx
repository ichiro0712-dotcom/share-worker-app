import { getPendingReviews, getMyReviews } from '@/src/lib/actions';
import ReviewsClient from './ReviewsClient';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const session = await getServerSession(authOptions);

  // 未ログイン時はログインページへリダイレクト
  if (!session) {
    redirect('/login?callbackUrl=/mypage/reviews');
  }

  const [pendingReviews, myReviews] = await Promise.all([
    getPendingReviews(),
    getMyReviews(),
  ]);

  return (
    <ReviewsClient
      pendingReviews={pendingReviews}
      myReviews={myReviews}
    />
  );
}
