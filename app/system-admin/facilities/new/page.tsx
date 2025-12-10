'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createFacilityWithAdmin } from '@/src/lib/system-actions';
import { SERVICE_TYPES } from '@/constants/serviceTypes';
import { ChevronLeft, Building2, User, Lock, Mail, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SystemAdminNewFacilityPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        corporationName: '',
        facilityName: '',
        facilityType: '',
        postalCode: '',
        prefecture: '',
        city: '',
        addressLine: '',
        phoneNumber: '',
        description: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Basic validation
            if (!formData.facilityName || !formData.corporationName || !formData.adminEmail || !formData.adminPassword) {
                toast.error('必須項目を入力してください');
                setLoading(false);
                return;
            }

            const result = await createFacilityWithAdmin(formData);

            if (result.success) {
                toast.success('施設と管理者を登録しました');
                router.push('/system-admin/facilities');
            } else {
                toast.error(result.error || '登録に失敗しました');
            }
        } catch (error) {
            console.error(error);
            toast.error('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/system-admin/facilities" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">新規施設登録</h1>
                    <p className="text-slate-500">施設情報と管理者アカウントを同時に作成します</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Facility Information */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                        施設基本情報
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">法人名 <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="corporationName"
                                value={formData.corporationName}
                                onChange={handleChange}
                                placeholder="例: 株式会社ケアサービス"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">施設名 <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="facilityName"
                                value={formData.facilityName}
                                onChange={handleChange}
                                placeholder="例: ケアホームひまわり"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">サービス種別 <span className="text-red-500">*</span></label>
                            <select
                                name="facilityType"
                                value={formData.facilityType}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            >
                                <option value="">選択してください</option>
                                {SERVICE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">電話番号</label>
                            <input
                                type="tel"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                placeholder="例: 03-1234-5678"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="md:col-span-2 space-y-4 pt-2 border-t border-slate-50">
                            <h3 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> 所在地
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">郵便番号</label>
                                    <input
                                        type="text"
                                        name="postalCode"
                                        value={formData.postalCode}
                                        onChange={handleChange}
                                        placeholder="例: 100-0001"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">都道府県 <span className="text-red-500">*</span></label>
                                    <select
                                        name="prefecture"
                                        value={formData.prefecture}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        <option value="東京都">東京都</option>
                                        <option value="神奈川県">神奈川県</option>
                                        <option value="埼玉県">埼玉県</option>
                                        <option value="千葉県">千葉県</option>
                                        {/* 他省略 - 追加可能 */}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">市区町村 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        placeholder="例: 千代田区"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">番地・建物名</label>
                                    <input
                                        type="text"
                                        name="addressLine"
                                        value={formData.addressLine}
                                        onChange={handleChange}
                                        placeholder="例: 丸の内1-1-1 シェアビル3F"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">施設説明 (オプション)</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Admin Information */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-600" />
                        管理者アカウント情報
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">管理者氏名 <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="adminName"
                                value={formData.adminName}
                                onChange={handleChange}
                                placeholder="例: 山田 太郎"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">電話番号</label>
                            <input
                                type="tel"
                                name="adminPhone"
                                value={formData.adminPhone}
                                onChange={handleChange}
                                placeholder="例: 090-1234-5678"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="email"
                                    name="adminEmail"
                                    value={formData.adminEmail}
                                    onChange={handleChange}
                                    placeholder="admin@example.com"
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">初期パスワード <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    name="adminPassword"
                                    value={formData.adminPassword}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">※8文字以上で設定してください</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <Link
                        href="/system-admin/facilities"
                        className="px-6 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        キャンセル
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? '登録中...' : '登録する'}
                    </button>
                </div>
            </form>
        </div>
    );
}
