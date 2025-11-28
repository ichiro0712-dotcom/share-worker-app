'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ChevronLeft, Check, X, Users, Calendar, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFacilityJobsWithApplicationCount,
  getFacilityApplications,
  updateApplicationStatus,
} from '@/src/lib/actions';

interface JobWithCount {
  id: number;
  title: string;
  workDate: string;
  startTime: string;
  endTime: string;
  hourlyWage: number;
  workContent: string[];
  status: string;
  appliedCount: number;
  totalApplications: number;
}

interface Application {
  id: number;
  status: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    phoneNumber: string;
    profileImage: string | null;
    qualifications: string[];
  };
  job: {
    id: number;
    title: string;
    workDate: string;
    startTime: string;
    endTime: string;
    hourlyWage: number;
    workContent: string[];
  };
}

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [jobs, setJobs] = useState<JobWithCount[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);

  // 認証チェック
  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // URLパラメータから状態を復元
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId) {
      setSelectedJobId(Number(jobId));
    } else {
      setSelectedJobId(null);
    }
  }, [searchParams]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.facilityId) return;

      setIsLoading(true);
      try {
        const [jobsData, applicationsData] = await Promise.all([
          getFacilityJobsWithApplicationCount(admin.facilityId),
          getFacilityApplications(admin.facilityId),
        ]);
        setJobs(jobsData);
        setApplications(applicationsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [admin?.facilityId]);

  // マッチング処理
  const handleMatch = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'SCHEDULED', admin.facilityId);

      if (result.success) {
        toast.success(result.message || 'マッチングが成立しました');
        // ローカル状態を更新
        setApplications((prev) =>
          prev.map((app) =>
            app.id === applicationId ? { ...app, status: 'SCHEDULED' } : app
          )
        );
        // 求人の応募数を更新
        const updatedApp = applications.find((a) => a.id === applicationId);
        if (updatedApp) {
          setJobs((prev) =>
            prev.map((job) =>
              job.id === updatedApp.job.id
                ? { ...job, appliedCount: job.appliedCount - 1 }
                : job
            )
          );
        }
      } else {
        toast.error(result.error || 'マッチングに失敗しました');
      }
    } catch (error) {
      console.error('Failed to match:', error);
      toast.error('マッチングに失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  // キャンセル処理
  const handleCancel = async (applicationId: number) => {
    if (!admin?.facilityId) return;

    if (!confirm('この応募をキャンセルしますか？')) return;

    setIsUpdating(applicationId);
    try {
      const result = await updateApplicationStatus(applicationId, 'CANCELLED', admin.facilityId);

      if (result.success) {
        toast.success(result.message || 'キャンセルしました');
        // ローカル状態を更新
        setApplications((prev) =>
          prev.map((app) =>
            app.id === applicationId ? { ...app, status: 'CANCELLED' } : app
          )
        );
        // 求人の応募数を更新
        const updatedApp = applications.find((a) => a.id === applicationId);
        if (updatedApp) {
          setJobs((prev) =>
            prev.map((job) =>
              job.id === updatedApp.job.id
                ? { ...job, appliedCount: job.appliedCount - 1 }
                : job
            )
          );
        }
      } else {
        toast.error(result.error || 'キャンセルに失敗しました');
      }
    } catch (error) {
      console.error('Failed to cancel:', error);
      toast.error('キャンセルに失敗しました');
    } finally {
      setIsUpdating(null);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPLIED':
        return { text: '応募中', color: 'bg-yellow-100 text-yellow-800' };
      case 'SCHEDULED':
        return { text: '勤務予定', color: 'bg-green-100 text-green-800' };
      case 'WORKING':
        return { text: '勤務中', color: 'bg-blue-100 text-blue-800' };
      case 'COMPLETED_PENDING':
        return { text: '完了・評価待ち', color: 'bg-purple-100 text-purple-800' };
      case 'COMPLETED_RATED':
        return { text: '完了', color: 'bg-gray-100 text-gray-800' };
      case 'CANCELLED':
        return { text: 'キャンセル', color: 'bg-red-100 text-red-800' };
      default:
        return { text: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // 求人一覧表示
  if (selectedJobId === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold">応募管理</h1>
            <p className="text-sm text-gray-600 mt-1">
              求人一覧 ({jobs.length}件)
            </p>
          </div>
        </div>

        <div className="p-4">
          {jobs.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">求人がありません</h3>
              <p className="text-sm text-gray-600 mb-4">
                求人を作成して、応募者を募集しましょう
              </p>
              <Link
                href="/admin/jobs"
                className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
              >
                求人管理へ
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => router.push(`/admin/applications?jobId=${job.id}`)}
                  className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-gray-900 mb-2">
                        {job.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{job.workDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {job.startTime}〜{job.endTime}
                          </span>
                        </div>
                        <span className="text-primary font-bold">
                          ¥{job.hourlyWage.toLocaleString()}/h
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-bold text-primary">
                          {job.appliedCount}
                        </span>
                        <span className="text-xs text-gray-600">件応募中</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
                      </div>
                      <span className="text-xs text-gray-500">
                        全{job.totalApplications}件
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ワーカー一覧表示
  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const filteredApplications = applications.filter(
    (app) => app.job.id === selectedJobId
  );
  const appliedApplications = filteredApplications.filter(
    (app) => app.status === 'APPLIED'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <button
            onClick={() => router.push('/admin/applications')}
            className="flex items-center gap-1 text-sm text-gray-600 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            求人一覧に戻る
          </button>
          <h1 className="text-lg font-bold">{selectedJob?.title}</h1>
          <p className="text-sm text-gray-600">
            {selectedJob?.workDate} {selectedJob?.startTime}〜{selectedJob?.endTime}
          </p>
        </div>
      </div>

      {/* 応募中の応募者 */}
      <div className="p-4">
        <h2 className="font-bold text-gray-900 mb-3">
          応募中 ({appliedApplications.length}件)
        </h2>

        {appliedApplications.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">応募者がいません</h3>
            <p className="text-sm text-gray-600">
              応募があるまでお待ちください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {appliedApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  {/* プロフィール画像 */}
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {app.user.profileImage ? (
                      <img
                        src={app.user.profileImage}
                        alt={app.user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* ワーカー情報 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{app.user.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${getStatusLabel(app.status).color
                          }`}
                      >
                        {getStatusLabel(app.status).text}
                      </span>
                    </div>

                    {/* 資格 */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {app.user.qualifications.map((qual, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                        >
                          {qual}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-gray-500">
                      応募日時: {formatDateTime(app.createdAt)}
                    </p>
                  </div>
                </div>

                {/* アクションボタン */}
                {app.status === 'APPLIED' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleMatch(app.id)}
                      disabled={isUpdating === app.id}
                      className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      マッチング
                    </button>
                    <button
                      onClick={() => handleCancel(app.id)}
                      disabled={isUpdating === app.id}
                      className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* その他のステータスの応募者 */}
        {filteredApplications.filter((app) => app.status !== 'APPLIED').length > 0 && (
          <div className="mt-6">
            <h2 className="font-bold text-gray-900 mb-3">その他</h2>
            <div className="space-y-3">
              {filteredApplications
                .filter((app) => app.status !== 'APPLIED')
                .map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {app.user.profileImage ? (
                          <img
                            src={app.user.profileImage}
                            alt={app.user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {app.user.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${getStatusLabel(app.status).color
                              }`}
                          >
                            {getStatusLabel(app.status).text}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
