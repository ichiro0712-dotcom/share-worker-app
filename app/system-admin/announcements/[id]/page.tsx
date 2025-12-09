'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAnnouncementDetail, updateAnnouncement } from '@/src/lib/system-actions';
import { ChevronLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function EditAnnouncementPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const id = parseInt(params.id);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'NEWS',
        target_type: 'ALL',
        published: false,
    });

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const data = await getAnnouncementDetail(id);
                if (data) {
                    setFormData({
                        title: data.title,
                        content: data.content,
                        category: data.category,
                        target_type: data.target_type,
                        published: data.published,
                    });
                } else {
                    toast.error('お知らせが見つかりません');
                    router.push('/system-admin/announcements');
                }
            } catch (e) {
                console.error(e);
                toast.error('読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.content) {
            toast.error('タイトルと本文は必須です');
            return;
        }

        setSubmitting(true);
        try {
            const result = await updateAnnouncement(id, formData);
            if (result.success) {
                toast.success('お知らせを更新しました');
                router.push('/system-admin/announcements');
            } else {
                toast.error(result.error || '更新に失敗しました');
            }
        } catch (e) {
            toast.error('エラーが発生しました');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">読み込み中...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/system-admin/announcements" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">お知らせ編集</h1>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">タイトル <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="お知らせのタイトル"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">カテゴリー</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="NEWS">ニュース</option>
                                <option value="MAINTENANCE">メンテナンス</option>
                                <option value="EVENT">イベント</option>
                                <option value="IMPORTANT">重要</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">配信先</label>
                            <select
                                value={formData.target_type}
                                onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="ALL">全員</option>
                                <option value="WORKER">ワーカーのみ</option>
                                <option value="FACILITY">施設のみ</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">本文 <span className="text-red-500">*</span></label>
                        <textarea
                            required
                            rows={10}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="お知らせの内容を入力してください"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="published"
                            checked={formData.published}
                            onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="published" className="text-sm text-slate-700 font-medium">公開する</label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Link
                            href="/system-admin/announcements"
                            className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            キャンセル
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-70"
                        >
                            <Save className="w-4 h-4" />
                            {submitting ? '保存中...' : '保存する'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
