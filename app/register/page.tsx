import { redirect } from 'next/navigation';

export default function Register() {
  // ワーカー登録ページにリダイレクト
  redirect('/register/worker');
}
