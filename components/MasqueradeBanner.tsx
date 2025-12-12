'use client';

import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
    getWorkerMasqueradeSession,
    clearWorkerMasqueradeSession,
    getWorkerMasqueradeRemainingMinutes
} from '@/src/lib/worker-masquerade-session';

export default function MasqueradeBanner() {
    const [isMasquerade, setIsMasquerade] = useState(false);
    const [workerName, setWorkerName] = useState<string | null>(null);
    const [remainingMinutes, setRemainingMinutes] = useState(0);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const checkMasqueradeStatus = () => {
            const session = getWorkerMasqueradeSession();

            if (session) {
                setIsMasquerade(true);
                setWorkerName(session.workerName);
                setRemainingMinutes(getWorkerMasqueradeRemainingMinutes());
            } else {
                setIsMasquerade(false);
                setWorkerName(null);
                setRemainingMinutes(0);
            }
        };

        checkMasqueradeStatus();

        // 1分ごとに残り時間を更新
        const interval = setInterval(checkMasqueradeStatus, 60000);

        // localStorageの変更を監視
        window.addEventListener('storage', checkMasqueradeStatus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', checkMasqueradeStatus);
        };
    }, [pathname]);

    // マスカレード終了処理
    const handleExit = () => {
        clearWorkerMasqueradeSession();
        setIsMasquerade(false);
        setWorkerName(null);
        // システム管理画面に戻る
        router.push('/system-admin/workers');
    };

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
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4" />
                        <span className="font-medium">
                            システム管理者としてログイン中
                            {workerName && (
                                <span className="ml-1 opacity-90">
                                    （{workerName}さんとして閲覧）
                                </span>
                            )}
                        </span>
                        {remainingMinutes > 0 && (
                            <span className="ml-2 text-xs opacity-75">
                                残り {Math.floor(remainingMinutes / 60)}時間{remainingMinutes % 60}分
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                        終了
                    </button>
                </div>
            </div>
        </>
    );
}
