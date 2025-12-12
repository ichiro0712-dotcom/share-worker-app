'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, Download, Trash2, Eye, Loader2, X, CheckCircle } from 'lucide-react';
import { getCurrentUserGuide, getUserGuideHistory, createUserGuide, deleteUserGuide } from '@/src/lib/content-actions';

interface UserGuide {
    id: number;
    target_type: string;
    file_path: string;
    file_name: string;
    file_size: number;
    uploaded_by: number;
    created_at: Date;
}

export default function UserGuideEditPage() {
    const [loading, setLoading] = useState(true);
    const [currentGuide, setCurrentGuide] = useState<UserGuide | null>(null);
    const [history, setHistory] = useState<UserGuide[]>([]);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [current, historyData] = await Promise.all([
                getCurrentUserGuide('FACILITY'),
                getUserGuideHistory('FACILITY'),
            ]);
            setCurrentGuide(current);
            setHistory(historyData);
        } catch (error) {
            console.error('データの読み込みに失敗しました:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatDateShort = (date: Date) => {
        return new Date(date).toLocaleDateString('ja-JP');
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files[0]) {
            await uploadFile(files[0]);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files[0]) {
            await uploadFile(files[0]);
        }
    };

    const uploadFile = async (file: File) => {
        if (!file.type.includes('pdf')) {
            alert('PDFファイルのみアップロードできます');
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            alert('ファイルサイズは100MB以下にしてください');
            return;
        }

        setUploading(true);
        try {
            // FormDataを使ってファイルをアップロード
            const formData = new FormData();
            formData.append('files', file);
            formData.append('type', 'user-guide');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'アップロードに失敗しました');
            }

            const data = await response.json();
            const filePath = data.urls[0];

            // DBに保存
            await createUserGuide({
                targetType: 'FACILITY',
                filePath: filePath,
                fileName: file.name,
                fileSize: file.size,
                uploadedBy: 1, // システム管理者ID（実際の認証から取得すべき）
            });

            await loadData();
        } catch (error) {
            console.error('アップロードに失敗しました:', error);
            alert(error instanceof Error ? error.message : 'アップロードに失敗しました');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('このファイルを削除しますか？')) return;
        setDeleting(id);
        try {
            await deleteUserGuide(id);
            await loadData();
        } catch (error) {
            console.error('削除に失敗しました:', error);
            alert('削除に失敗しました');
        } finally {
            setDeleting(null);
        }
    };

    const handlePreview = (filePath: string) => {
        setPreviewUrl(filePath);
    };

    const handleDownload = (filePath: string, fileName: string) => {
        const a = document.createElement('a');
        a.href = filePath;
        a.download = fileName;
        a.click();
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
                <h1 className="text-2xl font-bold text-slate-800">ご利用ガイド編集</h1>
                <p className="text-slate-500">施設向けご利用ガイドPDFを管理します</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
            ) : (
                <>
                    {/* 現在のガイド */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">現在のご利用ガイド</h2>

                        {currentGuide ? (
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="p-3 bg-red-100 rounded-lg">
                                    <FileText className="w-8 h-8 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-slate-800">{currentGuide.file_name}</p>
                                    <p className="text-sm text-slate-500">
                                        {formatFileSize(currentGuide.file_size)} • アップロード: {formatDate(currentGuide.created_at)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePreview(currentGuide.file_path)}
                                        className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                        プレビュー
                                    </button>
                                    <button
                                        onClick={() => handleDownload(currentGuide.file_path, currentGuide.file_name)}
                                        className="inline-flex items-center gap-2 px-3 py-2 text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        ダウンロード
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                ご利用ガイドはまだアップロードされていません
                            </div>
                        )}
                    </div>

                    {/* 新しいPDFをアップロード */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">新しいPDFをアップロード</h2>

                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragActive
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-slate-300 hover:border-indigo-400'
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploading ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                                    <p className="text-slate-600">アップロード中...</p>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600 mb-2">PDFファイルをドラッグ&ドロップ</p>
                                    <p className="text-sm text-slate-500 mb-4">または</p>
                                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                                        ファイルを選択
                                    </button>
                                    <p className="text-xs text-slate-400 mt-4">最大ファイルサイズ: 100MB</p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>

                    {/* アップロード履歴 */}
                    {history.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">アップロード履歴</h2>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">ファイル名</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">サイズ</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">アップロード日</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {history.map((guide, index) => (
                                        <tr key={guide.id} className="hover:bg-slate-50">
                                            <td className="py-3 px-4 text-sm text-slate-800">{guide.file_name}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{formatFileSize(guide.file_size)}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{formatDateShort(guide.created_at)}</td>
                                            <td className="py-3 px-4 text-right">
                                                {index === 0 ? (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded inline-flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        現在使用中
                                                    </span>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handlePreview(guide.file_path)}
                                                            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mr-3"
                                                        >
                                                            プレビュー
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(guide.id)}
                                                            disabled={deleting === guide.id}
                                                            className="text-red-600 hover:text-red-700 text-sm font-medium inline-flex items-center gap-1"
                                                        >
                                                            {deleting === guide.id ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3 h-3" />
                                                            )}
                                                            削除
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* PDFプレビューモーダル */}
            {previewUrl && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">PDFプレビュー</h2>
                            <button onClick={() => setPreviewUrl(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1">
                            <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
