import { redirect } from 'next/navigation';

// 古いルートから新しいルートへリダイレクト
export default function ApplicationsRedirect() {
  redirect('/mypage/applications');
}
