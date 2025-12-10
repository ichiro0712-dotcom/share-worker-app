'use client';

import { usePathname } from 'next/navigation';
import { SystemAuthProvider } from '@/contexts/SystemAuthContext';
import SystemAdminLayout from '@/components/system-admin/SystemAdminLayout';

function SystemAdminLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Pages where the sidebar layout should NOT be shown
    const noLayoutPages = ['/system-admin/login'];
    // dev-portal配下も除外（開発ポータルは独自レイアウトを使用）
    const isDevPortal = pathname?.startsWith('/system-admin/dev-portal');
    const shouldShowLayout = !noLayoutPages.includes(pathname || '') && !isDevPortal;

    if (!shouldShowLayout) {
        return <>{children}</>;
    }

    return <SystemAdminLayout>{children}</SystemAdminLayout>;
}

export default function SystemAdminRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SystemAuthProvider>
            <SystemAdminLayoutWrapper>{children}</SystemAdminLayoutWrapper>
        </SystemAuthProvider>
    );
}
