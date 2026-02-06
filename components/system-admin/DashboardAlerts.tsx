'use client';

import { useState } from 'react';
import { AlertTriangle, Info, Settings, ChevronRight, Copy, Check, Users, Building2, ExternalLink, Mail } from 'lucide-react';
import Link from 'next/link';
import type { SystemAlert } from '@/src/lib/system-actions';

interface Alert {
    id: number;
    type: 'worker' | 'facility';
    name: string;
    alertType: 'low_rating' | 'high_cancel_rate';
    value: number;
    threshold: number;
    detailUrl: string;
}

interface DashboardAlertsProps {
    alerts: Alert[];
    systemAlerts?: SystemAlert[];
}

export default function DashboardAlerts({ alerts, systemAlerts = [] }: DashboardAlertsProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const warningSystemAlerts = systemAlerts.filter(a => a.severity !== 'info');
    const totalAlertCount = alerts.length + warningSystemAlerts.length;

    const getAlertMessage = (alert: Alert): string => {
        if (alert.alertType === 'low_rating') {
            return `平均評価 ${alert.value.toFixed(1)}（閾値: ${alert.threshold}以下）`;
        } else {
            return `キャンセル率 ${alert.value.toFixed(0)}%（閾値: ${alert.threshold}%超）`;
        }
    };

    const copyToClipboard = async (e: React.MouseEvent, text: string) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(text);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const getAlertDetailUrl = (alert: Alert): string => {
        return `/system-admin/alerts?type=${alert.type}&id=${alert.id}&alertType=${alert.alertType}`;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    アラート
                    {totalAlertCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
                            {totalAlertCount}
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-3">
                    <Link
                        href="/system-admin/alerts"
                        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        一覧を見る
                    </Link>
                    <Link
                        href="/system-admin/content/notifications"
                        className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        設定
                    </Link>
                </div>
            </div>

            {/* システムアラート（メール送信数など） */}
            {systemAlerts.length > 0 && (
                <div className="space-y-2 mb-3">
                    {systemAlerts.map((alert) => {
                        const styles = {
                            critical: {
                                bg: 'bg-red-50 border-red-200',
                                icon: 'text-red-600',
                                mailIcon: 'text-red-500',
                                title: 'text-red-800',
                                message: 'text-red-600',
                                bar: 'bg-red-500',
                            },
                            warning: {
                                bg: 'bg-yellow-50 border-yellow-200',
                                icon: 'text-yellow-600',
                                mailIcon: 'text-yellow-500',
                                title: 'text-yellow-800',
                                message: 'text-yellow-600',
                                bar: 'bg-yellow-500',
                            },
                            info: {
                                bg: 'bg-slate-50 border-slate-200',
                                icon: 'text-slate-400',
                                mailIcon: 'text-slate-400',
                                title: 'text-slate-700',
                                message: 'text-slate-500',
                                bar: 'bg-blue-400',
                            },
                        }[alert.severity];

                        return (
                            <div
                                key={alert.id}
                                className={`p-3 rounded-lg border ${styles.bg}`}
                            >
                                <div className="flex items-center gap-3">
                                    {alert.severity !== 'info' && (
                                        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${styles.icon}`} />
                                    )}
                                    <Mail className={`w-4 h-4 flex-shrink-0 ${styles.mailIcon}`} />
                                    <div className="flex-1 min-w-0">
                                        <span className={`font-medium text-sm ${styles.title}`}>
                                            {alert.title}
                                        </span>
                                        <p className={`text-sm ${styles.message}`}>
                                            {alert.message}
                                        </p>
                                        <div className="mt-1.5 w-full max-w-xs h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${styles.bar}`}
                                                style={{ width: `${Math.min((alert.value / alert.limit) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ワーカー/施設アラート */}
            {alerts.length === 0 && systemAlerts.length === 0 ? (
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Info className="w-4 h-4" />
                        <span className="text-sm">アラートはありません</span>
                    </div>
                    <Link
                        href="/system-admin/alerts"
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                        過去のアラートを確認 →
                    </Link>
                </div>
            ) : alerts.length > 0 ? (
                <div className="space-y-2">
                    {alerts.slice(0, 5).map((alert) => (
                        <Link
                            key={`${alert.type}-${alert.id}-${alert.alertType}`}
                            href={getAlertDetailUrl(alert)}
                            className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                {/* タイプアイコン */}
                                {alert.type === 'worker' ? (
                                    <Users className="w-4 h-4 text-blue-500" />
                                ) : (
                                    <Building2 className="w-4 h-4 text-indigo-500" />
                                )}
                                <div className="flex items-center gap-2">
                                    {/* ID + コピーボタン */}
                                    <button
                                        onClick={(e) => copyToClipboard(e, String(alert.id))}
                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-600 hover:bg-slate-200 transition-colors"
                                        title="IDをコピー"
                                    >
                                        {alert.id}
                                        {copiedId === String(alert.id) ? (
                                            <Check className="w-3 h-3 text-green-600" />
                                        ) : (
                                            <Copy className="w-3 h-3" />
                                        )}
                                    </button>
                                    <span className="font-medium text-slate-800">{alert.name}</span>
                                    <span className="text-sm text-slate-600">
                                        - {getAlertMessage(alert)}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        </Link>
                    ))}
                    {alerts.length > 5 && (
                        <Link
                            href="/system-admin/alerts"
                            className="block text-center py-2 text-sm text-indigo-600 hover:text-indigo-800"
                        >
                            他 {alerts.length - 5} 件のアラートを見る →
                        </Link>
                    )}
                </div>
            ) : null}
        </div>
    );
}
