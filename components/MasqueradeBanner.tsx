'use client';

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function MasqueradeBanner() {
    const [isMasquerade, setIsMasquerade] = useState(false);
    const [workerName, setWorkerName] = useState<string | null>(null);
    const pathname = usePathname();

    useEffect(() => {
        const checkMasqueradeStatus = () => {
            try {
                // ワーカーマスカレードをチェック
                const masqueradeMode = localStorage.getItem('masqueradeMode');
                const userStr = localStorage.getItem('user');

                if (masqueradeMode === 'worker' && userStr) {
                    const user = JSON.parse(userStr);
                    if (user.isMasquerade) {
                        setIsMasquerade(true);
                        setWorkerName(user.name || null);
                        return;
                    }
                }

                setIsMasquerade(false);
                setWorkerName(null);
            } catch {
                setIsMasquerade(false);
                setWorkerName(null);
            }
        };

        checkMasqueradeStatus();

        // localStorageの変更を監視
        window.addEventListener('storage', checkMasqueradeStatus);
        return () => window.removeEventListener('storage', checkMasqueradeStatus);
    }, [pathname]);

    // 管理画面やシステム管理画面、マスカレードページでは表示しない
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/system-admin') || pathname?.startsWith('/masquerade')) {
        return null;
    }

    // マスカレードモードでなければ表示しない
    if (!isMasquerade) {
        return null;
    }

    return (
        <>
            {/* スペーサー: バナーの高さ分のスペースを確保 */}
            <div className="h-10" />
            {/* 固定バナー */}
            <div className="bg-purple-600 text-white py-2 px-4 fixed top-0 left-0 right-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">
                        システム管理者としてログイン中
                        {workerName && (
                            <span className="ml-1 opacity-90">
                                （{workerName}さんとして閲覧）
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </>
    );
}
