'use client';

import { useState } from 'react';
import { Filter, Calendar, ChevronDown, Info, CheckCircle2, Clock } from 'lucide-react';
import { JobCard } from '@/components/job/JobCard';
import { DateSlider } from '@/components/job/DateSlider';
import { BottomNav } from '@/components/layout/BottomNav';
import { jobs } from '@/data/jobs';
import { facilities } from '@/data/facilities';

type TabType = 'all' | 'limited' | 'nominated';
type SortOrder = 'distance' | 'wage' | 'deadline';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedDateIndex, setSelectedDateIndex] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>('distance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImplementationStatus, setShowImplementationStatus] = useState(true);

  const itemsPerPage = 20;

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'limited' || tab === 'nominated') {
      window.location.href = `/under-construction?page=${tab}`;
    }
  };

  const handleFilterClick = () => {
    alert('未定：フィルター機能はPhase 2で実装予定です');
  };

  const handleWorkDateClick = () => {
    alert('未定：働ける日カレンダーはPhase 2で実装予定です');
  };

  // ソート処理
  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortOrder === 'wage') {
      // 時給順（高い順）
      return b.hourlyWage - a.hourlyWage;
    } else if (sortOrder === 'deadline') {
      // 締切順（締切が近い順）
      const deadlineA = new Date(a.deadline).getTime();
      const deadlineB = new Date(b.deadline).getTime();
      return deadlineA - deadlineB;
    }
    // distance（近い順）はデフォルトの順序を維持
    return 0;
  });

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* 実装状況パネル */}
      {showImplementationStatus && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-blue-900">実装状況（Phase 1 テストバージョン）</h3>
              </div>
              <button
                onClick={() => setShowImplementationStatus(false)}
                className="text-blue-600 text-xs hover:text-blue-800"
              >
                閉じる
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-3">
              {/* 実装済み機能 */}
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <h4 className="text-xs font-semibold text-green-900">✓ 実装済み機能</h4>
                </div>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• 求人一覧表示（50件のダミーデータ）</li>
                  <li>• 並び替え機能（近い順/時給順/締切順）</li>
                  <li>• ページネーション</li>
                  <li>• 求人詳細ページ表示</li>
                  <li>• 画像カルーセル</li>
                  <li>• レビュー表示</li>
                  <li>• 施設情報表示</li>
                  <li>• 申し込み完了ページ</li>
                  <li>• レスポンシブデザイン</li>
                  <li>• 管理画面（案件テンプレート管理）</li>
                </ul>
              </div>

              {/* 未実装機能 */}
              <div className="bg-white rounded-lg p-3 border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <h4 className="text-xs font-semibold text-orange-900">○ Phase 2以降で実装予定</h4>
                </div>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• ユーザー認証（ログイン/会員登録）</li>
                  <li>• 詳細フィルター機能</li>
                  <li>• 働ける日カレンダー選択</li>
                  <li>• ブックマーク/お気に入り保存</li>
                  <li>• あとで見る機能</li>
                  <li>• 限定・指名求人機能</li>
                  <li>• メッセージ機能</li>
                  <li>• 仕事管理機能</li>
                  <li>• マイページ</li>
                  <li>• 実際の応募処理（データベース連携）</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-blue-700 mt-3">
              ※ 現在はダミーデータを使用したUIプロトタイプです。実際の求人データやユーザー認証機能はPhase 2以降で実装します。
            </p>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        {/* タブ */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabClick('all')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${
              activeTab === 'all' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            全体
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('limited')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${
              activeTab === 'limited' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            限定
            {activeTab === 'limited' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleTabClick('nominated')}
            className={`flex-1 py-3 text-sm relative flex items-center justify-center ${
              activeTab === 'nominated' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            指名
            {activeTab === 'nominated' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* フィルターエリア */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleWorkDateClick}
              className="flex items-center gap-2 text-sm"
            >
              <Calendar className="w-5 h-5" />
              <span>働ける日</span>
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={handleFilterClick}
                className="flex items-center gap-1 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>絞り込み</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-1 text-sm"
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {sortOrder === 'distance' ? '近い順' : sortOrder === 'wage' ? '時給順' : '締切順'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showSortMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        setSortOrder('distance');
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortOrder === 'distance' ? 'text-primary' : ''
                      }`}
                    >
                      近い順
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('wage');
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortOrder === 'wage' ? 'text-primary' : ''
                      }`}
                    >
                      時給順
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('deadline');
                        setShowSortMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortOrder === 'deadline' ? 'text-primary' : ''
                      }`}
                    >
                      締切順
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 日付スライダー */}
          <DateSlider
            selectedDateIndex={selectedDateIndex}
            onDateSelect={setSelectedDateIndex}
          />
        </div>
      </div>

      {/* 求人リスト */}
      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4">
        {sortedJobs
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map((job) => {
            const facility = facilities.find((f) => f.id === job.facilityId);
            if (!facility) return null;

            return <JobCard key={job.id} job={job} facility={facility} />;
          })}
      </div>

      {/* ページネーション */}
      <div className="px-4 py-4 flex items-center justify-center gap-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded-lg ${
            currentPage === 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          ← 前へ
        </button>
        <span className="text-sm text-gray-600">
          {currentPage} / {Math.ceil(sortedJobs.length / itemsPerPage)}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(Math.ceil(sortedJobs.length / itemsPerPage), prev + 1)
            )
          }
          disabled={currentPage === Math.ceil(sortedJobs.length / itemsPerPage)}
          className={`px-4 py-2 rounded-lg ${
            currentPage === Math.ceil(sortedJobs.length / itemsPerPage)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          次へ →
        </button>
      </div>

      {/* 下部ナビゲーション */}
      <BottomNav />
    </div>
  );
}
