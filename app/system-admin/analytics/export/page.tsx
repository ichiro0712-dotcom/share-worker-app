'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getExportData, AnalyticsFilter } from '@/src/lib/analytics-actions';

const WORKER_METRICS = [
    { key: 'registeredCount', label: '登録ワーカー数' },
    { key: 'newCount', label: '入会ワーカー数' },
    { key: 'withdrawnCount', label: '退会ワーカー数' },
    { key: 'reviewCount', label: 'レビュー数' },
    { key: 'reviewAvg', label: 'レビュー平均点' },
    { key: 'cancelRate', label: 'キャンセル率' },
    { key: 'lastMinuteCancelRate', label: '直前キャンセル率' },
    { key: 'withdrawalRate', label: '退会率' }
];

const FACILITY_METRICS = [
    { key: 'registeredCount', label: '登録施設数' },
    { key: 'newCount', label: '入会施設数' },
    { key: 'withdrawnCount', label: '退会施設数' },
    { key: 'reviewCount', label: 'レビュー数' },
    { key: 'reviewAvg', label: 'レビュー平均点' },
    { key: 'parentJobCount', label: '親求人数' },
    { key: 'childJobCount', label: '子求人数' }
];

const MATCHING_METRICS = [
    { key: 'applicationCount', label: '応募数' },
    { key: 'matchingCount', label: 'マッチング数' },
    { key: 'avgMatchingHours', label: 'マッチング期間' },
    { key: 'applicationsPerWorker', label: 'ワーカーあたり応募数' },
    { key: 'matchingsPerWorker', label: 'ワーカーあたりマッチング数' }
];

export default function ExportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedWorker, setSelectedWorker] = useState<string[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string[]>([]);
    const [selectedMatching, setSelectedMatching] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const toggleMetric = (
        key: string,
        selected: string[],
        setSelected: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        setSelected(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleExport = async () => {
        if (!startDate || !endDate) {
            alert('期間を指定してください');
            return;
        }
        if (selectedWorker.length === 0 && selectedFacility.length === 0 && selectedMatching.length === 0) {
            alert('少なくとも1つの指標を選択してください');
            return;
        }

        setLoading(true);
        try {
            const filter: AnalyticsFilter = { viewMode: 'daily' };
            const data = await getExportData({
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                metrics: {
                    worker: selectedWorker,
                    facility: selectedFacility,
                    matching: selectedMatching
                },
                filter
            });

            // CSVを生成
            const rows: string[][] = [];
            const headers = ['日付'];

            if (data.workerData.length > 0) {
                selectedWorker.forEach(key => {
                    const label = WORKER_METRICS.find(m => m.key === key)?.label || key;
                    headers.push(`ワーカー_${label}`);
                });
            }
            if (data.facilityData.length > 0) {
                selectedFacility.forEach(key => {
                    const label = FACILITY_METRICS.find(m => m.key === key)?.label || key;
                    headers.push(`施設_${label}`);
                });
            }
            if (data.matchingData.length > 0) {
                selectedMatching.forEach(key => {
                    const label = MATCHING_METRICS.find(m => m.key === key)?.label || key;
                    headers.push(`マッチング_${label}`);
                });
            }
            rows.push(headers);

            const maxLength = Math.max(
                data.workerData.length,
                data.facilityData.length,
                data.matchingData.length
            );

            for (let i = 0; i < maxLength; i++) {
                const row: string[] = [];
                const date = data.workerData[i]?.date || data.facilityData[i]?.date || data.matchingData[i]?.date || '';
                row.push(date);

                if (data.workerData.length > 0) {
                    selectedWorker.forEach(key => {
                        row.push(String(data.workerData[i]?.[key as keyof typeof data.workerData[0]] ?? ''));
                    });
                }
                if (data.facilityData.length > 0) {
                    selectedFacility.forEach(key => {
                        row.push(String(data.facilityData[i]?.[key as keyof typeof data.facilityData[0]] ?? ''));
                    });
                }
                if (data.matchingData.length > 0) {
                    selectedMatching.forEach(key => {
                        row.push(String(data.matchingData[i]?.[key as keyof typeof data.matchingData[0]] ?? ''));
                    });
                }
                rows.push(row);
            }

            // BOMを追加してExcelで文字化けしないようにする
            const bom = '\uFEFF';
            const csv = bom + rows.map(row => row.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics_${startDate}_${endDate}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('エクスポートに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">スプレッドシートDL</h1>
                    <p className="text-slate-500">アナリティクスデータをCSVでダウンロードします</p>
                </div>
                <Link
                    href="/system-admin/analytics"
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                >
                    戻る
                </Link>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
                {/* 期間指定 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">期間指定</h3>
                    <div className="flex gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">開始日</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">終了日</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* ワーカー指標 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">ワーカー指標</h3>
                    <div className="flex flex-wrap gap-2">
                        {WORKER_METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key, selectedWorker, setSelectedWorker)}
                                className={`px-3 py-1 text-sm rounded ${selectedWorker.includes(m.key)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 施設指標 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">施設指標</h3>
                    <div className="flex flex-wrap gap-2">
                        {FACILITY_METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key, selectedFacility, setSelectedFacility)}
                                className={`px-3 py-1 text-sm rounded ${selectedFacility.includes(m.key)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* マッチング指標 */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">マッチング指標</h3>
                    <div className="flex flex-wrap gap-2">
                        {MATCHING_METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => toggleMetric(m.key, selectedMatching, setSelectedMatching)}
                                className={`px-3 py-1 text-sm rounded ${selectedMatching.includes(m.key)
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleExport}
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
                >
                    {loading ? 'ダウンロード中...' : 'CSVダウンロード'}
                </button>
            </div>
        </div>
    );
}
