'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminJobTemplates } from '@/src/lib/actions';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface TemplateData {
  id: number;
  name: string;
  title: string;
  startTime: string;
  endTime: string;
  breakTime: number;
  hourlyWage: number;
  transportationFee: number;
  recruitmentCount: number;
  qualifications: string[];
  description: string | null;
  skills: string[];
  dresscode: string[];
  belongings: string[];
  tags: string[];
  images: string[];
  notes: string | null;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    // テンプレートを取得
    const fetchTemplates = async () => {
      if (admin.facilityId) {
        try {
          const data = await getAdminJobTemplates(admin.facilityId);
          setTemplates(data);
        } catch (error) {
          console.error('Failed to fetch templates:', error);
          toast.error('テンプレートの取得に失敗しました');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    fetchTemplates();
  }, [isAdmin, admin, router]);

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
      <div className="h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">テンプレート管理</h1>
              <p className="text-xs text-gray-500 mt-1">
                {templates.length}件のテンプレート
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/jobs/templates/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              テンプレート作成
            </button>
          </div>
        </div>

        {/* テンプレートリスト */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 max-w-6xl mx-auto">
            {templates.length === 0 ? (
              <div className="bg-white rounded border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">テンプレートが見つかりませんでした</p>
              </div>
            ) : (
              templates.map((template) => {
                return (
                  <div
                    key={template.id}
                    className="bg-white rounded border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-1">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">{template.title}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>時給: ¥{template.hourlyWage.toLocaleString()}</span>
                          <span>•</span>
                          <span>{template.startTime}〜{template.endTime}</span>
                          <span>•</span>
                          <span>募集: {template.recruitmentCount}名</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/jobs/templates/${template.id}/edit`)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="編集"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            // 複製機能（ダミー）
                            toast.success('テンプレートを複製しました');
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="複製"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('このテンプレートを削除しますか？')) {
                              toast.success('テンプレートを削除しました');
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* タグ */}
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {template.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
  );
}
