'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const GTM_ID = 'GTM-T7XC88HJ';

// ワーカー向けページ以外のパス（GTMを除外するパス）
// /public はワーカー向けなので除外しない
const EXCLUDED_PATHS = ['/admin', '/system-admin', '/api'];

function useIsWorkerPage() {
  const pathname = usePathname();
  return !EXCLUDED_PATHS.some(path => pathname?.startsWith(path));
}

export function GoogleTagManager() {
  const isWorkerPage = useIsWorkerPage();

  if (!isWorkerPage) {
    return null;
  }

  return (
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `,
      }}
    />
  );
}

export function GoogleTagManagerNoscript() {
  const isWorkerPage = useIsWorkerPage();

  if (!isWorkerPage) {
    return null;
  }

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
