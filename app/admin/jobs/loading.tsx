
export default function Loading() {
    return (
        <div className="p-6">
            <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="p-4 border-b flex items-center space-x-4">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
