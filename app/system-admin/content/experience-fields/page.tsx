'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Plus,
    Pencil,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    X,
    Loader2,
    Eye,
    EyeOff,
    Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import {
    getExperienceFieldsForAdmin,
    createExperienceFieldCategory,
    updateExperienceFieldCategory,
    updateExperienceFieldCategoryOrder,
    createExperienceField,
    updateExperienceField,
    updateExperienceFieldOrder,
} from '@/src/lib/content-actions';

interface FieldItem {
    id: number;
    name: string;
    sort_order: number;
    is_published: boolean;
}

interface CategoryData {
    id: number;
    name: string;
    sort_order: number;
    is_published: boolean;
    fields: FieldItem[];
}

interface CategoryWithState extends CategoryData {
    isExpanded: boolean;
}

export default function ExperienceFieldsEditPage() {
    const { showDebugError } = useDebugError();
    const [categories, setCategories] = useState<CategoryWithState[]>([]);
    const [loading, setLoading] = useState(true);

    // モーダル状態
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showFieldModal, setShowFieldModal] = useState(false);

    // 編集対象
    const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
    const [editingField, setEditingField] = useState<(FieldItem & { categoryId: number }) | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

    // フォーム状態
    const [categoryName, setCategoryName] = useState('');
    const [fieldName, setFieldName] = useState('');
    const [saving, setSaving] = useState(false);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getExperienceFieldsForAdmin();
            setCategories(
                data.map((cat) => ({
                    id: cat.id,
                    name: cat.name,
                    sort_order: cat.sort_order,
                    is_published: cat.is_published,
                    fields: cat.fields.map((f) => ({
                        id: f.id,
                        name: f.name,
                        sort_order: f.sort_order,
                        is_published: f.is_published,
                    })),
                    isExpanded: true,
                }))
            );
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: '経験分野マスタ取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
            });
            toast.error('経験分野の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [showDebugError]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const toggleCategory = (categoryId: number) => {
        setCategories((prev) =>
            prev.map((cat) =>
                cat.id === categoryId ? { ...cat, isExpanded: !cat.isExpanded } : cat
            )
        );
    };

    // ---------- カテゴリ ----------
    const openCategoryModal = (category?: CategoryData) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.name);
        } else {
            setEditingCategory(null);
            setCategoryName('');
        }
        setShowCategoryModal(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryName.trim()) {
            toast.error('カテゴリ名を入力してください');
            return;
        }
        setSaving(true);
        try {
            if (editingCategory) {
                await updateExperienceFieldCategory(editingCategory.id, { name: categoryName.trim() });
                toast.success('カテゴリを更新しました');
            } else {
                await createExperienceFieldCategory({ name: categoryName.trim() });
                toast.success('カテゴリを追加しました');
            }
            setShowCategoryModal(false);
            loadCategories();
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: editingCategory ? 'update' : 'save',
                operation: editingCategory ? '経験分野カテゴリ更新' : '経験分野カテゴリ作成',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { categoryName, editingCategoryId: editingCategory?.id },
            });
            toast.error('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const toggleCategoryPublished = async (category: CategoryData) => {
        try {
            await updateExperienceFieldCategory(category.id, { isPublished: !category.is_published });
            toast.success(category.is_published ? 'カテゴリを非表示にしました' : 'カテゴリを表示にしました');
            loadCategories();
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'update',
                operation: '経験分野カテゴリ表示切替',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { categoryId: category.id },
            });
            toast.error('更新に失敗しました');
        }
    };

    // カテゴリの並び替え（上下移動）
    const moveCategory = async (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= categories.length) return;

        const reordered = [...categories];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

        const updates = reordered.map((cat, i) => ({ id: cat.id, sortOrder: i + 1 }));
        // 楽観的更新
        setCategories(reordered);
        try {
            await updateExperienceFieldCategoryOrder(updates);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'update',
                operation: '経験分野カテゴリ並び替え',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
            });
            toast.error('並び替えに失敗しました');
            loadCategories();
        }
    };

    // ---------- 項目 ----------
    const openFieldModal = (categoryId: number, field?: FieldItem) => {
        setSelectedCategoryId(categoryId);
        if (field) {
            setEditingField({ ...field, categoryId });
            setFieldName(field.name);
        } else {
            setEditingField(null);
            setFieldName('');
        }
        setShowFieldModal(true);
    };

    const handleSaveField = async () => {
        if (!fieldName.trim()) {
            toast.error('項目名を入力してください');
            return;
        }
        setSaving(true);
        try {
            if (editingField) {
                await updateExperienceField(editingField.id, { name: fieldName.trim() });
                toast.success('項目を更新しました');
            } else if (selectedCategoryId) {
                await createExperienceField({ categoryId: selectedCategoryId, name: fieldName.trim() });
                toast.success('項目を追加しました');
            }
            setShowFieldModal(false);
            loadCategories();
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: editingField ? 'update' : 'save',
                operation: editingField ? '経験分野項目更新' : '経験分野項目作成',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { fieldName, editingFieldId: editingField?.id, selectedCategoryId },
            });
            toast.error('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const toggleFieldPublished = async (field: FieldItem) => {
        try {
            await updateExperienceField(field.id, { isPublished: !field.is_published });
            toast.success(field.is_published ? '非表示にしました' : '表示にしました');
            loadCategories();
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'update',
                operation: '経験分野項目表示切替',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { fieldId: field.id },
            });
            toast.error('更新に失敗しました');
        }
    };

    // 項目の並び替え（カテゴリ内の上下移動）
    const moveField = async (category: CategoryWithState, index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= category.fields.length) return;

        const fields = [...category.fields];
        [fields[index], fields[target]] = [fields[target], fields[index]];

        const updates = fields.map((f, i) => ({ id: f.id, sortOrder: i + 1 }));
        // 楽観的更新
        setCategories((prev) =>
            prev.map((c) => (c.id === category.id ? { ...c, fields } : c))
        );
        try {
            await updateExperienceFieldOrder(updates);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'update',
                operation: '経験分野項目並び替え',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
            });
            toast.error('並び替えに失敗しました');
            loadCategories();
        }
    };

    return (
        <div className="p-8">
            {/* ヘッダー */}
            <div className="mb-6">
                <Link
                    href="/system-admin/content"
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    コンテンツ管理に戻る
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">経験分野の項目管理</h1>
                <p className="text-slate-500">
                    ワーカープロフィールの「経験分野」で選択できる項目を、カテゴリごとに登録・編集・並び替えできます
                </p>
            </div>

            {/* 注意書き */}
            <div className="flex items-start gap-2 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium">運用上の注意</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>項目名は、ワーカーが登録済みの経験データと突き合わせる「キー」です。既に使われている項目の<strong>名称変更は避けてください</strong>（過去の登録が表示されなくなります）。</li>
                        <li>不要になった項目は削除ではなく<strong>「非表示」</strong>にしてください。新規選択肢から外れますが、過去に登録したワーカーの情報は保持されます。</li>
                    </ul>
                </div>
            </div>

            {/* ボタンエリア */}
            <div className="flex flex-wrap gap-3 mb-4">
                <button
                    onClick={() => openCategoryModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    カテゴリを追加
                </button>
            </div>

            {/* ローディング */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
            ) : categories.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">カテゴリがありません</p>
                    <p className="text-sm text-slate-400 mt-1">「カテゴリを追加」ボタンから作成してください</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {categories.map((category, catIndex) => (
                        <div
                            key={category.id}
                            className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${!category.is_published ? 'opacity-60' : ''}`}
                        >
                            {/* カテゴリヘッダー */}
                            <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-200">
                                {/* 並び替え */}
                                <div className="flex flex-col">
                                    <button
                                        onClick={() => moveCategory(catIndex, -1)}
                                        disabled={catIndex === 0}
                                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                                        aria-label="カテゴリを上へ"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => moveCategory(catIndex, 1)}
                                        disabled={catIndex === categories.length - 1}
                                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                                        aria-label="カテゴリを下へ"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => toggleCategory(category.id)}
                                    className="flex items-center gap-2 flex-1 text-left"
                                >
                                    {category.isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-slate-500" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-slate-500" />
                                    )}
                                    <span className="font-semibold text-slate-800">{category.name}</span>
                                    <span className="text-sm text-slate-500">({category.fields.length}項目)</span>
                                    {!category.is_published && (
                                        <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">非表示</span>
                                    )}
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleCategoryPublished(category)}
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title={category.is_published ? '非表示にする' : '表示にする'}
                                    >
                                        {category.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => openCategoryModal(category)}
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="カテゴリ名を編集"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* 項目一覧 */}
                            {category.isExpanded && (
                                <div className="divide-y divide-slate-100">
                                    {category.fields.map((field, fieldIndex) => (
                                        <div
                                            key={field.id}
                                            className={`flex items-center gap-3 p-4 hover:bg-slate-50 ${!field.is_published ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex flex-col">
                                                <button
                                                    onClick={() => moveField(category, fieldIndex, -1)}
                                                    disabled={fieldIndex === 0}
                                                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                                                    aria-label="項目を上へ"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => moveField(category, fieldIndex, 1)}
                                                    disabled={fieldIndex === category.fields.length - 1}
                                                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                                                    aria-label="項目を下へ"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <span className="flex-1 text-slate-800">
                                                {field.name}
                                                {!field.is_published && (
                                                    <span className="ml-2 text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">非表示</span>
                                                )}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleFieldPublished(field)}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title={field.is_published ? '非表示にする' : '表示にする'}
                                                >
                                                    {field.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => openFieldModal(category.id, field)}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="項目名を編集"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {/* 項目追加 */}
                                    <div className="p-3">
                                        <button
                                            onClick={() => openFieldModal(category.id)}
                                            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            項目を追加
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* カテゴリ追加・編集モーダル */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-800">
                                {editingCategory ? 'カテゴリを編集' : 'カテゴリを追加'}
                            </h3>
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">カテゴリ名</label>
                            <input
                                type="text"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                placeholder="例：病院"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveCategory}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 項目追加・編集モーダル */}
            {showFieldModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-800">
                                {editingField ? '項目を編集' : '項目を追加'}
                            </h3>
                            <button
                                onClick={() => setShowFieldModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">項目名</label>
                            <input
                                type="text"
                                value={fieldName}
                                onChange={(e) => setFieldName(e.target.value)}
                                placeholder="例：病院（急性期）"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                            />
                            {editingField && (
                                <p className="mt-2 text-xs text-amber-600">
                                    ※ 既に登録に使われている項目名の変更は、過去データの表示に影響します。
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
                            <button
                                onClick={() => setShowFieldModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveField}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
