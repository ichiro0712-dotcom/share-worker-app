export default function Loading() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
        <div className="h-4 w-64 bg-slate-200 rounded animate-pulse"></div>
      </div>

      {/* KPIカードスケルトン */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm p-4 border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse"></div>
              <div>
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="h-6 w-20 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* フィルタースケルトン */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-slate-100">
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>

      {/* テーブルスケルトン */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-100 rounded mb-2 animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
