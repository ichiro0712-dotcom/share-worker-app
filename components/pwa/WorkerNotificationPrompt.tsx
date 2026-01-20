'use client';

import { useSession } from 'next-auth/react';
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt';

/**
 * ワーカー用の通知許可プロンプト
 * ログイン済みの場合のみ表示
 */
export function WorkerNotificationPrompt() {
    const { data: session, status } = useSession();

    // ローディング中または未認証の場合は表示しない
    if (status === 'loading' || !session?.user) {
        return null;
    }

    return <NotificationPermissionPrompt userType="worker" />;
}
