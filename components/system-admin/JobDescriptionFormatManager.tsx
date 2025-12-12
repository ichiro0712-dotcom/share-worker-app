'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Loader2, Check, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getAllJobDescriptionFormats,
    createJobDescriptionFormat,
    updateJobDescriptionFormat,
    deleteJobDescriptionFormat,
    updateJobDescriptionFormatOrder,
} from '@/src/lib/content-actions';

interface Format {
    id: number;
    label: string;
    content: string;
    sort_order: number;
    is_active: boolean;
}

interface Props {
    onFormatCreated?: () => void;
}

export function JobDescriptionFormatManager({ onFormatCreated }: Props) {
    const [formats, setFormats] = useState<Format[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ドラッグ状態
    const [draggedId, setDraggedId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);

    // 編集フォーム
    const [editForm, setEditForm] = useState({ label: '', content: '' });
    // 新規作成フォーム
    const [newForm, setNewForm] = useState({ label: '', content: '' });

    // データ取得
    useEffect(() => {
        loadFormats();
    }, []);

    const loadFormats = async () => {
        try {
            const data = await getAllJobDescriptionFormats();
            setFormats(data.filter(f => f.is_active));
        } catch (error) {
            toast.error('フォーマットの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    // 新規作成開始
    const handleStartCreate = () => {
        setIsCreating(true);
        setNewForm({ label: '', content: '' });
        setEditingId(null);
    };

    // 新規作成保存
    const handleCreate = async () => {
        if (!newForm.label.trim() || !newForm.content.trim()) {
            toast.error('ラベルと本文を入力してください');
            return;
        }

        setIsSaving(true);
        try {
            const result = await createJobDescriptionFormat({
                label: newForm.label,
                content: newForm.content,
            });
            if (result.success) {
                toast.success('フォーマットを作成しました');
                setIsCreating(false);
                setNewForm({ label: '', content: '' });
                await loadFormats();
                // 作成後にコールバックを呼び出す
                if (onFormatCreated) {
                    onFormatCreated();
                }
            } else {
                toast.error(result.error || '作成に失敗しました');
            }
        } catch (error) {
            toast.error('作成に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    // 編集開始
    const handleStartEdit = (format: Format) => {
        setEditingId(format.id);
        setEditForm({ label: format.label, content: format.content });
        setIsCreating(false);
    };

    // 編集保存
    const handleSaveEdit = async () => {
        if (!editForm.label.trim() || !editForm.content.trim()) {
            toast.error('ラベルと本文を入力してください');
            return;
        }

        setIsSaving(true);
        try {
            const result = await updateJobDescriptionFormat(editingId!, {
                label: editForm.label,
                content: editForm.content,
            });
            if (result.success) {
                toast.success('フォーマットを更新しました');
                setEditingId(null);
                loadFormats();
            } else {
                toast.error(result.error || '更新に失敗しました');
            }
        } catch (error) {
            toast.error('更新に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    // 削除
    const handleDelete = async (id: number, label: string) => {
        if (!confirm(`「${label}」を削除しますか？`)) return;

        try {
            const result = await deleteJobDescriptionFormat(id);
            if (result.success) {
                toast.success('フォーマットを削除しました');
                loadFormats();
            } else {
                toast.error(result.error || '削除に失敗しました');
            }
        } catch (error) {
            toast.error('削除に失敗しました');
        }
    };

    // キャンセル
    const handleCancel = () => {
        setEditingId(null);
        setIsCreating(false);
    };

    // ドラッグ開始
    const handleDragStart = (e: React.DragEvent, id: number) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id.toString());
    };

    // ドラッグ終了
    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverId(null);
    };

    // ドラッグオーバー
    const handleDragOver = (e: React.DragEvent, id: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (id !== draggedId) {
            setDragOverId(id);
        }
    };

    // ドラッグリーブ
    const handleDragLeave = () => {
        setDragOverId(null);
    };

    // ドロップ
    const handleDrop = useCallback(async (e: React.DragEvent, targetId: number) => {
        e.preventDefault();
        setDragOverId(null);

        if (draggedId === null || draggedId === targetId) {
            setDraggedId(null);
            return;
        }

        const draggedIndex = formats.findIndex(f => f.id === draggedId);
        const targetIndex = formats.findIndex(f => f.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedId(null);
            return;
        }

        // 新しい順序を作成
        const newFormats = [...formats];
        const [draggedItem] = newFormats.splice(draggedIndex, 1);
        newFormats.splice(targetIndex, 0, draggedItem);

        // UI を先に更新
        setFormats(newFormats);
        setDraggedId(null);

        // 並び順をサーバーに保存
        try {
            const orders = newFormats.map((f, index) => ({
                id: f.id,
                sort_order: index + 1,
            }));
            const result = await updateJobDescriptionFormatOrder(orders);
            if (result.success) {
                toast.success('並び順を更新しました');
            } else {
                toast.error(result.error || '並び順の更新に失敗しました');
                loadFormats(); // 失敗したら元に戻す
            }
        } catch (error) {
            toast.error('並び順の更新に失敗しました');
            loadFormats(); // 失敗したら元に戻す
        }
    }, [draggedId, formats]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">仕事詳細フォーマット管理</h2>
                <p className="text-sm text-gray-500 mb-4">
                    求人作成時の「フォーマットを選択」で表示される選択肢を管理します。
                    <br />
                    <span className="text-indigo-600">ドラッグ＆ドロップで並び順を変更できます。</span>
                </p>
            </div>

            {/* 新規作成ボタン */}
            {!isCreating && !editingId && (
                <button
                    onClick={handleStartCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" />
                    新規フォーマット追加
                </button>
            )}

            {/* 新規作成フォーム */}
            {isCreating && (
                <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-gray-900">新規フォーマット作成</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ラベル（選択肢の表示名）
                        </label>
                        <input
                            type="text"
                            value={newForm.label}
                            onChange={(e) => setNewForm({ ...newForm, label: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="例: 介護：日勤"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            テンプレート本文
                        </label>
                        <textarea
                            value={newForm.content}
                            onChange={(e) => setNewForm({ ...newForm, content: e.target.value })}
                            rows={8}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                            placeholder="【介護業務（日勤）】&#10;・利用者様の日常生活介助..."
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            作成
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            {/* フォーマット一覧 */}
            <div className="space-y-3">
                {formats.length === 0 && !isCreating && (
                    <div className="text-center py-8 text-gray-500">
                        フォーマットがありません。「新規フォーマット追加」から作成してください。
                    </div>
                )}

                {formats.map((format) => (
                    <div
                        key={format.id}
                        draggable={!editingId && !isCreating}
                        onDragStart={(e) => handleDragStart(e, format.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, format.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, format.id)}
                        className={`border rounded-lg transition-all ${
                            editingId === format.id
                                ? 'border-indigo-300 bg-indigo-50'
                                : draggedId === format.id
                                    ? 'border-indigo-400 bg-indigo-50 opacity-50'
                                    : dragOverId === format.id
                                        ? 'border-indigo-400 bg-indigo-100 border-dashed'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                        } ${!editingId && !isCreating ? 'cursor-move' : ''}`}
                    >
                        {editingId === format.id ? (
                            // 編集モード
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ラベル
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.label}
                                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        テンプレート本文
                                    </label>
                                    <textarea
                                        value={editForm.content}
                                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                        rows={8}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        保存
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // 表示モード
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="text-gray-400 mt-1 cursor-grab active:cursor-grabbing">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900">{format.label}</h4>
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">
                                                {format.content}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => handleStartEdit(format)}
                                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(format.id, format.label)}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 説明 */}
            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">表示箇所</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 新規求人作成（/admin/jobs/new）の「フォーマットを選択」</li>
                    <li>• テンプレート作成（/admin/jobs/templates/new）の「フォーマットを選択」</li>
                    <li>• テンプレート編集（/admin/jobs/templates/[id]/edit）の「フォーマットを選択」</li>
                </ul>
            </div>
        </div>
    );
}
