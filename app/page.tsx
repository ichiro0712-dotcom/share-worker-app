'use client';

import { useState } from 'react';
import { Filter, Calendar, ChevronDown } from 'lucide-react';
import { JobCard } from '@/components/job/JobCard';
import { DateSlider } from '@/components/job/DateSlider';
import { BottomNav } from '@/components/layout/BottomNav';
import { jobs } from '@/data/jobs';
import { facilities } from '@/data/facilities';

type TabType = 'all' | 'limited' | 'nominated';
type SortOrder = 'distance' | 'wage';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedDateIndex, setSelectedDateIndex] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>('distance');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  return (
    <div className="min-h-screen bg-white pb-20">
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
                  <span>{sortOrder === 'distance' ? '近い順' : '時給順'}</span>
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
      <div className="px-4 py-4 space-y-4">
        {jobs
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
          {currentPage} / {Math.ceil(jobs.length / itemsPerPage)}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(Math.ceil(jobs.length / itemsPerPage), prev + 1)
            )
          }
          disabled={currentPage === Math.ceil(jobs.length / itemsPerPage)}
          className={`px-4 py-2 rounded-lg ${
            currentPage === Math.ceil(jobs.length / itemsPerPage)
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
