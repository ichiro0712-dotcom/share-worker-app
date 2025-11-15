import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S WORKS - 看護師・介護士のための求人マッチング",
  description: "看護師・介護士のための求人マッチングWebサービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
