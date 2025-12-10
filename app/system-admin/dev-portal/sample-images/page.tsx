'use client';

import { useState } from 'react';
import { Download, Check, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Image from 'next/image';

type SampleImage = {
    id: string;
    src: string;
    name: string;
    category: string;
};

const CATEGORIES = {
    PEOPLE_20s_F: '20代女性',
    PEOPLE_20s_M: '20代男性',
    PEOPLE_40s_M: '40代男性',
    PEOPLE_40s_F: '40代女性',
    PEOPLE_60s_M: '60代男性',
    PEOPLE_60s_F: '60代女性',
    DOCUMENTS: '書類・証明書',
    FACILITY: '施設・求人',
    ATTIRE: '服装例'
};

const SAMPLE_IMAGES: SampleImage[] = [
    // 20代女性
    { id: '20s_f_1', src: '/images/samples/20s_female_1.png', name: '20代女性_1.png', category: CATEGORIES.PEOPLE_20s_F },
    { id: '20s_f_2', src: '/images/samples/20s_female_2.png', name: '20代女性_2.png', category: CATEGORIES.PEOPLE_20s_F },
    { id: '20s_f_3', src: '/images/samples/20s_female_3.png', name: '20代女性_3.png', category: CATEGORIES.PEOPLE_20s_F },
    // 20代男性
    { id: '20s_m_1', src: '/images/samples/20s_male_1.png', name: '20代男性_1.png', category: CATEGORIES.PEOPLE_20s_M },
    { id: '20s_m_2', src: '/images/samples/20s_male_2.png', name: '20代男性_2.png', category: CATEGORIES.PEOPLE_20s_M },
    { id: '20s_m_3', src: '/images/samples/20s_male_3.png', name: '20代男性_3.png', category: CATEGORIES.PEOPLE_20s_M },
    // 40代男性
    { id: '40s_m_1', src: '/images/samples/40s_male_1.png', name: '40代男性_1.png', category: CATEGORIES.PEOPLE_40s_M },
    { id: '40s_m_2', src: '/images/samples/40s_male_2.png', name: '40代男性_2.png', category: CATEGORIES.PEOPLE_40s_M },
    { id: '40s_m_3', src: '/images/samples/40s_male_3.png', name: '40代男性_3.png', category: CATEGORIES.PEOPLE_40s_M },
    // 40代女性
    { id: '40s_f_1', src: '/images/samples/40s_female_1.png', name: '40代女性_1.png', category: CATEGORIES.PEOPLE_40s_F },
    { id: '40s_f_2', src: '/images/samples/40s_female_2.png', name: '40代女性_2.png', category: CATEGORIES.PEOPLE_40s_F },
    { id: '40s_f_3', src: '/images/samples/40s_female_3.png', name: '40代女性_3.png', category: CATEGORIES.PEOPLE_40s_F },
    // 60代男性
    { id: '60s_m_1', src: '/images/samples/60s_male_1.png', name: '60代男性_1.png', category: CATEGORIES.PEOPLE_60s_M },
    { id: '60s_m_2', src: '/images/samples/60s_male_2.png', name: '60代男性_2.png', category: CATEGORIES.PEOPLE_60s_M },
    { id: '60s_m_3', src: '/images/samples/60s_male_3.png', name: '60代男性_3.png', category: CATEGORIES.PEOPLE_60s_M },
    // 60代女性
    { id: '60s_f_1', src: '/images/samples/60s_female_1.png', name: '60代女性_1.png', category: CATEGORIES.PEOPLE_60s_F },
    { id: '60s_f_2', src: '/images/samples/60s_female_2.png', name: '60代女性_2.png', category: CATEGORIES.PEOPLE_60s_F },
    { id: '60s_f_3', src: '/images/samples/60s_female_3.png', name: '60代女性_3.png', category: CATEGORIES.PEOPLE_60s_F },
    // 書類
    { id: 'doc_license', src: '/images/samples/driver_license.png', name: '免許証.png', category: CATEGORIES.DOCUMENTS },
    { id: 'doc_care', src: '/images/samples/care_license.png', name: '介護福祉士証.png', category: CATEGORIES.DOCUMENTS },
    { id: 'doc_nurse', src: '/images/samples/nurse_license.png', name: '看護師免許証.png', category: CATEGORIES.DOCUMENTS },
    { id: 'doc_bank', src: '/images/samples/bank_book.png', name: '通帳.png', category: CATEGORIES.DOCUMENTS },
    { id: 'doc_pension', src: '/images/samples/pension_book.png', name: '年金手帳.png', category: CATEGORIES.DOCUMENTS },
    // 施設求人TOP (10枚)
    ...Array.from({ length: 10 }).map((_, i) => ({
        id: `facility_top_${i + 1}`,
        src: `/images/samples/facility_top_${i + 1}.png`,
        name: `介護施設TOP_${i + 1}.png`,
        category: CATEGORIES.FACILITY
    })),
    // 服装例
    { id: 'attire_care_1', src: '/images/samples/attire_care_1.png', name: '介護士服装_1.png', category: CATEGORIES.ATTIRE },
    { id: 'attire_care_2', src: '/images/samples/attire_care_2.png', name: '介護士服装_2.png', category: CATEGORIES.ATTIRE },
    { id: 'attire_care_3', src: '/images/samples/attire_care_3.png', name: '介護士服装_3.png', category: CATEGORIES.ATTIRE },
    { id: 'attire_nurse_1', src: '/images/samples/attire_nurse_1.png', name: '看護師服装_1.png', category: CATEGORIES.ATTIRE },
    { id: 'attire_nurse_2', src: '/images/samples/attire_nurse_2.png', name: '看護師服装_2.png', category: CATEGORIES.ATTIRE },
    { id: 'attire_nurse_3', src: '/images/samples/attire_nurse_3.png', name: '看護師服装_3.png', category: CATEGORIES.ATTIRE },
];

export default function SampleImagesPage() {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === SAMPLE_IMAGES.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(SAMPLE_IMAGES.map(img => img.id)));
        }
    };

    const downloadSelected = async () => {
        if (selectedIds.size === 0) return;
        setIsDownloading(true);

        try {
            const zip = new JSZip();
            const promises = Array.from(selectedIds).map(async (id) => {
                const img = SAMPLE_IMAGES.find(i => i.id === id);
                if (!img) return;

                try {
                    const response = await fetch(img.src);
                    if (!response.ok) throw new Error(`Failed to fetch ${img.name}`);
                    const blob = await response.blob();
                    zip.file(img.name, blob);
                } catch (e) {
                    console.error(`Error downloading ${img.name}:`, e);
                }
            });

            await Promise.all(promises);
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'sample_images.zip');
        } catch (e) {
            console.error('Download failed:', e);
            alert('ダウンロードに失敗しました');
        } finally {
            setIsDownloading(false);
        }
    };

    // Group images by category
    const groupedImages = Object.values(CATEGORIES).reduce((acc, category) => {
        acc[category] = SAMPLE_IMAGES.filter(img => img.category === category);
        return acc;
    }, {} as Record<string, SampleImage[]>);

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* Header */}
                <header className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between sticky top-4 z-10">
                    <div className="flex items-center gap-4">
                        <Link href="/dev-portal" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <ImageIcon className="w-6 h-6 text-pink-600" />
                                サンプル画像素材集
                            </h1>
                            <p className="text-sm text-gray-500">開発・テスト用のダミー画像一覧</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">
                            選択中: <span className="font-bold text-gray-900">{selectedIds.size}</span> 枚
                        </div>
                        <button
                            onClick={selectAll}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            {selectedIds.size === SAMPLE_IMAGES.length ? '全解除' : '全選択'}
                        </button>
                        <button
                            onClick={downloadSelected}
                            disabled={selectedIds.size === 0 || isDownloading}
                            className={`px-4 py-2 text-sm font-bold text-white rounded-lg flex items-center gap-2 transition-all
                                ${selectedIds.size === 0 || isDownloading
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-pink-600 hover:bg-pink-700 shadow-md hover:shadow-lg'}`}
                        >
                            {isDownloading ? (
                                <>保存中...</>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    まとめてダウンロード
                                </>
                            )}
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="space-y-8 pb-20">
                    {Object.entries(groupedImages).map(([category, images]) => (
                        <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="font-bold text-gray-800">{category}</h2>
                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                                    {images.length}枚
                                </span>
                            </div>
                            <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {images.map((img) => (
                                    <div
                                        key={img.id}
                                        onClick={() => toggleSelection(img.id)}
                                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all aspect-square
                                            ${selectedIds.has(img.id) ? 'border-pink-500 ring-2 ring-pink-100' : 'border-transparent hover:border-gray-300'}`}
                                    >
                                        <div className="absolute top-2 left-2 z-10">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                ${selectedIds.has(img.id) ? 'bg-pink-500 border-pink-500' : 'bg-white/80 border-gray-400'}`}>
                                                {selectedIds.has(img.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                        </div>
                                        <div className="relative w-full h-full bg-gray-100">
                                            <Image
                                                src={img.src}
                                                alt={img.name}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                                            />
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-xs text-white truncate">{img.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
