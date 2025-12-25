'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ログインページではレイアウトを適用しない
  const noLayoutPages = ['/admin/login'];
  const shouldShowLayout = !noLayoutPages.includes(pathname || '');

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
