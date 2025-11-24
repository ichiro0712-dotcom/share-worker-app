'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ログインページ、利用規約、プライバシーポリシーではレイアウトを適用しない
  const noLayoutPages = ['/admin/login', '/admin/terms', '/admin/privacy'];
  const shouldShowLayout = !noLayoutPages.includes(pathname || '');

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
