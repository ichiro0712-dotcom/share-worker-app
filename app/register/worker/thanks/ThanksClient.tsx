'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackGA4Event } from '@/src/lib/ga4-events';

interface Props {
  lineUrl: string;
}

export default function ThanksClient({ lineUrl }: Props) {
  useEffect(() => {
    try {
      trackGA4Event('worker_register_thanks_view', {});
    } catch {
      // noop
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FCFE]">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="bg-gradient-to-br from-[#E8F7FB] via-[#D4F1F9] to-[#E8F0FE] px-5 pt-6 pb-8 text-center">
          <div className="text-[#2AADCF] font-bold text-lg">タスタス</div>
          <h1 className="text-xl font-bold text-gray-800 mt-1">登録完了</h1>
        </div>

        <div className="px-5 py-10 text-center">
          <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-gradient-to-br from-[#E8F7FB] to-[#D4F1F9] flex items-center justify-center text-3xl">
            🎉
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            会員登録が完了しました！
          </h2>

          <div className="bg-[#EAF7FB] rounded-2xl px-5 py-5 mb-6 text-left">
            <p className="text-center text-[#2AADCF] font-bold mb-3">
              ＼ LINE追加でお仕事探しがもっと快適に！ ／
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>・新着・おすすめ求人をスマホへ最速でお届け！</li>
              <li>・サイトの使い方の疑問はチャットで気軽に質問！</li>
              <li>・その他、お知らせやキャンペーンをご案内！</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 items-center max-w-xs mx-auto">
            {lineUrl ? (
              <a
                href={lineUrl}
                onClick={() => {
                  try {
                    trackGA4Event('worker_register_thanks_line_click', {});
                  } catch {}
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://scdn.line-apps.com/n/line_add_friends/btn/ja.png"
                  alt="友だち追加"
                  height={36}
                  style={{ border: 0 }}
                />
              </a>
            ) : null}

            <Link
              href="/"
              className="py-3 px-6 rounded-full text-sm font-medium text-gray-700 border border-gray-200 bg-white w-full text-center"
              onClick={() => {
                try {
                  trackGA4Event('worker_register_thanks_jobs_click', {});
                } catch {}
              }}
            >
              求人ページはこちら
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
