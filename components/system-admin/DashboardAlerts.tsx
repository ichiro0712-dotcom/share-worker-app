'use client';

import { AlertTriangle, Info, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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
}

export default function DashboardAlerts({ alerts }: DashboardAlertsProps) {
    const getAlertMessage = (alert: Alert): string => {
        if (alert.alertType === 'low_rating') {
            return `平均評価 ${alert.value.toFixed(1)}（閾値: ${alert.threshold}以下）`;
        } else {
            return `キャンセル率 ${alert.value.toFixed(0)}%（閾値: ${alert.threshold}%超）`;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    アラート
                </h2>
                <Link
                    href="/system-admin/content/notifications"
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
                >
                    <Settings className="w-4 h-4" />
                    設定
                </Link>
            </div>

            {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-slate-500 py-2">
                    <Info className="w-4 h-4" />
                    <span className="text-sm">アラートはありません</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((alert) => (
                        <Link
                            key={`${alert.type}-${alert.id}-${alert.alertType}`}
                            href={alert.detailUrl}
                            className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <div>
                                    <span className="font-medium text-slate-800">{alert.name}</span>
                                    <span className="text-sm text-slate-600 ml-2">
                                        - {getAlertMessage(alert)}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
