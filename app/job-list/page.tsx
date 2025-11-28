import { redirect } from 'next/navigation';

// /job-list は /（トップ）にリダイレクト
// トップページが同じ機能を持つDB連携済み画面のため
export default function JobListPage() {
  redirect('/');
}
