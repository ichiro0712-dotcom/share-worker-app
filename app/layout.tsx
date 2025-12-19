import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { BadgeProvider } from "@/contexts/BadgeContext";
import { Toaster } from "react-hot-toast";
import MasqueradeBanner from "@/components/MasqueradeBanner";
import { ErrorToastProvider } from '@/components/ui/PersistentErrorToast';
import { DebugErrorProvider } from '@/components/debug/DebugErrorBanner';

export const metadata: Metadata = {
  title: "+TASTAS - 看護師・介護士のための求人マッチング",
  description: "看護師・介護士のための求人マッチングWebサービス",
  manifest: '/manifest.json',
  themeColor: '#6366f1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '+TASTAS',
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
        <DebugErrorProvider>
          <ErrorToastProvider>
            <AuthProvider>
              <BadgeProvider>
                <MasqueradeBanner />
                {children}
              </BadgeProvider>
            </AuthProvider>
            <Toaster position="bottom-center" />
          </ErrorToastProvider>
        </DebugErrorProvider>
      </body>
    </html>
  );
}
