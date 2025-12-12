'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Mail, Phone, Clock } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { getSystemTemplates } from '@/src/lib/content-actions';

export default function ContactPage() {
    const router = useRouter();
    const [supportInfo, setSupportInfo] = useState({
        email: 'support@s-works.example.com',
        phone: '0120-XXX-XXX', // 初期値
        department: 'カスタマーサポート部',
        hours: '平日: 9:00 〜 18:00',
    });

    useEffect(() => {
        const fetchSupport = async () => {
            try {
                const templates = await getSystemTemplates();
                setSupportInfo({
                    email: templates.support_email || 'support@s-works.example.com',
                    phone: templates.support_phone || '0120-XXX-XXX',
                    department: templates.support_department || 'カスタマーサポート部',
                    hours: templates.support_hours || '平日: 9:00 〜 18:00',
                });
            } catch (err) {
                console.error('Failed to fetch support info:', err);
            }
        };
        fetchSupport();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200">
                <div className="flex items-center px-4 py-3">
                    <button onClick={() => router.back()} className="mr-3">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-lg font-bold">お問い合わせ</h1>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* メールでのお問い合わせ */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Mail className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="font-bold text-gray-800">メールでのお問い合わせ</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        ご質問・ご要望がございましたら、以下のメールアドレスまでお気軽にお問い合わせください。
                    </p>
                    <a
                        href={`mailto:${supportInfo.email}`}
                        className="block w-full text-center px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                        {supportInfo.email}
                    </a>
                </div>

                {/* 電話でのお問い合わせ */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Phone className="w-5 h-5 text-green-600" />
                        </div>
                        <h2 className="font-bold text-gray-800">電話でのお問い合わせ</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        お急ぎの場合は、お電話でもお問い合わせいただけます。
                    </p>
                    <a
                        href={`tel:${supportInfo.phone}`}
                        className="block w-full text-center px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                        {supportInfo.phone}
                    </a>
                </div>

                {/* 受付時間 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <h2 className="font-bold text-gray-800">受付時間</h2>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                        <p>{supportInfo.hours}</p>
                        <p>土日祝: 休業</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                        ※ メールでのお問い合わせは24時間受け付けております。<br />
                        ※ お返事には2〜3営業日いただく場合がございます。
                    </p>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
