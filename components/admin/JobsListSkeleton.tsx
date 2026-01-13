export function JobsListSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-lg p-4 shadow-sm animate-pulse border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 space-y-2">
                            <div className="h-5 bg-gray-200 rounded w-2/3" />
                            <div className="h-4 bg-gray-200 rounded w-1/3" />
                        </div>
                        <div className="w-20 h-7 bg-gray-200 rounded" />
                    </div>
                    <div className="flex gap-3">
                        <div className="h-6 bg-gray-200 rounded w-24" />
                        <div className="h-6 bg-gray-200 rounded w-20" />
                        <div className="h-6 bg-gray-200 rounded w-32" />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <div className="h-8 bg-gray-200 rounded w-16" />
                        <div className="h-8 bg-gray-200 rounded w-16" />
                    </div>
                </div>
            ))}
        </div>
    );
}
