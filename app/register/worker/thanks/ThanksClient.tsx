'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackGA4Event } from '@/src/lib/ga4-events';

interface Props {
  userName: string;
  lineUrl: string;
}

export default function ThanksClient({ userName, lineUrl }: Props) {
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
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            会員登録が完了しました！
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            {userName ? `${userName} さん、ありがとうございます。` : ''}
            <br />
            LINE登録者限定で、
            <br />
            ご希望に合った施設をお探しいたします！
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            {lineUrl ? (
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-4 px-6 rounded-full text-lg font-bold text-white shadow-[0_6px_24px_rgba(6,199,85,0.35)]"
                style={{ background: 'linear-gradient(135deg,#06C755 0%,#05B34C 100%)' }}
                onClick={() => {
                  try {
                    trackGA4Event('worker_register_thanks_line_click', {});
                  } catch {}
                }}
              >
                📲 LINEで相談する
              </a>
            ) : null}

            <Link
              href="/job-list"
              className="py-3 px-6 rounded-full text-sm font-medium text-gray-500 border border-gray-200 bg-white"
              onClick={() => {
                try {
                  trackGA4Event('worker_register_thanks_jobs_click', {});
                } catch {}
              }}
            >
              求人ページはこちら
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
