'use client';

import { usePathname } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ログインページ、マスカレードページ、パスワードリセットページではレイアウトを適用しない
  const noLayoutPages = ['/admin/login', '/admin/masquerade'];
  const shouldShowLayout = !noLayoutPages.includes(pathname || '') && !(pathname || '').startsWith('/admin/password-reset');

  if (!shouldShowLayout) {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
