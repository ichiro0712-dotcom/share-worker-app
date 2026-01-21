export default function Loading() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-96 bg-slate-100 rounded animate-pulse" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="h-4 w-32 bg-slate-100 rounded animate-pulse mb-2" />
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="border-b border-slate-200 p-4">
                    <div className="flex gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-10 w-32 bg-slate-100 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-16 bg-slate-50 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
