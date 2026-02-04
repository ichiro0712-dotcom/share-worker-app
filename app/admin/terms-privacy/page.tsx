import { redirect } from 'next/navigation';

// 施設向け利用規約は公開ページに一元化
// /terms/facility へリダイレクト
export default function TermsAndPrivacyRedirect() {
    redirect('/terms/facility');
}
