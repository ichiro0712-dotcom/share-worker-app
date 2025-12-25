'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Edit3, Trash2, FileText, GripVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getOfferTemplates, createOfferTemplate, updateOfferTemplate, deleteOfferTemplate } from '@/src/lib/actions';

interface OfferTemplate {
    id: number;
    name: string;
    message: string;
    sort_order: number;
}

export default function OfferTemplatesPage() {
    const router = useRouter();
    const { admin, isAdmin, isAdminLoading } = useAuth();
    const [templates, setTemplates] = useState<OfferTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 編集状態
    const [editingTemplate, setEditingTemplate] = useState<OfferTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formName, setFormName] = useState('');
    const [formMessage, setFormMessage] = useState('');

    // 認証チェック
    useEffect(() => {
        if (isAdminLoading) return;
        if (!isAdmin || !admin) {
            router.push('/admin/login');
        }
    }, [isAdmin, admin, isAdminLoading, router]);

    // データ取得
    useEffect(() => {
        if (isAdminLoading || !admin?.facilityId) return;

        const fetchTemplates = async () => {
            setIsLoading(true);
            try {
                const data = await getOfferTemplates(admin.facilityId);
                setTemplates(data as OfferTemplate[]);
            } catch (error) {
                console.error('Failed to fetch templates:', error);
                toast.error('テンプレートの取得に失敗しました');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTemplates();
    }, [isAdminLoading, admin?.facilityId]);

    // テンプレート再取得
    const refreshTemplates = async () => {
        if (!admin?.facilityId) return;
        const data = await getOfferTemplates(admin.facilityId);
        setTemplates(data as OfferTemplate[]);
    };

    // 作成処理
    const handleCreate = async () => {
        if (!admin?.facilityId || !formName.trim() || !formMessage.trim()) {
            toast.error('タイトルと内容を入力してください');
            return;
        }

        try {
            const result = await createOfferTemplate(admin.facilityId, formName.trim(), formMessage.trim());
            if (result.success) {
                toast.success('テンプレートを作成しました');
                setFormName('');
                setFormMessage('');
                setIsCreating(false);
                await refreshTemplates();
            } else {
                toast.error(result.error || 'テンプレートの作成に失敗しました');
            }
        } catch (error) {
            console.error('Failed to create template:', error);
            toast.error('テンプレートの作成に失敗しました');
        }
    };

    // 更新処理
    const handleUpdate = async () => {
        if (!admin?.facilityId || !editingTemplate || !formName.trim() || !formMessage.trim()) {
            toast.error('タイトルと内容を入力してください');
            return;
        }

        try {
            const result = await updateOfferTemplate(editingTemplate.id, formName.trim(), formMessage.trim(), admin.facilityId);
            if (result.success) {
                toast.success('テンプレートを更新しました');
                setEditingTemplate(null);
                setFormName('');
                setFormMessage('');
                await refreshTemplates();
            } else {
                toast.error(result.error || 'テンプレートの更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to update template:', error);
            toast.error('テンプレートの更新に失敗しました');
        }
    };

    // 削除処理
    const handleDelete = async (templateId: number) => {
        if (!admin?.facilityId) return;
        if (!confirm('このテンプレートを削除しますか？')) return;

        try {
            const result = await deleteOfferTemplate(templateId, admin.facilityId);
            if (result.success) {
                toast.success('テンプレートを削除しました');
                await refreshTemplates();
            } else {
                toast.error(result.error || 'テンプレートの削除に失敗しました');
            }
        } catch (error) {
            console.error('Failed to delete template:', error);
            toast.error('テンプレートの削除に失敗しました');
        }
    };

    // 編集開始
    const startEditing = (template: OfferTemplate) => {
        setEditingTemplate(template);
        setFormName(template.name);
        setFormMessage(template.message);
        setIsCreating(false);
    };

    // 新規作成開始
    const startCreating = () => {
        setIsCreating(true);
        setEditingTemplate(null);
        setFormName('');
        setFormMessage('');
    };

    // キャンセル
    const cancelEdit = () => {
        setIsCreating(false);
        setEditingTemplate(null);
        setFormName('');
        setFormMessage('');
    };

    if (isAdminLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 px-4 py-4">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>戻る</span>
                    </button>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-600" />
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">オファーメッセージテンプレート</h1>
                                <p className="text-sm text-gray-500">ワーカーへのオファー時に使用するメッセージテンプレートを管理します</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-500">
                            {templates.length} / 20 件
                        </div>
                    </div>
                </div>
            </div>

            {/* メインコンテンツ */}
            <div className="max-w-4xl mx-auto p-4">
                {/* 新規作成/編集フォーム */}
                {(isCreating || editingTemplate) && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                        <h2 className="text-lg font-bold mb-4">
                            {editingTemplate ? 'テンプレートを編集' : '新規テンプレート作成'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    テンプレート名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="例：リピーター向けオファー"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    メッセージ内容 <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formMessage}
                                    onChange={(e) => setFormMessage(e.target.value)}
                                    rows={6}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="オファーメッセージの内容を入力..."
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={editingTemplate ? handleUpdate : handleCreate}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {editingTemplate ? '更新する' : '作成する'}
                                </button>
                                <button
                                    onClick={cancelEdit}
                                    className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 新規作成ボタン */}
                {!isCreating && !editingTemplate && templates.length < 20 && (
                    <button
                        onClick={startCreating}
                        className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 text-blue-600 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        新規テンプレートを作成
                    </button>
                )}

                {/* テンプレート一覧 */}
                {templates.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">テンプレートがありません</p>
                        <button
                            onClick={startCreating}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4" />
                            最初のテンプレートを作成
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className={`bg-white rounded-lg shadow-sm border p-4 transition-colors ${
                                    editingTemplate?.id === template.id
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                                            {template.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => startEditing(template)}
                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="編集"
                                        >
                                            <Edit3 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(template.id)}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="削除"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 使い方の説明 */}
                <div className="mt-8 bg-blue-50 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">使い方</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>・ここで作成したテンプレートは、オファー作成時のメッセージ入力欄で選択できます</li>
                        <li>・最大20件まで登録できます</li>
                        <li>・よく使うメッセージパターンをテンプレートとして登録しておくと便利です</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
