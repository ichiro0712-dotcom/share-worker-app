'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyMasqueradeToken } from '@/src/lib/system-actions';

export default function MasqueradePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect'); // リダイレクト先を取得
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false); // 成功フラグを追加
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const verify = async () => {
            if (!token) {
                setError('トークンがありません');
                setLoading(false);
                return;
            }

            try {
                const result = await verifyMasqueradeToken(token);
                if (result.success && result.admin) {
                    // セッションをlocalStorageに保存
                    // lib/admin-session.ts のAdminSessionData構造に合わせる
                    const now = Date.now();
                    const sessionData = {
                        adminId: result.admin.id,  // id → adminId に変換
                        facilityId: result.admin.facilityId,
                        name: result.admin.name,
                        email: result.admin.email,
                        role: result.admin.role,
                        createdAt: now,
                        expiresAt: now + 8 * 60 * 60 * 1000, // 8時間
                        isPending: result.admin.isPending || false, // 仮登録状態を保存
                        isMasquerade: true, // システム管理者によるなりすましログイン
                    };

                    // 新しいセッション管理（admin_session）
                    localStorage.setItem('admin_session', JSON.stringify(sessionData));

                    // 後方互換性用（currentAdmin）
                    const legacyData = {
                        id: result.admin.id,
                        facilityId: result.admin.facilityId,
                        name: result.admin.name,
                        email: result.admin.email,
                        password: '',
                        phone: result.admin.phone || '',
                        role: result.admin.role,
                        isPending: result.admin.isPending || false,
                    };
                    localStorage.setItem('currentAdmin', JSON.stringify(legacyData));

                    // 成功フラグを設定
                    setSuccess(true);

                    // リダイレクト（redirectパラメータがあればそこへ、なければダッシュボードへ）
                    const redirectPath = redirect && redirect.startsWith('/admin') ? redirect : '/admin';
                    // window.location.hrefでフルリロードしてAdminLayoutを再初期化
                    window.location.href = redirectPath;
                } else {
                    setError(result.error || 'トークンが無効です');
                    setLoading(false);
                }
            } catch (err) {
                setError('エラーが発生しました');
                setLoading(false);
            }
        };

        verify();
    }, [token, redirect, router]);

    // ローディング中または成功時（リダイレクト待ち）
    if (loading || success) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-600">
                        {success ? '施設管理画面に移動中...' : '施設管理者としてログイン処理中...'}
                    </p>
                </div>
            </div>
        );
    }

    // エラー時のみエラー画面を表示
    return (
        <div className="h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <h1 className="text-xl font-bold text-slate-800 mb-4">ログインエラー</h1>
                <p className="text-red-500 mb-6">{error}</p>
                <button
                    onClick={() => router.push('/system-admin/facilities')}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                    一覧に戻る
                </button>
            </div>
        </div>
    );
}
