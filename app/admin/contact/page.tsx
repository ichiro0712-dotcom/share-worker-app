'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Phone, Clock, Building2, Loader2, MessageSquare, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { getSystemTemplates } from '@/src/lib/content-actions';

interface SupportInfo {
    email: string;
    phone: string;
    department: string;
    hours: string;
}

export default function FacilityContactPage() {
    const router = useRouter();
    const { isAdmin, admin } = useAuth();
    const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin || !admin) {
            router.push('/admin/login');
            return;
        }

        const loadData = async () => {
            try {
                const templates = await getSystemTemplates();
                setSupportInfo({
                    email: templates.support_email || '',
                    phone: templates.support_phone || '',
                    department: templates.support_department || '',
                    hours: templates.support_hours || '',
                });
            } catch (error) {
                console.error('Failed to load support info:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [isAdmin, admin, router]);

    if (!isAdmin || !admin) {
        return null;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">お問い合わせ</h1>

                {/* サポート連絡先 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            サポートセンター
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1">
                            ご不明な点がございましたら、お気軽にお問い合わせください。
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* メールアドレス */}
                        {supportInfo?.email && (
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Mail className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">メールでのお問い合わせ</p>
                                    <a
                                        href={`mailto:${supportInfo.email}`}
                                        className="text-lg font-medium text-indigo-600 hover:underline"
                                    >
                                        {supportInfo.email}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* 電話番号 */}
                        {supportInfo?.phone && (
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Phone className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">お電話でのお問い合わせ</p>
                                    <a
                                        href={`tel:${supportInfo.phone.replace(/-/g, '')}`}
                                        className="text-lg font-medium text-indigo-600 hover:underline"
                                    >
                                        {supportInfo.phone}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* 担当部署 */}
                        {supportInfo?.department && (
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Building2 className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">担当部署</p>
                                    <p className="text-lg font-medium text-gray-900">
                                        {supportInfo.department}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 対応時間 */}
                        {supportInfo?.hours && (
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Clock className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">対応時間</p>
                                    <p className="text-lg font-medium text-gray-900">
                                        {supportInfo.hours}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 連絡先が未設定の場合 */}
                        {!supportInfo?.email && !supportInfo?.phone && (
                            <div className="text-center py-8 text-gray-500">
                                <p>サポート連絡先が設定されていません。</p>
                                <p className="text-sm mt-1">システム管理者にお問い合わせください。</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* FAQ案内 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-blue-900">
                                よくある質問もご確認ください
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                                お問い合わせの前に、FAQで解決できるかもしれません。
                            </p>
                            <Link
                                href="/admin/faq"
                                className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
                            >
                                FAQ・ご利用ガイドを見る →
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
