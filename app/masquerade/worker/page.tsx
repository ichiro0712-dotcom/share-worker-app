'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyWorkerMasqueradeToken } from '@/src/lib/system-actions';
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';

export default function WorkerMasqueradePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [errorMessage, setErrorMessage] = useState('');
    const [workerInfo, setWorkerInfo] = useState<{ name: string; email: string } | null>(null);

    useEffect(() => {
        const verifyAndLogin = async () => {
            if (!token) {
                setStatus('error');
                setErrorMessage('トークンが指定されていません');
                return;
            }

            try {
                const result = await verifyWorkerMasqueradeToken(token);

                if (!result.success) {
                    setStatus('error');
                    setErrorMessage(result.error || '認証に失敗しました');
                    return;
                }

                if (result.worker) {
                    setWorkerInfo({
                        name: result.worker.name,
                        email: result.worker.email,
                    });

                    // マスカレードセッション情報をlocalStorageに保存
                    localStorage.setItem('masqueradeMode', 'worker');
                    localStorage.setItem('masqueradeWorkerId', result.worker.id.toString());
                    localStorage.setItem('masqueradeWorkerName', result.worker.name);
                    localStorage.setItem('masqueradeWorkerEmail', result.worker.email);
                    if (result.systemAdminId) {
                        localStorage.setItem('masqueradeSystemAdminId', result.systemAdminId.toString());
                    }

                    // 通常のワーカーログインセッションも設定
                    localStorage.setItem('user', JSON.stringify({
                        id: result.worker.id,
                        name: result.worker.name,
                        email: result.worker.email,
                        profileImage: result.worker.profileImage,
                        isMasquerade: true,
                    }));

                    setStatus('success');

                    // 2秒後にマイページにリダイレクト
                    setTimeout(() => {
                        router.push('/mypage');
                    }, 2000);
                }
            } catch (error) {
                console.error('Masquerade verification error:', error);
                setStatus('error');
                setErrorMessage('システムエラーが発生しました');
            }
        };

        verifyAndLogin();
    }, [token, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                {status === 'verifying' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Shield className="w-8 h-8 text-indigo-600 animate-pulse" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">認証中...</h1>
                        <p className="text-gray-500">マスカレードトークンを検証しています</p>
                        <div className="mt-6">
                            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        </div>
                    </>
                )}

                {status === 'success' && workerInfo && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">認証成功</h1>
                        <p className="text-gray-600 mb-4">
                            <span className="font-semibold text-indigo-600">{workerInfo.name}</span> さんとしてログインしました
                        </p>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left mb-6">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-semibold text-yellow-800 mb-1">マスカレードモード</p>
                                    <p className="text-yellow-700">
                                        システム管理者としてワーカーのマイページにアクセスしています。
                                        編集内容はログに記録されます。
                                    </p>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500">
                            マイページにリダイレクトしています...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">認証エラー</h1>
                        <p className="text-red-600 mb-6">{errorMessage}</p>
                        <button
                            onClick={() => window.close()}
                            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            このタブを閉じる
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
