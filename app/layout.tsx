import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import MasqueradeBanner from "@/components/MasqueradeBanner";

export const metadata: Metadata = {
  title: "S WORKS - 看護師・介護士のための求人マッチング",
  description: "看護師・介護士のための求人マッチングWebサービス",
  manifest: '/manifest.json',
  themeColor: '#6366f1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'S WORKS',
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
        <AuthProvider>
          <MasqueradeBanner />
          {children}
        </AuthProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
