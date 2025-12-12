'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Shield, Pencil, History, Eye, X, Loader2, Save, RotateCcw, Users, Building2, Copy, Check } from 'lucide-react';
import {
    getLegalDocument,
    getLegalDocumentVersions,
    createLegalDocument,
    revertToLegalDocumentVersion,
} from '@/src/lib/content-actions';

type TargetType = 'WORKER' | 'FACILITY';
type DocType = 'TERMS' | 'PRIVACY';

interface LegalDoc {
    id: number;
    doc_type: string;
    target_type: string;
    content: string;
    version: number;
    is_current: boolean;
    published_at: Date | null;
    created_at: Date;
}

interface AllDocs {
    WORKER: { TERMS: LegalDoc | null; PRIVACY: LegalDoc | null };
    FACILITY: { TERMS: LegalDoc | null; PRIVACY: LegalDoc | null };
}

interface AllVersions {
    WORKER: { TERMS: LegalDoc[]; PRIVACY: LegalDoc[] };
    FACILITY: { TERMS: LegalDoc[]; PRIVACY: LegalDoc[] };
}

export default function LegalEditPage() {
    const [loading, setLoading] = useState(true);
    const [allDocs, setAllDocs] = useState<AllDocs>({
        WORKER: { TERMS: null, PRIVACY: null },
        FACILITY: { TERMS: null, PRIVACY: null },
    });
    const [allVersions, setAllVersions] = useState<AllVersions>({
        WORKER: { TERMS: [], PRIVACY: [] },
        FACILITY: { TERMS: [], PRIVACY: [] },
    });
    const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
    const [selectedTargetType, setSelectedTargetType] = useState<TargetType | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewContent, setPreviewContent] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [reverting, setReverting] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyTargetType, setHistoryTargetType] = useState<TargetType | null>(null);
    const [historyDocType, setHistoryDocType] = useState<DocType | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const getDocTitle = (targetType: TargetType, docType: DocType) => {
        const prefix = targetType === 'WORKER' ? '【ワーカー向け】' : '【施設向け】';
        const docName = docType === 'TERMS' ? '利用規約' : 'プライバシーポリシー';
        return `${prefix}${docName}`;
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [
                workerTermsCurrent,
                workerPrivacyCurrent,
                facilityTermsCurrent,
                facilityPrivacyCurrent,
                workerTermsVersions,
                workerPrivacyVersions,
                facilityTermsVersions,
                facilityPrivacyVersions,
            ] = await Promise.all([
                getLegalDocument('TERMS', 'WORKER'),
                getLegalDocument('PRIVACY', 'WORKER'),
                getLegalDocument('TERMS', 'FACILITY'),
                getLegalDocument('PRIVACY', 'FACILITY'),
                getLegalDocumentVersions('TERMS', 'WORKER'),
                getLegalDocumentVersions('PRIVACY', 'WORKER'),
                getLegalDocumentVersions('TERMS', 'FACILITY'),
                getLegalDocumentVersions('PRIVACY', 'FACILITY'),
            ]);
            setAllDocs({
                WORKER: { TERMS: workerTermsCurrent, PRIVACY: workerPrivacyCurrent },
                FACILITY: { TERMS: facilityTermsCurrent, PRIVACY: facilityPrivacyCurrent },
            });
            setAllVersions({
                WORKER: { TERMS: workerTermsVersions, PRIVACY: workerPrivacyVersions },
                FACILITY: { TERMS: facilityTermsVersions, PRIVACY: facilityPrivacyVersions },
            });
        } catch (error) {
            console.error('データの読み込みに失敗しました:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (targetType: TargetType, docType: DocType) => {
        setSelectedTargetType(targetType);
        setSelectedDocType(docType);
        setEditContent(allDocs[targetType][docType]?.content || '');
        setEditModalOpen(true);
    };

    const handlePreview = (content: string, title: string) => {
        setPreviewContent(content);
        setPreviewTitle(title);
        setCopied(false);
        setHistoryModalOpen(false); // 履歴モーダルを閉じる
        setPreviewModalOpen(true);
    };

    const handleOpenHistory = (targetType: TargetType, docType: DocType) => {
        setHistoryTargetType(targetType);
        setHistoryDocType(docType);
        setHistoryModalOpen(true);
    };

    const handleCopyContent = async () => {
        // HTMLからテキストを抽出
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = previewContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        try {
            await navigator.clipboard.writeText(textContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('コピーに失敗しました:', error);
            alert('コピーに失敗しました');
        }
    };

    const handleSave = async () => {
        if (!selectedDocType || !selectedTargetType) return;
        setSaving(true);
        try {
            await createLegalDocument({
                docType: selectedDocType,
                targetType: selectedTargetType,
                content: editContent,
                createdBy: 1, // システム管理者ID（実際の認証から取得すべき）
            });
            await loadData();
            setEditModalOpen(false);
        } catch (error) {
            console.error('保存に失敗しました:', error);
            alert('保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleRevert = async (id: number) => {
        if (!confirm('この版に戻しますか？')) return;
        setReverting(id);
        try {
            await revertToLegalDocumentVersion(id);
            await loadData();
        } catch (error) {
            console.error('復元に失敗しました:', error);
            alert('復元に失敗しました');
        } finally {
            setReverting(null);
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatDateShort = (date: Date) => {
        return new Date(date).toLocaleDateString('ja-JP');
    };

    // 日付ベースのバージョン名を生成（例: V20251211_1）
    const getVersionName = (doc: LegalDoc, allDocsForType: LegalDoc[]) => {
        const docDate = new Date(doc.created_at);
        const year = docDate.getFullYear();
        const month = String(docDate.getMonth() + 1).padStart(2, '0');
        const day = String(docDate.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        // 同じ日付のドキュメントを抽出して、作成順でソート
        const sameDateDocs = allDocsForType
            .filter((d) => {
                const dDate = new Date(d.created_at);
                return (
                    dDate.getFullYear() === docDate.getFullYear() &&
                    dDate.getMonth() === docDate.getMonth() &&
                    dDate.getDate() === docDate.getDate()
                );
            })
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // その日付内での順番を取得（1から開始）
        const index = sameDateDocs.findIndex((d) => d.id === doc.id) + 1;

        return `V${dateStr}_${index}`;
    };

    // リッチテキストエディタの操作
    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    const renderDocCard = (targetType: TargetType, docType: DocType) => {
        const currentDoc = allDocs[targetType][docType];
        const docVersions = allVersions[targetType][docType];
        const title = getDocTitle(targetType, docType);
        const icon = docType === 'TERMS' ? <FileText className="w-6 h-6" /> : <Shield className="w-6 h-6" />;

        return (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">{icon}</div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-800">{title}</h3>
                        <p className="text-sm text-slate-500">
                            {currentDoc ? (
                                <>
                                    最終更新: {formatDate(currentDoc.published_at)} • バージョン:{' '}
                                    {getVersionName(currentDoc, docVersions)}
                                </>
                            ) : (
                                'まだ作成されていません'
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleEdit(targetType, docType)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                        編集
                    </button>
                    <button
                        onClick={() => handlePreview(currentDoc?.content || '', title)}
                        disabled={!currentDoc}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <Eye className="w-4 h-4" />
                        プレビュー
                    </button>
                    <button
                        onClick={() => handleOpenHistory(targetType, docType)}
                        disabled={docVersions.length === 0}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <History className="w-4 h-4" />
                        履歴
                    </button>
                </div>
            </div>
        );
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
                <h1 className="text-2xl font-bold text-slate-800">利用規約・プライバシーポリシー編集</h1>
                <p className="text-slate-500">利用規約とプライバシーポリシーの編集・バージョン管理ができます</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
            ) : (
                <>
                    {/* ワーカー向けセクション */}
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-indigo-200">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <Users className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">ワーカー向け</h2>
                        </div>

                        {/* ワーカー向けドキュメントカード */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderDocCard('WORKER', 'TERMS')}
                            {renderDocCard('WORKER', 'PRIVACY')}
                        </div>
                    </div>

                    {/* 施設向けセクション */}
                    <div>
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-emerald-200">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <Building2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">施設向け</h2>
                        </div>

                        {/* 施設向けドキュメントカード */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderDocCard('FACILITY', 'TERMS')}
                            {renderDocCard('FACILITY', 'PRIVACY')}
                        </div>
                    </div>
                </>
            )}

            {/* 編集モーダル */}
            {editModalOpen && selectedDocType && selectedTargetType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">
                                {getDocTitle(selectedTargetType, selectedDocType)}の編集
                            </h2>
                            <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* ツールバー */}
                        <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => execCommand('bold')}
                                className="px-3 py-1 text-sm font-bold hover:bg-slate-200 rounded"
                            >
                                B
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('italic')}
                                className="px-3 py-1 text-sm italic hover:bg-slate-200 rounded"
                            >
                                I
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('underline')}
                                className="px-3 py-1 text-sm underline hover:bg-slate-200 rounded"
                            >
                                U
                            </button>
                            <div className="w-px h-6 bg-slate-300 mx-1" />
                            <button
                                type="button"
                                onClick={() => execCommand('formatBlock', 'h2')}
                                className="px-3 py-1 text-sm hover:bg-slate-200 rounded"
                            >
                                H2
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('formatBlock', 'h3')}
                                className="px-3 py-1 text-sm hover:bg-slate-200 rounded"
                            >
                                H3
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('formatBlock', 'p')}
                                className="px-3 py-1 text-sm hover:bg-slate-200 rounded"
                            >
                                P
                            </button>
                            <div className="w-px h-6 bg-slate-300 mx-1" />
                            <button
                                type="button"
                                onClick={() => execCommand('insertUnorderedList')}
                                className="px-3 py-1 text-sm hover:bg-slate-200 rounded"
                            >
                                • List
                            </button>
                            <button
                                type="button"
                                onClick={() => execCommand('insertOrderedList')}
                                className="px-3 py-1 text-sm hover:bg-slate-200 rounded"
                            >
                                1. List
                            </button>
                        </div>

                        {/* エディタ */}
                        <div className="flex-1 overflow-auto p-4">
                            <div
                                ref={editorRef}
                                contentEditable
                                className="min-h-[400px] p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: editContent }}
                                onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
                            />
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
                            <button
                                onClick={() => handlePreview(editContent, getDocTitle(selectedTargetType, selectedDocType))}
                                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                            >
                                <Eye className="w-4 h-4 inline mr-2" />
                                プレビュー
                            </button>
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                新しいバージョンとして保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* プレビューモーダル */}
            {previewModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">{previewTitle} プレビュー</h2>
                            <button onClick={() => setPreviewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: previewContent }}
                            />
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
                            <button
                                onClick={handleCopyContent}
                                className={`px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors ${
                                    copied
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                }`}
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        コピーしました
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        全文コピー
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setPreviewModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* バージョン履歴モーダル */}
            {historyModalOpen && historyTargetType && historyDocType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-slate-600" />
                                <h2 className="text-lg font-bold text-slate-800">
                                    {getDocTitle(historyTargetType, historyDocType)}のバージョン履歴
                                </h2>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {allVersions[historyTargetType][historyDocType].length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    バージョン履歴はありません
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="border-b border-slate-200">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">バージョン</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">公開日</th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {allVersions[historyTargetType][historyDocType].map((v) => {
                                            const versionName = getVersionName(v, allVersions[historyTargetType][historyDocType]);
                                            const title = getDocTitle(historyTargetType, historyDocType);
                                            return (
                                                <tr key={v.id} className="hover:bg-slate-50">
                                                    <td className="py-3 px-4 text-sm">
                                                        <span className="font-medium text-slate-800">{versionName}</span>
                                                        {v.is_current && (
                                                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                                                現在
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-slate-600">
                                                        {formatDateShort(v.created_at)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button
                                                            onClick={() => handlePreview(v.content, `${title} ${versionName}`)}
                                                            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mr-3"
                                                        >
                                                            プレビュー
                                                        </button>
                                                        {!v.is_current && (
                                                            <button
                                                                onClick={() => handleRevert(v.id)}
                                                                disabled={reverting === v.id}
                                                                className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center gap-1"
                                                            >
                                                                {reverting === v.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <RotateCcw className="w-3 h-3" />
                                                                )}
                                                                この版に戻す
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="flex justify-end p-4 border-t border-slate-200">
                            <button
                                onClick={() => setHistoryModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
