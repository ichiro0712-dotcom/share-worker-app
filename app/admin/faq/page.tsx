'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, ChevronRight, HelpCircle, Download, FileText, Loader2 } from 'lucide-react';
import { getFaqCategories, getCurrentUserGuide } from '@/src/lib/content-actions';

interface FaqItem {
    id: number;
    question: string;
    answer: string;
}

interface FaqCategory {
    id: number;
    name: string;
    faqs: FaqItem[];
}

interface UserGuide {
    id: number;
    file_path: string;
    file_name: string;
}

export default function FacilityFaqPage() {
    const router = useRouter();
    const { isAdmin, admin } = useAuth();
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [categories, setCategories] = useState<FaqCategory[]>([]);
    const [userGuide, setUserGuide] = useState<UserGuide | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin || !admin) {
            router.push('/admin/login');
            return;
        }

        const loadData = async () => {
            try {
                const [faqData, guideData] = await Promise.all([
                    getFaqCategories('FACILITY'),
                    getCurrentUserGuide('FACILITY'),
                ]);
                setCategories(faqData);
                setUserGuide(guideData);
            } catch (error) {
                console.error('Failed to load FAQ data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [isAdmin, admin, router]);

    if (!isAdmin || !admin) {
        return null;
    }

    const toggleItem = (faqId: number) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(faqId)) {
                next.delete(faqId);
            } else {
                next.add(faqId);
            }
            return next;
        });
    };

    const handleDownloadGuide = () => {
        if (userGuide) {
            window.open(userGuide.file_path, '_blank');
        } else {
            alert('ご利用ガイドはまだアップロードされていません');
        }
    };

    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">ご利用ガイド・FAQ</h1>

                {/* ご利用ガイドダウンロード */}
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl p-6 mb-8 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-lg">
                            <FileText className="w-8 h-8" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold mb-1">ご利用ガイド</h2>
                            <p className="text-indigo-100 text-sm">
                                S WORKSの使い方をまとめたPDFガイドです。初めての方はぜひご覧ください。
                            </p>
                            {userGuide && (
                                <p className="text-indigo-200 text-xs mt-1">
                                    ファイル: {userGuide.file_name}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleDownloadGuide}
                            disabled={!userGuide}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-5 h-5" />
                            PDFをダウンロード
                        </button>
                    </div>
                </div>

                {/* FAQ一覧 */}
                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-gray-900">よくある質問</h2>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                            <p className="text-gray-500">FAQはまだ登録されていません</p>
                        </div>
                    ) : (
                        categories.map((category) => (
                            <div key={category.id}>
                                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                                    {category.name}
                                </h3>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                                    {category.faqs.map((faq) => (
                                        <div key={faq.id}>
                                            <button
                                                onClick={() => toggleItem(faq.id)}
                                                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                                            >
                                                <span className="font-medium text-gray-800 pr-4">Q. {faq.question}</span>
                                                {expandedItems.has(faq.id) ? (
                                                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                )}
                                            </button>
                                            {expandedItems.has(faq.id) && (
                                                <div className="px-4 pb-4 bg-indigo-50">
                                                    <p className="text-sm text-gray-700 leading-relaxed">
                                                        <span className="font-medium text-indigo-600">A. </span>
                                                        {faq.answer}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* お問い合わせ案内 */}
                <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                        解決しない場合は、<a href="mailto:support@s-works.example.com" className="text-indigo-600 hover:underline">support@s-works.example.com</a> までお問い合わせください。
                    </p>
                </div>
            </div>
        </div>
    );
}
