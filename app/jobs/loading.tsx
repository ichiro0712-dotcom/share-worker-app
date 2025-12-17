
export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
                {/* ヘッダースケルトン */}
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>

                {/* 検索バースケルトン */}
                <div className="h-12 bg-gray-200 rounded mb-6"></div>

                {/* 求人カードスケルトン */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white rounded-lg shadow p-4">
                            <div className="h-40 bg-gray-200 rounded mb-4"></div>
                            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
