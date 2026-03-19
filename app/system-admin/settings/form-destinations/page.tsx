'use client';

import { useState, useEffect } from 'react';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import {
  Mail,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ShieldAlert,
  Settings,
  Users,
  Send,
  ToggleLeft,
  ToggleRight,
  Copy,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface FormDestination {
  id: number;
  name: string;
  email: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function FormDestinationsPage() {
  const { admin, isAdminLoading } = useSystemAuth();
  const isSuperAdmin = admin?.role === 'super_admin';

  const [destinations, setDestinations] = useState<FormDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', email: '', description: '' });

  const fetchDestinations = async () => {
    try {
      const res = await fetch('/api/system-admin/form-destinations');
      if (res.ok) {
        const data = await res.json();
        setDestinations(data);
      }
    } catch (error) {
      console.error('送信先の取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchDestinations();
  }, [isSuperAdmin]);

  const handleCreate = async () => {
    if (!form.name || !form.email) {
      toast.error('名前とメールアドレスは必須です');
      return;
    }

    try {
      const res = await fetch('/api/system-admin/form-destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success('送信先を追加しました');
        setShowModal(false);
        setForm({ name: '', email: '', description: '' });
        fetchDestinations();
      } else {
        const data = await res.json();
        toast.error(data.error || '追加に失敗しました');
      }
    } catch {
      toast.error('追加に失敗しました');
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !form.name || !form.email) {
      toast.error('名前とメールアドレスは必須です');
      return;
    }

    try {
      const res = await fetch('/api/system-admin/form-destinations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      });

      if (res.ok) {
        toast.success('送信先を更新しました');
        setEditingId(null);
        setShowModal(false);
        setForm({ name: '', email: '', description: '' });
        fetchDestinations();
      } else {
        const data = await res.json();
        toast.error(data.error || '更新に失敗しました');
      }
    } catch {
      toast.error('更新に失敗しました');
    }
  };

  const handleToggleActive = async (dest: FormDestination) => {
    try {
      const res = await fetch('/api/system-admin/form-destinations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dest.id, is_active: !dest.is_active }),
      });

      if (res.ok) {
        toast.success(dest.is_active ? '無効にしました' : '有効にしました');
        fetchDestinations();
      }
    } catch {
      toast.error('更新に失敗しました');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この送信先を無効化しますか？（フォーム連携を維持するため、データは保持されます）')) return;

    try {
      const res = await fetch(`/api/system-admin/form-destinations?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('送信先を無効化しました');
        fetchDestinations();
      } else {
        const data = await res.json();
        toast.error(data.error || '無効化に失敗しました');
      }
    } catch {
      toast.error('無効化に失敗しました');
    }
  };

  const openEditModal = (dest: FormDestination) => {
    setEditingId(dest.id);
    setForm({ name: dest.name, email: dest.email, description: dest.description || '' });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ name: '', email: '', description: '' });
    setShowModal(true);
  };

  const copyId = (id: number) => {
    navigator.clipboard.writeText(String(id));
    toast.success('IDをコピーしました');
  };

  // super_admin以外はアクセス拒否
  if (!isAdminLoading && !isSuperAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">アクセス権限がありません</h1>
        <p className="text-slate-500">このページは特権管理者(super_admin)のみアクセスできます。</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-gray-600" />
        <h1 className="text-2xl font-bold">システム設定</h1>
      </div>

      {/* サブメニュー */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/system-admin/settings/system"
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Settings className="w-4 h-4" />
          システム設定
        </Link>
        <Link
          href="/system-admin/settings/admins"
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Users className="w-4 h-4" />
          管理者管理
        </Link>
        <Link
          href="/system-admin/settings/form-destinations"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
        >
          <Send className="w-4 h-4" />
          フォーム送信先管理
        </Link>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          LPやお問い合わせフォームからのメール送信先を管理します。フォームではIDを指定することで安全にメール送信できます。
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          送信先を追加
        </button>
      </div>

      {/* 送信先一覧 */}
      {destinations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">送信先がまだ登録されていません</p>
          <button
            onClick={openCreateModal}
            className="mt-4 text-primary text-sm font-medium hover:underline"
          >
            最初の送信先を追加する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {destinations.map((dest) => (
            <div
              key={dest.id}
              className={`bg-white rounded-lg shadow-sm border p-4 ${
                dest.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{dest.name}</h3>
                    {!dest.is_active && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        無効
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Mail className="w-3.5 h-3.5" />
                    {dest.email}
                  </div>
                  {dest.description && (
                    <p className="text-sm text-gray-500 mt-1">{dest.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => copyId(dest.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      title="IDをコピー（フォーム連携用）"
                    >
                      <Copy className="w-3 h-3" />
                      ID: {dest.id}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(dest)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title={dest.is_active ? '無効にする' : '有効にする'}
                  >
                    {dest.is_active ? (
                      <ToggleRight className="w-5 h-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(dest)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="編集"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dest.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-800 mb-2">フォーム連携について</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• フォームからは送信先の<strong>ID</strong>を指定してメールを送信します（メールアドレスは直接渡しません）</li>
          <li>• サーバー側でIDからメールアドレスを解決するため、スパム悪用のリスクがありません</li>
          <li>• 無効にした送信先はフォームから利用できなくなります</li>
          <li>• 送信先を削除すると、その送信先を使用しているフォームからメール送信ができなくなります</li>
        </ul>
      </div>

      {/* 追加・編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? '送信先を編集' : '送信先を追加'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  送信先名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: 運営事務局、看護師採用担当"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="例: info@tastas.work"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明（任意）
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="この送信先の用途を入力"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={editingId ? handleUpdate : handleCreate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Check className="w-4 h-4" />
                {editingId ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
