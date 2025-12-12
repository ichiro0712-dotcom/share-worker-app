'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, RotateCcw, Copy, Check, FileText, HelpCircle, X, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    getLaborDocumentTemplate,
    updateLaborDocumentTemplate,
    resetLaborDocumentTemplate,
    previewLaborDocumentTemplate,
    type LaborDocumentTemplateData,
} from '@/src/lib/system-actions';
import { LABOR_TEMPLATE_VARIABLES } from '@/src/constants/labor-template';

export default function LaborTemplateEditPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [template, setTemplate] = useState<LaborDocumentTemplateData | null>(null);
    const [copiedVar, setCopiedVar] = useState<string | null>(null);

    useEffect(() => {
        loadTemplate();
    }, []);

    const loadTemplate = async () => {
        try {
            const data = await getLaborDocumentTemplate();
            setTemplate(data);
        } catch (error) {
            toast.error('テンプレートの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!template) return;

        setSaving(true);
        try {
            const result = await updateLaborDocumentTemplate(template);
            if (result.success) {
                toast.success('テンプレートを保存しました');
            } else {
                toast.error(result.error || '保存に失敗しました');
            }
        } catch (error) {
            toast.error('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('テンプレートをデフォルトに戻しますか？')) return;

        setSaving(true);
        try {
            const result = await resetLaborDocumentTemplate();
            if (result.success) {
                await loadTemplate();
                toast.success('テンプレートをリセットしました');
            } else {
                toast.error(result.error || 'リセットに失敗しました');
            }
        } catch (error) {
            toast.error('リセットに失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const copyVariable = (varKey: string) => {
        navigator.clipboard.writeText(varKey);
        setCopiedVar(varKey);
        setTimeout(() => setCopiedVar(null), 2000);
    };

    const handlePreview = async () => {
        if (!template) return;

        setPreviewing(true);
        try {
            const result = await previewLaborDocumentTemplate(
                template.template_content,
                template.accent_color
            );
            if (result.success && result.data) {
                // 新しいウィンドウでPDFを開く
                const win = window.open();
                if (win) {
                    win.document.write(
                        `<iframe src="${result.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
                    );
                } else {
                    toast.error('ポップアップがブロックされました');
                }
            } else {
                toast.error(result.error || 'プレビュー生成に失敗しました');
            }
        } catch (error) {
            toast.error('プレビュー生成に失敗しました');
        } finally {
            setPreviewing(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    if (!template) {
        return (
            <div className="p-8">
                <div className="text-center text-red-500">テンプレートの読み込みに失敗しました</div>
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* ヘルプモーダル */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setShowHelp(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="p-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <HelpCircle className="w-6 h-6 text-indigo-600" />
                                テンプレートの編集方法
                            </h2>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                <div className="flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-bold text-blue-900 mb-1">解雇事由について</h3>
                                        <p className="text-sm text-blue-800">
                                            ここで設定した「解雇の事由」の内容は、求人作成・編集時の「解雇事由」のデフォルト値として使用されます。<br />
                                            一貫性を保つため、このテンプレート内で解雇事由を適切に管理してください。
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 text-sm text-slate-600">
                                <section>
                                    <h3 className="font-bold text-slate-800 mb-2 text-base">基本ルール</h3>
                                    <p>テキストは自由に入力・編集できます。改行はそのまま反映されます。</p>
                                </section>

                                <section>
                                    <h3 className="font-bold text-slate-800 mb-2 text-base">セクションの見出し</h3>
                                    <p className="mb-2">
                                        行の先頭を <code className="bg-slate-100 px-1 py-0.5 rounded border">■</code> で始めると、その行は「セクション見出し」として扱われます。
                                    </p>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <p className="font-mono text-xs mb-1 text-slate-500">入力例:</p>
                                        <p className="font-mono text-slate-800">■ 業務内容</p>
                                        <p className="text-xs mt-2 text-indigo-600">
                                            → PDF生成時にアクセントカラーで強調表示され、下線が付きます。
                                        </p>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="font-bold text-slate-800 mb-2 text-base">変数の埋め込み</h3>
                                    <p className="mb-2">
                                        <code className="bg-slate-100 px-1 py-0.5 rounded border">{'{{変数名}}'}</code> の形式で記述すると、実際のデータ（ワーカー名や日時など）に自動的に置き換わります。
                                    </p>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <p className="font-mono text-xs mb-1 text-slate-500">入力例:</p>
                                        <p className="font-mono text-slate-800">労働者氏名: {'{{ワーカー名}}'} 殿</p>
                                        <p className="text-xs mt-2 text-indigo-600">
                                            → PDF生成時: 「労働者氏名: 山田 太郎 殿」のようになります。
                                        </p>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        ※ 使用可能な変数は、画面左側のリストからクリックしてコピーできます。
                                    </p>
                                </section>

                                <section>
                                    <h3 className="font-bold text-slate-800 mb-2 text-base">注意点</h3>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>変数の前後のスペースはそのまま出力されます。</li>
                                        <li>誤って変数の括弧 <code className="bg-slate-100 px-1 rounded">{'}}'}</code> を消してしまわないようご注意ください。</li>
                                        <li>HTMLタグは使用できません（テキストとして表示されます）。</li>
                                    </ul>
                                </section>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setShowHelp(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
                                >
                                    閉じる
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ヘッダー */}
            <div className="mb-6">
                <Link
                    href="/system-admin/content"
                    className="inline-flex items-center text-slate-600 hover:text-slate-800 mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    コンテンツ管理に戻る
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">労働条件通知書テンプレート編集</h1>
                        <p className="text-slate-500 mt-1">
                            テキストを自由に編集できます。<code className="bg-slate-100 px-1 rounded">{'{{変数名}}'}</code> の部分には実際のデータが入ります。
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePreview}
                            disabled={saving || previewing}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            {previewing ? '生成中...' : 'プレビュー'}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={saving || previewing}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            リセット
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 変数一覧（左サイドバー） */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-4">
                        <h2 className="font-semibold text-slate-800 mb-3">使用可能な変数</h2>
                        <p className="text-xs text-slate-500 mb-4">クリックでコピー</p>
                        <div className="space-y-2">
                            {LABOR_TEMPLATE_VARIABLES.map((v) => (
                                <button
                                    key={v.key}
                                    onClick={() => copyVariable(v.key)}
                                    className="w-full text-left p-2 rounded-lg hover:bg-indigo-50 transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <code className="text-sm text-indigo-600 font-mono">{v.key}</code>
                                        {copiedVar === v.key ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{v.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* テンプレート編集エリア */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                アクセントカラー（セクションバーの色）
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={template.accent_color}
                                    onChange={(e) => setTemplate({ ...template, accent_color: e.target.value })}
                                    className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={template.accent_color}
                                    onChange={(e) => setTemplate({ ...template, accent_color: e.target.value })}
                                    className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-700">
                                    テンプレート本文
                                </label>
                                <button
                                    onClick={() => setShowHelp(true)}
                                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                    編集方法
                                </button>
                            </div>
                            <textarea
                                value={template.template_content}
                                onChange={(e) => setTemplate({ ...template, template_content: e.target.value })}
                                className="w-full h-[600px] px-4 py-3 border border-slate-300 rounded-lg font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="テンプレートを入力..."
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                ヒント: <code className="bg-slate-100 px-1 rounded">{'{{変数名}}'}</code> 形式で変数を挿入すると、PDF生成時に実際の値に置き換わります。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
