'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Edit, Clock, JapaneseYen, MapPin, Users, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getJobById } from '@/src/lib/actions';

interface JobData {
  id: number;
  title: string;
  status: string;
  facility_id: number;
  start_time: string;
  end_time: string;
  break_time: string;
  hourly_wage: number;
  wage: number;
  transportation_fee: number;
  overview: string;
  work_content: string[];
  required_qualifications: string[];
  required_experience: string[];
  dresscode: string[];
  belongings: string[];
  tags: string[];
  images: string[];
  dresscode_images: string[];
  attachments: string[];
  workDates: Array<{
    id: number;
    work_date: string;
    recruitment_count: number;
    applied_count: number;
  }>;
  facility: {
    id: number;
    facility_name: string;
    address: string | null;
    prefecture: string | null;
    city: string | null;
    address_line: string | null;
  };
}

export default function AdminJobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const { admin, isAdmin, isAdminLoading } = useAuth();

  const [job, setJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 認証チェックとデータ取得
  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const fetchData = async () => {
      if (!admin.facilityId || !jobId) return;

      setIsLoading(true);
      try {
        const jobData = await getJobById(jobId);

        if (!jobData) {
          toast.error('求人が見つかりません');
          router.push('/admin/jobs');
          return;
        }

        // 別の施設の求人は閲覧不可
        if (jobData.facility_id !== admin.facilityId) {
          toast.error('この求人を閲覧する権限がありません');
          router.push('/admin/jobs');
          return;
        }

        setJob(jobData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, admin, isAdminLoading, router, jobId]);

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-primary"></div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  const statusLabel = {
    PUBLISHED: '公開中',
    DRAFT: '下書き',
    STOPPED: '停止中',
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
  }[job.status] || job.status;

  // パターン5（青ベース統一）用の色
  const statusBadgeColor = {
    PUBLISHED: 'bg-blue-600 text-white',
    DRAFT: 'bg-blue-100 text-blue-400',
    STOPPED: 'bg-blue-100 text-blue-400',
    COMPLETED: 'bg-blue-50 text-blue-300',
    CANCELLED: 'bg-red-100 text-red-600',
  }[job.status] || 'bg-blue-100 text-blue-400';

  const totalRecruitment = job.workDates?.reduce((sum, wd) => sum + wd.recruitment_count, 0) || 0;
  const totalApplied = job.workDates?.reduce((sum, wd) => sum + wd.applied_count, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">求人詳細</h1>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadgeColor}`}>
              {statusLabel}
            </span>
          </div>
          <Link
            href={`/admin/jobs/${jobId}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            編集
          </Link>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 基本情報 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">基本情報</h2>

            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
              <p className="text-sm text-gray-500 mt-1">求人ID: #{job.id}</p>
            </div>

            {/* 画像 */}
            {job.images && job.images.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-2">
                  {job.images.map((url, index) => (
                    <div key={index} className="relative aspect-video rounded overflow-hidden">
                      <Image
                        src={url}
                        alt={`求人画像 ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">勤務時間:</span>
                <span className="font-medium">{job.start_time} 〜 {job.end_time}</span>
                <span className="text-gray-500">(休憩 {job.break_time})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <JapaneseYen className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">時給:</span>
                <span className="font-medium text-primary">¥{job.hourly_wage.toLocaleString()}</span>
                <span className="text-gray-500">(日給 ¥{job.wage.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">交通費:</span>
                <span className="font-medium">¥{job.transportation_fee.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">応募状況:</span>
                <span className="font-medium">{totalApplied} / {totalRecruitment}人</span>
              </div>
            </div>
          </div>

          {/* 勤務日一覧 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              勤務日一覧 ({job.workDates?.length || 0}件)
            </h2>
            <div className="space-y-2">
              {job.workDates?.map((wd) => {
                const dateObj = new Date(wd.work_date);
                const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                const dayOfWeekIndex = dateObj.getDay();
                const dateColor = dayOfWeekIndex === 0 ? 'text-red-600' : dayOfWeekIndex === 6 ? 'text-blue-600' : 'text-gray-900';
                const isFull = wd.applied_count >= wd.recruitment_count;

                return (
                  <div
                    key={wd.id}
                    className={`flex items-center justify-between p-3 rounded border ${isFull ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className={`text-sm font-medium ${dateColor}`}>
                      {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        応募: <span className="font-bold">{wd.applied_count}</span> / {wd.recruitment_count}人
                      </span>
                      {isFull && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                          募集完了
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!job.workDates || job.workDates.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">勤務日が設定されていません</p>
              )}
            </div>
          </div>

          {/* 仕事内容 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              仕事内容
            </h2>

            {job.work_content && job.work_content.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">業務内容</h3>
                <div className="flex flex-wrap gap-2">
                  {job.work_content.map((content, index) => (
                    <span key={index} className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded">
                      {content}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.overview && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">仕事概要</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.overview}</p>
              </div>
            )}

            {job.required_qualifications && job.required_qualifications.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">必要資格</h3>
                <div className="flex flex-wrap gap-2">
                  {job.required_qualifications.map((qual, index) => (
                    <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                      {qual}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.required_experience && job.required_experience.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">必要経験・スキル</h3>
                <div className="flex flex-wrap gap-2">
                  {job.required_experience.map((exp, index) => (
                    <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                      {exp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.dresscode && job.dresscode.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">服装・身だしなみ</h3>
                <div className="flex flex-wrap gap-2">
                  {job.dresscode.map((item, index) => (
                    <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.belongings && job.belongings.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">持ち物</h3>
                <div className="flex flex-wrap gap-2">
                  {job.belongings.map((item, index) => (
                    <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {job.tags && job.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">タグ</h3>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag, index) => (
                    <span key={index} className="px-3 py-1 text-sm bg-primary/10 text-primary rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 施設情報 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">施設情報</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">施設名:</span>
                <span className="font-medium">{job.facility.facility_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {[
                    job.facility.prefecture,
                    job.facility.city,
                    job.facility.address_line
                  ].filter(Boolean).join(' ') || job.facility.address}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
