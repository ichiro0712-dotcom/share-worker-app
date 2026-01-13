'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { deleteFacilityBySystemAdmin } from '@/src/lib/system-actions';
import { Trash2, AlertTriangle, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

export default function DeleteFacilityPage() {
    const router = useRouter();
    const { admin, adminLogout } = useAuth();
    const { showDebugError } = useDebugError();
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMasquerade, setIsMasquerade] = useState(false);

    useEffect(() => {
        // マスカレード状態を確認
        try {
            const sessionStr = localStorage.getItem('admin_session');
            if (sessionStr) {
                const session = JSON.parse(sessionStr);
                setIsMasquerade(session.isMasquerade === true);
                if (!session.isMasquerade) {
                    toast.error('この機能はシステム管理者専用です');
                    router.push('/admin');
                }
            }
        } catch {
            router.push('/admin');
        }
    }, [router]);

    const handleDelete = async () => {
        if (!admin?.facilityId) {
            toast.error('施設情報が取得できません');
            return;
        }

        if (confirmText !== '削除する') {
            toast.error('確認テキストが正しくありません');
            return;
        }

        setLoading(true);
        try {
            const result = await deleteFacilityBySystemAdmin(admin.facilityId);
            if (result.success) {
                toast.success('施設を削除しました');
                adminLogout();
                router.push('/system-admin/facilities');
            } else {
                toast.error(result.error || '削除に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'delete',
                operation: '施設削除（マスカレード）',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId: admin?.facilityId }
            });
            console.error('Delete facility error:', error);
            toast.error('削除に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    if (!isMasquerade) {
        return (
            <div className="p-8 text-center text-slate-500">
                読み込み中...
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-red-50 border-b border-red-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                            <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-red-800">施設削除</h1>
                            <p className="text-sm text-red-600">この操作は取り消せません</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-medium mb-2">削除すると以下のデータがすべて失われます：</p>
                                <ul className="list-disc list-inside space-y-1 text-amber-700">
                                    <li>施設情報</li>
                                    <li>すべての求人データ</li>
                                    <li>応募履歴</li>
                                    <li>メッセージ履歴</li>
                                    <li>レビュー</li>
                                    <li>施設管理者アカウント</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Building2 className="w-5 h-5 text-slate-500" />
                            <span className="font-medium text-slate-700">削除対象施設</span>
                        </div>
                        <p className="text-lg font-bold text-slate-800 ml-8">
                            施設ID: {admin?.facilityId}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            確認のため「削除する」と入力してください
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="削除する"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => router.back()}
                            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={loading || confirmText !== '削除する'}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    削除中...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    施設を削除
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
