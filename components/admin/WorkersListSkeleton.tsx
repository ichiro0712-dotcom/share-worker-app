export function WorkersListSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-lg p-6 border border-gray-200 animate-pulse">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 bg-gray-200 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-4">
                                <div className="h-6 bg-gray-200 rounded w-1/4" />
                                <div className="h-4 bg-gray-200 rounded w-1/6" />
                                <div className="h-4 bg-gray-200 rounded w-1/3" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-4 bg-gray-200 rounded w-20" />
                                <div className="h-4 bg-gray-200 rounded w-20" />
                                <div className="h-4 bg-gray-200 rounded w-20" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-6 bg-gray-200 rounded w-16" />
                                <div className="h-6 bg-gray-200 rounded w-16" />
                                <div className="h-6 bg-gray-200 rounded w-16" />
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                            </div>
                            <div className="h-4 bg-gray-200 rounded w-24" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
