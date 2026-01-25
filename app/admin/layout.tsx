'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ログインページとマスカレードページではレイアウトを適用しない
  const noLayoutPages = ['/admin/login', '/admin/masquerade'];
  const shouldShowLayout = !noLayoutPages.includes(pathname || '');

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
