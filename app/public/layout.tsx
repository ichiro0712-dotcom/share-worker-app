'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, Suspense, useCallback, useEffect, useState } from 'react';

interface PublicLayoutProps {
  children: ReactNode;
}

/**
 * 公開ページ用レイアウト
 * - ヘッダー: なし（各ページで必要に応じて設定）
 * - フッター: 会員登録CTAボタン（固定）※求人検索ページでは非表示
 * - ナビゲーションメニューなし
 *
 * LP経由（from_lp パラメータあり）の場合:
 * - CTAボタンはLINE LIFF URLにリンク
 * - クリックトラッキングは該当LPのイベントとして送信
 */
export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <Suspense fallback={<PublicLayoutFallback>{children}</PublicLayoutFallback>}>
      <PublicLayoutInner>{children}</PublicLayoutInner>
    </Suspense>
  );
}

/** Suspense fallback — searchParams なしの状態で表示 */
function PublicLayoutFallback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isJobListPage = pathname === '/public/jobs';

  return (
    <div className="min-h-screen bg-background">
      <main
        className="max-w-lg mx-auto"
        style={{ paddingBottom: isJobListPage ? undefined : 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
      {!isJobListPage && (
        <footer
          className="fixed bottom-0 left-0 right-0 bg-primary z-20"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-lg mx-auto p-4">
            <Link
              href="/login"
              className="block w-full bg-white text-primary font-bold py-3 rounded-lg text-center shadow-lg hover:bg-gray-50 transition-colors"
            >
              会員登録して応募する
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}

function PublicLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // /public/jobs（求人検索一覧ページ）ではCTAフッターを非表示
  const isJobListPage = pathname === '/public/jobs';

  // LP経由の場合
  const fromLp = searchParams?.get('from_lp');
  const [lineUrl, setLineUrl] = useState<string | null>(null);

  // LP情報（localStorageから取得、CTAリンクのクエリパラメータに埋め込む用）
  const [lpParams, setLpParams] = useState<{ lpId: string | null; campaignCode: string | null; genrePrefix: string | null }>({
    lpId: null, campaignCode: null, genrePrefix: null,
  });

  // LP経由の場合、LINE URLを取得
  useEffect(() => {
    if (!fromLp) return;

    fetch(`/api/public/lp-line-url?lp=${encodeURIComponent(fromLp)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.url) setLineUrl(data.url);
      })
      .catch(() => {});
  }, [fromLp]);

  // localStorageからLP情報を取得（CTAリンクにクエリパラメータとして付与するため）
  useEffect(() => {
    try {
      const data = localStorage.getItem('lp_tracking_data');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.expiry && Date.now() < parsed.expiry) {
          setLpParams({
            lpId: parsed.lpId || null,
            campaignCode: parsed.campaignCode || null,
            genrePrefix: parsed.genrePrefix || null,
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // CTAクリック計測
  const handleCtaClick = useCallback(() => {
    try {
      // LP経由の場合は該当LPのイベントとして送信
      const lpId = fromLp || '0';
      const sessionKey = fromLp ? `lp_session_id_${fromLp}` : 'lp_session_id_0';
      const sessionId = sessionStorage.getItem(sessionKey) || sessionStorage.getItem('lp_session_id') || '';
      let campaignCode: string | null = null;
      try {
        const data = localStorage.getItem('lp_tracking_data');
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.expiry && Date.now() < parsed.expiry) {
            campaignCode = parsed.campaignCode || null;
          }
        }
      } catch {
        // ignore
      }

      const payload = JSON.stringify({
        type: 'click',
        lpId,
        campaignCode,
        sessionId,
        buttonId: fromLp ? 'line_register' : 'cta_register',
        buttonText: '会員登録して応募する',
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/lp-tracking', blob);
      } else {
        fetch('/api/lp-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // トラッキングエラーはサイレントに無視
    }
  }, [fromLp]);

  // LP経由でLINE URLが取得できた場合は<a>タグで外部遷移
  // それ以外は/loginにLP情報をクエリパラメータとして引き継ぎ
  const isExternalLink = !!(fromLp && lineUrl);
  const ctaHref = (() => {
    if (isExternalLink) return lineUrl!;
    const params = new URLSearchParams();
    const lpId = fromLp || lpParams.lpId;
    if (lpId) params.set('lp', lpId);
    if (lpParams.campaignCode) params.set('c', lpParams.campaignCode);
    if (lpParams.genrePrefix) params.set('g', lpParams.genrePrefix);
    const qs = params.toString();
    return `/login${qs ? `?${qs}` : ''}`;
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* メインコンテンツ */}
      <main
        className="max-w-lg mx-auto"
        style={{ paddingBottom: isJobListPage ? undefined : 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      {/* フッター - CTA固定（求人検索ページでは非表示） */}
      {!isJobListPage && (
        <footer
          className="fixed bottom-0 left-0 right-0 bg-primary z-20"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-lg mx-auto p-4">
            {isExternalLink ? (
              <a
                href={ctaHref}
                onClick={handleCtaClick}
                className="block w-full bg-white text-primary font-bold py-3 rounded-lg text-center shadow-lg hover:bg-gray-50 transition-colors"
              >
                会員登録して応募する
              </a>
            ) : (
              <Link
                href={ctaHref}
                onClick={handleCtaClick}
                className="block w-full bg-white text-primary font-bold py-3 rounded-lg text-center shadow-lg hover:bg-gray-50 transition-colors"
              >
                会員登録して応募する
              </Link>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
