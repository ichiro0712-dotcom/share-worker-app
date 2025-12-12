'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, GripVertical, Pencil, Trash2, ChevronDown, ChevronRight, X, Loader2, Eye, EyeOff, Download, Upload, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getFaqCategoriesForAdmin,
    createFaqCategory,
    updateFaqCategory,
    deleteFaqCategory,
    createFaq,
    updateFaq,
    deleteFaq,
    updateFaqOrder,
    updateFaqCategoryOrder,
} from '@/src/lib/content-actions';

type TargetType = 'WORKER' | 'FACILITY';

interface FaqItem {
    id: number;
    question: string;
    answer: string;
    sort_order: number;
    is_published: boolean;
}

interface FaqCategoryData {
    id: number;
    name: string;
    sort_order: number;
    faqs: FaqItem[];
}

interface FaqCategoryWithState extends FaqCategoryData {
    isExpanded: boolean;
}

// CSV形式の定義
const CSV_HEADERS = ['カテゴリ名', 'カテゴリ順', '質問', '回答', 'FAQ順', '公開'];

export default function FaqEditPage() {
    const [activeTab, setActiveTab] = useState<TargetType>('WORKER');
    const [categories, setCategories] = useState<FaqCategoryWithState[]>([]);
    const [loading, setLoading] = useState(true);

    // モーダル状態
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'category' | 'faq'; id: number } | null>(null);
    const [showCsvImportModal, setShowCsvImportModal] = useState(false);
    const [csvImportError, setCsvImportError] = useState<string | null>(null);
    const [csvPreviewData, setCsvPreviewData] = useState<string[][] | null>(null);

    // 編集対象
    const [editingCategory, setEditingCategory] = useState<FaqCategoryData | null>(null);
    const [editingFaq, setEditingFaq] = useState<(FaqItem & { categoryId: number }) | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

    // フォーム状態
    const [categoryName, setCategoryName] = useState('');
    const [faqQuestion, setFaqQuestion] = useState('');
    const [faqAnswer, setFaqAnswer] = useState('');
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    // ドラッグ&ドロップ状態
    const [draggedFaq, setDraggedFaq] = useState<{ faq: FaqItem; categoryId: number } | null>(null);
    const [draggedCategory, setDraggedCategory] = useState<FaqCategoryWithState | null>(null);

    // CSV入力用
    const csvInputRef = useRef<HTMLInputElement>(null);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getFaqCategoriesForAdmin(activeTab);
            setCategories(data.map(cat => ({
                ...cat,
                isExpanded: true,
            })));
        } catch {
            toast.error('FAQの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const handleTabChange = (tab: TargetType) => {
        setActiveTab(tab);
    };

    const toggleCategory = (categoryId: number) => {
        setCategories(prev =>
            prev.map(cat =>
                cat.id === categoryId ? { ...cat, isExpanded: !cat.isExpanded } : cat
            )
        );
    };

    // カテゴリ追加・編集
    const openCategoryModal = (category?: FaqCategoryData) => {
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
                await updateFaqCategory(editingCategory.id, { name: categoryName });
                toast.success('カテゴリを更新しました');
            } else {
                await createFaqCategory({ targetType: activeTab, name: categoryName });
                toast.success('カテゴリを追加しました');
            }
            setShowCategoryModal(false);
            loadCategories();
        } catch {
            toast.error('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    // FAQ追加・編集
    const openFaqModal = (categoryId: number, faq?: FaqItem) => {
        setSelectedCategoryId(categoryId);
        if (faq) {
            setEditingFaq({ ...faq, categoryId });
            setFaqQuestion(faq.question);
            setFaqAnswer(faq.answer);
        } else {
            setEditingFaq(null);
            setFaqQuestion('');
            setFaqAnswer('');
        }
        setShowFaqModal(true);
    };

    const handleSaveFaq = async () => {
        if (!faqQuestion.trim() || !faqAnswer.trim()) {
            toast.error('質問と回答を入力してください');
            return;
        }

        setSaving(true);
        try {
            if (editingFaq) {
                await updateFaq(editingFaq.id, { question: faqQuestion, answer: faqAnswer });
                toast.success('FAQを更新しました');
            } else if (selectedCategoryId) {
                await createFaq({ categoryId: selectedCategoryId, question: faqQuestion, answer: faqAnswer });
                toast.success('FAQを追加しました');
            }
            setShowFaqModal(false);
            loadCategories();
        } catch {
            toast.error('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    // 削除
    const handleDelete = async () => {
        if (!showDeleteConfirm) return;

        setSaving(true);
        try {
            if (showDeleteConfirm.type === 'category') {
                await deleteFaqCategory(showDeleteConfirm.id);
                toast.success('カテゴリを削除しました');
            } else {
                await deleteFaq(showDeleteConfirm.id);
                toast.success('FAQを削除しました');
            }
            setShowDeleteConfirm(null);
            loadCategories();
        } catch {
            toast.error('削除に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    // 公開/非公開切り替え
    const toggleFaqPublished = async (faq: FaqItem) => {
        try {
            await updateFaq(faq.id, { isPublished: !faq.is_published });
            toast.success(faq.is_published ? '非公開にしました' : '公開しました');
            loadCategories();
        } catch {
            toast.error('更新に失敗しました');
        }
    };

    // ドラッグ&ドロップ - FAQ
    const handleFaqDragStart = (e: React.DragEvent, faq: FaqItem, categoryId: number) => {
        setDraggedFaq({ faq, categoryId });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleFaqDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleFaqDrop = async (e: React.DragEvent, targetFaq: FaqItem, targetCategoryId: number) => {
        e.preventDefault();
        if (!draggedFaq || draggedFaq.faq.id === targetFaq.id) {
            setDraggedFaq(null);
            return;
        }

        // 同じカテゴリ内での並び替えのみ対応
        if (draggedFaq.categoryId !== targetCategoryId) {
            toast.error('カテゴリをまたいでの移動はできません');
            setDraggedFaq(null);
            return;
        }

        const category = categories.find(c => c.id === targetCategoryId);
        if (!category) return;

        const faqs = [...category.faqs];
        const draggedIndex = faqs.findIndex(f => f.id === draggedFaq.faq.id);
        const targetIndex = faqs.findIndex(f => f.id === targetFaq.id);

        // 順序を入れ替え
        faqs.splice(draggedIndex, 1);
        faqs.splice(targetIndex, 0, draggedFaq.faq);

        // 新しい順序を計算して更新
        const updates = faqs.map((faq, index) => ({
            id: faq.id,
            sortOrder: index + 1,
        }));

        try {
            await updateFaqOrder(updates);
            toast.success('並び順を更新しました');
            loadCategories();
        } catch {
            toast.error('並び順の更新に失敗しました');
        }

        setDraggedFaq(null);
    };

    // ドラッグ&ドロップ - カテゴリ
    const handleCategoryDragStart = (e: React.DragEvent, category: FaqCategoryWithState) => {
        setDraggedCategory(category);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleCategoryDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleCategoryDrop = async (e: React.DragEvent, targetCategory: FaqCategoryWithState) => {
        e.preventDefault();
        if (!draggedCategory || draggedCategory.id === targetCategory.id) {
            setDraggedCategory(null);
            return;
        }

        const cats = [...categories];
        const draggedIndex = cats.findIndex(c => c.id === draggedCategory.id);
        const targetIndex = cats.findIndex(c => c.id === targetCategory.id);

        cats.splice(draggedIndex, 1);
        cats.splice(targetIndex, 0, draggedCategory);

        const updates = cats.map((cat, index) => ({
            id: cat.id,
            sortOrder: index + 1,
        }));

        try {
            await updateFaqCategoryOrder(updates);
            toast.success('カテゴリの並び順を更新しました');
            loadCategories();
        } catch {
            toast.error('並び順の更新に失敗しました');
        }

        setDraggedCategory(null);
    };

    // CSVエクスポート
    const handleCsvExport = () => {
        const rows: string[][] = [CSV_HEADERS];

        categories.forEach(category => {
            if (category.faqs.length === 0) {
                // FAQがないカテゴリも出力
                rows.push([
                    category.name,
                    String(category.sort_order),
                    '',
                    '',
                    '',
                    '',
                ]);
            } else {
                category.faqs.forEach(faq => {
                    rows.push([
                        category.name,
                        String(category.sort_order),
                        faq.question,
                        faq.answer,
                        String(faq.sort_order),
                        faq.is_published ? '公開' : '非公開',
                    ]);
                });
            }
        });

        // CSVデータ生成（BOM付きUTF-8）
        const csvContent = rows.map(row =>
            row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });

        // ダウンロード
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FAQ_${activeTab === 'WORKER' ? 'ワーカー向け' : '施設向け'}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('CSVをダウンロードしました');
    };

    // CSVインポート - ファイル選択
    const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCsvAndValidate(text);
        };
        reader.readAsText(file);

        // 入力をリセット
        if (csvInputRef.current) {
            csvInputRef.current.value = '';
        }
    };

    // CSV解析と検証
    const parseCsvAndValidate = (csvText: string) => {
        setCsvImportError(null);
        setCsvPreviewData(null);

        try {
            // BOMを除去
            const text = csvText.replace(/^\uFEFF/, '');

            // 行に分割
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (lines.length < 2) {
                setCsvImportError('CSVファイルにデータがありません（ヘッダー行とデータ行が必要です）');
                setShowCsvImportModal(true);
                return;
            }

            // ヘッダー検証
            const headerLine = lines[0];
            const headers = parseCSVLine(headerLine);

            // ヘッダーの検証
            const expectedHeaders = CSV_HEADERS;
            if (headers.length !== expectedHeaders.length) {
                setCsvImportError(`CSVの列数が正しくありません。期待: ${expectedHeaders.length}列, 実際: ${headers.length}列\n\n必要な列: ${expectedHeaders.join(', ')}`);
                setShowCsvImportModal(true);
                return;
            }

            for (let i = 0; i < expectedHeaders.length; i++) {
                if (headers[i].trim() !== expectedHeaders[i]) {
                    setCsvImportError(`列名が正しくありません。\n位置${i + 1}: 期待「${expectedHeaders[i]}」, 実際「${headers[i].trim()}」\n\n正しいヘッダー: ${expectedHeaders.join(', ')}`);
                    setShowCsvImportModal(true);
                    return;
                }
            }

            // データ行を解析
            const dataRows: string[][] = [];
            for (let i = 1; i < lines.length; i++) {
                const row = parseCSVLine(lines[i]);
                if (row.length !== expectedHeaders.length) {
                    setCsvImportError(`${i + 1}行目の列数が正しくありません。期待: ${expectedHeaders.length}列, 実際: ${row.length}列`);
                    setShowCsvImportModal(true);
                    return;
                }

                // カテゴリ名は必須
                if (!row[0].trim()) {
                    setCsvImportError(`${i + 1}行目: カテゴリ名が空です`);
                    setShowCsvImportModal(true);
                    return;
                }

                // FAQがある場合は質問と回答が必須
                if (row[2].trim() || row[3].trim()) {
                    if (!row[2].trim()) {
                        setCsvImportError(`${i + 1}行目: 質問が空です`);
                        setShowCsvImportModal(true);
                        return;
                    }
                    if (!row[3].trim()) {
                        setCsvImportError(`${i + 1}行目: 回答が空です`);
                        setShowCsvImportModal(true);
                        return;
                    }
                }

                // 公開状態の検証
                if (row[5].trim() && !['公開', '非公開'].includes(row[5].trim())) {
                    setCsvImportError(`${i + 1}行目: 公開状態は「公開」または「非公開」で指定してください`);
                    setShowCsvImportModal(true);
                    return;
                }

                dataRows.push(row);
            }

            // プレビューデータをセット
            setCsvPreviewData(dataRows);
            setShowCsvImportModal(true);

        } catch (error) {
            setCsvImportError(`CSVの解析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
            setShowCsvImportModal(true);
        }
    };

    // CSVの1行を解析（ダブルクォートを考慮）
    const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (inQuotes) {
                if (char === '"') {
                    if (nextChar === '"') {
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
        }
        result.push(current);

        return result;
    };

    // CSVインポート実行
    const handleCsvImport = async () => {
        if (!csvPreviewData) return;

        setImporting(true);
        try {
            // カテゴリとFAQのマッピング
            const categoryMap = new Map<string, { order: number; faqs: { question: string; answer: string; order: number; published: boolean }[] }>();

            for (const row of csvPreviewData) {
                const categoryName = row[0].trim();
                const categoryOrder = parseInt(row[1]) || 1;
                const question = row[2].trim();
                const answer = row[3].trim();
                const faqOrder = parseInt(row[4]) || 1;
                const published = row[5].trim() !== '非公開';

                if (!categoryMap.has(categoryName)) {
                    categoryMap.set(categoryName, { order: categoryOrder, faqs: [] });
                }

                if (question && answer) {
                    categoryMap.get(categoryName)!.faqs.push({
                        question,
                        answer,
                        order: faqOrder,
                        published,
                    });
                }
            }

            // 既存データを削除
            for (const category of categories) {
                await deleteFaqCategory(category.id);
            }

            // 新規作成
            const sortedCategories = Array.from(categoryMap.entries())
                .sort((a, b) => a[1].order - b[1].order);

            for (const [catName, catData] of sortedCategories) {
                const newCategory = await createFaqCategory({ targetType: activeTab, name: catName });

                const sortedFaqs = catData.faqs.sort((a, b) => a.order - b.order);
                for (const faq of sortedFaqs) {
                    const createdFaq = await createFaq({
                        categoryId: newCategory.id,
                        question: faq.question,
                        answer: faq.answer,
                    });
                    if (!faq.published) {
                        await updateFaq(createdFaq.id, { isPublished: false });
                    }
                }
            }

            toast.success('CSVからFAQをインポートしました');
            setShowCsvImportModal(false);
            setCsvPreviewData(null);
            loadCategories();
        } catch (error) {
            toast.error('インポートに失敗しました');
            console.error('Import error:', error);
        } finally {
            setImporting(false);
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
                <h1 className="text-2xl font-bold text-slate-800">FAQ編集</h1>
                <p className="text-slate-500">よくある質問の登録・編集・並び替えができます</p>
            </div>

            {/* タブ */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => handleTabChange('WORKER')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'WORKER'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    ワーカー向け
                </button>
                <button
                    onClick={() => handleTabChange('FACILITY')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'FACILITY'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    施設向け
                </button>
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
                <button
                    onClick={handleCsvExport}
                    disabled={categories.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    CSV出力
                </button>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    CSV入力
                    <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCsvFileSelect}
                        className="hidden"
                    />
                </label>
            </div>

            {/* ローディング */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
            ) : categories.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <p className="text-slate-500">FAQカテゴリがありません</p>
                    <p className="text-sm text-slate-400 mt-1">「カテゴリを追加」ボタンから作成してください</p>
                </div>
            ) : (
                /* カテゴリ一覧 */
                <div className="space-y-4">
                    {categories.map((category) => (
                        <div
                            key={category.id}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                            draggable
                            onDragStart={(e) => handleCategoryDragStart(e, category)}
                            onDragOver={handleCategoryDragOver}
                            onDrop={(e) => handleCategoryDrop(e, category)}
                        >
                            {/* カテゴリヘッダー */}
                            <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-200">
                                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab" />
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
                                    <span className="text-sm text-slate-500">({category.faqs.length}件)</span>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openCategoryModal(category)}
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm({ type: 'category', id: category.id })}
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* FAQ一覧 */}
                            {category.isExpanded && (
                                <div className="divide-y divide-slate-100">
                                    {category.faqs.map((faq) => (
                                        <div
                                            key={faq.id}
                                            className={`flex items-center gap-3 p-4 hover:bg-slate-50 ${!faq.is_published ? 'opacity-50' : ''}`}
                                            draggable
                                            onDragStart={(e) => handleFaqDragStart(e, faq, category.id)}
                                            onDragOver={handleFaqDragOver}
                                            onDrop={(e) => handleFaqDrop(e, faq, category.id)}
                                        >
                                            <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-700">Q: {faq.question}</p>
                                                <p className="text-sm text-slate-500 mt-1 line-clamp-1">A: {faq.answer}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleFaqPublished(faq)}
                                                    className={`p-2 rounded-lg transition-colors ${faq.is_published
                                                        ? 'text-green-600 hover:bg-green-50'
                                                        : 'text-slate-400 hover:bg-slate-100'
                                                        }`}
                                                    title={faq.is_published ? '公開中' : '非公開'}
                                                >
                                                    {faq.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => openFaqModal(category.id, faq)}
                                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm({ type: 'faq', id: faq.id })}
                                                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="p-4">
                                        <button
                                            onClick={() => openFaqModal(category.id)}
                                            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                                        >
                                            <Plus className="w-4 h-4" />
                                            質問を追加
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ヒント */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                    💡 ヒント: ドラッグ&ドロップで並び替えができます。目のアイコンで公開/非公開を切り替えられます。CSVで一括編集も可能です。
                </p>
            </div>

            {/* カテゴリモーダル */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCategoryModal(false)}></div>
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {editingCategory ? 'カテゴリを編集' : 'カテゴリを追加'}
                            </h3>
                            <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">カテゴリ名</label>
                            <input
                                type="text"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="例: 登録について"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveCategory}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAQモーダル */}
            {showFaqModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowFaqModal(false)}></div>
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {editingFaq ? 'FAQを編集' : 'FAQを追加'}
                            </h3>
                            <button onClick={() => setShowFaqModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">質問</label>
                                <input
                                    type="text"
                                    value={faqQuestion}
                                    onChange={(e) => setFaqQuestion(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="例: 登録に必要なものは何ですか？"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">回答</label>
                                <textarea
                                    value={faqAnswer}
                                    onChange={(e) => setFaqAnswer(e.target.value)}
                                    rows={6}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="回答を入力してください..."
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowFaqModal(false)}
                                className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveFaq}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 削除確認モーダル */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(null)}></div>
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">削除確認</h3>
                        <p className="text-slate-600 mb-6">
                            {showDeleteConfirm.type === 'category'
                                ? 'このカテゴリを削除しますか？カテゴリ内のすべてのFAQも削除されます。'
                                : 'このFAQを削除しますか？'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '削除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSVインポートモーダル */}
            {showCsvImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCsvImportModal(false); setCsvImportError(null); setCsvPreviewData(null); }}></div>
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">CSVインポート</h3>
                            <button onClick={() => { setShowCsvImportModal(false); setCsvImportError(null); setCsvPreviewData(null); }} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {csvImportError ? (
                            <div className="mb-6">
                                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-red-800">CSV形式エラー</p>
                                        <p className="text-sm text-red-600 mt-1 whitespace-pre-wrap">{csvImportError}</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                    <p className="text-sm font-medium text-slate-700 mb-2">正しいCSV形式:</p>
                                    <code className="text-xs text-slate-600 block overflow-x-auto">
                                        {CSV_HEADERS.join(',')}
                                    </code>
                                </div>
                            </div>
                        ) : csvPreviewData ? (
                            <div className="mb-6">
                                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800">注意</p>
                                        <p className="text-sm text-amber-600 mt-1">
                                            インポートを実行すると、現在の{activeTab === 'WORKER' ? 'ワーカー向け' : '施設向け'}FAQデータはすべて削除され、CSVの内容に置き換わります。
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-2">
                                    プレビュー（{csvPreviewData.length}件）:
                                </p>
                                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0">
                                            <tr>
                                                {CSV_HEADERS.map((header, i) => (
                                                    <th key={i} className="text-left px-3 py-2 text-slate-600 font-medium whitespace-nowrap">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {csvPreviewData.slice(0, 10).map((row, rowIndex) => (
                                                <tr key={rowIndex} className="hover:bg-slate-50">
                                                    {row.map((cell, cellIndex) => (
                                                        <td key={cellIndex} className="px-3 py-2 text-slate-700 max-w-[200px] truncate">
                                                            {cell || '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {csvPreviewData.length > 10 && (
                                        <div className="px-3 py-2 bg-slate-50 text-sm text-slate-500">
                                            ...他 {csvPreviewData.length - 10} 件
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCsvImportModal(false); setCsvImportError(null); setCsvPreviewData(null); }}
                                className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            {csvPreviewData && !csvImportError && (
                                <button
                                    onClick={handleCsvImport}
                                    disabled={importing}
                                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {importing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'インポート実行'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
