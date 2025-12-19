'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { sendFacilityPasswordResetEmail, getFacilityAdmins } from '@/src/lib/system-actions';
import { KeyRound, Mail, Check, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface FacilityAdmin {
    id: number;
    name: string;
    email: string;
    is_primary: boolean;
}

export default function PasswordResetPage() {
    const router = useRouter();
    const { admin } = useAuth();
    const { showDebugError } = useDebugError();
    const [loading, setLoading] = useState(false);
    const [isMasquerade, setIsMasquerade] = useState(false);
    const [admins, setAdmins] = useState<FacilityAdmin[]>([]);
    const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
    const [sentTo, setSentTo] = useState<number[]>([]);

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

    useEffect(() => {
        // 施設の管理者一覧を取得
        const loadAdmins = async () => {
            if (admin?.facilityId) {
                try {
                    const result = await getFacilityAdmins(admin.facilityId);
                    if (result.success && result.admins) {
                        setAdmins(result.admins);
                        // 主担当者をデフォルト選択
                        const primary = result.admins.find((a: FacilityAdmin) => a.is_primary);
                        if (primary) {
                            setSelectedAdminId(primary.id);
                        } else if (result.admins.length > 0) {
                            setSelectedAdminId(result.admins[0].id);
                        }
                    }
                } catch (error) {
                    const debugInfo = extractDebugInfo(error);
                    showDebugError({
                        type: 'fetch',
                        operation: '施設管理者一覧取得（マスカレード）',
                        message: debugInfo.message,
                        details: debugInfo.details,
                        stack: debugInfo.stack,
                        context: { facilityId: admin?.facilityId }
                    });
                    console.error('Failed to load admins:', error);
                }
            }
        };
        loadAdmins();
    }, [admin?.facilityId]);

    const handleSendReset = async () => {
        if (!selectedAdminId) {
            toast.error('送信先を選択してください');
            return;
        }

        setLoading(true);
        try {
            const result = await sendFacilityPasswordResetEmail(selectedAdminId);
            if (result.success) {
                toast.success('パスワードリセットメールを送信しました');
                setSentTo([...sentTo, selectedAdminId]);
            } else {
                toast.error(result.error || '送信に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'save',
                operation: 'パスワードリセットメール送信（マスカレード）',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { adminId: selectedAdminId }
            });
            console.error('Send reset email error:', error);
            toast.error('送信に失敗しました');
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
                <div className="bg-blue-50 border-b border-blue-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <KeyRound className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-blue-800">パスワードリセット</h1>
                            <p className="text-sm text-blue-600">施設担当者にリセットメールを送信</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-sm text-slate-600 mb-4">
                            選択した担当者のメールアドレスにパスワードリセットリンクを送信します。
                            リンクの有効期限は24時間です。
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                            送信先を選択
                        </label>
                        <div className="space-y-2">
                            {admins.map((adminItem) => (
                                <label
                                    key={adminItem.id}
                                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${selectedAdminId === adminItem.id
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="admin"
                                        value={adminItem.id}
                                        checked={selectedAdminId === adminItem.id}
                                        onChange={() => setSelectedAdminId(adminItem.id)}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                        <User className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-800">{adminItem.name}</span>
                                            {adminItem.is_primary && (
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded">
                                                    主担当者
                                                </span>
                                            )}
                                            {sentTo.includes(adminItem.id) && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    送信済み
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-slate-500">
                                            <Mail className="w-3.5 h-3.5" />
                                            {adminItem.email}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {admins.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            施設管理者が見つかりません
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => router.back()}
                            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            戻る
                        </button>
                        <button
                            onClick={handleSendReset}
                            disabled={loading || !selectedAdminId}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    送信中...
                                </>
                            ) : (
                                <>
                                    <Mail className="w-4 h-4" />
                                    リセットメールを送信
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
