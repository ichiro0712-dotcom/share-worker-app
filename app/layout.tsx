import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { BadgeProvider } from "@/contexts/BadgeContext";
import { NetworkStatusProvider } from "@/contexts/NetworkStatusContext";
import { Toaster } from "react-hot-toast";
import MasqueradeBanner from "@/components/MasqueradeBanner";
import { ErrorToastProvider } from '@/components/ui/PersistentErrorToast';
import { DebugErrorProvider } from '@/components/debug/DebugErrorBanner';
import { WorkerLayout } from '@/components/layout/WorkerLayout';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { GoogleTagManager, GoogleTagManagerNoscript } from '@/components/GoogleTagManager';

// Viewport設定（iOS safe-area対応 + themeColor）
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // iPhoneのノッチ/Dynamic Island対応
  themeColor: '#6366f1', // Next.js 14+ではviewport exportに移動が必要
};

export const metadata: Metadata = {
  title: "+タスタス - 看護師・介護士のための求人マッチング",
  description: "看護師・介護士のための求人マッチングWebサービス",
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '+タスタス',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <GoogleTagManager />
        <GoogleTagManagerNoscript />
        <NetworkStatusProvider>
          <OfflineBanner />
          <DebugErrorProvider>
            <ErrorToastProvider>
              <AuthProvider>
                <BadgeProvider>
                  <MasqueradeBanner />
                  <WorkerLayout>
                    {children}
                  </WorkerLayout>
                </BadgeProvider>
              </AuthProvider>
              <Toaster position="bottom-center" />
            </ErrorToastProvider>
          </DebugErrorProvider>
        </NetworkStatusProvider>
      </body>
    </html>
  );
}
