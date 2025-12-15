'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { isIOS, isStandaloneMode } from '@/lib/push-notification';

export function IOSInstallGuide() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // iOS + ブラウザモードの場合のみ表示
        const shouldShow = isIOS() && !isStandaloneMode();
        // 一度閉じたら24時間は表示しない
        const dismissed = localStorage.getItem('ios-install-guide-dismissed');
        if (dismissed) {
            const dismissedAt = new Date(dismissed);
            const now = new Date();
            const hoursDiff = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60);
            if (hoursDiff < 24) {
                return;
            }
        }
        setShow(shouldShow);
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('ios-install-guide-dismissed', new Date().toISOString());
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 animate-slide-up">
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                        📱 アプリをインストール
                    </h3>
                    <button
                        onClick={handleDismiss}
                        className="p-1 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    +TASTASをホーム画面に追加すると、通知を受け取れるようになります。
                </p>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Share className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                1. 共有ボタンをタップ
                            </p>
                            <p className="text-xs text-gray-500">
                                画面下の <Share className="w-3 h-3 inline" /> をタップ
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <PlusSquare className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                2. 「ホーム画面に追加」を選択
                            </p>
                            <p className="text-xs text-gray-500">
                                メニューをスクロールして探してください
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleDismiss}
                    className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                >
                    あとで
                </button>
            </div>
        </div>
    );
}
