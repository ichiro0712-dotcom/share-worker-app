'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronRight, HelpCircle, MessageCircle } from 'lucide-react';

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

interface Props {
    categories: FaqCategory[];
}

export default function WorkerFaqClient({ categories }: Props) {
    const router = useRouter();
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

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

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200">
                <div className="flex items-center px-4 py-3">
                    <button onClick={() => router.back()} className="mr-3">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-lg font-bold">よくある質問</h1>
                </div>
            </div>

            {/* FAQ一覧 */}
            <div className="p-4 space-y-6">
                {categories.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                        <p className="text-gray-500">FAQはまだ登録されていません</p>
                    </div>
                ) : (
                    categories.map((category) => (
                        <div key={category.id}>
                            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                                <HelpCircle className="w-4 h-4 text-indigo-600" />
                                {category.name}
                            </h2>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
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

            {/* お問い合わせリンク */}
            <div className="p-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-600 mb-3">
                        解決しない場合はお問い合わせください
                    </p>
                    <button
                        onClick={() => router.push('/contact')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        <MessageCircle className="w-5 h-5" />
                        お問い合わせ
                    </button>
                </div>
            </div>
        </div>
    );
}
