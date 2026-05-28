'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminJobTemplates, duplicateJobTemplate, deleteJobTemplate } from '@/src/lib/actions';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  PUBLISHED: '公開中',
  STOPPED: '停止中',
  WORKING: '稼働中',
  COMPLETED: '完了',
  CANCELLED: 'キャンセル',
};

interface BlockingJob {
  id: number;
  title: string;
  status: string;
}

interface BlockingInfo {
  templateName: string;
  jobs: BlockingJob[];
  count: number;
}

interface TemplateData {
  id: number;
  usageCount: number;
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
  const { showDebugError } = useDebugError();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockingInfo, setBlockingInfo] = useState<BlockingInfo | null>(null);

  const handleDeleteTemplate = async (template: TemplateData) => {
    if (!admin?.facilityId) {
      toast.error('施設情報が取得できませんでした。再ログインしてください');
      return;
    }
    // 未使用テンプレートのみ破壊的確認ダイアログを表示。
    // 使用中の場合はサーバー側でブロックされるため、確認なしで呼び出し詳細を提示する。
    if (template.usageCount === 0) {
      if (!confirm(`「${template.name}」を削除しますか？`)) {
        return;
      }
    }
    try {
      const result = await deleteJobTemplate(template.id, admin.facilityId);
      if (result.success) {
        toast.success('テンプレートを削除しました');
        const data = await getAdminJobTemplates(admin.facilityId);
        setTemplates(data);
        return;
      }
      if ('blockingJobs' in result && result.blockingJobs) {
        setBlockingInfo({
          templateName: template.name,
          jobs: result.blockingJobs,
          count: ('blockingJobCount' in result && result.blockingJobCount) || result.blockingJobs.length,
        });
        return;
      }
      toast.error(result.error || 'テンプレートの削除に失敗しました');
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('テンプレートの削除に失敗しました');
    }
  };

  useEffect(() => {
    if (isAdminLoading) return;
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
  }, [isAdmin, admin, isAdminLoading, router]);

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* ヘッダー Skeleton */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            </div>
            <div className="h-9 bg-gray-200 rounded w-36 animate-pulse" />
          </div>
        </div>

        {/* テンプレート一覧 Skeleton */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 animate-pulse" />
                <div className="flex justify-between items-center mt-4">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
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
                      {template.usageCount > 0 && (
                        <span className="inline-flex items-center mt-2 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded border border-amber-200">
                          使用中の求人: {template.usageCount}件
                        </span>
                      )}
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
                        onClick={async () => {
                          if (!admin?.facilityId) return;
                          const result = await duplicateJobTemplate(template.id, admin.facilityId);
                          if (result.success) {
                            toast.success('テンプレートを複製しました');
                            // テンプレート一覧を再取得
                            const data = await getAdminJobTemplates(admin.facilityId);
                            setTemplates(data);
                          } else {
                            toast.error(result.error || 'テンプレートの複製に失敗しました');
                          }
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="複製"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className={
                          template.usageCount > 0
                            ? 'p-2 text-gray-400 hover:bg-gray-100 rounded transition-colors'
                            : 'p-2 text-red-600 hover:bg-red-50 rounded transition-colors'
                        }
                        title={
                          template.usageCount > 0
                            ? '使用中の求人があるため削除できません（クリックで詳細）'
                            : '削除'
                        }
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

      {/* 削除ブロック詳細モーダル */}
      {blockingInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBlockingInfo(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-900 mb-2">
              テンプレートを削除できません
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              「{blockingInfo.templateName}」は下記の求人で使用中のため削除できません。
              先に該当求人を削除または停止してください。
            </p>
            <div className="max-h-60 overflow-y-auto rounded border border-gray-200 divide-y divide-gray-100">
              {blockingInfo.jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-800 truncate mr-2">{job.title}</span>
                  <span className="shrink-0 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    {JOB_STATUS_LABELS[job.status] ?? job.status}
                  </span>
                </div>
              ))}
            </div>
            {blockingInfo.count > blockingInfo.jobs.length && (
              <p className="text-xs text-gray-500 mt-2">
                ほか{blockingInfo.count - blockingInfo.jobs.length}件
              </p>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setBlockingInfo(null)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
