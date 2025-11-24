'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { facilities } from '@/data/facilities';
import { jobs } from '@/data/jobs';
import Link from 'next/link';
import {
  AlertCircle,
  Users,
  Calendar,
  TrendingUp,
  Clock,
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();

  // 管理している施設の求人を取得
  const facilityJobs = useMemo(() => {
    if (!admin) return [];
    return jobs.filter((job) => job.facilityId === admin.facilityId);
  }, [admin]);

  // タスク計算
  const tasks = useMemo(() => {
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    return {
      // 締切が近い求人（3日以内）
      deadlineSoon: facilityJobs.filter((job) => {
        const deadline = new Date(job.deadline);
        return deadline > today && deadline <= threeDaysLater;
      }),
      // 応募が少ない求人（応募率50%未満）
      lowApplications: facilityJobs.filter((job) => {
        const isActive = new Date(job.deadline) > today;
        const applicationRate = job.recruitmentCount > 0
          ? (job.appliedCount / job.recruitmentCount) * 100
          : 0;
        return isActive && applicationRate < 50;
      }),
      // 新しい応募（ダミー - 実際はapplication dataから取得）
      newApplications: facilityJobs.filter((job) => job.appliedCount > 0).slice(0, 5),
      // 募集中の求人
      activeJobs: facilityJobs.filter((job) => new Date(job.deadline) > today),
      // 本日勤務予定（ダミー）
      todayJobs: facilityJobs.filter((job) => {
        const workDate = new Date(job.workDate);
        const todayDate = new Date();
        return workDate.toDateString() === todayDate.toDateString();
      }),
    };
  }, [facilityJobs]);

  // 統計情報
  const stats = useMemo(() => ({
    totalJobs: facilityJobs.length,
    activeJobs: tasks.activeJobs.length,
    totalApplications: facilityJobs.reduce((sum, job) => sum + job.appliedCount, 0),
    todayJobs: tasks.todayJobs.length,
  }), [facilityJobs, tasks]);

  // ログインしていない、または管理者でない場合はログインページへリダイレクト
  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

  // ログインしていない場合は何も表示しない
  if (!isAdmin || !admin) {
    return null;
  }

  // 管理している施設の情報を取得
  const facility = facilities.find((f) => f.id === admin.facilityId);

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ダッシュボード</h1>
        <p className="text-sm text-gray-600">{facility?.name}</p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">総求人数</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalJobs}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">募集中</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.activeJobs}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">総応募数</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalApplications}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">本日勤務予定</span>
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.todayJobs}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 左カラム */}
        <div className="space-y-6">
          {/* 締切が近い求人 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <h2 className="text-sm font-bold">締切が近い求人</h2>
              </div>
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {tasks.deadlineSoon.length}件
              </span>
            </div>
            <div className="p-4">
              {tasks.deadlineSoon.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">締切が近い求人はありません</p>
              ) : (
                <div className="space-y-2">
                  {tasks.deadlineSoon.map((job) => (
                    <Link
                      key={job.id}
                      href={`/admin/jobs/${job.id}/edit`}
                      className="block p-2 border border-orange-100 rounded hover:bg-orange-50 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-900 mb-1">{job.title}</div>
                      <div className="text-xs text-gray-600">
                        締切: {new Date(job.deadline).toLocaleString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 応募が少ない求人 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-red-600" />
                <h2 className="text-sm font-bold">応募が少ない求人</h2>
              </div>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {tasks.lowApplications.length}件
              </span>
            </div>
            <div className="p-4">
              {tasks.lowApplications.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">すべての求人で十分な応募があります</p>
              ) : (
                <div className="space-y-2">
                  {tasks.lowApplications.slice(0, 5).map((job) => {
                    const applicationRate = Math.round((job.appliedCount / job.recruitmentCount) * 100);
                    return (
                      <Link
                        key={job.id}
                        href={`/admin/jobs/${job.id}/edit`}
                        className="block p-2 border border-red-100 rounded hover:bg-red-50 transition-colors"
                      >
                        <div className="text-xs font-medium text-gray-900 mb-1">{job.title}</div>
                        <div className="text-xs text-red-600">
                          応募: {job.appliedCount}/{job.recruitmentCount}名 ({applicationRate}%)
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右カラム */}
        <div className="space-y-6">
          {/* 新しい応募 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-bold">新しい応募</h2>
              </div>
              <Link
                href="/admin/workers"
                className="text-xs text-blue-600 hover:underline"
              >
                すべて見る
              </Link>
            </div>
            <div className="p-4">
              {tasks.newApplications.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">新しい応募はありません</p>
              ) : (
                <div className="space-y-2">
                  {tasks.newApplications.map((job) => (
                    <Link
                      key={job.id}
                      href={`/admin/workers?jobId=${job.id}`}
                      className="block p-2 border border-green-100 rounded hover:bg-green-50 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-900 mb-1">{job.title}</div>
                      <div className="text-xs text-green-600">
                        {job.appliedCount}名が応募
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 本日の勤務予定 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold">本日の勤務予定</h2>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {tasks.todayJobs.length}件
              </span>
            </div>
            <div className="p-4">
              {tasks.todayJobs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">本日の勤務予定はありません</p>
              ) : (
                <div className="space-y-2">
                  {tasks.todayJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-2 border border-blue-100 rounded bg-blue-50"
                    >
                      <div className="text-xs font-medium text-gray-900 mb-1">{job.title}</div>
                      <div className="text-xs text-gray-600">
                        {job.startTime}〜{job.endTime} / {job.appliedCount}名確定
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
