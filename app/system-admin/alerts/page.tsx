'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users, Building2, Copy, Check, ChevronLeft, Search, Filter, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Alert {
    id: number;
    type: 'worker' | 'facility';
    name: string;
    alertType: 'low_rating' | 'high_cancel_rate';
    value: number;
    threshold: number;
}

export default function AlertsPage() {
    const searchParams = useSearchParams();
    const highlightType = searchParams?.get('type');
    const highlightId = searchParams?.get('id');
    const highlightAlertType = searchParams?.get('alertType');

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // フィルター
    const [filterType, setFilterType] = useState<'all' | 'worker' | 'facility'>('all');
    const [filterAlertType, setFilterAlertType] = useState<'all' | 'low_rating' | 'high_cancel_rate'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system-admin/alerts');
            if (res.ok) {
                const data = await res.json();
                setAlerts(data);
            }
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(text);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const getAlertMessage = (alert: Alert): string => {
        if (alert.alertType === 'low_rating') {
            return `平均評価 ${alert.value.toFixed(1)}（閾値: ${alert.threshold}以下）`;
        } else {
            return `キャンセル率 ${alert.value.toFixed(0)}%（閾値: ${alert.threshold}%超）`;
        }
    };

    const getAlertTypeLabel = (alertType: string): string => {
        return alertType === 'low_rating' ? '低評価' : '高キャンセル率';
    };

    // フィルター適用
    const filteredAlerts = alerts.filter(alert => {
        if (filterType !== 'all' && alert.type !== filterType) return false;
        if (filterAlertType !== 'all' && alert.alertType !== filterAlertType) return false;
        if (searchQuery && !alert.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // ハイライト判定
    const isHighlighted = (alert: Alert): boolean => {
        return (
            highlightType === alert.type &&
            highlightId === String(alert.id) &&
            highlightAlertType === alert.alertType
        );
    };

    return (
        <div className="p-8">
            {/* ヘッダー */}
            <div className="mb-6">
                <Link
                    href="/system-admin"
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
                >
                    <ChevronLeft className="w-4 h-4" />
                    ダッシュボードに戻る
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                            アラート一覧
                        </h1>
                        <p className="text-slate-500 mt-1">閾値を超えたワーカー・施設の一覧</p>
                    </div>
                    <button
                        onClick={fetchAlerts}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        更新
                    </button>
                </div>
            </div>

            {/* フィルターバー */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* 検索 */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="名前で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* タイプフィルター */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">すべて</option>
                            <option value="worker">ワーカー</option>
                            <option value="facility">施設</option>
                        </select>
                    </div>

                    {/* アラートタイプフィルター */}
                    <select
                        value={filterAlertType}
                        onChange={(e) => setFilterAlertType(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="all">すべてのアラート</option>
                        <option value="low_rating">低評価</option>
                        <option value="high_cancel_rate">高キャンセル率</option>
                    </select>
                </div>
            </div>

            {/* アラート一覧 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <AlertTriangle className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium">アラートはありません</p>
                        <p className="text-sm mt-1">閾値を超えたワーカー・施設がいない良好な状態です</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {/* ヘッダー */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-sm font-medium text-slate-600">
                            <div className="col-span-1">タイプ</div>
                            <div className="col-span-1">ID</div>
                            <div className="col-span-3">名前</div>
                            <div className="col-span-2">アラート種別</div>
                            <div className="col-span-3">詳細</div>
                            <div className="col-span-2">アクション</div>
                        </div>

                        {/* データ行 */}
                        {filteredAlerts.map((alert) => (
                            <div
                                key={`${alert.type}-${alert.id}-${alert.alertType}`}
                                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors ${
                                    isHighlighted(alert) ? 'bg-amber-50 border-l-4 border-amber-400' : ''
                                }`}
                            >
                                {/* タイプアイコン */}
                                <div className="col-span-1">
                                    {alert.type === 'worker' ? (
                                        <div className="flex items-center gap-1 text-blue-600">
                                            <Users className="w-4 h-4" />
                                            <span className="text-xs">W</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-indigo-600">
                                            <Building2 className="w-4 h-4" />
                                            <span className="text-xs">F</span>
                                        </div>
                                    )}
                                </div>

                                {/* ID + コピーボタン */}
                                <div className="col-span-1 flex items-center gap-1">
                                    <span className="font-mono text-sm text-slate-600">{alert.id}</span>
                                    <button
                                        onClick={() => copyToClipboard(String(alert.id))}
                                        className="p-1 hover:bg-slate-200 rounded transition-colors"
                                        title="IDをコピー"
                                    >
                                        {copiedId === String(alert.id) ? (
                                            <Check className="w-3 h-3 text-green-600" />
                                        ) : (
                                            <Copy className="w-3 h-3 text-slate-400" />
                                        )}
                                    </button>
                                </div>

                                {/* 名前 */}
                                <div className="col-span-3 font-medium text-slate-800 truncate">
                                    {alert.name}
                                </div>

                                {/* アラート種別バッジ */}
                                <div className="col-span-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        alert.alertType === 'low_rating'
                                            ? 'bg-orange-100 text-orange-700'
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        {getAlertTypeLabel(alert.alertType)}
                                    </span>
                                </div>

                                {/* 詳細 */}
                                <div className="col-span-3 text-sm text-slate-600">
                                    {getAlertMessage(alert)}
                                </div>

                                {/* アクション */}
                                <div className="col-span-2 flex items-center gap-2">
                                    <Link
                                        href={alert.type === 'worker' ? `/system-admin/workers?id=${alert.id}` : `/system-admin/facilities?id=${alert.id}`}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                    >
                                        詳細を見る
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 統計サマリー */}
            {!loading && filteredAlerts.length > 0 && (
                <div className="mt-6 grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <p className="text-sm text-slate-500">総アラート数</p>
                        <p className="text-2xl font-bold text-slate-800">{filteredAlerts.length}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <p className="text-sm text-slate-500">ワーカー</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {filteredAlerts.filter(a => a.type === 'worker').length}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <p className="text-sm text-slate-500">施設</p>
                        <p className="text-2xl font-bold text-indigo-600">
                            {filteredAlerts.filter(a => a.type === 'facility').length}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <p className="text-sm text-slate-500">低評価 / キャンセル</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {filteredAlerts.filter(a => a.alertType === 'low_rating').length} / {filteredAlerts.filter(a => a.alertType === 'high_cancel_rate').length}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
