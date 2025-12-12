'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface Props {
    title: string;
    content: string;
    lastUpdated: string;
}

export default function LegalDocumentClient({ title, content, lastUpdated }: Props) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center px-4 py-3">
                    <button onClick={() => router.back()} className="mr-3">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-lg font-bold">{title}</h1>
                </div>
            </div>

            {/* コンテンツ */}
            <div className="p-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div
                        className="prose prose-sm max-w-none
                            prose-h2:text-base prose-h2:font-bold prose-h2:text-gray-900 prose-h2:mt-6 prose-h2:mb-3
                            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-2
                            prose-ul:my-2 prose-li:text-gray-700"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                    <div className="mt-8 pt-4 border-t border-gray-200 text-right text-xs text-gray-500">
                        最終更新日: {lastUpdated}
                    </div>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
