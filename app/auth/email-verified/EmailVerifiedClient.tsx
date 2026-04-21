'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackGA4Event } from '@/src/lib/ga4-events';

interface Props {
  userName: string;
  returnUrl: string | null;
}

export default function EmailVerifiedClient({ userName, returnUrl }: Props) {
  useEffect(() => {
    try {
      trackGA4Event('email_verified_thanks_view', {
        has_return_url: returnUrl ? 'true' : 'false',
      });
    } catch {
      // noop
    }
  }, [returnUrl]);

  return (
    <div className="min-h-screen bg-[#F8FCFE]">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="bg-gradient-to-br from-[#E8F7FB] via-[#D4F1F9] to-[#E8F0FE] px-5 pt-6 pb-8 text-center">
          <div className="text-[#2AADCF] font-bold text-lg">タスタス</div>
          <h1 className="text-xl font-bold text-gray-800 mt-1">メール認証完了</h1>
        </div>

        <div className="px-5 py-10 text-center">
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-[#E8F7FB] to-[#D4F1F9] flex items-center justify-center text-3xl">
            ✅
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            メールアドレスの認証が完了しました
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            {userName ? `${userName} さん、` : ''}
            ご登録ありがとうございます。
            <br />
            求人へのご応募が可能になりました。
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            {returnUrl && (
              <Link
                href={returnUrl}
                className="py-4 px-6 rounded-full bg-[#2AADCF] text-white text-base font-bold shadow-[0_6px_24px_rgba(42,173,207,0.3)]"
                onClick={() => {
                  try {
                    trackGA4Event('email_verified_thanks_return_click', {});
                  } catch {}
                }}
              >
                応募ページへ戻る
              </Link>
            )}
            <Link
              href="/job-list"
              className="py-3 px-6 rounded-full border border-gray-300 text-gray-700 text-sm font-medium bg-white"
            >
              求人一覧を見る
            </Link>
            <Link
              href="/mypage"
              className="py-3 px-6 rounded-full text-sm font-medium text-[#2AADCF] underline"
            >
              マイページへ移動
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
